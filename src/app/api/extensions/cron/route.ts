// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — extension cron endpoint (self-authenticated by CRON_SECRET).

import { NextResponse } from "next/server";
import { runScheduledWebhooks } from "@/lib/extensions/server-providers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await runScheduledWebhooks();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
