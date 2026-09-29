// SPDX-License-Identifier: GPL-3.0-only
// In-memory sliding-window rate limiter — single shared instance per runtime.
// NOTE: proxy.ts (middleware) and the Node.js server are separate runtimes;
// each runtime gets its own Map instance from this module. Within a runtime,
// every import shares the same singleton (auth throttle, register, setup).
// Single-instance deployments only — see proxy.ts for the Redis note.
const buckets = new Map<string, { count: number; lastReset: number }>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export const DEFAULT_LIMITS = {
  api: { max: 100, windowMs: 60 * 1000 },
  login: { max: 10, windowMs: 5 * 60 * 1000 },
  register: { max: 5, windowMs: 60 * 1000 },
  // v3.12.0 — QR login: scan page loads + confirm attempts. Public endpoints,
  // so tighter than login; the 256-bit token is unguessable anyway.
  qr: { max: 10, windowMs: 60 * 1000 },
} as const;

/**
 * The trusted client IP for throttling. Behind Cloudflare (the personal
 * deployment tunnels through cloudflared) `x-forwarded-for` alone can
 * collapse every device into one key, so the Cloudflare-added
 * `cf-connecting-ip` wins when present; otherwise the first hop of
 * `x-forwarded-for` (real client), then `x-real-ip`.
 */
export function getRequestIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "anonymous";
  return headers.get("x-real-ip")?.trim() ?? "anonymous";
}

export function checkRateLimit(key: string, { max, windowMs }: RateLimitOptions): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.lastReset > windowMs) {
    buckets.set(key, { count: 1, lastReset: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/**
 * Throttles are enforced only in production. Dev/e2e hammer login/register
 * endpoints in quick succession from a single IP and would false-positive.
 */
export function throttlingEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
