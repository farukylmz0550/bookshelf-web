// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — extension ZIP install/uninstall service.
//
// Trust model:
//   • theme/ui packages: any signed-in user may install them for themselves
//   • server packages: admin-only, declarative HTTP providers only
//   • a package is written to <data>/extensions/<slug>/<version>; the DB row
//     mirrors the validated manifest for listing and permission checks.

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { ManifestError, parseManifestJson, type ExtensionManifest } from "./manifest";
import { extensionInstallPath, isInside } from "./paths";

const MAX_ZIP_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 200;

export class ExtensionError extends Error {}

export interface InstalledExtension {
  id: string;
  slug: string;
  name: string;
  version: string;
  type: string;
  scope: string;
  manifest: ExtensionManifest;
  installPath: string;
  enabled: boolean;
  isDefaultTheme: boolean;
  settings: Record<string, unknown>;
}

function parseSettings(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toInstalled(row: {
  id: string;
  slug: string;
  name: string;
  version: string;
  type: string;
  scope: string;
  manifest: string;
  installPath: string;
  enabled: boolean;
  isDefaultTheme: boolean;
  settings: string | null;
}): InstalledExtension {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    type: row.type,
    scope: row.scope,
    manifest: parseManifestJson(row.manifest),
    installPath: row.installPath,
    enabled: row.enabled,
    isDefaultTheme: row.isDefaultTheme,
    settings: parseSettings(row.settings),
  };
}

interface ZipEntry {
  name: string;
  contents: Buffer;
}

async function readZip(buffer: Buffer): Promise<{ manifest: ExtensionManifest; files: ZipEntry[] }> {
  if (buffer.byteLength > MAX_ZIP_BYTES) throw new ExtensionError("Package exceeds the 5 MB limit");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ExtensionError("Package is not a valid ZIP file");
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length === 0) throw new ExtensionError("Package is empty");
  if (entries.length > MAX_FILES) throw new ExtensionError(`Package has more than ${MAX_FILES} files`);

  const manifestEntry =
    entries.find((f) => f.name === "manifest.json") ?? entries.find((f) => /^[^/]+\/manifest\.json$/.test(f.name));
  if (!manifestEntry) throw new ExtensionError("Package must contain manifest.json at its root");
  const prefix = manifestEntry.name === "manifest.json" ? "" : manifestEntry.name.slice(0, -"manifest.json".length);

  let total = 0;
  const files: ZipEntry[] = [];
  for (const entry of entries) {
    const rawName = entry.name.replace(/\\/g, "/");
    if (!rawName.startsWith(prefix)) throw new ExtensionError(`Unexpected file outside package root: ${rawName}`);
    const name = rawName.slice(prefix.length);
    if (!name) continue;
    if (name.startsWith("/") || name.split("/").some((part) => part === ".." || part === "" || part === ".")) {
      throw new ExtensionError(`Unsafe path in package: ${rawName}`);
    }
    if (name.length > 200) throw new ExtensionError(`Path too long: ${name}`);
    const contents = await entry.async("nodebuffer");
    total += contents.byteLength;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new ExtensionError("Uncompressed package exceeds the 15 MB limit");
    files.push({ name, contents });
  }

  const manifestFile = files.find((f) => f.name === "manifest.json");
  if (!manifestFile) throw new ExtensionError("manifest.json is missing after extraction");
  let manifest: ExtensionManifest;
  try {
    manifest = parseManifestJson(manifestFile.contents.toString("utf8"));
  } catch (error) {
    if (error instanceof ManifestError) throw new ExtensionError(error.message);
    throw error;
  }
  return { manifest, files };
}

