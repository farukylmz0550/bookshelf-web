// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { normalizeName } from "@/lib/person";

const personNameSchema = z.string().min(1).max(200);

export async function createPerson(
  name: string,
): Promise<{ ok: true; person: { id: string; name: string } } | { error: string }> {
  const userId = await requireUserId();
  const parsed = personNameSchema.safeParse(name.trim());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const trimmed = parsed.data;
  const normalized = normalizeName(trimmed);
  // Dedup case-insensitive
  const existing = await db.person.findFirst({ where: { userId, name: { equals: trimmed } } });
  // Also check normalized
  const all = await db.person.findMany({ where: { userId }, select: { name: true } });
  if (all.some((p) => normalizeName(p.name) === normalized)) {
    return { error: "Person already exists" };
  }
  if (existing) return { error: "Person already exists" };
  const person = await db.person.create({ data: { userId, name: trimmed }, select: { id: true, name: true } });
  revalidatePath("/people");
  revalidatePath("/lending");
  // v3.14.0 — in-place borrower creation (lending popup): the caller can
  // select the fresh person immediately without a full round-trip.
  return { ok: true as const, person: { id: person.id, name: person.name } };
}

export async function removePerson(personId: string) {
  const userId = await requireUserId();
  const person = await db.person.findFirst({ where: { id: personId, userId } });
  if (!person) return { error: "Not found" };
  const outCount = await db.lendingRecord.count({ where: { personId, returnedAt: null } });
  if (outCount > 0) return { error: "Still has books out" };
  await db.person.delete({ where: { id: personId } });
  revalidatePath("/people");
  revalidatePath("/lending");
  return { ok: true };
}
