// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — pure grouping tests for the Series/Authors views and the OPDS
// 1.2 feed XML builders.

import { describe, it, expect } from "vitest";
import { groupSeries, groupAuthors } from "@/lib/collections";
import { esc, opdsAcquisitionFeed, opdsNavigationFeed } from "@/lib/opds";
import type { Book } from "@/generated/prisma/client";

function book(partial: Partial<Book> & { id: string }): Book {
  return {
    userId: "u",
    isbn: null,
    title: "T",
    author: null,
    coverUrl: null,
    coverFetchedAt: null,
    status: "TO_READ" as never,
    addedAt: new Date("2026-01-01"),
    finishedAt: null,
    subtitle: null,
    publishers: null,
    publishDate: null,
    publishPlaces: null,
    editionName: null,
    series: null,
    numberOfPages: null,
    languages: null,
    isbn10: null,
    isbn13: null,
    subjects: null,
    rating: 0,
    notes: null,
    tags: null,
    startedAt: null,
    signed: false,
    copies: 1,
    currentPage: null,
    koboSpentMinutes: 0,
    koboRemainingMinutes: null,
    lendingRecords: [],
    readEvents: [],
    groupMemberships: [],
    ...partial,
  } as Book;
}

describe("groupSeries (v3.2.0)", () => {
  it("groups books by series and counts finished", () => {
    const books = [
      book({ id: "1", series: "Dune", status: "FINISHED" as never }),
      book({ id: "2", series: "Dune", status: "READING" as never }),
      book({ id: "3", series: "Dune", status: "TO_READ" as never }),
      book({ id: "4", series: " Discworld ", status: "FINISHED" as never }),
      book({ id: "5", series: null }),
    ];
    const series = groupSeries(books);
    expect(series).toHaveLength(2);
    expect(series[0].name).toBe("Dune");
    expect(series[0].total).toBe(3);
    expect(series[0].finished).toBe(1);
    expect(series[1].name).toBe("Discworld"); // trimmed
  });

  it("orders most books first, then alphabetically", () => {
    const books = [
      book({ id: "1", series: "A" }),
      book({ id: "2", series: "C" }),
      book({ id: "3", series: "C" }),
      book({ id: "4", series: "B" }),
      book({ id: "5", series: "B" }),
      book({ id: "6", series: "B" }),
    ];
    const series = groupSeries(books);
    expect(series.map((s) => s.name)).toEqual(["B", "C", "A"]);
  });
});

describe("groupAuthors (v3.2.0)", () => {
  it("groups by author with finished/reading counts", () => {
    const books = [
      book({ id: "1", author: " Ursula K. Le Guin ", status: "FINISHED" as never }),
      book({ id: "2", author: "Ursula K. Le Guin", status: "READING" as never }),
      book({ id: "3", author: "Ted Chiang", status: "TO_READ" as never }),
    ];
    const authors = groupAuthors(books);
    expect(authors).toHaveLength(2);
    expect(authors[0].name).toBe("Ursula K. Le Guin");
    expect(authors[0].reading).toBe(1);
    expect(authors[1].name).toBe("Ted Chiang");
  });
});

describe("OPDS 1.2 feeds (v3.2.0)", () => {
  const meta = {
    id: "urn:bookshelf:root",
    title: "BookShelf",
    selfHref: "http://localhost:3000/api/opds/tok",
    updated: new Date("2026-09-18T00:00:00Z"),
  };

  it("escapes XML special characters", () => {
    expect(esc("<b>&\"' >")).toBe("&lt;b&gt;&amp;&quot;&apos; &gt;");
  });

  it("navigation feed declares entries with alternate links", () => {
    const feed = opdsNavigationFeed(meta, [
      { id: "urn:bookshelf:all", title: "All books", href: `${meta.selfHref}/all`, content: "3 books" },
    ]);
    expect(feed).toContain('xmlns="http://www.w3.org/2005/Atom"');
    expect(feed).toContain("opds-catalog");
    expect(feed).toContain('rel="self"');
    expect(feed).toContain("All books");
    expect(feed).not.toContain('rel="http://opds-spec.org/acquisition"'); // nav entries link feeds, not files
  });

  it("acquisition feed carries image + EPUB download links and escapes titles", () => {
    const feed = opdsAcquisitionFeed({
      ...meta,
      upHref: meta.selfHref,
      books: [
        {
          id: "urn:bookshelf:1",
          title: 'Weird & "Quoted" <Title>',
          author: "O'Connor",
          summary: null,
          language: "tr",
          coverUrl: "https://covers.example/1.jpg",
          downloadHref: "http://localhost:3000/api/kobo/t/download/1/epub",
          updated: new Date("2026-01-01"),
        },
      ],
    });
    expect(feed).toContain('rel="http://opds-spec.org/acquisition"');
    expect(feed).toContain('type="application/epub+zip"');
    expect(feed).toContain("image/thumbnail");
    expect(feed).toContain("&amp;");
    expect(feed).toContain("&apos;Connor");
    expect(feed).not.toContain('Quoted" <Title>');
    expect(feed).toContain('rel="up"');
  });
});