async function writePackage(manifest: ExtensionManifest, files: ZipEntry[]): Promise<string> {
  const target = extensionInstallPath(manifest.id, manifest.version);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "bookshelf-ext-"));
  try {
    for (const file of files) {
      const destination = path.resolve(temp, file.name);
      if (!isInside(temp, destination)) throw new ExtensionError(`Unsafe path: ${file.name}`);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, file.contents);
    }
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(temp, target);
    return target;
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function installExtension(input: {
  zip: Buffer;
  userId: string;
  isAdmin: boolean;
}): Promise<{ extension: InstalledExtension; installed: boolean; updated: boolean }> {
  const { manifest, files } = await readZip(input.zip);
  if (manifest.type === "server" && !input.isAdmin) {
    throw new ExtensionError("Server extensions can only be installed by an administrator");
  }

  const existing = await db.extension.findUnique({ where: { slug: manifest.id } });
  if (existing) {
    if (existing.type !== manifest.type.toUpperCase()) {
      throw new ExtensionError("An extension with this id already exists with a different type");
    }
    if (existing.scope === "SERVER" && !input.isAdmin) {
      throw new ExtensionError("Server extensions can only be managed by an administrator");
    }
    if (existing.version !== manifest.version) {
      const installCount = await db.extensionUser.count({ where: { extensionId: existing.id } });
      const ownsPackage = existing.installedById === input.userId && installCount <= 1;
      if (!input.isAdmin && !ownsPackage) {
        throw new ExtensionError("This extension id is already installed by another user");
      }
    }
  }

  const needsWrite = !existing || existing.version !== manifest.version;
  const installPath = needsWrite ? await writePackage(manifest, files) : existing.installPath;

  // Verify a pre-existing package directory still exists; if not, rewrite it.
  let finalPath = installPath;
  if (!needsWrite) {
    const exists = await fs
      .stat(path.join(installPath, "manifest.json"))
      .then(() => true)
      .catch(() => false);
    if (!exists) finalPath = await writePackage(manifest, files);
  }

  const data = {
    slug: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type.toUpperCase() as "THEME" | "UI" | "SERVER",
    scope: (manifest.type === "server" ? "SERVER" : "USER") as "SERVER" | "USER",
    manifest: JSON.stringify(manifest),
    installPath: finalPath,
    installedById: existing?.installedById ?? input.userId,
    enabled: existing?.enabled ?? true,
    secret: existing?.secret ?? (manifest.type === "server" ? randomBytes(32).toString("base64url") : null),
  };

  const row = existing
    ? await db.extension.update({ where: { id: existing.id }, data })
    : await db.extension.create({ data });

  if (manifest.type !== "server") {
    await db.extensionUser.upsert({
      where: { extensionId_userId: { extensionId: row.id, userId: input.userId } },
      update: { enabled: true },
      create: { extensionId: row.id, userId: input.userId },
    });
    if (manifest.type === "theme") {
      await db.extensionUser.updateMany({
        where: {
          userId: input.userId,
          extensionId: { not: row.id },
          extension: { type: "THEME" },
        },
        data: { enabled: false },
      });
    }
  }

  return { extension: toInstalled(row), installed: !existing, updated: needsWrite };
}

