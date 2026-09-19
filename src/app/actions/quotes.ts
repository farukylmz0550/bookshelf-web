// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.4.0 — book quotes: create/update/delete. All operations are
// ownership-scoped (the caller's quote, joined through userId). Validation is
// pure (lib/quotes.ts); revalidation happens on the book detail page so the
// Quotes section always renders fresh data.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { validateQuoteText } from "@/lib/quotes";

export type QuoteActionResult = { ok: boolean; error?: string };

/** Add a quote (optional page reference) to one of the caller's books. */
export async function addQuote(input: {
  bookId: string;
  text: string;
  page?: number | null;
}): Promise<QuoteActionResult> {
  const userId = await requireUserId();

  const book = await db.book.findFirst({
    where: { id: input.bookId, userId },
    select: { id: true, title: true },
  });
  if (!book) return { ok: false, error: "NotFound" };

  const textError = validateQuoteText(input.text);
  if (textError) return { ok: false, error: textError };

  const page = input.page == null || input.page === ("" as unknown as number) ? null : Math.floor(Number(input.page));
  if (page !== null && (isNaN(page) || page < 1 || page > 100000)) return { ok: false, error: "InvalidPage" };

  await db.quote.create({
    data: {
      userId,
      bookId: input.bookId,
      bookTitle: book.title,
      text: input.text.trim(),
      page,
    },
  });
  revalidatePath(`/books/${input.bookId}`);
  return { ok: true };
}

/** Update the text/page of one of the caller's quotes. */
export async function updateQuote(
  id: string,
  input: { text?: string; page?: number | null },
): Promise<QuoteActionResult> {
  const userId = await requireUserId();

  if (input.text !== undefined) {
    const textError = validateQuoteText(input.text);
    if (textError) return { ok: false, error: textError };
  }
  let page: number | null | undefined;
  if (input.page !== undefined) {
    page = input.page === null ? null : Math.floor(Number(input.page));
    if (page !== null && (isNaN(page) || page < 1 || page > 100000)) return { ok: false, error: "InvalidPage" };
  }

  const existing = await db.quote.findFirst({ where: { id, userId }, select: { id: true, bookId: true } });
  if (!existing) return { ok: false, error: "NotFound" };

  await db.quote.update({
    where: { id: existing.id },
    data: {
      ...(input.text !== undefined ? { text: input.text.trim() } : {}),
      ...(page !== undefined ? { page } : {}),
    },
  });
  revalidatePath(`/books/${existing.bookId}`);
  return { ok: true };
}

/** Delete one of the caller's quotes. */
export async function deleteQuote(id: string, bookId: string): Promise<QuoteActionResult> {
  const userId = await requireUserId();

  await db.quote.deleteMany({ where: { id, userId } });
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}
