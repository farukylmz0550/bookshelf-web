// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { buildHealthReport, type HealthBook } from "./health";

const book = (overrides: Partial<HealthBook> = {}): HealthBook => ({
  id: "book-1",
  title: "The Dispossessed",
  author: "Ursula K. Le Guin",
  coverUrl: "https://example.com/cover.jpg",
  publishers: "Harper",
  publishDate: "1974",
  numberOfPages: "341",
  languages: "eng",
  isbn: "9780441478125",
  isbn10: null,
  isbn13: "9780441478125",
  status: "TO_READ",
  currentPage: 0,
  copies: 1,
  ...overrides,
});

describe("buildHealthReport", () => {
  it("reports missing metadata and invalid values without mutating the input", () => {
    const input = book({ author: null, isbn: "bad", numberOfPages: "0", currentPage: 2, copies: 0 });
    const report = buildHealthReport([input], "2026-10-30T00:00:00.000Z");
    expect(report.generatedAt).toBe("2026-10-30T00:00:00.000Z");
    expect(report.findings.map((finding) => finding.findingCode)).toEqual([
      "invalid_copies",
      "invalid_isbn",
      "invalid_page_count",
      "invalid_progress",
      "missing_author",
    ]);
    expect(input).toEqual(book({ author: null, isbn: "bad", numberOfPages: "0", currentPage: 2, copies: 0 }));
  });

  it("keeps duplicate detection inside the supplied collection", () => {
    const report = buildHealthReport([
      book({ id: "a" }),
      book({ id: "b", title: "The Dispossessed", author: "Ursula K. Le Guin" }),
      book({
        id: "other-user-book",
        title: "The Left Hand of Darkness",
        author: "Ursula K. Le Guin",
        isbn: "9780140449136",
        isbn13: "9780140449136",
      }),
    ]);
    expect(
      report.findings.filter((finding) => finding.findingCode === "duplicate_isbn").map((finding) => finding.bookId),
    ).toEqual(["a", "b"]);
    expect(
      report.findings
        .filter((finding) => finding.findingCode === "possible_duplicate_title_author")
        .map((finding) => finding.bookId),
    ).toEqual(["a", "b"]);
  });

  it("sorts findings deterministically", () => {
    const first = buildHealthReport([book({ id: "z", author: null }), book({ id: "a", isbn: "bad" })], "same");
    const second = buildHealthReport([book({ id: "z", author: null }), book({ id: "a", isbn: "bad" })], "same");
    expect(first).toEqual(second);
  });
});
