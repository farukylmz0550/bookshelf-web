// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — seasonal challenges service.

import { db } from "@/lib/db";
import { validateChallenge } from "@/lib/challenges";

export async function listChallenges(userId: string) {
  return db.challenge.findMany({ where: { userId }, orderBy: { startAt: "desc" } });
}

export async function createChallenge(
  userId: string,
  input: { title: string; target: number; startAt: string; endAt: string },
) {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return { ok: false as const, error: "InvalidWindow" };
  const error = validateChallenge({ title: input.title, target: Number(input.target), startAt, endAt });
  if (error) return { ok: false as const, error };
  const challenge = await db.challenge.create({
    data: { userId, title: input.title.trim(), target: Math.floor(Number(input.target)), startAt, endAt },
  });
  return { ok: true as const, challenge };
}

export async function deleteChallenge(userId: string, id: string) {
  const result = await db.challenge.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
