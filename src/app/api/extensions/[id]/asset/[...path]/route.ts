// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — serve extension package assets with a strict path guard.

import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { isInside } from "@/lib/extensions/paths";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(_request: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path: segments } = await context.params;
  if (!segments || segments.length === 0) return new Response("Not found", { status: 404 });
  if (segments.some((s) => s.includes(".."))) return new Response("Not found", { status: 404 });

  const row = await db.extension.findUnique({ where: { slug: id } });
  if (!row || !row.enabled) return new Response("Not found", { status: 404 });

  const root = row.installPath;
  const target = path.resolve(root, ...segments);
  if (!isInside(root, target)) return new Response("Not found", { status: 404 });

  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) return new Response("Not found", { status: 404 });
    const buffer = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
