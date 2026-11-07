// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { toOpenLibraryImportPayload } from "./openlibrary-submissions";

describe("toOpenLibraryImportPayload", () => {
  it("maps detailed manual metadata to the Open Library import schema", () => {
    expect(
      toOpenLibraryImportPayload({
        id: "book-1",
        title: "The Book",
        subtitle: "A Subtitle",
        author: "Author One, Author Two",
        publishers: "Publisher One; Publisher Two",
        publishDate: "2024",
        numberOfPages: "320",
        languages: "eng, tr",
        subjects: "fiction; history",
        isbn10: "0-123-45678-X",
        isbn13: "978-0123456789",
      }),
    ).toEqual({
      title: "The Book",
      subtitle: "A Subtitle",
      authors: [{ name: "Author One" }, { name: "Author Two" }],
      publishers: ["Publisher One", "Publisher Two"],
      publish_date: "2024",
      number_of_pages: 320,
      languages: ["eng", "tr"],
      subjects: ["fiction", "history"],
      isbn_10: ["0-123-45678-X"],
      isbn_13: ["978-0123456789"],
      source_records: ["bookshelf:book-1"],
    });
  });

  it("omits blank optional fields and invalid page counts", () => {
    expect(
      toOpenLibraryImportPayload({
        id: "book-2",
        title: "Minimal",
        author: "",
        publishers: null,
        publishDate: "",
        numberOfPages: "not-a-number",
        languages: " ; ",
        subjects: undefined,
        isbn10: "",
        isbn13: null,
      }),
    ).toEqual({ title: "Minimal", source_records: ["bookshelf:book-2"] });
  });

  it("splits multiline metadata and trims each value", () => {
    const payload = toOpenLibraryImportPayload({
      id: "book-3",
      title: "Trimmed",
      author: "  Jane Doe\nJane Roe  ",
      subjects: "  one, two\n three ",
    });

    expect(payload.authors).toEqual([{ name: "Jane Doe" }, { name: "Jane Roe" }]);
    expect(payload.subjects).toEqual(["one", "two", "three"]);
  });
});