export async function uninstallExtension(input: { slug: string; userId: string; isAdmin: boolean }): Promise<void> {
  const row = await db.extension.findUnique({ where: { slug: input.slug } });
  if (!row) throw new ExtensionError("Extension not found");
  if (row.scope === "SERVER") {
    if (!input.isAdmin) throw new ExtensionError("Server extensions can only be removed by an administrator");
    await db.extension.delete({ where: { id: row.id } });
    await fs.rm(path.dirname(row.installPath), { recursive: true, force: true }).catch(() => undefined);
    return;
  }

  const own = await db.extensionUser.findUnique({
    where: { extensionId_userId: { extensionId: row.id, userId: input.userId } },
  });
  if (!own) throw new ExtensionError("Extension is not installed for this user");
  await db.extensionUser.delete({ where: { id: own.id } });

  const remaining = await db.extensionUser.count({ where: { extensionId: row.id } });
  if (remaining === 0 && (input.isAdmin || row.installedById === input.userId)) {
    await db.extension.delete({ where: { id: row.id } });
    await fs.rm(path.dirname(row.installPath), { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function listInstalledExtensions(userId: string): Promise<InstalledExtension[]> {
  const rows = await db.extensionUser.findMany({
    where: { userId, extension: { enabled: true } },
    include: { extension: true },
    orderBy: { installedAt: "desc" },
  });
  return rows.map((row) => toInstalled(row.extension)).filter((ext) => ext.enabled || ext.type === "THEME");
}

/** Installed extensions with their per-user enabled flag (settings UI). */
export async function listUserExtensionRows(userId: string) {
  const rows = await db.extensionUser.findMany({
    where: { userId, extension: { enabled: true } },
    include: { extension: true },
    orderBy: { installedAt: "desc" },
  });
  return rows.map((row) => ({
    ...toInstalled(row.extension),
    userEnabled: row.enabled,
    settings: parseSettings(row.settings),
  }));
}

export async function setUserExtensionEnabled(userId: string, slug: string, enabled: boolean): Promise<void> {
  const row = await db.extension.findUnique({ where: { slug }, select: { id: true, type: true, enabled: true } });
  if (!row || !row.enabled) throw new ExtensionError("Extension not found");
  const install = await db.extensionUser.findUnique({
    where: { extensionId_userId: { extensionId: row.id, userId } },
  });
  if (!install) throw new ExtensionError("Extension is not installed for this user");
  await db.extensionUser.update({ where: { id: install.id }, data: { enabled } });
  if (enabled && row.type === "THEME") {
    await db.extensionUser.updateMany({
      where: { userId, extensionId: { not: row.id }, extension: { type: "THEME" } },
      data: { enabled: false },
    });
  }
}

export async function listServerExtensions() {
  const rows = await db.extension.findMany({
    where: { type: "SERVER", enabled: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({ ...toInstalled(row), secret: row.secret }));
}

export async function listAllExtensionsForAdmin() {
  const rows = await db.extension.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return rows.map((row) => ({
    ...toInstalled(row),
    enabled: row.enabled,
    installCount: 0,
  }));
}

export async function setExtensionEnabled(slug: string, enabled: boolean): Promise<void> {
  const result = await db.extension.updateMany({ where: { slug }, data: { enabled } });
  if (result.count === 0) throw new ExtensionError("Extension not found");
}

export async function setDefaultTheme(slug: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.extension.updateMany({ where: { isDefaultTheme: true }, data: { isDefaultTheme: false } });
    if (slug) {
      const row = await tx.extension.findUnique({ where: { slug }, select: { id: true, type: true } });
      if (!row || row.type !== "THEME") throw new ExtensionError("Theme extension not found");
      await tx.extension.update({ where: { id: row.id }, data: { isDefaultTheme: true, enabled: true } });
    }
  });
}

export async function getExtensionBySlug(slug: string) {
  const row = await db.extension.findUnique({ where: { slug } });
  return row ? toInstalled(row) : null;
}

export async function getExtensionById(id: string) {
  const row = await db.extension.findUnique({ where: { id } });
  return row ? toInstalled(row) : null;
}

export async function updateServerSettings(slug: string, settings: Record<string, unknown>): Promise<void> {
  const row = await db.extension.findUnique({ where: { slug }, select: { id: true, type: true, manifest: true } });
  if (!row || row.type !== "SERVER") throw new ExtensionError("Server extension not found");
  const manifest = parseManifestJson(row.manifest);
  const allowed = manifest.server?.settings ?? [];
  const sanitized: Record<string, unknown> = {};
  for (const field of allowed) {
    const value = settings[field.key];
    if (value === undefined) {
      if (field.default !== undefined) sanitized[field.key] = field.default;
      else if (field.required) throw new ExtensionError(`${field.label} is required`);
      continue;
    }
    if (field.type === "number" && typeof value !== "number")
      throw new ExtensionError(`${field.label} must be a number`);
    if (field.type === "boolean" && typeof value !== "boolean")
      throw new ExtensionError(`${field.label} must be true/false`);
    if ((field.type === "string" || field.type === "url") && typeof value !== "string") {
      throw new ExtensionError(`${field.label} must be text`);
    }
    if (field.type === "url" && typeof value === "string" && !/^https?:\/\//.test(value)) {
      throw new ExtensionError(`${field.label} must be an http(s) URL`);
    }
    sanitized[field.key] = value;
  }
  await db.extension.update({ where: { id: row.id }, data: { settings: JSON.stringify(sanitized) } });
}
