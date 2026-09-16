// SPDX-License-Identifier: GPL-3.0-only
export const XP_REWARDS = {
  BOOK_ADDED: 5,
  BOOK_FINISHED_BASE: 50,
  PAGES_PER_10: 3,
  LENDING_CREATED: 5,
} as const;

/**
 * Configurable XP parameters (v2.7.0) — resolved from AppSettings/env at
 * runtime; every parameter defaults to the legacy XP_REWARDS value so the
 * default behavior is byte-for-byte unchanged.
 */
export type XpConfig = {
  bookFinishedBase: number;
  pagesPer10: number;
  /** Base XP of the Fibonacci level curve (legacy: 100). */
  perLevelBase: number;
};

export const DEFAULT_XP_CONFIG: XpConfig = {
  bookFinishedBase: XP_REWARDS.BOOK_FINISHED_BASE,
  pagesPer10: XP_REWARDS.PAGES_PER_10,
  perLevelBase: 100,
};

function fibonacci(n: number): number {
  if (n <= 1) return 1;
  let a = 1,
    b = 1;
  for (let i = 2; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/** XP required to advance FROM the given level to the next. */
export function xpForNextLevel(currentLevel: number, base: number = DEFAULT_XP_CONFIG.perLevelBase): number {
  return base * fibonacci(currentLevel);
}

/** Total XP accumulated to reach the given level from level 1. */
function totalXpForLevel(level: number, base: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForNextLevel(i, base);
  }
  return total;
}

/** Level derived from total XP. Pure function — level is derived, never stored. */
export function levelForXp(xp: number, base: number = DEFAULT_XP_CONFIG.perLevelBase): number {
  let level = 1;
  let total = 0;
  while (total + xpForNextLevel(level, base) <= xp) {
    total += xpForNextLevel(level, base);
    level++;
  }
  return level;
}

/** XP progress within the current level. */
export function levelProgress(xp: number, base: number = DEFAULT_XP_CONFIG.perLevelBase) {
  const level = levelForXp(xp, base);
  const currentFloor = totalXpForLevel(level, base);
  const nextFloor = currentFloor + xpForNextLevel(level, base);
  return {
    level,
    currentFloor,
    nextFloor,
    xpForNext: xpForNextLevel(level, base),
    progress: nextFloor === currentFloor ? 0 : (xp - currentFloor) / (nextFloor - currentFloor),
  };
}

/** Streak multiplier for XP bonus. */
export function streakMultiplier(streak: number): number {
  if (streak >= 100) return 2.0;
  if (streak >= 60) return 1.5;
  if (streak >= 30) return 1.3;
  if (streak >= 14) return 1.2;
  if (streak >= 7) return 1.1;
  return 1.0;
}

/** Calculate XP for finishing a book (config from AppSettings; defaults legacy). */
export function calculateFinishXp(
  pages: number | null | undefined,
  streak: number,
  config: XpConfig = DEFAULT_XP_CONFIG,
): number {
  let xp = config.bookFinishedBase;
  if (pages && pages > 0) {
    xp += Math.floor(pages / 10) * config.pagesPer10;
  }
  return Math.floor(xp * streakMultiplier(streak));
}

/** Streak protection shield cost — exponential. */
export function shieldCost(shieldCount: number): number {
  return 100 * Math.pow(2, shieldCount);
}

export type AchievementStats = {
  booksAdded: number;
  booksFinished: number;
  lendingsCreated: number;
  distinctAuthors: number;
  currentStreak: number;
  longestStreak: number;
  // v2.11.0 — lifetime pages read (DailyActivity sum; page-less finishes add 0)
  lifetimePagesRead: number;
  shelvesCreated: number;
  // Goal context (read events / goal fields — single evaluation source)
  goalConfirmed: boolean;
  goalYearlyTarget: number;
  goalMonthlyTarget: number;
  readEventsInGoalYear: number;
  // Period-scoped stats (UTC "YYYY-MM" — caller supplies the current period's
  // numbers; permanent predicates simply ignore them)
  booksFinishedInPeriod: number;
  pagesReadInPeriod: number;
  distinctReadingDaysInPeriod: number;
  readEventsInPeriod: number;
};

export type AchievementRecurrence = "NONE" | "MONTHLY";

type AchievementRule = {
  key: string;
  recurrence: AchievementRecurrence;
  isUnlocked: (stats: AchievementStats) => boolean;
};

/** Achievement XP — explicit configuration, one value per key (v2.11.0). */
export const ACHIEVEMENT_XP: Record<string, number> = {
  first_book: 10,
  first_finish: 10,
  ten_finished: 25,
  books_25: 50,
  books_50: 100,
  books_100: 250,
  pages_1000: 25,
  pages_5000: 75,
  pages_10000: 150,
  first_lending: 10,
  five_authors: 25,
  first_shelf: 10,
  first_goal: 10,
  week_streak: 25,
  month_streak: 100,
  century_streak: 250,
  monthly_reader: 25,
  monthly_bookworm: 50,
  monthly_page_turner: 50,
  monthly_regular_reader: 50,
  monthly_goal: 50,
};

/** Achievement catalog: each rule is a single, testable predicate over stats.
 * NONE = permanent (unlock once), MONTHLY = evaluated per calendar period. */
export const ACHIEVEMENT_RULES: AchievementRule[] = [
  { key: "first_book", recurrence: "NONE", isUnlocked: (s) => s.booksAdded >= 1 },
  { key: "first_finish", recurrence: "NONE", isUnlocked: (s) => s.booksFinished >= 1 },
  { key: "ten_finished", recurrence: "NONE", isUnlocked: (s) => s.booksFinished >= 10 },
  { key: "books_25", recurrence: "NONE", isUnlocked: (s) => s.booksFinished >= 25 },
  { key: "books_50", recurrence: "NONE", isUnlocked: (s) => s.booksFinished >= 50 },
  { key: "books_100", recurrence: "NONE", isUnlocked: (s) => s.booksFinished >= 100 },
  { key: "pages_1000", recurrence: "NONE", isUnlocked: (s) => s.lifetimePagesRead >= 1000 },
  { key: "pages_5000", recurrence: "NONE", isUnlocked: (s) => s.lifetimePagesRead >= 5000 },
  { key: "pages_10000", recurrence: "NONE", isUnlocked: (s) => s.lifetimePagesRead >= 10000 },
  { key: "first_lending", recurrence: "NONE", isUnlocked: (s) => s.lendingsCreated >= 1 },
  { key: "five_authors", recurrence: "NONE", isUnlocked: (s) => s.distinctAuthors >= 5 },
  { key: "first_shelf", recurrence: "NONE", isUnlocked: (s) => s.shelvesCreated >= 1 },
  {
    key: "first_goal",
    recurrence: "NONE",
    isUnlocked: (s) => s.goalConfirmed && s.goalYearlyTarget > 0 && s.readEventsInGoalYear >= s.goalYearlyTarget,
  },
  { key: "week_streak", recurrence: "NONE", isUnlocked: (s) => s.currentStreak >= 7 || s.longestStreak >= 7 },
  { key: "month_streak", recurrence: "NONE", isUnlocked: (s) => s.currentStreak >= 30 || s.longestStreak >= 30 },
  { key: "century_streak", recurrence: "NONE", isUnlocked: (s) => s.longestStreak >= 100 },
  // Monthly (period-scoped) achievements — re-earnable every calendar month.
  { key: "monthly_reader", recurrence: "MONTHLY", isUnlocked: (s) => s.booksFinishedInPeriod >= 3 },
  { key: "monthly_bookworm", recurrence: "MONTHLY", isUnlocked: (s) => s.booksFinishedInPeriod >= 5 },
  { key: "monthly_page_turner", recurrence: "MONTHLY", isUnlocked: (s) => s.pagesReadInPeriod >= 500 },
  { key: "monthly_regular_reader", recurrence: "MONTHLY", isUnlocked: (s) => s.distinctReadingDaysInPeriod >= 7 },
  {
    key: "monthly_goal",
    recurrence: "MONTHLY",
    isUnlocked: (s) => s.goalConfirmed && s.goalMonthlyTarget > 0 && s.readEventsInPeriod >= s.goalMonthlyTarget,
  },
];

/** Pure: which achievement keys should be unlocked for a given stats snapshot. */
export function evaluateAchievements(stats: AchievementStats): string[] {
  return ACHIEVEMENT_RULES.filter((rule) => rule.isUnlocked(stats)).map((rule) => rule.key);
}

// ---------------------------------------------------------------------------
// v2.11.0 — period handling (UTC calendar months; the streak/activity system
// also uses UTC days, so both sides of the gamification clock agree).
// ---------------------------------------------------------------------------

/** Current monthly period key, e.g. "2026-09". */
export function currentPeriodKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Validate a "YYYY-MM" period key (defensive — never trust client input). */
export function isPeriodKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** [start, end) UTC bounds for a period key. */
export function periodBounds(periodKey: string): [Date, Date] {
  if (!isPeriodKey(periodKey)) throw new Error("Invalid period key");
  const [year, month] = periodKey.split("-").map(Number);
  return [new Date(Date.UTC(year, month - 1, 1)), new Date(Date.UTC(year, month, 1))];
}
