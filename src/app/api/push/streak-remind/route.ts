// SPDX-License-Identifier: GPL-3.0-only
import { NextResponse } from "next/server";
import { sendStreakReminders } from "@/lib/push";

/**
 * Triggered by the Docker cron service (or an external scheduler):
 * sends push reminders to subscribed users whose streak is at risk.
 * Protected with CRON_SECRET (Bearer token).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendStreakReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Push failed" }, { status: 500 });
  }
}
