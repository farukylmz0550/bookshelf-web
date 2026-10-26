// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — quote actions delegate to the shared quotes service.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  addQuote as addQuoteService,
  deleteQuote as deleteQuoteService,
  updateQuote as updateQuoteService,
} from "@/lib/services/quotes";

export type QuoteActionResult = { ok: boolean; error?: string };

export async function addQuote(input: {
  bookId: string;
  text: string;
  page?: number | null;
}): Promise<QuoteActionResult> {
  const userId = await requireUserId();
  const result = await addQuoteService(userId, input);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/books/${input.bookId}`);
  return { ok: true };
}

export async function updateQuote(
  id: string,
  input: { text?: string; page?: number | null },
): Promise<QuoteActionResult> {
  const userId = await requireUserId();
  const result = await updateQuoteService(userId, id, input);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/books/${result.quote.bookId}`);
  return { ok: true };
}

export async function deleteQuote(id: string, bookId: string): Promise<QuoteActionResult> {
  const userId = await requireUserId();
  await deleteQuoteService(userId, id);
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}
