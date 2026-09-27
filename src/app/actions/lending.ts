// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { awardXp, syncAchievements } from "@/lib/gamification";
import { getAppConfig } from "@/lib/app-config";
import { parseDueDate } from "@/lib/lending-due";

// v3.5.1 — borrowers must exist as people (created on /people). The old
// free-text name entry with implicit person creation is gone: lending to a
// borrower now requires the id of a person owned by this user, which keeps
// lender history consistent and avoids duplicate/misspelled people.

export async function createLending(bookId: string, personId: string, dueDate?: string | null) {
  const userId = await requireUserId();
  // Authoritative server-side validation — the due date must resolve before
  // any record is created. Clients cannot bypass it.
  const normalizedDueDate = parseDueDate(dueDate);

  const [book, person] = await Promise.all([
    db.book.findFirst({ where: { id: bookId, userId } }),
    db.person.findFirst({ where: { id: personId, userId }, select: { id: true, name: true } }),
  ]);
  if (!book) throw new Error("Not found");
  if (!person) throw new Error("Not found");

  // Copy-aware guard, atomically (check-then-act race)
  const copies = (book as unknown as { copies?: number }).copies ?? 1;

  await db.$transaction(async (tx) => {
    const outCount = await tx.lendingRecord.count({ where: { bookId, returnedAt: null } });
    if (outCount >= copies) throw new Error("All copies are out");

    await tx.lendingRecord.create({
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
