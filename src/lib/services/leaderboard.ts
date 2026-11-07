// SPDX-License-Identifier: GPL-3.0-only

import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import { currentPeriodKey, levelForXp, periodBounds } from "@/lib/gamification-pure";

export const MONTHLY_LEADERBOARD_ACHIEVEMENT = "monthly_champion";
export const MONTHLY_LEADERBOARD_REWARD_XP = 150;

type MonthlyRow = { id: string; name: string; xp: number; level: number; booksRead: number };

async function rankingForPeriod(periodKey: string): Promise<MonthlyRow[]> {
  const [start, end] = periodBounds(periodKey);
  const users = await db.user.findMany({
    where: { showOnLeaderboard: true },
    select: { id: true, name: true, xp: true, level: true },
  });
  if (users.length === 0) return [];

  const events = await db.bookReadEvent.findMany({
    where: { userId: { in: users.map((user) => user.id) }, readAt: { gte: start, lt: end } },
    select: { userId: true, bookId: true },
  });
  const booksByUser = new Map<string, Set<string>>();
  for (const event of events) {
    const books = booksByUser.get(event.userId) ?? new Set<string>();
    books.add(event.bookId);
    booksByUser.set(event.userId, books);
  }

  return users
    .map((user) => ({ ...user, booksRead: booksByUser.get(user.id)?.size ?? 0 }))
    .sort((a, b) => b.booksRead - a.booksRead || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export async function getCurrentMonthlyLeaderboard(now: Date = new Date()) {
  return { periodKey: currentPeriodKey(now), users: await rankingForPeriod(currentPeriodKey(now)) };
}

/** Finalize the previous UTC month once, when the leaderboard is visited. */
export async function awardPreviousMonthlyLeaderboard(now: Date = new Date()) {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodKey = currentPeriodKey(previousMonth);
  const winner = (await rankingForPeriod(periodKey)).find((user) => user.booksRead > 0);
  if (!winner) return null;

  const achievement = await db.achievement.findUnique({
    where: { key: MONTHLY_LEADERBOARD_ACHIEVEMENT },
    select: { id: true },
  });
  if (!achievement) return null;

  const config = await getAppConfig();
  return db.$transaction(async (tx) => {
    const existing = await tx.userAchievement.findUnique({
      where: { userId_achievementId_periodKey: { userId: winner.id, achievementId: achievement.id, periodKey } },
      select: { id: true },
    });
    if (existing) return { awarded: false as const, periodKey, winner, rewardXp: MONTHLY_LEADERBOARD_REWARD_XP };

    const user = await tx.user.findUnique({ where: { id: winner.id }, select: { xp: true, level: true } });
    if (!user) return null;
    const xp = user.xp + MONTHLY_LEADERBOARD_REWARD_XP;
    await tx.userAchievement.create({
      data: { userId: winner.id, achievementId: achievement.id, periodKey },
    });
    await tx.user.update({
      where: { id: winner.id },
      data: { xp, level: Math.max(user.level, levelForXp(xp, config.xpPerLevelBase)) },
    });
    return { awarded: true as const, periodKey, winner, rewardXp: MONTHLY_LEADERBOARD_REWARD_XP };
  });
}
