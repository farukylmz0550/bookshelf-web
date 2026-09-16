// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  levelForXp,
  levelProgress,
  currentPeriodKey,
  periodBounds,
  isPeriodKey,
  ACHIEVEMENT_XP,
  ACHIEVEMENT_RULES,
} from "@/lib/gamification-pure";
import type { AchievementStats } from "@/lib/gamification-pure";

describe("levelForXp", () => {
  it("starts at level 1 with zero xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("reaches level 2 at 100 xp", () => {
    expect(levelForXp(100)).toBe(2);
  });

  it("reaches level 3 at 200 xp", () => {
    expect(levelForXp(200)).toBe(3);
  });

  it("reaches level 4 at 400 xp", () => {
    expect(levelForXp(400)).toBe(4);
  });

  it("reaches level 5 at 700 xp", () => {
    expect(levelForXp(700)).toBe(5);
  });
});

describe("levelProgress", () => {
  it("reports progress within the current level's band", () => {
    const { level, progress } = levelProgress(150);
    expect(level).toBe(2);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(1);
  });
});

describe("evaluateAchievements", () => {
  const baseStats: AchievementStats = {
    booksAdded: 0,
    booksFinished: 0,
    lendingsCreated: 0,
    distinctAuthors: 0,
    currentStreak: 0,
    longestStreak: 0,
    lifetimePagesRead: 0,
    shelvesCreated: 0,
    goalConfirmed: false,
    goalYearlyTarget: 0,
    goalMonthlyTarget: 0,
    readEventsInGoalYear: 0,
    booksFinishedInPeriod: 0,
    pagesReadInPeriod: 0,
    distinctReadingDaysInPeriod: 0,
    readEventsInPeriod: 0,
  };

  const stats = (patch: Partial<AchievementStats>): AchievementStats => ({ ...baseStats, ...patch });

  it("unlocks nothing for a user with no activity", () => {
    expect(evaluateAchievements(stats({}))).toEqual([]);
  });

  it("unlocks first_book once a book is added", () => {
    expect(evaluateAchievements(stats({ booksAdded: 1 }))).toContain("first_book");
  });

  it("unlocks ten_finished only at ten finished books", () => {
    const under = evaluateAchievements(stats({ booksFinished: 9 }));
    const at = evaluateAchievements(stats({ booksFinished: 10 }));
    expect(under).not.toContain("ten_finished");
    expect(at).toContain("ten_finished");
  });

  it("unlocks books_25 / books_50 / books_100 at their thresholds", () => {
    expect(evaluateAchievements(stats({ booksFinished: 24 }))).not.toContain("books_25");
    expect(evaluateAchievements(stats({ booksFinished: 25 }))).toContain("books_25");
    expect(evaluateAchievements(stats({ booksFinished: 50 }))).toContain("books_50");
    expect(evaluateAchievements(stats({ booksFinished: 100 }))).toContain("books_100");
  });

  it("unlocks pages achievements on lifetime pages read", () => {
    expect(evaluateAchievements(stats({ lifetimePagesRead: 999 }))).not.toContain("pages_1000");
    expect(evaluateAchievements(stats({ lifetimePagesRead: 1000 }))).toContain("pages_1000");
    expect(evaluateAchievements(stats({ lifetimePagesRead: 5000 }))).toContain("pages_5000");
    expect(evaluateAchievements(stats({ lifetimePagesRead: 10000 }))).toContain("pages_10000");
  });

  it("unlocks first_shelf and first_lending", () => {
    expect(evaluateAchievements(stats({ shelvesCreated: 1 }))).toContain("first_shelf");
    expect(evaluateAchievements(stats({ lendingsCreated: 1 }))).toContain("first_lending");
  });

  it("unlocks first_goal when the confirmed yearly target is reached", () => {
    const notConfirmed = stats({ goalConfirmed: false, goalYearlyTarget: 10, readEventsInGoalYear: 10 });
    const reached = stats({ goalConfirmed: true, goalYearlyTarget: 10, readEventsInGoalYear: 10 });
    expect(evaluateAchievements(notConfirmed)).not.toContain("first_goal");
    expect(evaluateAchievements(reached)).toContain("first_goal");
  });

  it("unlocks week_streak at 7 days", () => {
    expect(evaluateAchievements(stats({ currentStreak: 7 }))).toContain("week_streak");
  });

  it("unlocks month_streak via longestStreak", () => {
    expect(evaluateAchievements(stats({ longestStreak: 30 }))).toContain("month_streak");
  });

  it("unlocks monthly achievements only within period stats", () => {
    expect(evaluateAchievements(stats({ booksFinishedInPeriod: 3 }))).toContain("monthly_reader");
    expect(evaluateAchievements(stats({ booksFinishedInPeriod: 5 }))).toContain("monthly_bookworm");
    expect(evaluateAchievements(stats({ pagesReadInPeriod: 500 }))).toContain("monthly_page_turner");
    expect(evaluateAchievements(stats({ distinctReadingDaysInPeriod: 7 }))).toContain("monthly_regular_reader");
  });

  it("monthly_goal requires a confirmed monthly target", () => {
    const noGoal = stats({ goalConfirmed: false, goalMonthlyTarget: 0, readEventsInPeriod: 5 });
    const reached = stats({ goalConfirmed: true, goalMonthlyTarget: 3, readEventsInPeriod: 3 });
    expect(evaluateAchievements(noGoal)).not.toContain("monthly_goal");
    expect(evaluateAchievements(reached)).toContain("monthly_goal");
  });

  it("every rule carries an explicit XP value", () => {
    expect(new Set(ACHIEVEMENT_RULES.map((r) => r.key)).size).toBe(ACHIEVEMENT_RULES.length);
    for (const rule of ACHIEVEMENT_RULES) {
      expect(typeof ACHIEVEMENT_XP[rule.key]).toBe("number");
    }
  });
});

describe("period keys (v2.11.0)", () => {
  it("formats the current UTC period", () => {
    expect(currentPeriodKey(new Date(Date.UTC(2026, 8, 30, 23, 59)))).toBe("2026-09");
    expect(currentPeriodKey(new Date(Date.UTC(2026, 9, 1, 0, 0)))).toBe("2026-10");
  });

  it("validates and bounds period keys", () => {
    expect(isPeriodKey("2026-09")).toBe(true);
    expect(isPeriodKey("2026-13")).toBe(false);
    expect(isPeriodKey("2026-00")).toBe(false);
    const [start, end] = periodBounds("2026-09");
    expect(start).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(end).toEqual(new Date(Date.UTC(2026, 9, 1)));
  });
});
