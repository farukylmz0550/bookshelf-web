// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — people (borrowers) service.

import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeName } from "@/lib/person";

const personNameSchema = z.string().trim().min(1).max(200);

export async function listPeople(userId: string) {
  return db.person.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { loans: { where: { returnedAt: null } } } } },
  });
}

export async function createPerson(userId: string, name: string) {
  const parsed = personNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const trimmed = parsed.data;
  const normalized = normalizeName(trimmed);
  const all = await db.person.findMany({ where: { userId }, select: { name: true } });
  if (all.some((p) => normalizeName(p.name) === normalized)) {
    return { ok: false as const, error: "Person already exists" };
  }
  const person = await db.person.create({
    data: { userId, name: trimmed },
    select: { id: true, name: true },
  });
  return { ok: true as const, person };
}

export async function removePerson(userId: string, personId: string) {
  const person = await db.person.findFirst({ where: { id: personId, userId } });
  if (!person) return { ok: false as const, error: "Not found" };
  const outCount = await db.lendingRecord.count({ where: { personId, returnedAt: null } });
  if (outCount > 0) return { ok: false as const, error: "Still has books out" };
  await db.person.delete({ where: { id: personId } });
  return { ok: true as const };
}
