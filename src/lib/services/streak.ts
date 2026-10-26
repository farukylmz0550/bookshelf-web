// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — streak/gamification service.
//
// These functions take an explicit userId instead of reading the NextAuth
// session, so server actions, the REST API, MCP and extension code all share
// the exact same implementation. Actions remain thin session-aware adapters.

import { db } from "@/lib/db";
import { calculateStreak, startOfUtcDay } from "@/lib/streak";
import { calculateFinishXp, shieldCost as calcShieldCost } from "@/lib/gamification-pure";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";

const FINISH_CLAIM_TTL_MS = 10_000;
const recentFinishClaims = new Map<string, number>();

export interface StreakResult {
  current: number;
  longest: number;
}

/** Record one reading activity for the user's today (UTC day boundary). */
export async function recordActivityFor(userId: string, pagesRead?: number, minutesRead = 0): Promise<StreakResult> {
  const today = startOfUtcDay();
  const existing = await db.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) {
    await db.dailyActivity.update({
      where: { id: existing.id },
      data: {
        count: existing.count + 1,
        pagesRead: existing.pagesRead + (pagesRead ?? 0),
        minutesRead: existing.minutesRead + minutesRead,
      },
    });
  } else {
    await db.dailyActivity.create({
      data: { userId, date: today, count: 1, pagesRead: pagesRead ?? 0, minutesRead },
    });
  }

  const activities = await db.dailyActivity.findMany({
    where: { userId },
    select: { date: true, count: true },
    orderBy: { date: "desc" },
  });
  const { current, longest } = calculateStreak(activities);

  await db.user.update({
    where: { id: userId },
    data: { currentStreak: current, longestStreak: longest, lastActiveDate: today },
  });
  return { current, longest };
}

/** Award finish XP + activity for an already-FINISHED book. Returns XP (0 = no-op). */
export async function finishBookWithXpFor(userId: string, bookId: string, pages: number | null): Promise<number> {
  const book = await db.book.findFirst({
    where: { id: bookId, userId, status: "FINISHED" },
    select: { id: true },
  });
  if (!book) return 0;

  const now = Date.now();
  const claimedAt = recentFinishClaims.get(bookId);
  if (claimedAt !== undefined && now - claimedAt < FINISH_CLAIM_TTL_MS) return 0;
  recentFinishClaims.set(bookId, now);

  const [user, settings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
    getAppConfig(),
  ]);

  const xp = calculateFinishXp(pages, user?.currentStreak ?? 0, {
    bookFinishedBase: settings.xpBookFinishedBase,
    pagesPer10: settings.xpPagesPer10,
    perLevelBase: settings.xpPerLevelBase,
  });
  await awardXp(userId, xp);
  await recordActivityFor(userId, pages ?? undefined);
  await syncAchievements(userId);
  try {
    const { syncChallenges } = await import("@/lib/gamification");
    await syncChallenges(userId);
  } catch {}
  return xp;
}

/** Spend XP on a streak shield and record today's synthetic activity. */
export async function useStreakShieldFor(userId: string): Promise<{ shieldUsed: true; cost: number }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { xp: true, streakShieldCount: true, currentStreak: true },
  });
  if (!user) throw new Error("User not found");

  const cost = calcShieldCost(user.streakShieldCount);
  if (user.xp < cost) throw new Error("Not enough XP");
  if (user.currentStreak === 0) throw new Error("No active streak to protect");

  const today = startOfUtcDay();
  const todayActivity = await db.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (todayActivity) throw new Error("Already active today, no need for shield");

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { xp: { decrement: cost }, streakShieldCount: { increment: 1 } },
    });
    await tx.streakShield.create({ data: { userId } });
    await tx.dailyActivity.create({ data: { userId, date: today, count: 0, pagesRead: 0 } });
  });

  return { shieldUsed: true, cost };
}
