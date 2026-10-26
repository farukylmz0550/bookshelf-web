// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — extension package storage paths.

import path from "node:path";

/** Root directory for installed extension packages. */
export function extensionsRoot(): string {
  if (process.env.BOOKSHELF_EXTENSIONS_DIR) return path.resolve(process.env.BOOKSHELF_EXTENSIONS_DIR);
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (databaseUrl.startsWith("file:")) {
    const dbPath = databaseUrl.slice("file:".length);
    return path.join(path.dirname(path.resolve(dbPath)), "extensions");
  }
  return path.join(process.cwd(), "data", "extensions");
}

export function extensionInstallPath(slug: string, version: string): string {
  return path.join(extensionsRoot(), slug, version);
}

/** True when `candidate` resolves inside `root` (zip-slip / traversal guard). */
export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
