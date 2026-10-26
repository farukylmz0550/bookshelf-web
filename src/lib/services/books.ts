// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — book service. Every function takes an explicit userId; ownership
// is enforced on every query. No NextAuth/session or revalidatePath calls live
// here so the REST API, MCP tools and server actions share one implementation.

import { z } from "zod";
import { db } from "@/lib/db";
import { lookupIsbn, lookupIsbns, type IsbnLookupResult } from "@/lib/isbn";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";
import { getPagesPerReadEventFor } from "@/lib/reading-settings";
import { defaultFilters, arrange, type Filters } from "@/lib/books/filters";
import { recordActivityFor, finishBookWithXpFor } from "./streak";

export const bookStatusSchema = z.enum(["TO_READ", "READING", "FINISHED"]);
export type BookStatusValue = z.infer<typeof bookStatusSchema>;

export const addBookSchema = z.object({
  isbn: z
    .string()
    .max(20)
    .optional()
    .transform((v) => (v ? v.replace(/[^0-9Xx]/g, "") || undefined : undefined)),
  title: z.string().trim().min(1, "Title is required").max(500),
  author: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  coverUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((val) => !val || /^https?:\/\/.+/.test(val), "Cover URL must be a valid HTTP/HTTPS URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  numberOfPages: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publishers: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publishDate: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publishPlaces: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  languages: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  subjects: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isbn10: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isbn13: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  subtitle: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  editionName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  series: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type AddBookInput = z.input<typeof addBookSchema>;
export type AddBookData = z.output<typeof addBookSchema>;

export const updateBookSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  subtitle: z.string().max(500).optional(),
  author: z.string().max(500).optional(),
  authors: z.string().max(500).optional(),
  publishers: z.string().max(500).optional(),
  publishDate: z.string().max(100).optional(),
  publishPlaces: z.string().max(500).optional(),
  editionName: z.string().max(200).optional(),
  series: z.string().max(200).optional(),
  numberOfPages: z.string().max(20).optional(),
  languages: z.string().max(200).optional(),
  isbn10: z.string().max(20).optional(),
  isbn13: z.string().max(20).optional(),
  subjects: z.string().max(1000).optional(),
  rating: z.number().int().min(0).max(5).optional(),
  notes: z.string().max(10000).optional(),
  tags: z.string().max(1000).optional(),
  signed: z.boolean().optional(),
  copies: z.number().int().min(1).max(999).optional(),
  currentPage: z.number().int().min(0).optional(),
});
export type UpdateBookInput = z.input<typeof updateBookSchema>;

export interface ListBooksOptions {
  search?: string;
  searchField?: string;
  status?: string;
  tag?: string;
  groupId?: string;
  lent?: string;
  signed?: string;
  minRating?: number;
  sort?: string;
  asc?: boolean;
  limit?: number;
  offset?: number;
}

export async function listBooks(userId: string, options: ListBooksOptions = {}) {
  const [books, memberships, lendings] = await Promise.all([
    db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } }),
    db.bookGroupMembership.findMany({
      where: { group: { userId } },
      select: { bookId: true, groupId: true },
    }),
    db.lendingRecord.findMany({
      where: { book: { userId }, returnedAt: null },
      select: { bookId: true },
    }),
  ]);
  const groupsByBook = new Map<string, string[]>();
  for (const m of memberships) {
    const list = groupsByBook.get(m.bookId) ?? [];
    list.push(m.groupId);
    groupsByBook.set(m.bookId, list);
  }
  const lentMap = new Map<string, boolean>();
  for (const b of books) lentMap.set(b.id, false);
  for (const l of lendings) lentMap.set(l.bookId, true);

  const filters: Filters = {
    ...defaultFilters,
    search: options.search ?? "",
    searchField: options.searchField ?? "all",
    status: options.status ?? "any",
    tag: options.tag ?? "any",
    groupId: options.groupId ?? "any",
    lent: options.lent ?? "any",
    signed: options.signed ?? "any",
    minRating: options.minRating ?? 0,
    sort: options.sort ?? "title",
    asc: options.asc ?? true,
  };
  const arranged = arrange(
    books.map((b) => ({ ...b, groupIds: groupsByBook.get(b.id) ?? [] })),
    filters,
    lentMap,
  );
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  return {
    total: arranged.length,
    limit,
    offset,
    books: arranged.slice(offset, offset + limit).map((b) => ({ ...b, lentOut: lentMap.get(b.id) ?? false })),
  };
}

