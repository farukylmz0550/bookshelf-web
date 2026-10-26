// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — statistics service (read-only, explicit userId).

import { db } from "@/lib/db";
import { getStreakInfo } from "@/lib/streak";
import { monthlyFinishCounts } from "@/lib/stats";
import { finishedInMonth, finishedInYear } from "@/lib/goals";
import { levelProgress, levelName } from "@/lib/gamification-pure";
import { getAppConfig } from "@/lib/app-config";

export async function getStats(userId: string, now = new Date()) {
  const [user, totalBooks, reading, finished, goal, streakInfo, dailyActivities, readEventDates] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, currentStreak: true, longestStreak: true },
    }),
    db.book.count({ where: { userId } }),
    db.book.count({ where: { userId, status: "READING" } }),
    db.book.count({ where: { userId, status: "FINISHED" } }),
    db.goal.findUnique({ where: { userId } }),
    getStreakInfo(userId),
    db.dailyActivity.findMany({
      where: { userId },
      select: { date: true, count: true, pagesRead: true, minutesRead: true },
      orderBy: { date: "asc" },
    }),
    db.bookReadEvent.findMany({ where: { userId }, select: { readAt: true } }),
  ]);

  const readDates = readEventDates.map((e) => e.readAt);
  const config = await getAppConfig();
  const { level } = levelProgress(user.xp, config.xpPerLevelBase);
  const booksWithDuration = await db.book.findMany({
    where: { userId, status: "FINISHED", startedAt: { not: null }, finishedAt: { not: null } },
    select: { startedAt: true, finishedAt: true },
  });
  const avgDays =
    booksWithDuration.length > 0
      ? booksWithDuration.reduce((acc, b) => {
          const d = ((b.finishedAt as Date).getTime() - (b.startedAt as Date).getTime()) / 86400000;
          return acc + (d >= 0 ? d : 0);
        }, 0) / booksWithDuration.length
      : null;

  return {
    totals: {
      books: totalBooks,
      reading,
      finished,
      xp: user.xp,
      level,
      levelName: levelName(level, config.xpLevelNames),
      averageDaysToFinish: avgDays === null ? null : Number(avgDays.toFixed(1)),
      readingMinutes: dailyActivities.reduce((sum, a) => sum + (a.minutesRead ?? 0), 0),
    },
    streak: streakInfo,
    goal: {
      yearly: goal?.yearly ?? 0,
      monthly: goal?.monthly ?? 0,
      doneYear: finishedInYear(readDates, now.getFullYear()),
      doneMonth: finishedInMonth(readDates, now.getFullYear(), now.getMonth()),
      targetYear: goal?.targetYear ?? null,
      confirmedAt: goal?.confirmedAt ?? null,
    },
    monthly: monthlyFinishCounts(readDates, now),
    activity: dailyActivities,
  };
}
