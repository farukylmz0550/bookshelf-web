// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { buildAnnualSummary, monthlyFinishCounts, parsePageCount, type AnnualReadEvent } from "@/lib/stats";
import { longestStreakWithinYear } from "@/lib/streak";
import { shareCardData } from "@/lib/share-card";
import { goalProgressNotification } from "@/lib/goal-progress";
import { moodForProgress, pieceForYear } from "@/lib/annual-music";
import { isGoalUnlocked } from "@/lib/goals";
import { isAnnualSummaryWindow, parseSelectedYear } from "@/lib/annual";
import { defaultAppConfig, validateAppConfig } from "@/lib/app-config";
import { calculateFinishXp, levelForXp, levelProgress, xpForNextLevel } from "@/lib/gamification-pure";

describe("monthlyFinishCounts", () => {
  it("returns 6 buckets for last 6 months", () => {
    const result = monthlyFinishCounts([], new Date("2024-06-15"));
    expect(result).toHaveLength(6);
  });

  it("counts finished books per month", () => {
    const dates = [new Date("2024-04-10"), new Date("2024-04-20"), new Date("2024-05-05")];
    const result = monthlyFinishCounts(dates, new Date("2024-06-01"));
    const april = result.find((r) => r.month === "Apr");
    const may = result.find((r) => r.month === "May");
    expect(april?.count).toBe(2);
    expect(may?.count).toBe(1);
  });

  it("returns zeros for months with no finished books", () => {
    const result = monthlyFinishCounts([], new Date("2024-06-01"));
    expect(result.every((r) => r.count === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Annual Reading Summary (v2.7.0 — read-event based)
// ---------------------------------------------------------------------------

let nextId = 0;
function event(overrides: Partial<AnnualReadEvent> = {}): AnnualReadEvent {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    bookId: `book-${nextId}`,
    bookTitle: "Untitled",
    author: null,
    bookPages: null,
    tags: null,
    pagesRead: null,
    readAt: new Date(2026, 5, 15),
    ...overrides,
  };
}

describe("parsePageCount", () => {
  it("rejects invalid/zero page counts (E)", () => {
    expect(parsePageCount(null)).toBeNull();
    expect(parsePageCount("")).toBeNull();
    expect(parsePageCount("abc")).toBeNull();
    expect(parsePageCount("0")).toBeNull();
    expect(parsePageCount("-5")).toBeNull();
  });

  it("accepts positive integers (E)", () => {
    expect(parsePageCount(" 304 ")).toBe(304);
    expect(parsePageCount("1")).toBe(1);
  });
});

describe("buildAnnualSummary", () => {
  it("reports an empty year as no data (A)", () => {
    const summary = buildAnnualSummary(2026, [], [], 0);
    expect(summary.booksRead).toBe(0);
    expect(summary.pagesRead).toBeNull();
    expect(summary.averagePages).toBeNull();
    expect(summary.topAuthor).toBeNull();
    expect(summary.topGenre).toBeNull();
    expect(summary.firstBook).toBeNull();
    expect(summary.lastBook).toBeNull();
    expect(summary.monthlyBooks).toHaveLength(12);
    expect(summary.monthlyBooks.every((m) => m === 0)).toBe(true);
  });

  it("counts multiple read events in the same year (B)", () => {
    const summary = buildAnnualSummary(2026, [event(), event(), event()], [], 0);
    expect(summary.booksRead).toBe(3);
  });

  it("filters events by year (C, O)", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ readAt: new Date(2025, 11, 31) }), event({ readAt: new Date(2026, 0, 1) }), event()],
      [],
      0,
    );
    expect(summary.booksRead).toBe(2);
  });

  it("counts re-reads: the same book read twice adds +1 twice (user rule)", () => {
    const summary = buildAnnualSummary(
      2026,
      [
        event({ bookId: "b1", readAt: new Date(2026, 1, 1), pagesRead: 134 }),
        event({ bookId: "b1" in {} ? "b1" : "b1", readAt: new Date(2026, 3, 1), pagesRead: 134 }),
      ],
      [],
      0,
    );
    expect(summary.booksRead).toBe(2);
  });

  it("sums page data from read events (D)", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ pagesRead: 134 }), event({ pagesRead: 20 }), event({ pagesRead: null })],
      [],
      0,
    );
    expect(summary.pagesRead).toBe(154);
    expect(summary.pagesKnown).toBe(2);
  });

  it("missing page data is not zero and does not block other stats (E, P)", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ pagesRead: null, bookTitle: "No Pages" }), event({ pagesRead: 100, author: "A" })],
      [],
      0,
    );
    expect(summary.pagesRead).toBe(100);
    expect(summary.pagesKnown).toBe(1);
    expect(summary.averagePages).toBe(100);
    expect(summary.booksRead).toBe(2);
  });

  it("averages only events with valid page counts (F)", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ pagesRead: 150 }), event({ pagesRead: 250 }), event({ pagesRead: null })],
      [],
      0,
    );
    expect(summary.pagesKnown).toBe(2);
    expect(summary.averagePages).toBe(200);
  });

  it("assigns events to the correct months, zero-filled and ordered (G)", () => {
    const summary = buildAnnualSummary(
      2026,
      [
        event({ readAt: new Date(2026, 0, 10) }),
        event({ readAt: new Date(2026, 0, 20) }),
        event({ readAt: new Date(2026, 9, 1) }),
      ],
      [],
      0,
    );
    expect(summary.monthlyBooks[0]).toBe(2);
    expect(summary.monthlyBooks[9]).toBe(1);
    expect(summary.monthlyBooks.filter((_, i) => i !== 0 && i !== 9).every((m) => m === 0)).toBe(true);
    expect(summary.monthlyBooks).toHaveLength(12);
  });

  it("aggregates the most-read author across re-reads (H)", () => {
    const summary = buildAnnualSummary(
      2026,
      [
        event({ author: "Orhan Pamuk" }),
        event({ author: "Orhan Pamuk" }),
        event({ author: "Liu, Cixin" }),
        event({ author: "" }),
      ],
      [],
      0,
    );
    expect(summary.topAuthor).toBe("Orhan Pamuk");
    expect(summary.topAuthorCount).toBe(2);
    expect(summary.uniqueAuthors).toBe(2);
  });

  it("omits the author metric when no valid author exists (P)", () => {
    const summary = buildAnnualSummary(2026, [event({ author: null }), event({ author: "   " })], [], 0);
    expect(summary.topAuthor).toBeNull();
    expect(summary.uniqueAuthors).toBe(0);
  });

  it("counts each distinct tag once per event (I)", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ tags: "Fantasy, Classic" }), event({ tags: "fantasy" }), event({ tags: "classic, classic" })],
      [],
      0,
    );
    expect(summary.topGenre).toBe("Fantasy");
    expect(summary.topGenreCount).toBe(2);
    expect(summary.uniqueGenres).toBe(2);
  });

  it("computes reading days from activity days with count > 0 (J)", () => {
    const summary = buildAnnualSummary(
      2026,
      [],
      [
        { date: new Date(Date.UTC(2026, 0, 1)), count: 1 },
        { date: new Date(Date.UTC(2026, 0, 2)), count: 2 },
        { date: new Date(Date.UTC(2025, 11, 31)), count: 1 },
        { date: new Date(Date.UTC(2026, 2, 1)), count: 0 },
      ],
      0,
    );
    expect(summary.readingDays).toBe(2);
  });

  it("computes first/last read events chronologically (L)", () => {
    const first = event({ bookTitle: "First", readAt: new Date(2026, 1, 1) });
    const last = event({ bookTitle: "Last", readAt: new Date(2026, 11, 1) });
    const summary = buildAnnualSummary(2026, [last, first], [], 0);
    expect(summary.firstBook?.title).toBe("First");
    expect(summary.lastBook?.title).toBe("Last");
  });

  it("finds longest/shortest books by page count over distinct books (M)", () => {
    const summary = buildAnnualSummary(
      2026,
      [
        event({ bookId: "b1", bookTitle: "Mid", bookPages: "200" }),
        event({ bookId: "b2", bookTitle: "Long", bookPages: "900" }),
        event({ bookId: "b3", bookTitle: "Short", bookPages: "80" }),
      ],
      [],
      0,
    );
    expect(summary.longestBook?.title).toBe("Long");
    expect(summary.shortestBook?.title).toBe("Short");
  });

  it("longest/shortest dedupe re-reads of the same book (M)", () => {
    const summary = buildAnnualSummary(
      2026,
      [
        event({ bookId: "b1", bookTitle: "Long", bookPages: "900", readAt: new Date(2026, 0, 1) }),
        event({ bookId: "b1", bookTitle: "Long", bookPages: "900", readAt: new Date(2026, 6, 1) }),
        event({ bookId: "b2", bookTitle: "Short", bookPages: "80" }),
      ],
      [],
      0,
    );
    expect(summary.longestBook?.title).toBe("Long");
    expect(summary.shortestBook?.title).toBe("Short");
  });

  it("omits page extremes when no book has valid pages (P)", () => {
    const summary = buildAnnualSummary(2026, [event(), event()], [], 0);
    expect(summary.longestBook).toBeNull();
    expect(summary.shortestBook).toBeNull();
  });

  it("never fabricates yearly XP from the lifetime schema (§10)", () => {
    const summary = buildAnnualSummary(2026, [event()], [], 0);
    expect(summary.xpEarned).toBeNull();
  });
});

