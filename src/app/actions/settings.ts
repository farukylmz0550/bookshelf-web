// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

export type UserSettingsData = {
  notificationsEnabled: boolean;
  streakReminders: boolean;
  weeklyDigest: boolean;
  goalReminders: boolean;
  pagesPerReadEvent: number | null;
};

export async function getSettings(): Promise<UserSettingsData> {
  const userId = await requireUserId();
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });
  if (!settings) {
    return {
      notificationsEnabled: true,
      streakReminders: true,
      weeklyDigest: false,
      goalReminders: true,
      pagesPerReadEvent: null,
    };
  }
  return {
    notificationsEnabled: settings.notificationsEnabled,
    streakReminders: settings.streakReminders,
    weeklyDigest: settings.weeklyDigest,
    goalReminders: settings.goalReminders,
    pagesPerReadEvent: settings.pagesPerReadEvent ?? null,
  };
}

export async function updateSettings(data: Partial<UserSettingsData>) {
  const userId = await requireUserId();
  await db.userSettings.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      notificationsEnabled: data.notificationsEnabled ?? true,
      streakReminders: data.streakReminders ?? true,
      weeklyDigest: data.weeklyDigest ?? false,
      goalReminders: data.goalReminders ?? true,
    },
  });
  revalidatePath("/settings");
}

// v3.5.1 — per-user "I read N pages" step (1–1000). Server-side clamp is
// authoritative; the admin floor is applied at read time, not here, so a
// lowered admin floor takes effect immediately without rewriting user rows.
export async function updatePagesPerReadEvent(value: number): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
    return { ok: false, error: "invalid" };
  }
  await db.userSettings.upsert({
    where: { userId },
    update: { pagesPerReadEvent: parsed },
    create: {
      userId,
      notificationsEnabled: true,
      streakReminders: true,
      weeklyDigest: false,
      goalReminders: true,
      pagesPerReadEvent: parsed,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/books");
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  try {
    const count = await sendPushToUser(userId, {
      title: "Book Shelf",
      body: "Test push — it works! 🎉",
      url: "/books",
      tag: "test-push",
    });
    if (count === 0) {
      return { ok: false, error: "No push subscription found" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
