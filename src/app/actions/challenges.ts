// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.3.0 — seasonal challenges: user CRUD. Progress/completion sync lives in
// gamification.ts (syncChallenges, called from the read-event paths).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { validateChallenge } from "@/lib/challenges";

export type ChallengeActionResult = { ok: boolean; error?: string };

/** Create a seasonal challenge for the caller. */
export async function createChallenge(input: {
  title: string;
  target: number;
  startAt: string;
  endAt: string;
}): Promise<ChallengeActionResult> {
  const userId = await requireUserId();
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return { ok: false, error: "InvalidWindow" };
  const error = validateChallenge({
    title: input.title,
    target: Number(input.target),
    startAt,
    endAt,
  });
  if (error) return { ok: false, error };
  await db.challenge.create({
    data: { userId, title: input.title.trim(), target: Math.floor(Number(input.target)), startAt, endAt },
  });
  revalidatePath("/challenges");
  return { ok: true };
}

/** Delete one of the caller's challenges (ownership-scoped). */
export async function deleteChallenge(id: string): Promise<ChallengeActionResult> {
  const userId = await requireUserId();
  await db.challenge.deleteMany({ where: { id, userId } });
  revalidatePath("/challenges");
  return { ok: true };
}
