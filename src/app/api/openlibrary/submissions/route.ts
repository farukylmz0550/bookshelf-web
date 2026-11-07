// SPDX-License-Identifier: GPL-3.0-only
// v3.21.1 — retry queued manual metadata imports from the scheduler.
import { processOpenLibrarySubmissions } from "@/lib/services/openlibrary-submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await processOpenLibrarySubmissions()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Submission processing failed" }, { status: 500 });
  }
}
