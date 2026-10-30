// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { assignCopyLocation } from "@/lib/services/locations";

export async function assignBookCopyLocation(bookId: string, copyId: string, locationId: string | null) {
  const result = await assignCopyLocation(await requireUserId(), copyId, locationId);
  if (result.ok) revalidatePath(`/books/${bookId}`);
  return result;
}
