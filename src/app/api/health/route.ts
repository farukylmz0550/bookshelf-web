// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — container health probe. Used by the Docker Compose healthcheck so
// the cron service can wait for the app instead of racing it on startup.
// Public (no session) and intentionally free of user data: a DB round-trip is
// the only thing it checks.

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
