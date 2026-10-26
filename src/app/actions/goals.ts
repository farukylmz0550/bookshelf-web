// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — goal actions delegate to the shared goals service.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { confirmGoals as confirmGoalsService } from "@/lib/services/goals";

export async function confirmGoals(yearly: number, monthly: number): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const result = await confirmGoalsService(userId, yearly, monthly);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/stats");
  return { ok: true };
}
