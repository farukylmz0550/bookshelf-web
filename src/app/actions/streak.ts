// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — streak actions delegate to the shared streak service so API/MCP
// calls can record activity without a NextAuth session.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  finishBookWithXpFor,
  recordActivityFor,
  useStreakShieldFor,
} from "@/lib/services/streak";

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
  const result = await useStreakShieldFor(userId);
  revalidatePath("/stats");
  return result;
}
