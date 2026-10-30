// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — book actions are thin session-aware adapters over
// src/lib/services/books.ts. Validation, ownership and gamification live in
// the service so the REST API / MCP use exactly the same implementation.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import type { IsbnLookupResult } from "@/lib/isbn";
import { lookupBooksBatch, createBooksBatch } from "@/lib/services/batch-books";
import {
  addBookSchema,
  backfillPageCounts as backfillPageCountsService,
  createBook,
  logPagesRead as logPagesReadService,
  lookupIsbnFor,
  setBookStatus as setBookStatusService,
  startReRead as startReReadService,
  updateBook as updateBookService,
  type AddBookInput,
  type UpdateBookInput,
} from "@/lib/services/books";

function revalidateBook(bookId?: string) {
  revalidatePath("/books");
  revalidatePath("/stats");
  if (bookId) revalidatePath(`/books/${bookId}`);
}

export async function lookupIsbnAction(
  isbn: string,
): Promise<{ ok: true; data: Awaited<ReturnType<typeof lookupIsbnFor>> } | { ok: false; error: string }> {
  await requireUserId();
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  if (!cleaned) return { ok: false, error: "ISBN is required" };
  try {
    const result = await lookupIsbnFor(cleaned);
    if (!result) return { ok: false, error: "NOT_FOUND" };
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed" };
  }
}

export async function lookupBooksBatchAction(
  isbns: string[],
): Promise<{ ok: true; data: Awaited<ReturnType<typeof lookupBooksBatch>> } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    return { ok: true, data: await lookupBooksBatch(userId, isbns) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Batch lookup failed" };
  }
}

export async function createBooksBatchAction(
  items: IsbnLookupResult[],
): Promise<{ ok: true; data: Awaited<ReturnType<typeof createBooksBatch>> } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    const result = await createBooksBatch(userId, items, `ui-${crypto.randomUUID()}`);
    revalidatePath("/books");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Batch add failed" };
  }
}

export async function addBook(input: AddBookInput): Promise<{ ok: true } | { ok: false; error: string }> {
  // Keep the action contract: a Zod failure returns ok:false instead of throwing.
  const parsed = addBookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const userId = await requireUserId();
  const result = await createBook(userId, input);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/books");
  return { ok: true };
}

export async function setBookStatus(
  bookId: string,
  status: "TO_READ" | "READING" | "FINISHED",
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const result = await setBookStatusService(userId, bookId, status);
  if (result.ok) revalidateBook(bookId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function logPagesRead(
  bookId: string,
  pages?: number,
): Promise<{ ok: boolean; logged?: number; finished?: boolean; streak?: number; error?: string }> {
  const userId = await requireUserId();
  const result = await logPagesReadService(userId, bookId, pages);
  if (result.ok) revalidateBook(bookId);
  return result;
}

export async function startReRead(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const result = await startReReadService(userId, bookId);
  if (result.ok) revalidateBook(bookId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function updateBook(bookId: string, data: UpdateBookInput) {
  const userId = await requireUserId();
  const result = await updateBookService(userId, bookId, data);
  if (!result.ok) throw new Error(result.error === "NOT_FOUND" ? "Not found" : result.error);
  revalidateBook(bookId);
}

export async function backfillPageCounts() {
  const userId = await requireUserId();
  const result = await backfillPageCountsService(userId);
  if (result.ok) revalidatePath("/books");
  return result;
}
