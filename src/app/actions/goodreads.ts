// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  GOODREADS_CSV_MAX_BYTES,
  GOODREADS_MAX_ERROR_MESSAGES,
  GOODREADS_MAX_ROWS,
  parseGoodreadsRows,
  type GoodreadsRow,
} from "@/lib/books/goodreads";
import { lookupIsbns, type IsbnLookupResult } from "@/lib/isbn";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";

export type GoodreadsImportResult = {
  imported: number;
  duplicates: number;
  invalid: number;
  lookupFailed: number;
  errors: string[];
  /** Machine-readable code (invalidCsv | fileTooLarge | tooManyRows | noValidBooks) or an unexpected message. */
  error?: string;
};

/**
 * Import a Goodreads-exported CSV into the current user's library.
 * Flow: parse rows → Zod validation → Open Library enrichment with one
 * request per unique ISBN (§19) → duplicate check (ISBN + exact title/author)
 * → batch creation scoped to the authenticated user.
 */
export async function importGoodreadsCsv(base64: string): Promise<GoodreadsImportResult> {
  const userId = await requireUserId();
  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > GOODREADS_CSV_MAX_BYTES) throw new Error("FileTooLarge");
    const text = buffer.toString("utf8");

    const parsed = parseGoodreadsRows(text);
    if ("error" in parsed) {
      return { imported: 0, duplicates: 0, invalid: 0, lookupFailed: 0, errors: [], error: "invalidCsv" };
    }
    if (parsed.rows.length > GOODREADS_MAX_ROWS) {
      return { imported: 0, duplicates: 0, invalid: 0, lookupFailed: 0, errors: [], error: "tooManyRows" };
    }
    if (parsed.rows.length === 0) {
      return {
        imported: 0,
        duplicates: 0,
        invalid: parsed.invalidRows.length,
        lookupFailed: 0,
        errors: parsed.invalidRows.slice(0, GOODREADS_MAX_ERROR_MESSAGES),
        error: "noValidBooks",
      };
    }

    // In-memory duplicate check — derives only from the current user's rows,
    // so one user's library can never affect another's (§8/§11).
    const owned = await db.book.findMany({
      where: { userId },
      select: { isbn: true, title: true, author: true },
    });
    const ownedIsbns = new Set(owned.map((b) => b.isbn).filter((v): v is string => !!v));
    const ownedTitles = new Set(
      owned.map((b) => `${b.title.trim().toLowerCase()}|${(b.author ?? "").trim().toLowerCase()}`),
    );

    const isDuplicate = (r: GoodreadsRow) =>
      (r.isbn && ownedIsbns.has(r.isbn)) ||
      (!r.isbn && ownedTitles.has(`${r.title.toLowerCase()}|${(r.author ?? "").toLowerCase()}`));

    const candidate = parsed.rows.filter((r) => !isDuplicate(r));
    const duplicateCount = parsed.rows.length - candidate.length;

    // Open Library enrichment — one request per unique ISBN of importable rows.
    const uniqueIsbns = [...new Set(candidate.map((r) => r.isbn).filter((v): v is string => !!v))];
    const enriched = new Map<string, IsbnLookupResult>();
    if (uniqueIsbns.length > 0) {
      try {
        const found = await lookupIsbns(uniqueIsbns);
        for (const f of found) enriched.set(f.isbn, f);
      } catch {
        // Enrichment, not a dependency — rows import with Goodreads data alone.
      }
    }
    const lookupFailed = uniqueIsbns.filter((isbn) => !enriched.has(isbn)).length;

    const data = candidate.map((r) => {
      const ol = r.isbn ? enriched.get(r.isbn) : undefined;
      return {
        userId,
        isbn: r.isbn,
        isbn13: r.isbn13,
        title: r.title,
        author: r.author ?? ol?.author ?? null,
        coverUrl: ol?.coverUrl ?? null,
        coverFetchedAt: ol?.coverUrl ? new Date() : null,
        rating: r.rating,
        tags: r.tags.length > 0 ? r.tags.join(",") : null,
        notes: r.notes,
        status: (r.status ?? (r.dateRead ? "FINISHED" : "TO_READ")) as "TO_READ" | "READING" | "FINISHED",
        finishedAt: r.dateRead ?? null,
        numberOfPages: ol?.numberOfPages ?? null,
        publishers: ol?.publishers ?? null,
        subjects: ol?.subjects ?? null,
        languages: ol?.languages ?? null,
        subtitle: null,
        startedAt: null,
      };
    });

    let imported = 0;
    if (data.length > 0) {
      try {
        const res = await db.book.createMany({ data });
        imported = res.count;
      } catch {
        // Batch failed — fall back to row-by-row creation so a single bad
        // row cannot abort the whole import (partial success, §15).
        for (const row of data) {
          try {
            await db.book.create({ data: row });
            imported += 1;
          } catch {
            // not counted as imported
          }
        }
      }
    }

    if (imported > 0) {
      revalidatePath("/books");
      await awardXp(userId, imported * (await getAppConfig()).xpBookAdded);
      await syncAchievements(userId);
    }

    return {
      imported,
      duplicates: duplicateCount,
      invalid: parsed.invalidRows.length,
      lookupFailed,
      errors: parsed.invalidRows.slice(0, GOODREADS_MAX_ERROR_MESSAGES),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "FileTooLarge") {
      return {
        imported: 0,
        duplicates: 0,
        invalid: 0,
        lookupFailed: 0,
        errors: [],
        error: "fileTooLarge",
      };
    }
    return { imported: 0, duplicates: 0, invalid: 0, lookupFailed: 0, errors: [], error: msg };
  }
}
