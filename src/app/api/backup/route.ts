// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — automatic SQLite backup endpoint, called by the Docker cron
// container once a day (Bearer CRON_SECRET, same auth as the push routes).
// Uses better-sqlite3 .backup() — an online, WAL-consistent copy — into
// /data/backups and keeps the newest 7 files.

import { mkdir } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { backupFileName, pruneSelection, sqlitePathFromUrl } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "backup disabled" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dbPath = sqlitePathFromUrl(process.env.DATABASE_URL);
  if (!dbPath) return Response.json({ error: "sqlite required" }, { status: 503 });

  const backupDir = join(dbPath, "..", "backups");
  const file = join(backupDir, backupFileName(new Date()));

  try {
    await mkdir(backupDir, { recursive: true });
    // better-sqlite3 is a serverExternalPackage — safe to require here.
    // (The .backup() API exists at runtime; the shipped types omit it.)
    const { default: Database } = await import("better-sqlite3");
    const source = new Database(dbPath, { readonly: true }) as unknown as {
      backup: (file: string) => Promise<void>;
      close: () => void;
    };
    try {
      await source.backup(file);
    } finally {
      source.close();
    }

    // Retention: delete everything beyond the newest N files.
    const existing = readdirSync(backupDir)
      .filter((f) => /^bookshelf-\d{8}\.db$/.test(f))
      .sort()
      .reverse();
    const kept = existing.length;
    for (const victim of pruneSelection(existing)) {
      try {
        const p = join(backupDir, victim);
        statSync(p);
        const { unlinkSync } = await import("node:fs");
        unlinkSync(p);
      } catch {}
    }

    return Response.json({ ok: true, file, kept });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "backup failed" }, { status: 500 });
  }
}
