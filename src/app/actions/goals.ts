// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { isGoalUnlocked } from "@/lib/goals";
import { syncAchievements } from "@/lib/gamification";

/**
 * v2.7.0 — targets are confirmed once per calendar year and stay locked until
 * Jan 1 of the next year (server-local clock). This action is the only way to
 * set them; it refuses while the current year's targets are confirmed.
 */
export async function confirmGoals(yearly: number, monthly: number): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const y = Math.max(0, Math.min(999, Math.floor(yearly)));
  const m = Math.max(0, Math.min(999, Math.floor(monthly)));

  const existing = await db.goal.findUnique({ where: { userId } });
  const currentYear = new Date().getFullYear();
  if (existing && !isGoalUnlocked(existing, currentYear)) {
    return { ok: false, error: "GoalLocked" };
  }

  await db.goal.upsert({
    where: { userId },
    update: { yearly: y, monthly: m, targetYear: currentYear, confirmedAt: new Date() },
    create: { userId, yearly: y, monthly: m, targetYear: currentYear, confirmedAt: new Date() },
  });
  revalidatePath("/stats");
  // v2.11.0 — goal achievements (first_goal / monthly_goal); evaluation is
  // cheap and also runs from every reading action, so failures stay silent.
  try {
    await syncAchievements(userId);
  } catch {}
  return { ok: true };
}
