// SPDX-License-Identifier: GPL-3.0-only
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { checkRateLimit, throttlingEnabled, DEFAULT_LIMITS } from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/setup",
  "/manifest.json",
  "/sw.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.png",
  "/icon.svg",
  "/logo.svg",
  "/apple-touch-icon.png",
  // v3.0.0 — Kobo eReader sync: the device cannot hold a NextAuth cookie;
  // it authenticates via its per-user path token.
  "/api/kobo/",
];

// NOTE: The limiter util holds a Map per runtime — proxy (middleware) and the
// Node server are separate runtimes, so each has its own instance. That is by
// design: the middleware guards /api/* (non-auth), while login/register
// throttling lives in the Node runtime (auth.ts authorize + server actions).
// NOTE: This in-memory rate limiter only works in single-instance deployments.
// In serverless, edge, or multi-replica setups, each instance has its own Map.
// For production at scale, replace with Redis-backed rate limiting (e.g. @upstash/ratelimit).

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname;

  // Rate limit API routes (except auth — auth throttling lives in auth.ts
  // authorize() because the middleware runtime cannot load db/bcrypt).
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    // Kobo sync: a device hammers sync/download from one IP for one token —
    // key by token, not IP, so the whole building's readers can't exhaust each
    // other and one device can't rotate IPs to bypass its own budget.
    const koboPrefix = "/api/kobo/";
    const key = pathname.startsWith(koboPrefix)
      ? `kobo:${pathname.slice(koboPrefix.length).split("/")[0] ?? "anon"}`
      : `${req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anonymous"}:${pathname}`;
    if (throttlingEnabled() && !checkRateLimit(key, DEFAULT_LIMITS.api)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (pathname.startsWith("/setup")) return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|api/register|_next/static|_next/image|favicon.ico).*)"],
};
