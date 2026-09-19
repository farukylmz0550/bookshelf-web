// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { lookupIsbn, lookupIsbns, type IsbnLookupResult } from "@/lib/isbn";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";

const addBookSchema = z.object({
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

const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
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

export async function lookupIsbnAction(
  isbn: string,
): Promise<{ ok: true; data: Awaited<ReturnType<typeof lookupIsbn>> } | { ok: false; error: string }> {
  await requireUserId();
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  if (!cleaned) return { ok: false, error: "ISBN is required" };
  try {
    const result = await lookupIsbn(cleaned);
    if (!result) return { ok: false, error: "NOT_FOUND" };
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed" };
  }
}

export async function addBook(input: {
  isbn?: string;
  title: string;
  author?: string;
  coverUrl?: string;
  numberOfPages?: string;
  publishers?: string;
  publishDate?: string;
  publishPlaces?: string;
  languages?: string;
  subjects?: string;
  isbn10?: string;
  isbn13?: string;
  subtitle?: string;
  editionName?: string;
  series?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = addBookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const userId = await requireUserId();
  try {
    await db.book.create({
      data: {
        userId,
        isbn: parsed.data.isbn,
        title: parsed.data.title,
        author: parsed.data.author,
        coverUrl: parsed.data.coverUrl,
        numberOfPages: parsed.data.numberOfPages,
        publishers: parsed.data.publishers,
        publishDate: parsed.data.publishDate,
        publishPlaces: parsed.data.publishPlaces,
        languages: parsed.data.languages,
        subjects: parsed.data.subjects,
        isbn10: parsed.data.isbn10,
        isbn13: parsed.data.isbn13,
        subtitle: parsed.data.subtitle,
        editionName: parsed.data.editionName,
        series: parsed.data.series,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create book" };
  }
  // XP/achievements are non-blocking — book creation already succeeded
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
  revalidatePath("/books");
  return { ok: true };
}

export async function setBookStatus(
  bookId: string,
  status: "TO_READ" | "READING" | "FINISHED",
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) throw new Error("Not found");

  // v2.7.0 (user rule): a book with a known page count can only be finished
  // when ALL of its pages have been read — early manual finish is blocked.
  // Books without a page count keep manual finishing.
  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;
  if (status === "FINISHED" && knownPages && (book.currentPage ?? 0) < totalPages) {
    return { ok: false, error: "RemainingPages" };
  }

  // Conditional update acts as an atomic guard: only transitions that change
  // the current status take effect, so concurrent FINISHED requests award XP once.
  const updated = await db.book.updateMany({
    where: { id: bookId, userId, status: { not: status } },
    data: {
      status,
      finishedAt: status === "FINISHED" ? new Date() : null,
      ...(status !== "TO_READ" && !book.startedAt ? { startedAt: new Date() } : {}),
    },
  });

  if (status === "FINISHED" && updated.count > 0) {
    // One read event per completion (re-reads each add +1).
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
    const { finishBookWithXp } = await import("./streak");
    await finishBookWithXp(bookId, knownPages ? totalPages : null);
  }
  revalidatePath("/books");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}

/**
 * v2.7.0 — "I read N pages" (streak-only): advances the book's currentPage by
 * the configured step, feeds DailyActivity/streaks and awards page-based XP.
 * It does NOT count the book as finished and does NOT write a read event —
 * a book is only finished when ALL of its pages have been read, which
 * triggers the automatic FINISHED transition (+1 booksRead, finish XP).
 */
export async function logPagesRead(
  bookId: string,
  pages?: number,
): Promise<{ ok: boolean; logged?: number; finished?: boolean; streak?: number; error?: string }> {
  const userId = await requireUserId();
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return { ok: false, error: "Not found" };

  const settings = await getAppConfig();
  const pagesLogged = Math.max(1, Math.min(5000, Math.floor(pages ?? settings.pagesPerReadEvent)));
  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;
  const current = book.currentPage ?? 0;
  const newCurrent = knownPages ? Math.min(current + pagesLogged, totalPages) : current + pagesLogged;

  // v2.9.0 — "currentPage still holds the value this call read". Books never
  // opened store NULL, not 0, so the unchanged-check must match both.
  const currentPageUnchanged =
    current === 0 ? { OR: [{ currentPage: 0 }, { currentPage: null as null }] } : { currentPage: current };

  // All pages read → automatic FINISH: one read event + finish XP
  // (finishBookWithXp also records the activity, so skip the plain log below).
  // v2.9.0 — optimistic lock: the transition only fires when currentPage still
  // holds the value this call read and the book is not FINISHED yet, so a
  // concurrent duplicate call can never award a second read event / finish XP.
  if (knownPages && newCurrent >= totalPages) {
    const finished = await db.book.updateMany({
      where: { id: bookId, userId, ...currentPageUnchanged, status: { not: "FINISHED" } },
      data: { status: "FINISHED", finishedAt: new Date(), currentPage: totalPages },
    });
    if (finished.count === 0) return { ok: false, error: "Conflict, please retry" };
    try {
      await db.bookReadEvent.create({
        data: { userId, bookId: book.id, bookTitle: book.title, pagesRead: totalPages },
      });
    } catch {}
    const { finishBookWithXp } = await import("./streak");
    await finishBookWithXp(bookId, totalPages);
    const user = await db.user.findUnique({ where: { id: userId }, select: { currentStreak: true } });
    revalidatePath("/books");
    revalidatePath("/stats");
    return { ok: true, logged: pagesLogged, finished: true, streak: user?.currentStreak ?? 0 };
  }

  // v2.9.0 — optimistic lock: the write only applies when currentPage still
  // holds the value this call read. A concurrent call that already advanced
  // the page counter makes this write a no-op (count 0) — report a conflict
  // instead of silently losing the other call's progress or double-awarding XP.
  const updateData: { currentPage: number; status?: "READING"; startedAt?: Date } = { currentPage: newCurrent };
  if (book.status === "TO_READ") {
    // Reading progress implies the book has been started.
    updateData.status = "READING";
    if (!book.startedAt) updateData.startedAt = new Date();
  }
  const updated = await db.book.updateMany({
    where: { id: bookId, userId, ...currentPageUnchanged },
    data: updateData,
  });
  if (updated.count === 0) return { ok: false, error: "Conflict, please retry" };

  // Streak-only path: no read event, no finish bonus XP. XP/activity are
  // awarded only after the write is confirmed. v2.9.6 — the recalculated
  // streak is returned so the UI can acknowledge the press.
  const { recordActivity } = await import("./streak");
  const { current: streakNow } = await recordActivity(pagesLogged);
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

  revalidatePath("/books");
  revalidatePath("/stats");
  return { ok: true, logged: pagesLogged, streak: streakNow };
}

/**
 * v2.7.0 — start re-reading a finished book: page counter resets to 0, the
 * book returns to READING; when all pages are read again the automatic
 * FINISHED transition adds another read event (+1).
 */
export async function startReRead(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) return { ok: false, error: "Not found" };
  if (book.status !== "FINISHED") return { ok: false, error: "Not finished" };

  await db.book.update({
    where: { id: bookId },
    data: { status: "READING", currentPage: 0, finishedAt: null },
  });
  revalidatePath("/books");
  revalidatePath("/stats");
  return { ok: true };
}

export async function updateBook(
  bookId: string,
  data: Partial<{
    title: string;
    subtitle: string;
    author: string;
    authors: string;
    publishers: string;
    publishDate: string;
    publishPlaces: string;
    editionName: string;
    series: string;
    numberOfPages: string;
    languages: string;
    isbn10: string;
    isbn13: string;
    subjects: string;
    rating: number;
    notes: string;
    tags: string;
    signed: boolean;
    copies: number;
    currentPage: number;
  }>,
) {
  const parsed = updateBookSchema.partial().safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const userId = await requireUserId();
  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) throw new Error("Not found");
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
  await db.book.update({ where: { id: bookId }, data: update });
  revalidatePath("/books");
  revalidatePath(`/books/${bookId}`);
}

/**
 * v2.9.6 — backfill missing page counts: for the caller's books that have no
 * numberOfPages but do carry an ISBN, look them up on Open Library (throttled)
 * and fill ONLY numberOfPages — user-entered metadata is never overwritten.
 */
// v3.0.0 — chunk sizes come from config.yaml (backfill.chunkSize / maxBatch);
// chunked so one request cannot run for minutes or get killed by the "3
// consecutive failures" abort of the bulk fetcher; the button can simply be
// pressed again while books remain.

export async function backfillPageCounts(): Promise<{
  ok: boolean;
  filled?: number;
  notFound?: number;
  remaining?: number;
  error?: string;
}> {
  const userId = await requireUserId();
  try {
    const cfg = await getAppConfig();
    const BACKFILL_CHUNK = cfg.backfillChunkSize;
    const MAX_BACKFILL_BATCH = cfg.backfillMaxBatch;
    const missing = await db.book.findMany({
      where: { userId, numberOfPages: null, isbn: { not: null } },
      select: { isbn: true },
      orderBy: { addedAt: "asc" },
    });
    const remaining = missing.length;
    const batchIsbns = [
      ...new Set(missing.map((b) => (b.isbn as string).replace(/[^0-9Xx]/g, "")).filter((v) => v.length > 0)),
    ].slice(0, MAX_BACKFILL_BATCH);
    if (batchIsbns.length === 0) return { ok: true, filled: 0, notFound: 0, remaining: 0 };

    const pagesByIsbn = new Map<string, string>();
    let failed = 0;
    for (let i = 0; i < batchIsbns.length; i += BACKFILL_CHUNK) {
      const chunk = batchIsbns.slice(i, i + BACKFILL_CHUNK);
      const found = await lookupIsbns(chunk).catch(() => [] as IsbnLookupResult[]);
      let chunkFailures = 0;
      for (const isbn of chunk) {
        const hit = found.find((f) => f.isbn === isbn);
        if (hit?.numberOfPages) pagesByIsbn.set(isbn, hit.numberOfPages);
        else chunkFailures++;
      }
      failed += chunkFailures;
      // If the network died, stop rather than hammering the API pointlessly.
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
    revalidatePath("/books");
    const remainingAfter = remaining - filled;
    return { ok: true, filled, notFound: failed, remaining: Math.max(0, remainingAfter) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Backfill failed" };
  }
}
