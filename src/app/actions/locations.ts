// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import * as locations from "@/lib/services/locations";

export async function createLocation(name: unknown, kind: unknown, parentId?: string | null) {
  const result = await locations.createLocation(await requireUserId(), { name, kind, parentId });
  if (result.ok) revalidatePath("/locations");
  return result;
}

export async function updateLocation(
  locationId: string,
  input: { name?: unknown; parentId?: string | null; archived?: boolean },
) {
  const result = await locations.updateLocation(await requireUserId(), locationId, input);
  if (result.ok) revalidatePath("/locations");
  return result;
}
