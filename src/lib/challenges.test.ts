// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — seasonal challenges, CSV import detection/parsing and backup
// helper tests.

import { describe, it, expect } from "vitest";
import { validateChallenge, challengeProgress, CHALLENGE_MAX_TARGET } from "@/lib/challenges";
import { detectCsvFormat, parseCalibreRows, parseStorygraphRows } from "@/lib/books/csv-import";
import { backupFileName, pruneSelection, sqlitePathFromUrl } from "@/lib/backup";
import { validateAppConfig } from "@/lib/app-config";

describe("challenge validation (v3.3.0)", () => {
  const base = {
    title: "Winter reading",
    target: 5,
    startAt: new Date("2026-12-21"),
    endAt: new Date("2027-03-20"),
  };

  it("accepts a valid challenge", () => {
    expect(validateChallenge(base)).toBeNull();
  });

  it("rejects end before start and windows beyond a year", () => {
    expect(validateChallenge({ ...base, endAt: base.startAt })).toBe("InvalidWindow");
    expect(validateChallenge({ ...base, startAt: new Date("2026-01-01"), endAt: new Date("2027-06-01") })).toBe(
      "WindowTooLong",
    );
  });

  it("rejects out-of-range targets and bad titles", () => {
    expect(validateChallenge({ ...base, target: 0 })).toBe("InvalidTarget");
    expect(validateChallenge({ ...base, target: CHALLENGE_MAX_TARGET + 1 })).toBe("InvalidTarget");
    expect(validateChallenge({ ...base, title: "" })).toBe("TitleRequired");
    expect(validateChallenge({ ...base, title: "x".repeat(81) })).toBe("TitleTooLong");
  });
});

describe("challenge progress (v3.3.0)", () => {
  const c = {
    id: "c1",
    title: "Winter",
    target: 3,
    startAt: new Date("2026-12-01"),
    endAt: new Date("2027-01-31"),
    completedAt: null,
  };
  const dates = [new Date("2026-12-25"), new Date("2027-01-05"), new Date("2027-01-10"), new Date("2027-02-01")];

  it("counts only read events inside the window", () => {
    const p = challengeProgress(c, dates, new Date("2027-01-15"));
    expect(p.done).toBe(3);
    expect(p.completed).toBe(true);
    expect(p.upcoming).toBe(false);
  });

  it("marks not-yet-started challenges as upcoming", () => {
    const p = challengeProgress(c, dates, new Date("2026-11-30"));
    expect(p.upcoming).toBe(true); // done counts events in-window regardless of now
  });

  it("respects an existing completedAt regardless of counts", () => {
    const p = challengeProgress({ ...c, completedAt: new Date("2027-01-05") }, [], new Date());
    expect(p.completed).toBe(true);
  });
});

describe("CSV import detection (v3.3.0)", () => {
  it("detects the three supported sources by header", () => {
    expect(detectCsvFormat("Title,Author,ISBN,My Rating,Bookshelves,Date Read\r\n")).toBe("goodreads");
    expect(detectCsvFormat('Title,Authors,"Read Status",ISBN,Number of Pages,Date Read\n')).toBe("storygraph");
    expect(detectCsvFormat("Title,Authors,ISBN,Tags,Publisher,Comments,Series\n")).toBe("calibre");
    expect(detectCsvFormat("Some,Random,Columns\n")).toBeNull();
  });
});

describe("calibre + storygraph parsing (v3.3.0)", () => {
  it("maps calibre rows incl. pages, series and publisher", () => {
    const csv = [
      "Title,Authors,ISBN,Tags,Publisher,Published,Rating,Pages,Read,Comments,Series",
      '"Dune","Frank Herbert","9780441013593","sci-fi","Ace",2020,4.5,412,"yes","<i>classic</i>","Dune"',
      ",,not-an-isbn,,Ace,,0,,no,,",
    ].join("\n");
    const res = parseCalibreRows(csv);
    if ("error" in res) throw new Error(res.error);
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.title).toBe("Dune");
    expect(row.author).toBe("Frank Herbert");
    expect(row.isbn).toBe("9780441013593");
    expect(row.status).toBe("FINISHED");
    expect(row.dateRead?.getUTCFullYear()).toBe(2020);
    expect(row.pages).toBe(412);
    expect(row.series).toBe("Dune");
    expect(row.publishers).toBe("Ace");
    expect(res.invalidRows.length).toBeGreaterThan(0); // bad rows skipped
  });

  it("maps storygraph rows incl. read status and pages", () => {
    const csv = [
      "Title,Authors,ISBN,ISBN13,My Rating,Number of Pages,Publisher,Date Read,Read Status",
      "Project Hail Mary,Andy Weir,,9780593135204,5,476,Ballantine,2024/03/15,read",
      "Dune,Frank Herbert,,,,,,,currently-reading",
    ].join("\n");
    const res = parseStorygraphRows(csv);
    if ("error" in res) throw new Error(res.error);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].status).toBe("FINISHED");
    expect(res.rows[0].pages).toBe(476);
    expect(res.rows[1].status).toBe("READING");
    expect(res.rows[1].pages).toBeNull();
  });
});

describe("backup helpers (v3.3.0)", () => {
  it("formats the UTC filename", () => {
    expect(backupFileName(new Date(Date.UTC(2026, 8, 18)))).toBe("bookshelf-20260918.db");
  });

  it("prunes beyond retention, newest first", () => {
    const files = [
      "bookshelf-20260918.db",
      "bookshelf-20260917.db",
      "bookshelf-20260916.db",
      "bookshelf-20260916.db",
      "bookshelf-20260915.db",
    ];
    expect(pruneSelection(files, 2)).toEqual([
      "bookshelf-20260916.db",
      "bookshelf-20260916.db",
      "bookshelf-20260915.db",
    ]);
  });

  it("extracts the sqlite path from DATABASE_URL", () => {
    expect(sqlitePathFromUrl("file:/data/bookshelf.db")).toBe("/data/bookshelf.db");
    expect(sqlitePathFromUrl('"file:./prisma/dev.db"')).toBe("./prisma/dev.db");
    expect(sqlitePathFromUrl("postgres://x")).toBeNull();
    expect(sqlitePathFromUrl(undefined)).toBeNull();
  });
});

describe("config challenges (v3.3.0)", () => {
  it("loads completion XP with defaults and overrides", () => {
    expect(defaultsOf({}).challengeCompletionXp).toBe(25);
    expect(defaultsOf({ challenges: { completionXp: 40 } }).challengeCompletionXp).toBe(40);
  });

  function defaultsOf(doc: unknown) {
    return validateAppConfig(doc);
  }
});
