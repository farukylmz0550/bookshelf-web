// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";
import { normalizeName } from "@/lib/person";
import { parseDueDate } from "@/lib/lending-due";

const borrowerNameSchema = z.string().min(1).max(200);

export async function createLending(bookId: string, borrowerName: string, dueDate?: string | null) {
  const userId = await requireUserId();
  // Authoritative server-side validation — the due date must resolve before
  // any record is created. Clients cannot bypass it.
  const normalizedDueDate = parseDueDate(dueDate);

  const book = await db.book.findFirst({ where: { id: bookId, userId } });
  if (!book) throw new Error("Not found");

  const parsed = borrowerNameSchema.safeParse(borrowerName.trim());
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid borrower name");

  const nameTrimmed = parsed.data;

  // Find or create Person + copy-aware guard, atomically (check-then-act race)
  const normalized = normalizeName(nameTrimmed);
  const copies = (book as unknown as { copies?: number }).copies ?? 1;

  await db.$transaction(async (tx) => {
    const persons = await tx.person.findMany({ where: { userId }, select: { id: true, name: true } });
    let person = persons.find((p) => normalizeName(p.name) === normalized);
    if (!person) {
      person = await tx.person.create({ data: { userId, name: nameTrimmed } });
    }

    const outCount = await tx.lendingRecord.count({ where: { bookId, returnedAt: null } });
    if (outCount >= copies) throw new Error("All copies are out");

    await tx.lendingRecord.create({
      data: {
        bookId,
        borrowerName: nameTrimmed,
        personId: person.id,
        personName: nameTrimmed,
        bookTitle: book.title,
        dueDate: normalizedDueDate,
      },
    });
  });

  await awardXp(userId, (await getAppConfig()).xpLending);
  await syncAchievements(userId);
  revalidatePath("/lending");
  revalidatePath("/people");
}

export async function returnLending(lendingId: string) {
  const userId = await requireUserId();
  const record = await db.lendingRecord.findFirst({
    where: { id: lendingId, book: { userId } },
  });
  if (!record) throw new Error("Not found");

  await db.lendingRecord.update({ where: { id: lendingId }, data: { returnedAt: new Date() } });
  revalidatePath("/lending");
}
