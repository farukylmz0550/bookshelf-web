// SPDX-License-Identifier: GPL-3.0-only
// Queue manual records for a future authenticated Open Library write flow.
import { db } from "@/lib/db";

export async function queueOpenLibrarySubmission(bookId: string, payload: Record<string, unknown>) {
  return db.openLibrarySubmission.upsert({
    where: { bookId },
    update: { payload: JSON.stringify(payload), status: "PENDING", lastError: null },
    create: { bookId, payload: JSON.stringify(payload) },
  });
}
