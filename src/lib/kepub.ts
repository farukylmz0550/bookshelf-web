// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — kepubify (EPUB → KEPUB) support for the Kobo sync download path.
// Pure helpers for cache-path derivation + the conversion runner. Conversion
// is lazy: on the first /download/{id}/kepub request the source EPUB is
// fetched from the user's fileSourceUrl template, converted with the kepubify
// binary and cached under <db dir>/cache/kepub/<bookId>.kepub.epub.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdir, rename } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { sqlitePathFromUrl } from "./backup";

/** Directory that holds converted KEPUB files (persistent, non-root writable). */
export function kepubCacheDir(dbUrl: string | undefined): string | null {
  const dbPath = sqlitePathFromUrl(dbUrl);
  if (!dbPath) return null;
  return join(dirname(resolve(dbPath)), "cache", "kepub");
}

/** Cache file for one book's converted KEPUB. */
export function kepubCachePath(cacheDir: string, bookId: string): string {
  return join(cacheDir, `${bookId}.kepub.epub`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Spawn `kepubify` and wait for a clean exit (null on failure). */
function runKepubify(binary: string, input: string, outputDir: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const child = spawn(binary, ["-o", outputDir, input], { stdio: "ignore" });
    child.on("error", () => resolvePromise(false));
    child.on("close", (code) => resolvePromise(code === 0));
  });
}

/**
 * Convert a source EPUB to KEPUB and atomically place it into the cache.
 * The final cache file only appears after a successful conversion, so a
 * failed/incomplete run never poisons later requests. Returns the final path,
 * or null when kepubify is unavailable/conversion failed.
 */
export async function convertToKepub(
  binary: string,
  inputPath: string,
  cacheDir: string,
  bookId: string,
): Promise<string | null> {
  try {
    await mkdir(cacheDir, { recursive: true });
    const finalPath = kepubCachePath(cacheDir, bookId);
    if (await exists(finalPath)) return finalPath;

    const ok = await runKepubify(binary, inputPath, cacheDir);
    if (!ok) return null;

    // kepubify writes <stem>.kepub.epub next to the input; rename it into the
    // final cache slot atomically (random suffix prevents cross-request races
    // from clobbering a partially written file).
    const stem = basename(inputPath).replace(/\.epub$/i, "");
    const produced = join(cacheDir, `${stem}.kepub.epub`);
    if (!(await exists(produced))) return null;
    await rename(produced, finalPath);
    return finalPath;
  } catch {
    return null;
  }
}

/** Fresh temp source path for the pre-conversion download. */
export function kepubSourceTmpPath(cacheDir: string, bookId: string): string {
  return join(cacheDir, `${bookId}.src-${randomBytes(6).toString("hex")}.epub`);
}
