// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { calculateStreak, startOfUtcDay } from "@/lib/streak";
import { calculateFinishXp, shieldCost as calcShieldCost } from "@/lib/gamification-pure";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";

/** Record a reading activity for today. Called when a book is finished or page progress is made.
 * v2.9.6 — returns the recalculated streak so callers can surface it in toasts. */
export async function recordActivity(pagesRead?: number): Promise<{ current: number; longest: number }> {
  const userId = await requireUserId();

  const today = startOfUtcDay();

  // Upsert daily activity
  const existing = await db.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) {
    await db.dailyActivity.update({
      where: { id: existing.id },
      data: {
        count: existing.count + 1,
        pagesRead: existing.pagesRead + (pagesRead ?? 0),
      },
    });
  } else {
    await db.dailyActivity.create({
      data: {
        userId,
        date: today,
        count: 1,
        pagesRead: pagesRead ?? 0,
      },
    });
  }

  // Recalculate streak
  const activities = await db.dailyActivity.findMany({
    where: { userId },
    select: { date: true, count: true },
    orderBy: { date: "desc" },
  });

  const { current, longest } = calculateStreak(activities);

  await db.user.update({
    where: { id: userId },
    data: {
      currentStreak: current,
      longestStreak: longest,
      lastActiveDate: today,
    },
  });

  revalidatePath("/stats");
  revalidatePath("/books");
  return { current, longest };
}

// v2.9.0 — defense-in-depth against duplicate finish invocations: after a
// legitimate finish this short-lived in-process claim collapses any immediate
// duplicate call (double-tap, racing callers) to a no-op. Legitimate re-reads
// are unaffected: startReRead moves the book to READING and the next finish
// happens well past the TTL. Caller-side callers (setBookStatus, logPagesRead)
// additionally gate this on an atomic status transition, which is the DB-level
// guarantee; this map is process-local extra safety.
const FINISH_CLAIM_TTL_MS = 10_000;
const recentFinishClaims = new Map<string, number>();

/** Finish a book with XP calculation. */
export async function finishBookWithXp(bookId: string, pages: number | null) {
  const userId = await requireUserId();

  // Fresh scoped read: only a book the caller owns, already transitioned to
  // FINISHED by the caller's atomic update, may award finish XP.
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
  await recordActivity(pages ?? undefined);
  await syncAchievements(userId);

  return xp;
}

/** Use a streak protection shield. */
export async function useStreakShield() {
  const userId = await requireUserId();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { xp: true, streakShieldCount: true, currentStreak: true },
  });

  if (!user) throw new Error("User not found");

  const cost = calcShieldCost(user.streakShieldCount);
  if (user.xp < cost) throw new Error("Not enough XP");
  if (user.currentStreak === 0) throw new Error("No active streak to protect");

  // Check if already active today
  const today = startOfUtcDay();
  const todayActivity = await db.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (todayActivity) throw new Error("Already active today, no need for shield");

  // Deduct XP + create shield record + record a synthetic activity to
  // maintain the streak — all atomic, so a failure rolls back the XP cost.
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        xp: { decrement: cost },
        streakShieldCount: { increment: 1 },
      },
    });
    await tx.streakShield.create({
      data: { userId },
    });
    // Record a synthetic activity to maintain streak
    await tx.dailyActivity.create({
      data: {
        userId,
        date: today,
        count: 0,
        pagesRead: 0,
      },
    });
  });

  revalidatePath("/stats");
  return { shieldUsed: true, cost };
}
