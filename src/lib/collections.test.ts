// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { genresForBook, groupGenres } from "./collections";
import type { Book } from "@/generated/prisma/client";

function book(id: string, subjects: string | null, tags: string | null): Book {
  return { id, subjects, tags, title: id, status: "TO_READ", addedAt: new Date(), userId: "u" } as Book;
}

describe("automatic genre collections", () => {
  it("prefers subjects, splits comma/semicolon and deduplicates per book", () => {
    expect(genresForBook(book("1", " Fantasy; fantasy, Space Opera ", "ignored"))).toEqual(["Fantasy", "Space Opera"]);
  });

  it("falls back to tags and merges case-insensitively across books", () => {
    const groups = groupGenres([book("1", null, "History"), book("2", "history; Memoir", "ignored")]);
    expect(groups.map((group) => [group.name, group.total])).toEqual([["History", 2], ["Memoir", 1]]);
  });

  it("sorts by count then name so the first twelve are deterministic", () => {
    const books = Array.from({ length: 14 }, (_, index) => book(String(index), `Genre ${index}`, null));
    books.push(book("popular", "Genre 13", null));
    const top = groupGenres(books).slice(0, 12);
    expect(top[0]).toMatchObject({ name: "Genre 13", total: 2 });
    expect(top).toHaveLength(12);
  });
});
