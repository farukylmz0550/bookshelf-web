// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — quotes service.

import { db } from "@/lib/db";
import { validateQuoteText } from "@/lib/quotes";

export async function listQuotes(userId: string, bookId: string) {
  return db.quote.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addQuote(userId: string, input: { bookId: string; text: string; page?: number | null }) {
  const book = await db.book.findFirst({
    where: { id: input.bookId, userId },
    select: { id: true, title: true },
  });
  if (!book) return { ok: false as const, error: "NotFound" };

  const textError = validateQuoteText(input.text);
  if (textError) return { ok: false as const, error: textError };

  const page = input.page == null || input.page === ("" as unknown as number) ? null : Math.floor(Number(input.page));
  if (page !== null && (isNaN(page) || page < 1 || page > 100000)) {
    return { ok: false as const, error: "InvalidPage" };
  }

  const quote = await db.quote.create({
    data: { userId, bookId: input.bookId, bookTitle: book.title, text: input.text.trim(), page },
  });
  return { ok: true as const, quote };
}

export async function updateQuote(userId: string, id: string, input: { text?: string; page?: number | null }) {
  if (input.text !== undefined) {
    const textError = validateQuoteText(input.text);
    if (textError) return { ok: false as const, error: textError };
  }
  let page: number | null | undefined;
  if (input.page !== undefined) {
    page = input.page === null ? null : Math.floor(Number(input.page));
    if (page !== null && (isNaN(page) || page < 1 || page > 100000)) {
      return { ok: false as const, error: "InvalidPage" };
    }
  }

  const existing = await db.quote.findFirst({ where: { id, userId }, select: { id: true, bookId: true } });
  if (!existing) return { ok: false as const, error: "NotFound" };

  const quote = await db.quote.update({
    where: { id: existing.id },
    data: {
      ...(input.text !== undefined ? { text: input.text.trim() } : {}),
      ...(page !== undefined ? { page } : {}),
    },
  });
  return { ok: true as const, quote };
}

export async function deleteQuote(userId: string, id: string) {
  const result = await db.quote.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
