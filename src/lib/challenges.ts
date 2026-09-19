// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — seasonal challenges: free-form reading challenges ("Winter: 5
// books") with a target number of read events inside a date window. Pure
// validation + progress math; the DB-facing sync lives in gamification.ts
// (completedAt exactly-once guard).

import { z } from "zod";

export const CHALLENGE_MAX_TARGET = 1000;
export const CHALLENGE_MAX_WINDOW_DAYS = 366;
export const CHALLENGE_TITLE_MAX = 80;

const challengeInputSchema = z.object({
  title: z.string().trim().min(1).max(CHALLENGE_TITLE_MAX),
  target: z.number().int().min(1).max(CHALLENGE_MAX_TARGET),
  startAt: z.date(),
  endAt: z.date(),
});

export type ChallengeInput = z.infer<typeof challengeInputSchema>;

/** Pure: validate a challenge create payload. Returns a machine error code. */
export function validateChallenge(input: { title: string; target: number; startAt: Date; endAt: Date }): string | null {
  const parsed = challengeInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path.includes("title")) return issue?.code === "too_big" ? "TitleTooLong" : "TitleRequired";
    if (issue?.path.includes("target")) return "InvalidTarget";
    return "InvalidInput";
  }
  if (parsed.data.endAt.getTime() <= parsed.data.startAt.getTime()) return "InvalidWindow";
  const days = (parsed.data.endAt.getTime() - parsed.data.startAt.getTime()) / 86_400_000;
  if (days > CHALLENGE_MAX_WINDOW_DAYS) return "WindowTooLong";
  return null;
}

export type ChallengeLike = {
  id: string;
  title: string;
  target: number;
  startAt: Date;
  endAt: Date;
  completedAt: Date | null;
};

/** Pure: challenge progress at `now` (read events within the window). */
export function challengeProgress(
  challenge: ChallengeLike,
  readEventDates: Date[],
  now: Date = new Date(),
): { done: number; target: number; completed: boolean; upcoming: boolean; finished: boolean } {
  const start = challenge.startAt.getTime();
  const end = challenge.endAt.getTime();
  const done = readEventDates.filter((d) => {
    const time = d.getTime();
    return time >= start && time <= end;
  }).length;
  return {
    done,
    target: challenge.target,
    completed: challenge.completedAt !== null || done >= challenge.target,
    upcoming: now.getTime() < start,
    finished: now.getTime() > end,
  };
}
