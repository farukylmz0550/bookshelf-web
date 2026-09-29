// SPDX-License-Identifier: GPL-3.0-only

// v3.12.0 — passwordless QR login: token generation and validation helpers.
// The raw token is a 256-bit CSPRNG value (base64url, 43 chars) shown ONCE in
// the QR code; only its SHA-256 hash is stored server-side, and the raw token
// is never logged. consumeQrLoginSession() atomically claims the row
// (conditional updateMany) so two simultaneous confirmations can never
// produce two sessions.

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/** QR login sessions live for 60 s — a short-lived handoff, not a credential. */
export const QR_LOGIN_TTL_SECONDS = 60;

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 256-bit CSPRNG token, base64url (43 chars) — guessing space is 2^256. */
export function generateQrLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Marks the matching session as scanned without consuming it. The lookup is
 * by hash; unknown tokens are a no-op (generic rejection happens at confirm).
 */
export async function markQrLoginScanned(token: string): Promise<void> {
  await db.qrLoginSession.updateMany({
    where: { tokenHash: hashQrToken(token), confirmedAt: null },
    data: { scannedAt: new Date() },
  });
}

/**
 * Atomically claims the session: marks it confirmed ONLY if the row is still
 * unconfirmed and unexpired. Returns the owning userId on success, null when
 * the token is unknown, already used, cancelled or expired. The expiry is
 * enforced server-side inside the conditional update — never on the client.
 */
export async function consumeQrLoginSession(token: string): Promise<{ userId: string } | null> {
  const result = await db.qrLoginSession.updateMany({
    where: {
      tokenHash: hashQrToken(token),
      confirmedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { confirmedAt: new Date() },
  });
  if (result.count === 0) return null;
  const row = await db.qrLoginSession.findUnique({
    where: { tokenHash: hashQrToken(token) },
    select: { userId: true },
  });
  return row ? { userId: row.userId } : null;
}

/** Deletes expired or consumed sessions — called when a new session is created. */
export async function cleanupQrLoginSessions(): Promise<void> {
  await db.qrLoginSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { confirmedAt: { not: null } }] },
  });
}
