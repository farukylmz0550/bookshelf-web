// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — goals service.

import { db } from "@/lib/db";
import { isGoalUnlocked } from "@/lib/goals";
import { syncAchievements } from "@/lib/gamification";

export async function getGoal(userId: string) {
  return db.goal.findUnique({ where: { userId } });
}

export async function confirmGoals(userId: string, yearly: number, monthly: number) {
  const y = Math.max(0, Math.min(999, Math.floor(yearly)));
  const m = Math.max(0, Math.min(999, Math.floor(monthly)));

  const existing = await db.goal.findUnique({ where: { userId } });
  const currentYear = new Date().getFullYear();
  if (existing && !isGoalUnlocked(existing, currentYear)) {
    return { ok: false as const, error: "GoalLocked" };
  }

  const goal = await db.goal.upsert({
    where: { userId },
    update: { yearly: y, monthly: m, targetYear: currentYear, confirmedAt: new Date() },
    create: { userId, yearly: y, monthly: m, targetYear: currentYear, confirmedAt: new Date() },
  });
  try {
    await syncAchievements(userId);
  } catch {}
  return { ok: true as const, goal };
}
