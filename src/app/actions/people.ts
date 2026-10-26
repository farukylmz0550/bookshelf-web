// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v3.16.0 — people actions delegate to the shared people service.

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  createPerson as createPersonService,
  removePerson as removePersonService,
} from "@/lib/services/people";

export async function createPerson(
  name: string,
): Promise<{ ok: true; person: { id: string; name: string } } | { error: string }> {
  const userId = await requireUserId();
  const result = await createPersonService(userId, name);
  if (!result.ok) return { error: result.error };
  revalidatePath("/people");
  revalidatePath("/lending");
  return { ok: true, person: result.person };
}

export async function removePerson(personId: string) {
  const userId = await requireUserId();
  const result = await removePersonService(userId, personId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/people");
  revalidatePath("/lending");
  return { ok: true };
}
