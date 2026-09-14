// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { clampSetting, invalidateAppSettingsCache, APP_SETTINGS_ID, type AppSettingsValues } from "@/lib/settings";

const settingsSchema = z.object({
  pagesPerReadEvent: z.number().int().min(1).max(1000),
  xpBookAdded: z.number().int().min(1).max(100000),
  xpBookFinishedBase: z.number().int().min(1).max(100000),
  xpPagesPer10: z.number().int().min(1).max(100000),
  xpLending: z.number().int().min(1).max(100000),
  xpPerLevelBase: z.number().int().min(1).max(100000),
});

/** System-admin only: persist the singleton reading/gamification settings. */
export async function updateAppSettings(
  input: AppSettingsValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    pagesPerReadEvent: clampSetting(input.pagesPerReadEvent),
    xpBookAdded: clampSetting(input.xpBookAdded),
    xpBookFinishedBase: clampSetting(input.xpBookFinishedBase),
    xpPagesPer10: clampSetting(input.xpPagesPer10),
    xpLending: clampSetting(input.xpLending),
    xpPerLevelBase: clampSetting(input.xpPerLevelBase),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Single atomic upsert on the fixed singleton row — concurrent admin
  // updates (double-click, two admins) can never produce two rows.
  await db.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: parsed.data,
    create: { id: APP_SETTINGS_ID, ...parsed.data },
  });
  invalidateAppSettingsCache();
  revalidatePath("/admin");
  revalidatePath("/stats");
  return { ok: true };
}

export async function readAppSettings(): Promise<AppSettingsValues | null> {
  await requireAdmin();
  const row = await db.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  return row ?? null;
}
