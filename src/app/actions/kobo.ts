// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.0.0 — user-facing Kobo sync management (Settings → Kobo Sync).
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { buildKoboApiEndpoint, generateKoboToken } from "@/lib/kobo";
import { getAppConfig } from "@/lib/app-config";

function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export type KoboSyncState = {
  enabled: boolean;
  syncUrl: string | null;
  /** v3.2.0 — OPDS 1.2 catalog root for the same token (Settings display). */
  opdsUrl: string | null;
  fileSourceUrl: string | null;
};

/** The caller's Kobo sync state (sync URL when a token exists). */
export async function getKoboSyncState(): Promise<KoboSyncState> {
  const enabled = (await getAppConfig()).koboEnabled;
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { fileSourceUrl: true, koboToken: { select: { token: true } } },
  });
  const token = user?.koboToken?.token ?? null;
  const origin = originFromHeaders(await headers());
  return {
    enabled,
    syncUrl: token && enabled ? buildKoboApiEndpoint(token, origin) : null,
    opdsUrl: token && enabled ? `${origin.replace(/\/$/, "")}/api/opds/${token}/` : null,
    fileSourceUrl: user?.fileSourceUrl ?? null,
  };
}

/**
 * Create or rotate the device sync token and return the fresh api_endpoint
 * URL. Rotation invalidates the URL previously entered on the device.
 */
export async function createKoboSyncUrl(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const enabled = (await getAppConfig()).koboEnabled;
  if (!enabled) return { ok: false, error: "KoboSyncDisabled" };
  const userId = await requireUserId();
  const token = generateKoboToken();
  await db.koboSyncToken.upsert({
    where: { userId },
    update: { token, lastSyncAt: null },
    create: { userId, token },
  });
  const url = buildKoboApiEndpoint(token, originFromHeaders(await headers()));
  revalidatePath("/settings");
  return { ok: true, url };
}

/** Set/clear the per-user download URL template ({isbn}, {isbn10}, {isbn13}). */
export async function setFileSourceUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const cleaned = url.trim() || null;
  if (cleaned) {
    if (cleaned.length > 2000) return { ok: false, error: "TooLong" };
    if (!/^https?:\/\//i.test(cleaned)) return { ok: false, error: "InvalidUrl" };
    if (!/\{isbn\}|\{isbn10\}|\{isbn13\}/.test(cleaned)) return { ok: false, error: "MissingPlaceholder" };
  }
  await db.user.update({ where: { id: userId }, data: { fileSourceUrl: cleaned } });
  revalidatePath("/settings");
  return { ok: true };
}