export async function getBook(userId: string, bookId: string) {
  return db.book.findFirst({ where: { id: bookId, userId } });
}

export async function createBook(userId: string, input: AddBookInput) {
  const parsed = addBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const book = await db.book.create({ data: { userId, ...parsed.data } });
    try {
      const settings = await getAppConfig();
      await awardXp(userId, settings.xpBookAdded);
    } catch {}
    try {
      await syncAchievements(userId);
    } catch {}
    try {
      const { syncChallenges } = await import("@/lib/gamification");
      await syncChallenges(userId);
    } catch {}
    return { ok: true as const, book };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to create book" };
  }
}

export async function updateBook(userId: string, bookId: string, data: UpdateBookInput) {
  const parsed = updateBookSchema.partial().safeParse(data);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const book = await db.book.findFirst({ where: { id: bookId, userId }, select: { id: true } });
  if (!book) return { ok: false as const, error: "NOT_FOUND" };

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (k === "rating") update.rating = Math.max(0, Math.min(5, Math.floor(Number(v))));
    else if (k === "copies") update.copies = Math.max(1, Math.min(999, Math.floor(Number(v))));
    else if (k === "signed") update.signed = !!v;
    else if (k === "authors") update.author = typeof v === "string" ? v.trim() : v;
    else if (k === "currentPage") update.currentPage = Math.max(0, Math.floor(Number(v)));
    else update[k] = typeof v === "string" ? v.trim() : v;
  }
  const updated = await db.book.update({ where: { id: bookId }, data: update });
  return { ok: true as const, book: updated };
}

export async function deleteBook(userId: string, bookId: string) {
  const result = await db.book.deleteMany({ where: { id: bookId, userId } });
  return result.count > 0;
}

export async function setBookStatus(userId: string, bookId: string, status: BookStatusValue) {
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return { ok: false as const, error: "NOT_FOUND" };

  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;
  if (status === "FINISHED" && knownPages && (book.currentPage ?? 0) < totalPages) {
    return { ok: false as const, error: "RemainingPages" };
  }

  const updated = await db.book.updateMany({
    where: { id: bookId, userId, status: { not: status } },
    data: {
      status,
      finishedAt: status === "FINISHED" ? new Date() : null,
      ...(status !== "TO_READ" && !book.startedAt ? { startedAt: new Date() } : {}),
    },
  });

  if (status === "FINISHED" && updated.count > 0) {
    try {
      await db.bookReadEvent.create({
        data: {
          userId,
          bookId: book.id,
          bookTitle: book.title,
          pagesRead: knownPages ? totalPages : null,
        },
      });
    } catch {}
    await finishBookWithXpFor(userId, bookId, knownPages ? totalPages : null);
  }
  return { ok: true as const };
}

