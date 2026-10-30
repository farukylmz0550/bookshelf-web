// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import * as inventory from "@/lib/services/inventory";

export async function startInventoryAudit(scopeLocationId?: string | null) {
  const result = await inventory.startInventoryAudit(await requireUserId(), scopeLocationId);
  if (result.ok) revalidatePath("/inventory");
  return result;
}

export async function recordInventoryScan(
  auditId: string,
  input: { copyId?: string; barcode?: string; source?: string },
) {
  const result = await inventory.recordInventoryScan(await requireUserId(), auditId, input);
  if (result.ok) revalidatePath("/inventory");
  return result;
}

export async function completeInventoryAudit(auditId: string) {
  const result = await inventory.completeInventoryAudit(await requireUserId(), auditId);
  if (result.ok) revalidatePath("/inventory");
  return result;
}
