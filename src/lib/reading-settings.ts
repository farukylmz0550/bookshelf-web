// SPDX-License-Identifier: GPL-3.0-only
// v3.5.1 — effective "I read N pages" resolution.
//
// One "Read N pages" tap credits a number of pages that used to come only
// from the site-wide config.yaml (`xp.pagesPerReadEvent`, default 20). Users
// can now pick their own step in Settings, while an admin-set minimum in the
// admin panel acts as a floor for everyone:
//
//   user setting → admin floor (max) → site default → 20
//
// Pure helpers are separated so tests can exercise the ordering directly
// (same pattern as lib/app-config.ts).

import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";

/** Hard clamp shared with the config.yaml value (1–1000). */
const MIN = 1;
const MAX = 1000;

export const DEFAULT_PAGES_PER_READ_EVENT = 20;

export function clampPages(value: number | null | undefined): number {
  if (value === null || value === undefined) return DEFAULT_PAGES_PER_READ_EVENT;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PAGES_PER_READ_EVENT;
  return Math.min(MAX, Math.max(MIN, n));
}

/**
 * Pure: combine the three sources. `userValue` may be null/undefined (not
 * set); `adminFloor` of 0 disables the floor.
 */
export function resolvePagesPerReadEvent(
  userValue: number | null | undefined,
  adminFloor: number | null | undefined,
  siteValue: number | null | undefined,
): number {
  const site = clampPages(siteValue ?? DEFAULT_PAGES_PER_READ_EVENT);
  const user = userValue === null || userValue === undefined ? site : clampPages(userValue);
  const floor = adminFloor !== null && adminFloor !== undefined ? clampPages(adminFloor) : 0;
  return Math.max(user, floor);
}

/** Read the singleton admin floor; 0 when the row does not exist yet. */
export async function getMinPagesPerReadEvent(): Promise<number> {
  const row = await db.siteSettings.findUnique({ where: { id: "site" } });
  return row?.minPagesPerReadEvent ?? 0;
}

/**
 * Effective step for a user: their own setting (if any), lifted by the
 * admin's floor, falling back to the site-wide config.yaml value.
 */
export async function getPagesPerReadEventFor(userId: string): Promise<number> {
  const [settings, config] = await Promise.all([
    db.userSettings.findUnique({ where: { userId }, select: { pagesPerReadEvent: true } }),
    getAppConfig(),
  ]);
  const floor = await getMinPagesPerReadEvent();
  return resolvePagesPerReadEvent(settings?.pagesPerReadEvent ?? null, floor, config.pagesPerReadEvent);
}