export async function logPagesRead(userId: string, bookId: string, pages?: number) {
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return { ok: false as const, error: "Not found" };

  const settings = await getAppConfig();
  const effectiveStep = await getPagesPerReadEventFor(userId);
  const pagesLogged = Math.max(1, Math.min(5000, Math.floor(pages ?? effectiveStep)));
  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;
  const current = book.currentPage ?? 0;
  const newCurrent = knownPages ? Math.min(current + pagesLogged, totalPages) : current + pagesLogged;

  const currentPageUnchanged =
    current === 0 ? { OR: [{ currentPage: 0 }, { currentPage: null as null }] } : { currentPage: current };

  if (knownPages && newCurrent >= totalPages) {
    const finished = await db.book.updateMany({
      where: { id: bookId, userId, ...currentPageUnchanged, status: { not: "FINISHED" } },
      data: { status: "FINISHED", finishedAt: new Date(), currentPage: totalPages },
    });
    if (finished.count === 0) return { ok: false as const, error: "Conflict, please retry" };
    try {
      await db.bookReadEvent.create({
        data: { userId, bookId: book.id, bookTitle: book.title, pagesRead: totalPages },
      });
    } catch {}
    await finishBookWithXpFor(userId, bookId, totalPages);
    const user = await db.user.findUnique({ where: { id: userId }, select: { currentStreak: true } });
    return { ok: true as const, logged: pagesLogged, finished: true, streak: user?.currentStreak ?? 0 };
  }

  const updateData: { currentPage: number; status?: "READING"; startedAt?: Date } = { currentPage: newCurrent };
  if (book.status === "TO_READ") {
    updateData.status = "READING";
    if (!book.startedAt) updateData.startedAt = new Date();
  }
  const updated = await db.book.updateMany({
    where: { id: bookId, userId, ...currentPageUnchanged },
    data: updateData,
  });
  if (updated.count === 0) return { ok: false as const, error: "Conflict, please retry" };

  const { current: streakNow } = await recordActivityFor(userId, pagesLogged);
  const xp = Math.floor(pagesLogged / 10) * settings.xpPagesPer10;
  if (xp > 0) {
    try {
      await awardXp(userId, xp);
      await syncAchievements(userId);
    } catch {}
  }
  try {
    const { syncChallenges } = await import("@/lib/gamification");
    await syncChallenges(userId);
  } catch {}

  return { ok: true as const, logged: pagesLogged, streak: streakNow };
}

export async function startReRead(userId: string, bookId: string) {
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return { ok: false as const, error: "Not found" };
  if (book.status !== "FINISHED") return { ok: false as const, error: "Not finished" };
  await db.book.update({
    where: { id: bookId },
    data: { status: "READING", currentPage: 0, finishedAt: null },
  });
  return { ok: true as const };
}

export async function lookupIsbnFor(isbn: string): Promise<IsbnLookupResult | null> {
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  if (!cleaned) return null;
  return lookupIsbn(cleaned);
}

export async function backfillPageCounts(userId: string): Promise<{
  ok: boolean;
  filled?: number;
  notFound?: number;
  remaining?: number;
  error?: string;
}> {
  try {
    const cfg = await getAppConfig();
    const missing = await db.book.findMany({
      where: { userId, numberOfPages: null, isbn: { not: null } },
      select: { isbn: true },
      orderBy: { addedAt: "asc" },
    });
    const remaining = missing.length;
    const batchIsbns = [
      ...new Set(missing.map((b) => (b.isbn as string).replace(/[^0-9Xx]/g, "")).filter((v) => v.length > 0)),
    ].slice(0, cfg.backfillMaxBatch);
    if (batchIsbns.length === 0) return { ok: true, filled: 0, notFound: 0, remaining: 0 };

    const pagesByIsbn = new Map<string, string>();
    let failed = 0;
    for (let i = 0; i < batchIsbns.length; i += cfg.backfillChunkSize) {
      const chunk = batchIsbns.slice(i, i + cfg.backfillChunkSize);
      const found = await lookupIsbns(chunk).catch(() => [] as IsbnLookupResult[]);
      let chunkFailures = 0;
      for (const isbn of chunk) {
        const hit = found.find((f) => f.isbn === isbn);
        if (hit?.numberOfPages) pagesByIsbn.set(isbn, hit.numberOfPages);
        else chunkFailures++;
      }
      failed += chunkFailures;
      if (chunkFailures === chunk.length && chunk.length > 5) break;
    }

    const rows = await db.book.findMany({
      where: { userId, numberOfPages: null, isbn: { not: null } },
      select: { id: true, isbn: true },
    });
    let filled = 0;
    for (const row of rows) {
      const pages = pagesByIsbn.get((row.isbn as string).replace(/[^0-9Xx]/g, ""));
      if (!pages) continue;
      const n = parseInt(pages, 10);
      if (isNaN(n) || n <= 0) continue;
      await db.book.update({ where: { id: row.id }, data: { numberOfPages: String(n) } });
      filled++;
    }
    return { ok: true, filled, notFound: failed, remaining: Math.max(0, remaining - filled) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Backfill failed" };
  }
}
