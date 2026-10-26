// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — Public-path policy for the auth proxy.
//
// Sessionless callers fall into three groups:
//   1. Auth/onboarding pages and static assets (prefix match)
//   2. Device integrations (Kobo/OPDS) that authenticate via a path token
//   3. Scheduler endpoints that authenticate with CRON_SECRET
//
// The scheduler endpoints are matched EXACTLY, not by prefix: /api/push/subscribe
// is a user-facing session route and must never become public just because it
// shares the /api/push/ prefix.

/** Paths that are reachable without a NextAuth session, by prefix. */
export const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/setup",
  // v3.12.0 — passwordless QR login: the phone opens this page right after
  // scanning, before it holds any session cookie.
  "/pair/",
  "/manifest.json",
  "/sw.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.png",
  "/icon.svg",
  "/logo.svg",
  "/apple-touch-icon.png",
  // v3.0.0 — Kobo eReader sync + v3.2.0 OPDS catalog: devices/apps cannot
  // hold a NextAuth cookie; they authenticate via the per-user path token.
  "/api/kobo/",
  "/api/opds/",
  // v3.16.0 — token-authenticated surfaces. The route handlers perform their
  // own Bearer-token/session authentication; the proxy must not redirect them.
  "/api/v1",
  "/api/mcp",
  // v3.16.0 — container health probe used by Docker Compose and the cron
  // service. It exposes no data (DB SELECT 1 only).
  "/api/health",
  // v3.16.0 — extension cron tick (self-authenticated by CRON_SECRET).
  "/api/extensions/cron",
];

/**
 * Scheduler endpoints. These authenticate themselves with
 * `Authorization: Bearer $CRON_SECRET`; the proxy must not redirect them to
 * /login (a redirect would make the cron job log 200 while never running).
 */
export const CRON_PATHS = [
  "/api/push/streak-remind",
  "/api/push/goal-progress",
  "/api/push/overdue-remind",
  "/api/backup",
  "/api/extensions/cron",
];

/** True when the pathname may be reached without a NextAuth session. */
export function isPublicPath(pathname: string): boolean {
  if (CRON_PATHS.some((path) => pathname === path || pathname === `${path}/`)) return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/** True when the pathname is a CRON_SECRET-protected scheduler endpoint. */
export function isCronPath(pathname: string): boolean {
  return CRON_PATHS.some((path) => pathname === path || pathname === `${path}/`);
}
