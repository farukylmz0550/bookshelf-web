// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — lending actions delegate to the shared lending service.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  createLending as createLendingService,
  returnLending as returnLendingService,
} from "@/lib/services/lending";

export async function createLending(bookId: string, personId: string, dueDate?: string | null) {
  const userId = await requireUserId();
  const result = await createLendingService(userId, bookId, personId, dueDate);
  if (!result.ok) throw new Error(result.error === "NOT_FOUND" ? "Not found" : result.error);
  revalidatePath("/lending");
  revalidatePath("/people");
  return result.lending;
}

export async function returnLending(lendingId: string) {
  const userId = await requireUserId();
  const result = await returnLendingService(userId, lendingId);
  if (!result.ok) throw new Error("Not found");
  revalidatePath("/lending");
  return result.lending;
}
