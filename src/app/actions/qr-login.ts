// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.12.0 — passwordless QR login. The desktop (already authenticated)
// creates a 30 s single-use token and renders it as a QR; the phone scans
// it, opens /pair/<token>, SEES a confirmation screen (account + device) and
// only after explicit confirmation does the server atomically consume the
// token and issue a normal NextAuth JWT session — the same lifecycle as a
// password login, no second auth system. The raw token is never stored (only
// its SHA-256 hash) and never logged.

import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getRequestIp, checkRateLimit, throttlingEnabled, DEFAULT_LIMITS } from "@/lib/rate-limit";
import {
  cleanupQrLoginSessions,
  consumeQrLoginSession,
  generateQrLoginToken,
  hashQrToken,
  QR_LOGIN_TTL_SECONDS,
} from "@/lib/qr-login";

export type QrLoginSessionInfo = {
  sessionId: string;
  /** Raw token — shown once in the QR, never persisted, never logged. */
  token: string;
  /** Full HTTPS pair URL encoded into the QR (NEXTAUTH_URL-based). */
  url: string;
  expiresAt: string;
};

/** Same derivation @auth/core uses for the session cookie name + salt. */
function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
}

async function issueSessionCookie(userId: string): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing auth secret");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw new Error("User not found");

  const cookieName = sessionCookieName();
  const maxAge = 30 * 24 * 60 * 60; // NextAuth's default session maxAge (30 days)
  const jwt = await encode({
    secret,
    salt: cookieName,
    maxAge,
    token: { sub: userId, id: userId, email: user.email, name: user.name },
  });
  (await cookies()).set(cookieName, jwt, {
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/** Desktop side: create a fresh 30 s single-use token. */
export async function createQrLoginSession(): Promise<
  { ok: true; sessionId: string; token: string; url: string; expiresAt: string } | { ok: false; error: string }
> {
  const userId = await requireUserId();
  await cleanupQrLoginSessions();

  const token = generateQrLoginToken();
  const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_SECONDS * 1000);
  const row = await db.qrLoginSession.create({
    data: { tokenHash: hashQrToken(token), userId, expiresAt },
    select: { id: true },
  });
  // Safe log: internal id only — the raw token never enters logs.
  console.log(`[qr-login] session created (${row.id})`);

  const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";
  return {
    ok: true,
    sessionId: row.id,
    token,
    url: `${base}/pair/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Desktop side: poll the session's state (owner-checked, generic otherwise). */
export async function getQrLoginStatus(
  sessionId: string,
): Promise<{ ok: true; state: "pending" | "scanned" | "confirmed" } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const row = await db.qrLoginSession.findFirst({
    where: { id: sessionId, userId },
    select: { scannedAt: true, confirmedAt: true, expiresAt: true },
  });
  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (row.confirmedAt) return { ok: true, state: "confirmed" };
  if (row.expiresAt < new Date()) return { ok: false, error: "EXPIRED" };
  return { ok: true, state: row.scannedAt ? "scanned" : "pending" };
}

/** Desktop side: user cancelled the QR before anyone scanned it. */
export async function cancelQrLoginSession(sessionId: string): Promise<void> {
  const userId = await requireUserId();
  await db.qrLoginSession.deleteMany({ where: { id: sessionId, userId, confirmedAt: null } });
}

/**
 * Phone side: called by the pair page AFTER the user explicitly confirms.
 * Atomically consumes the token (single-use), then issues the normal session.
 * Generic rejection for unknown / used / expired — no attacker-useful detail.
 */
export async function confirmQrLogin(
  token: string,
): Promise<{ ok: true } | { ok: false; error: "INVALID" | "RATE_LIMITED" }> {
  const headersList = await import("next/headers").then((m) => m.headers());
  const ip = getRequestIp(headersList);
  if (throttlingEnabled() && !checkRateLimit(`qr-confirm:${ip}`, DEFAULT_LIMITS.qr)) {
    return { ok: false, error: "RATE_LIMITED" };
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 128) {
    return { ok: false, error: "INVALID" };
  }
  const claimed = await consumeQrLoginSession(token);
  if (!claimed) {
    console.log("[qr-login] confirm rejected (generic)");
    return { ok: false, error: "INVALID" };
  }
  await issueSessionCookie(claimed.userId);
  console.log("[qr-login] session issued via QR");
  return { ok: true };
}
