// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — derived collections for the Series and Authors views. Pure grouping
// over the caller's books: series names come from the `series` metadata field,
// authors from `author`. No new tables — the Open Library data we already
// store becomes navigable.

import type { Book } from "@/generated/prisma/client";

export type SeriesGroup = {
  name: string;
  total: number;
  finished: number;
  books: Book[];
};

export type AuthorGroup = {
  name: string;
  total: number;
  finished: number;
  reading: number;
  books: Book[];
};

/**
 * Group the caller's books by series name. Books without a series value are
 * excluded. Order: most books first, then alphabetical.
 */
export function groupSeries(books: Book[]): SeriesGroup[] {
  const map = new Map<string, Book[]>();
  for (const book of books) {
    const name = (book.series ?? "").trim();
    if (!name) continue;
    const list = map.get(name) ?? [];
    list.push(book);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      total: list.length,
      finished: list.filter((b) => b.status === "FINISHED").length,
      books: sortBooks(list),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * Group the caller's books by author (trimmed, exact). Books without an
 * author are skipped. Order: most books first, then alphabetical.
 */
export function groupAuthors(books: Book[]): AuthorGroup[] {
  const map = new Map<string, Book[]>();
  for (const book of books) {
    const name = (book.author ?? "").trim();
    if (!name) continue;
    const list = map.get(name) ?? [];
    list.push(book);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      total: list.length,
      finished: list.filter((b) => b.status === "FINISHED").length,
      reading: list.filter((b) => b.status === "READING").length,
      books: sortBooks(list),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function sortBooks(list: Book[]): Book[] {
  return [...list].sort((a, b) => {
    // Reading first, then TO_READ, then FINISHED; newest added first within.
    const rank = (s: string) => (s === "READING" ? 0 : s === "TO_READ" ? 1 : 2);
    return rank(a.status) - rank(b.status) || a.addedAt.getTime() - b.addedAt.getTime();
  });
}
