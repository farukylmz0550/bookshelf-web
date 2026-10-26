// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — lending service (explicit userId, shared by actions/API/MCP).

import { db } from "@/lib/db";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";
import { parseDueDate } from "@/lib/lending-due";

export async function listLending(userId: string, options: { open?: boolean; limit?: number } = {}) {
  const rows = await db.lendingRecord.findMany({
    where: { book: { userId }, ...(options.open ? { returnedAt: null } : {}) },
    orderBy: { lentAt: "desc" },
    take: Math.min(500, Math.max(1, options.limit ?? 200)),
  });
  return rows;
}

export async function createLending(userId: string, bookId: string, personId: string, dueDate?: string | null) {
  const normalizedDueDate = parseDueDate(dueDate);
  const [book, person] = await Promise.all([
    db.book.findFirst({ where: { id: bookId, userId } }),
    db.person.findFirst({ where: { id: personId, userId }, select: { id: true, name: true } }),
  ]);
  if (!book || !person) return { ok: false as const, error: "NOT_FOUND" };

  const copies = book.copies ?? 1;
  try {
    const record = await db.$transaction(async (tx) => {
      const outCount = await tx.lendingRecord.count({ where: { bookId, returnedAt: null } });
      if (outCount >= copies) throw new Error("All copies are out");
      return tx.lendingRecord.create({
        data: {
          bookId,
          borrowerName: person.name,
          personId: person.id,
          personName: person.name,
          bookTitle: book.title,
          dueDate: normalizedDueDate,
        },
      });
    });
    try {
      await awardXp(userId, (await getAppConfig()).xpLending);
      await syncAchievements(userId);
    } catch {}
    return { ok: true as const, lending: record };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function returnLending(userId: string, lendingId: string) {
  const record = await db.lendingRecord.findFirst({
    where: { id: lendingId, book: { userId } },
  });
  if (!record) return { ok: false as const, error: "NOT_FOUND" };
  if (record.returnedAt) return { ok: true as const, lending: record };
  const lending = await db.lendingRecord.update({ where: { id: lendingId }, data: { returnedAt: new Date() } });
  return { ok: true as const, lending };
}
