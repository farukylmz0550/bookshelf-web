// SPDX-License-Identifier: GPL-3.0-only
// Kobo eReader sync (v3.0.0) — the device talks to /api/kobo/<token>/v1/...
// after its `.kobo/Kobo/Kobo eReader.conf` api_endpoint is pointed here
// (calibre-web pattern). Token = capability URL scoped to one user's library.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Book } from "@/generated/prisma/client";

/** Generate a URL-safe sync token (40 hex chars). */
export function generateKoboToken(): string {
  return randomBytes(20).toString("hex");
}

/** Resolve the user + sync row for an incoming device token. Null = 401. */
export async function resolveKoboToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!token || token.length < 16 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const row = await db.koboSyncToken.findUnique({ where: { token }, select: { userId: true, id: true } });
  if (!row) return null;
  return { userId: row.userId, tokenId: row.id };
}

/** Build the api_endpoint URL the user puts into Kobo eReader.conf. */
export function buildKoboApiEndpoint(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/kobo/${token}`;
}

/** Apply a per-user URL template ({isbn}, {isbn10}, {isbn13}). */
export function applyFileSourceTemplate(
  template: string,
  book: Pick<Book, "isbn" | "isbn10" | "isbn13">,
): string | null {
  const digits = (v: string | null) => (v ?? "").replace(/[^0-9Xx]/g, "") || null;
  const isbn = digits(book.isbn13 ?? book.isbn);
  if (!isbn) return null;
  return template
    .replace(/\{isbn13\}/g, digits(book.isbn13) ?? "")
    .replace(/\{isbn10\}/g, digits(book.isbn10) ?? "")
    .replace(/\{isbn\}/g, isbn);
}

/**
 * Kobo SyncToken (x-kobo-synctoken) — opaque; we echo the last sync time so
 * the device round-trips it and v1 always answers with the full library.
 */
export function readSyncTokenHeader(headers: Headers): string | null {
  return headers.get("x-kobo-synctoken") ?? headers.get("x-kobo-sync-token");
}

/** Response headers every Kobo sync response should carry. */
export function koboSyncHeaders(syncToken: string | null): Record<string, string> {
  const out: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "kobo-sync": "true",
    "x-kobo-sync": "continue",
    "x-kobo-sync-mode": "delta",
    "x-kobo-recent-reads": "false",
  };
  if (syncToken) out["x-kobo-synctoken"] = syncToken;
  return out;
}

const KOBO_STORE_BASE = "https://storeapi.kobo.com";

/**
 * Proxy an unimplemented device request to the real Kobo store (v3.0.0
 * `kobo.storeProxy: true` default) so store features keep working. Hop-by-hop
 * and auth headers are stripped; the device's own store auth headers are
 * forwarded so the Kobo store can authenticate the device session.
 */
export async function proxyToKoboStore(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  const target = `${KOBO_STORE_BASE}${path}${url.search}`;
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (["host", "authorization", "x-kobo-token", "cookie", "connection", "content-length"].includes(key.toLowerCase()))
      continue;
    headers.set(key, value);
  }
  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(15_000),
    });
    const outHeaders = new Headers();
    for (const [key, value] of res.headers.entries()) {
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase()))
        continue;
      outHeaders.set(key, value);
    }
    return new Response(res.body, { status: res.status, headers: outHeaders });
  } catch {
    return Response.json({ error: "store proxy failed" }, { status: 502 });
  }
}

const MAX_PROGRESS_JUMP = 1000; // cap per-sync delta — a stale device must not award a day's XP at once

export type KoboReadingStateInput = {
  /** Absolute page the device reports (1-based), when available. */
  page?: number | null;
  /** 0..1 fraction of the book read, when available. */
  fraction?: number | null;
};

/**
 * v3.0.0 — write device reading progress back into BookShelf's systems:
 * currentPage (absolute), startedAt/status transitions, streak activity and
 * per-10-pages XP for the delta. Mirrors logPagesRead semantics without the
 * delta-based optimistic lock (the device reports an absolute position).
 * Returns the applied delta, or null when there is nothing to record.
 */
export async function applyKoboProgress(
  book: Book,
  input: KoboReadingStateInput,
  config: { pagesPerReadEvent: number; xpPagesPer10: number },
): Promise<{ ok: boolean; delta: number; finished: boolean } | { ok: false; reason: string }> {
  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;

  // Resolve the device position into an absolute page.
  let position: number | null = null;
  if (knownPages && typeof input.fraction === "number" && input.fraction >= 0 && input.fraction <= 1) {
    position = Math.round(input.fraction * totalPages!);
  }
  if (position === null && typeof input.page === "number" && input.page >= 0) {
    position = knownPages ? Math.min(Math.floor(input.page), totalPages!) : Math.floor(input.page);
  }
  if (position === null) return { ok: false, reason: "no-position" };

  const current = book.currentPage ?? 0;
  const delta = Math.min(Math.max(position - current, 0), MAX_PROGRESS_JUMP);
  const finished = knownPages && position >= totalPages!;

  if (finished) {
    const updated = await db.book.updateMany({
      where: { id: book.id, userId: book.userId, status: { not: "FINISHED" } },
      data: { status: "FINISHED", finishedAt: new Date(), currentPage: totalPages },
    });
    if (updated.count > 0) {
      try {
        await db.bookReadEvent.create({
          data: { userId: book.userId, bookId: book.id, bookTitle: book.title, pagesRead: totalPages! },
        });
      } catch {}
      const { finishBookWithXp } = await import("@/app/actions/streak");
      await finishBookWithXp(book.id, totalPages);
      return { ok: true, delta, finished: true };
    }
    // Already finished by the user/another sync — no double finish bonus.
    return { ok: true, delta: 0, finished: true };
  }

  if (delta <= 0) {
    // Same position re-reported — no XP/streak farming by re-syncing.
    return { ok: true, delta: 0, finished: false };
  }

  const updateData: { currentPage: number; status?: "READING"; startedAt?: Date } = { currentPage: position };
  if (book.status === "TO_READ") {
    updateData.status = "READING";
    if (!book.startedAt) updateData.startedAt = new Date();
  }
  await db.book.update({ where: { id: book.id }, data: updateData });

  const { recordActivity } = await import("@/app/actions/streak");
  await recordActivity(delta);
  const { awardXp } = await import("@/lib/gamification");
  const xp = Math.floor(delta / 10) * config.xpPagesPer10;
  if (xp > 0) {
    try {
      await awardXp(book.userId, xp);
    } catch {}
  }
  return { ok: true, delta, finished: false };
}