describe("longestStreakWithinYear", () => {
  function day(year: number, month: number, date: number) {
    return { date: new Date(Date.UTC(year, month, date)), count: 1 };
  }

  it("returns 0 with no activities (J)", () => {
    expect(longestStreakWithinYear([], 2026)).toBe(0);
  });

  it("measures the longest run inside the year (J)", () => {
    const activities = [day(2026, 0, 1), day(2026, 0, 2), day(2026, 0, 3), day(2026, 5, 1), day(2026, 5, 2)];
    expect(longestStreakWithinYear(activities, 2026)).toBe(3);
  });

  it("counts a run that began in the previous year whole (K)", () => {
    const activities = [day(2025, 11, 30), day(2025, 11, 31), day(2026, 0, 1), day(2026, 0, 2)];
    expect(longestStreakWithinYear(activities, 2026)).toBe(4);
  });

  it("counts a run continuing into the next year whole (K)", () => {
    const activities = [day(2026, 11, 30), day(2026, 11, 31), day(2027, 0, 1)];
    expect(longestStreakWithinYear(activities, 2026)).toBe(3);
  });

  it("ignores runs that do not overlap the year (O)", () => {
    const activities = [day(2025, 5, 1), day(2025, 5, 2), day(2025, 5, 3)];
    expect(longestStreakWithinYear(activities, 2026)).toBe(0);
  });
});

