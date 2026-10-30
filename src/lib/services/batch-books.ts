// SPDX-License-Identifier: GPL-3.0-only
import { lookupIsbn, type IsbnLookupResult } from "@/lib/isbn";
import { db } from "@/lib/db";
import { normalizeIsbn } from "@/lib/books/model";
import { MAX_BATCH_ISBNS, uniqueBatchIsbns, type BatchIsbnStatus } from "@/lib/books/batch-isbn";
import { createBook, type AddBookInput } from "./books";

export { MAX_BATCH_ISBNS };

export type BatchLookupItem = {
  raw: string;
  isbn: string;
  status: BatchIsbnStatus;
  data?: IsbnLookupResult;
  bookId?: string;
};

export type BatchCreateItem = BatchLookupItem & { error?: string };

function existingIsbnSet(rows: Array<{ isbn: string | null; isbn10: string | null; isbn13: string | null }>) {
  return new Set(
    rows.flatMap((row) => [row.isbn, row.isbn10, row.isbn13].filter(Boolean).map((value) => normalizeIsbn(value!))),
  );
}

function assertBatchSize(isbns: string[]) {
  if (!Array.isArray(isbns) || isbns.length === 0) throw new Error("At least one ISBN is required");
  if (isbns.length > MAX_BATCH_ISBNS) throw new Error(`A batch may contain at most ${MAX_BATCH_ISBNS} ISBNs`);
}

export async function lookupBooksBatch(userId: string, isbns: string[]) {
  assertBatchSize(isbns);
  const candidates = uniqueBatchIsbns(isbns);
  const rows = await db.book.findMany({
    where: { userId },
    select: { isbn: true, isbn10: true, isbn13: true, id: true },
  });
  const existing = existingIsbnSet(rows);
  const existingIds = new Map<string, string>();
  for (const row of rows)
    for (const value of [row.isbn, row.isbn10, row.isbn13]) if (value) existingIds.set(normalizeIsbn(value), row.id);

  const results: BatchLookupItem[] = [];
  for (const candidate of candidates) {
    if (candidate.status === "invalid" || candidate.status === "duplicate") {
      results.push(candidate);
      continue;
    }
    if (existing.has(candidate.isbn)) {
      results.push({ ...candidate, status: "duplicate", bookId: existingIds.get(candidate.isbn) });
      continue;
    }
    const data = await lookupIsbn(candidate.isbn).catch(() => null);
    results.push(data ? { ...candidate, status: "ready", data } : { ...candidate, status: "lookup_failed" });
  }
  return { items: results, total: results.length };
}

const idempotentResults = new Map<string, { expiresAt: number; result: { items: BatchCreateItem[]; total: number } }>();

export async function createBooksBatch(
  userId: string,
  items: Array<IsbnLookupResult | AddBookInput>,
  idempotencyKey?: string,
) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one book is required");
  if (items.length > MAX_BATCH_ISBNS) throw new Error(`A batch may contain at most ${MAX_BATCH_ISBNS} books`);
  const cacheKey = idempotencyKey ? `${userId}:${idempotencyKey}` : undefined;
  const cached = cacheKey ? idempotentResults.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const rows = await db.book.findMany({
    where: { userId },
    select: { isbn: true, isbn10: true, isbn13: true, id: true },
  });
  const existing = existingIsbnSet(rows);
  const results: BatchCreateItem[] = [];
  for (const input of items) {
    const raw = typeof input.isbn === "string" ? input.isbn : "";
    const isbn = normalizeIsbn(raw);
    if (!isbn || !uniqueBatchIsbns([raw])[0] || uniqueBatchIsbns([raw])[0].status === "invalid") {
      results.push({ raw, isbn, status: "invalid" });
      continue;
    }
    if (existing.has(isbn)) {
      results.push({ raw, isbn, status: "duplicate" });
      continue;
    }
    const result = await createBook(userId, input);
    if (result.ok) {
      existing.add(isbn);
      results.push({ raw, isbn, status: "added", data: input as IsbnLookupResult, bookId: result.book.id });
    } else {
      results.push({ raw, isbn, status: "lookup_failed", error: result.error });
    }
  }
  const result = { items: results, total: results.length };
  if (cacheKey) idempotentResults.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, result });
  return result;
}
