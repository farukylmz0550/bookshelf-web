// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — automatic SQLite backups (daily cron → POST /api/backup with the
// CRON_SECRET bearer). Pure helpers for filename + retention; the actual copy
// uses better-sqlite3's .backup() (WAL-safe, online) inside the API route.

/** Backup filename for a UTC date: bookshelf-YYYYMMDD.db */
export function backupFileName(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `bookshelf-${y}${m}${d}.db`;
}

export const BACKUP_KEEP_COUNT = 7;

/**
 * Pure: which backup files to DELETE given the full list (sorted newest-first)
 * and the retention count. Today's fresh file is always kept.
 */
export function pruneSelection(files: string[], keep: number = BACKUP_KEEP_COUNT): string[] {
  return files.slice(keep);
}

/** Resolve the sqlite file path from a DATABASE_URL (file:... form). */
export function sqlitePathFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const cleaned = url.replace(/^"|"$/g, "");
  const match = cleaned.match(/^file:(.+)$/i);
  return match ? match[1] : null;
}
