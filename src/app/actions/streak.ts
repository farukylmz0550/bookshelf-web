// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — streak actions delegate to the shared streak service so API/MCP
// calls can record activity without a NextAuth session.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  finishBookWithXpFor,
  recordActivityFor,
  useStreakShieldFor as consumeStreakShieldFor,
} from "@/lib/services/streak";
import { purchaseMarketItem } from "@/lib/services/market";

export async function recordActivity(
  pagesRead?: number,
  minutesRead = 0,
): Promise<{ current: number; longest: number }> {
  const userId = await requireUserId();
  const result = await recordActivityFor(userId, pagesRead, minutesRead);
  revalidatePath("/stats");
  revalidatePath("/books");
  return result;
}

export async function finishBookWithXp(bookId: string, pages: number | null) {
  const userId = await requireUserId();
  return finishBookWithXpFor(userId, bookId, pages);
}

export async function useStreakShield() {
  const userId = await requireUserId();
  const result = await consumeStreakShieldFor(userId);
  revalidatePath("/stats");
  return result;
}

export async function purchaseStreakShield() {
  const userId = await requireUserId();
  const result = await purchaseMarketItem(userId, "STREAK_SHIELD");
  revalidatePath("/stats");
  return result;
}
