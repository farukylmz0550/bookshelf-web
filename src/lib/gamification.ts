// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { ACHIEVEMENT_XP, currentPeriodKey, evaluateAchievements, periodBounds } from "./gamification-pure";

export {
  XP_REWARDS,
  levelForXp,
  levelProgress,
  levelName,
  evaluateAchievements,
  ACHIEVEMENT_RULES,
  ACHIEVEMENT_XP,
  currentPeriodKey,
  periodBounds,
  streakMultiplier,
  calculateFinishXp,
  shieldCost,
  xpForNextLevel,
} from "./gamification-pure";

export async function awardXp(userId: string, amount: number) {
  return db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
}

async function collectAchievementStats(userId: string) {
  const [booksAdded, booksFinished, lendingsCreated, authors, user, lifetimePages, shelvesCreated] = await Promise.all([
    db.book.count({ where: { userId } }),
    db.book.count({ where: { userId, status: "FINISHED" } }),
    db.lendingRecord.count({ where: { book: { userId } } }),
    db.book.findMany({ where: { userId, author: { not: null } }, select: { author: true }, distinct: ["author"] }),
    db.user.findUnique({ where: { id: userId }, select: { currentStreak: true, longestStreak: true } }),
    // v2.11.0 — lifetime pages read + shelf count (DailyActivity.pagesRead is
    // the canonical pages counter: page logs accumulate there; page-less
    // finishes add 0).
    db.dailyActivity.aggregate({ where: { userId }, _sum: { pagesRead: true } }),
    db.bookGroup.count({ where: { userId } }),
  ]);
  return {
    booksAdded,
    booksFinished,
    lendingsCreated,
    distinctAuthors: authors.length,
    currentStreak: user?.currentStreak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    lifetimePagesRead: lifetimePages._sum.pagesRead ?? 0,
    shelvesCreated,
  };
}

/**
 * v2.11.0 — period-scoped stats for MONTHLY achievements (UTC calendar month;
 * same clock as the streak/activity system). Distinct reading days come from
 * DailyActivity (one row per UTC day, activity count > 0 filters the
 * synthetic streak-shield rows), finished books use Book.finishedAt.
 */
async function collectPeriodStats(userId: string, periodKey: string) {
  const [start, end] = periodBounds(periodKey);
  const [finished, pages, days, readEvents] = await Promise.all([
    // "Books finished this period" = Book.finishedAt (re-reads update it; the
    // last finish wins — matches the monthly headline tiles).
    db.book.count({ where: { userId, finishedAt: { gte: start, lt: end } } }),
    // Pages/days come from DailyActivity (UTC day rows) — the same canonical
    // counter the streak system writes, so period math stays UTC-consistent.
    db.dailyActivity.aggregate({
      where: { userId, date: { gte: start, lt: end } },
      _sum: { pagesRead: true },
    }),
    db.dailyActivity.count({ where: { userId, date: { gte: start, lt: end }, count: { gt: 0 } } }),
    // Goal-style completion counting uses read events (goal-progress UI
    // convention): every completion/re-read writes one event.
    db.bookReadEvent.count({ where: { userId, readAt: { gte: start, lt: end } } }),
  ]);
  return {
    booksFinishedInPeriod: finished,
    pagesReadInPeriod: pages._sum.pagesRead ?? 0,
    distinctReadingDaysInPeriod: days,
    readEventsInPeriod: readEvents,
  };
}

/**
 * Recomputes achievement stats for a user and persists any newly unlocked
 * ones.
 *
 * v2.11.0 — permanent (periodKey "") and monthly (periodKey "YYYY-MM") rules
 * share one evaluator; unlock + XP run in one transaction so the
 * (userId, achievementId, periodKey) unique constraint guarantees each
 * achievement can award XP exactly once per period. A concurrent duplicate
 * sync loses the race and rolls back with no XP — idempotent by construction.
 */
export async function syncAchievements(userId: string, now: Date = new Date()): Promise<string[]> {
  const periodKey = currentPeriodKey(now);

  const [lifetime, period, goal] = await Promise.all([
    collectAchievementStats(userId),
    collectPeriodStats(userId, periodKey),
    collectGoalContext(userId),
  ]);
  const unlockedKeys = evaluateAchievements({ ...lifetime, ...period, ...goal });
  if (unlockedKeys.length === 0) return [];

  const achievements = await db.achievement.findMany({
    where: { key: { in: unlockedKeys } },
    select: { id: true, key: true, recurrence: true },
  });
  const alreadyUnlocked = await db.userAchievement.findMany({
    where: { userId, achievementId: { in: achievements.map((a) => a.id) } },
    select: { achievementId: true, periodKey: true },
  });
  const existing = new Set(alreadyUnlocked.map((a) => `${a.achievementId}:${a.periodKey}`));
  const toUnlock = achievements.filter((a) => {
    const requiredPeriod = a.recurrence === "MONTHLY" ? periodKey : "";
    return !existing.has(`${a.id}:${requiredPeriod}`);
  });
  if (toUnlock.length === 0) return [];

  const xpTotal = toUnlock.reduce((sum, a) => sum + (ACHIEVEMENT_XP[a.key] ?? 0), 0);

  try {
    await db.$transaction(async (tx) => {
      await tx.userAchievement.createMany({
        data: toUnlock.map((a) => ({
          userId,
          achievementId: a.id,
          periodKey: a.recurrence === "MONTHLY" ? periodKey : "",
        })),
      });
      if (xpTotal > 0) {
        await tx.user.update({ where: { id: userId }, data: { xp: { increment: xpTotal } } });
      }
    });
  } catch (e) {
    // A concurrent sync inserted the same row first — it also awarded the XP,
    // so this call must not award anything. Everything else stays fatal.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return [];
    }
    throw e;
  }
  return toUnlock.map((a) => a.key);
}

async function collectGoalContext(userId: string) {
  const goal = await db.goal.findUnique({
    where: { userId },
    select: { yearly: true, monthly: true, targetYear: true, confirmedAt: true },
  });
  const targetYear = goal?.confirmedAt ? goal.targetYear : null;
  const readEventsInGoalYear = targetYear
    ? await db.bookReadEvent.count({
        where: {
          userId,
          readAt: { gte: new Date(Date.UTC(targetYear, 0, 1)), lt: new Date(Date.UTC(targetYear + 1, 0, 1)) },
        },
      })
    : 0;
  return {
    goalConfirmed: !!goal?.confirmedAt,
    goalYearlyTarget: goal?.yearly ?? 0,
    goalMonthlyTarget: goal?.monthly ?? 0,
    readEventsInGoalYear,
  };
}
