// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.4.0 — in-app reading timer: records session minutes into
// DailyActivity.minutesRead (the same column Kobo device minutes join, so the
// stats tile/heatmap show one combined total). Only READING books owned by the
// caller accept sessions; per-request and per-UTC-day caps are anti-farm
// (see lib/timer.ts). Minutes give no XP — consistent with the Kobo path.
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { startOfUtcDay } from "@/lib/streak";
import { capDailyMinutes, timerMinutes } from "@/lib/timer";
import { recordActivity } from "./streak";

export type TimerActionResult = { ok: boolean; recorded: number };

/** Record reading minutes for a session on one of the caller's READING books. */
export async function logReadingSession(bookId: string, seconds: number): Promise<TimerActionResult> {
  const userId = await requireUserId();

  const book = await db.book.findFirst({
    where: { id: bookId, userId, status: "READING" },
    select: { id: true },
  });
  if (!book) return { ok: false, recorded: 0 };

  const raw = timerMinutes(seconds);
  if (raw <= 0) return { ok: true, recorded: 0 };

  const today = startOfUtcDay();
  const todayRow = await db.dailyActivity.findUnique({
    where: { userId_date: { userId, date: today } },
    select: { minutesRead: true },
  });
  const minutes = capDailyMinutes(todayRow?.minutesRead ?? 0, raw);
  if (minutes <= 0) return { ok: true, recorded: 0 };

  await recordActivity(undefined, minutes);
  return { ok: true, recorded: minutes };
}