describe("shareCardData (Q)", () => {
  const labels = {
    brand: "Book Shelf",
    cardTitle: "My Reading Year",
    booksRead: "Books read",
    pagesRead: "Pages read",
    longestStreak: "Longest streak",
    mostReadAuthor: "Most-read author",
    mostReadGenre: "Most-read genre",
  };

  it("contains the expected summary values and omits unavailable metrics", () => {
    const summary = buildAnnualSummary(2026, [event()], [], 0);
    const card = shareCardData(summary, labels);
    expect(card.brand).toBe("Book Shelf");
    expect(card.year).toBe(2026);
    expect(card.stats[0]).toEqual({ label: "Books read", value: "1" });
    expect(card.stats).toHaveLength(1);
  });

  it("is deterministic — same summary produces identical card data", () => {
    const summary = buildAnnualSummary(
      2026,
      [event({ pagesRead: 300, author: "Orhan Pamuk", tags: "novel" })],
      [{ date: new Date(Date.UTC(2026, 3, 1)), count: 1 }],
      4,
    );
    expect(shareCardData(summary, labels)).toEqual(shareCardData(summary, labels));
  });
});

// ---------------------------------------------------------------------------
// v2.7.0 — mood-based piece selection
// ---------------------------------------------------------------------------

describe("moodForProgress + pieceForYear", () => {
  it("no goal → neutral", () => {
    expect(moodForProgress(5, 0)).toBe("neutral");
  });

  it("few books read relative to goal → sad (user rule)", () => {
    expect(moodForProgress(1, 10)).toBe("sad");
    expect(moodForProgress(2, 10)).toBe("sad");
  });

  it("mid progress → neutral, near-goal → happy", () => {
    expect(moodForProgress(4, 10)).toBe("neutral");
    expect(moodForProgress(7, 10)).toBe("happy");
    expect(moodForProgress(10, 10)).toBe("happy");
  });

  it("exceeding the yearly goal → the special celebration piece", () => {
    expect(moodForProgress(11, 10)).toBe("celebration");
    const piece = pieceForYear(2026, 11, 10);
    expect(piece.mood).toBe("celebration");
    expect(piece.slug).toBe("beethoven-ode-to-joy");
  });

  it("piece selection is deterministic within a mood pool", () => {
    expect(pieceForYear(2026, 2, 10)).toEqual(pieceForYear(2026, 2, 10));
    expect(pieceForYear(2026, 2, 10).mood).toBe("sad");
  });

  it("different years in the same mood pool can pick different pieces", () => {
    const pieces = new Set([2024, 2025, 2026, 2027].map((y) => pieceForYear(y, 2, 10).slug));
    expect(pieces.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// v2.7.0 — annual summary window (server-local, dev always open)
// ---------------------------------------------------------------------------

describe("isAnnualSummaryWindow + parseSelectedYear", () => {
  it("parses a valid 4-digit year", () => {
    expect(parseSelectedYear("2025", 2026)).toBe(2025);
    expect(parseSelectedYear(undefined, 2026)).toBe(2026);
    expect(parseSelectedYear("garbage", 2026)).toBe(2026);
    expect(parseSelectedYear("12345", 2026)).toBe(2026);
  });

  it("strict calendar window outside development (Jan 1–7, server-local)", () => {
    const original = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    try {
      expect(isAnnualSummaryWindow(new Date(2026, 0, 1, 0, 0, 0))).toBe(true);
      expect(isAnnualSummaryWindow(new Date(2026, 0, 3))).toBe(true);
      expect(isAnnualSummaryWindow(new Date(2026, 0, 7, 23, 59))).toBe(true);
      expect(isAnnualSummaryWindow(new Date(2026, 0, 8, 0, 0, 0))).toBe(false);
      expect(isAnnualSummaryWindow(new Date(2026, 5, 15))).toBe(false);
      expect(isAnnualSummaryWindow(new Date(2025, 11, 31))).toBe(false);
    } finally {
      Object.assign(process.env, { NODE_ENV: original });
    }
  });

  it("dev/e2e override: window always open", () => {
    const original = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "development" });
    try {
      expect(isAnnualSummaryWindow(new Date(2026, 5, 15))).toBe(true);
      expect(isAnnualSummaryWindow(new Date(2026, 0, 8))).toBe(true);
    } finally {
      Object.assign(process.env, { NODE_ENV: original });
    }
  });
});

// ---------------------------------------------------------------------------
// v2.7.0 — goal lock
// ---------------------------------------------------------------------------

describe("isGoalUnlocked", () => {
  it("unlocked when no goal exists", () => {
    expect(isGoalUnlocked(null, 2026)).toBe(true);
  });

  it("unlocked when never confirmed", () => {
    expect(isGoalUnlocked({ targetYear: null, confirmedAt: null }, 2026)).toBe(true);
  });

  it("locked for the confirmed year, unlocked for past years", () => {
    const goal = { targetYear: 2026, confirmedAt: new Date(2026, 0, 1) };
    expect(isGoalUnlocked(goal, 2026)).toBe(false);
    expect(isGoalUnlocked(goal, 2027)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// v2.7.0 — goal-progress notification calendar (rule A)
// ---------------------------------------------------------------------------

describe("goalProgressNotification", () => {
  it("day 1 announces the monthly target", () => {
    expect(goalProgressNotification(new Date(2026, 2, 1), 5, 0)).toEqual({ kind: "month-start", target: 5 });
  });

  it("day 10 reports count and percent (localized symbol handled by template)", () => {
    expect(goalProgressNotification(new Date(2026, 2, 10), 5, 2)).toEqual({
      kind: "progress",
      count: 2,
      percent: 40,
    });
    expect(goalProgressNotification(new Date(2026, 2, 20), 5, 3)).toEqual({
      kind: "progress",
      count: 3,
      percent: 60,
    });
  });

  it("last 3 days report remaining books", () => {
    // July has 31 days → last-3 window is 29..31
    expect(goalProgressNotification(new Date(2026, 6, 29), 5, 4)).toEqual({ kind: "final", remaining: 1 });
    expect(goalProgressNotification(new Date(2026, 6, 30), 5, 4)).toEqual({ kind: "final", remaining: 1 });
  });

  it("silences everything once the monthly goal is reached (rule A)", () => {
    expect(goalProgressNotification(new Date(2026, 2, 10), 5, 5)).toBeNull();
    expect(goalProgressNotification(new Date(2026, 2, 20), 5, 7)).toBeNull();
    expect(goalProgressNotification(new Date(2026, 6, 29), 5, 6)).toBeNull();
  });

  it("final notification only fires while books remain", () => {
    expect(goalProgressNotification(new Date(2026, 6, 29), 5, 5)).toBeNull();
  });

  it("no monthly goal → never notifies", () => {
    expect(goalProgressNotification(new Date(2026, 2, 1), 0, 3)).toBeNull();
  });

  it("day 1 ignores the reached goal (new month restarts counting)", () => {
    expect(goalProgressNotification(new Date(2026, 2, 1), 5, 9)).toEqual({ kind: "month-start", target: 5 });
  });
});

// ---------------------------------------------------------------------------
// v3.0.0 — config.yaml-driven values + parametric XP
// ---------------------------------------------------------------------------

describe("defaultAppConfig + validateAppConfig", () => {
  it("code defaults match the legacy v2.7.0 values", () => {
    const values = defaultAppConfig();
    expect(values.pagesPerReadEvent).toBe(20);
    expect(values.xpBookAdded).toBe(5);
    expect(values.xpBookFinishedBase).toBe(50);
    expect(values.xpPagesPer10).toBe(3);
    expect(values.xpLending).toBe(5);
    expect(values.xpPerLevelBase).toBe(100);
  });

  it("validates a partial YAML document field-by-field", () => {
    const values = validateAppConfig({ xp: { pagesPerReadEvent: 40, bookAdded: 10 } });
    expect(values.pagesPerReadEvent).toBe(40);
    expect(values.xpBookAdded).toBe(10);
    expect(values.xpBookFinishedBase).toBe(50);
    expect(values.koboEnabled).toBe(true);
  });

  it("falls back to defaults for invalid values and unknown keys", () => {
    const values = validateAppConfig({ xp: { pagesPerReadEvent: "not-a-number" }, unknown: 1 });
    expect(values.pagesPerReadEvent).toBe(20);
  });

  it("clamps out-of-range values", () => {
    const values = validateAppConfig({ xp: { pagesPerReadEvent: 999999 } });
    expect(values.pagesPerReadEvent).toBe(1000);
  });
});

describe("parametric XP (defaults unchanged)", () => {
  it("legacy defaults preserve behavior", () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(levelForXp(100)).toBe(2);
    expect(levelProgress(150)).toEqual(levelProgress(150, 100));
    expect(calculateFinishXp(300, 0)).toBe(140);
  });

  it("custom config changes the curve and finish XP", () => {
    expect(xpForNextLevel(1, 200)).toBe(200);
    expect(levelForXp(100, 200)).toBe(1);
    expect(calculateFinishXp(100, 0, { bookFinishedBase: 10, pagesPer10: 1, perLevelBase: 100 })).toBe(20);
  });
});
