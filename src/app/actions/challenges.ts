// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — challenge actions delegate to the shared challenges service.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  createChallenge as createChallengeService,
  deleteChallenge as deleteChallengeService,
} from "@/lib/services/challenges";

export type ChallengeActionResult = { ok: boolean; error?: string };

export async function createChallenge(input: {
  title: string;
  target: number;
  startAt: string;
  endAt: string;
}): Promise<ChallengeActionResult> {
  const userId = await requireUserId();
  const result = await createChallengeService(userId, input);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/challenges");
  return { ok: true };
}

export async function deleteChallenge(id: string): Promise<ChallengeActionResult> {
  const userId = await requireUserId();
  await deleteChallengeService(userId, id);
  revalidatePath("/challenges");
  return { ok: true };
}
