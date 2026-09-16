// SPDX-License-Identifier: GPL-3.0-only
"use server";

// v2.8.0 — Groups / Shelves server actions. Every mutation authenticates via
// requireUserId() and scopes every query to the caller's userId; ids supplied
// by the client are never trusted on their own.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { syncAchievements } from "@/lib/gamification";
import { applyReorder, validateGroupColor, validateGroupName } from "@/lib/groups";

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function dbErrorMessage(e: unknown): string {
  // P2002 = unique constraint (duplicate name / membership). Everything else
  // stays opaque — raw Prisma errors are never surfaced to the client.
  if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
    return "DUPLICATE";
  }
  return "DB_ERROR";
}

function revalidateGroups() {
  revalidatePath("/groups");
  revalidatePath("/books");
}

const nameField = z.unknown().transform((v) => validateGroupName(v));

const colorField = z
  .unknown()
  .optional()
  .transform((v) => validateGroupColor(v ?? null));

const createGroupSchema = z.object({ name: nameField, color: colorField });
const renameGroupSchema = z.object({ name: nameField });

export async function createGroup(name: unknown, color?: unknown): Promise<ActionResult & { groupId?: string }> {
  const userId = await requireUserId();
  const parsed = createGroupSchema.safeParse({ name, color });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  if (!parsed.data.name.ok) return fail(parsed.data.name.error);
  if (!parsed.data.color.ok) return fail(parsed.data.color.error);
  const groupName = parsed.data.name.value;
  const groupColor = parsed.data.color.value;

  try {
    // Aggregate + create run in one transaction (v2.9.0): two concurrent
    // creates can no longer read the same max order and tie on `order`.
    const group = await db.$transaction(async (tx) => {
      const maxOrder = (await tx.bookGroup.aggregate({ where: { userId }, _max: { order: true } }))._max.order;
      return tx.bookGroup.create({
        data: {
          userId,
          name: groupName,
          color: groupColor,
          order: (maxOrder ?? -1) + 1,
        },
      });
    });
    revalidateGroups();
    // v2.11.0 — shelf-based achievements (first_shelf)
    try {
      await syncAchievements(userId);
    } catch {}
    return { ok: true, groupId: group.id };
  } catch (e) {
    return fail(dbErrorMessage(e) === "DUPLICATE" ? "DUPLICATE_NAME" : dbErrorMessage(e));
  }
}

export async function renameGroup(groupId: string, name: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = renameGroupSchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  if (!parsed.data.name.ok) return fail(parsed.data.name.error);

  const group = await db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
  if (!group) return fail("NOT_FOUND");

  try {
    await db.bookGroup.update({
      where: { id: groupId },
      data: { name: parsed.data.name.value },
    });
    revalidateGroups();
    return { ok: true };
  } catch (e) {
    return fail(dbErrorMessage(e) === "DUPLICATE" ? "DUPLICATE_NAME" : dbErrorMessage(e));
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  // Ownership-scoped delete — a foreign groupId simply deletes nothing.
  const result = await db.bookGroup.deleteMany({ where: { id: groupId, userId } });
  if (result.count === 0) return fail("NOT_FOUND");
  revalidateGroups();
  return { ok: true };
}

export async function reorderGroups(orderedIds: string[]): Promise<ActionResult> {
  const userId = await requireUserId();
  const groups = await db.bookGroup.findMany({ where: { userId }, select: { id: true } });
  const reorder = applyReorder(
    groups.map((g) => g.id),
    orderedIds,
  );
  if (!reorder.ok) return fail(reorder.error);

  try {
    await db.$transaction(
      // updateMany scoped to userId — an id that escaped validation can't
      // touch another user's row.
      reorder.ordered.map((id, index) => db.bookGroup.updateMany({ where: { id, userId }, data: { order: index } })),
    );
  } catch (e) {
    return fail(dbErrorMessage(e));
  }
  revalidateGroups();
  return { ok: true };
}

export async function addBookToGroup(bookId: string, groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  // Both the book and the group must belong to the caller.
  const [book, group] = await Promise.all([
    db.book.findFirst({ where: { id: bookId, userId }, select: { id: true } }),
    db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } }),
  ]);
  if (!book || !group) return fail("NOT_FOUND");

  try {
    // The (bookId, groupId) unique constraint makes concurrent duplicates safe.
    await db.bookGroupMembership.upsert({
      where: { bookId_groupId: { bookId, groupId } },
      update: {},
      create: { bookId, groupId },
    });
  } catch (e) {
    return fail(dbErrorMessage(e));
  }
  revalidateGroups();
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}

// v2.10.0 — bulk picker: books the caller may add to one of their shelves.
export async function listBooksForShelfPicker(groupId: string): Promise<
  | {
      ok: true;
      books: { id: string; title: string; author: string | null; coverUrl: string | null; onShelf: boolean }[];
    }
  | { ok: false; error: string }
> {
  const userId = await requireUserId();
  const group = await db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
  if (!group) return { ok: false, error: "NOT_FOUND" };
  const [books, memberships] = await Promise.all([
    db.book.findMany({
      where: { userId },
      orderBy: { addedAt: "desc" },
      select: { id: true, title: true, author: true, coverUrl: true },
    }),
    db.bookGroupMembership.findMany({ where: { groupId }, select: { bookId: true } }),
  ]);
  const onShelf = new Set(memberships.map((m) => m.bookId));
  return {
    ok: true,
    books: books.map((b) => ({ ...b, onShelf: onShelf.has(b.id) })),
  };
}

export async function addBooksToGroup(
  groupId: string,
  bookIds: string[],
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!Array.isArray(bookIds) || bookIds.length === 0) return { ok: false, error: "INVALID_INPUT" };
  if (bookIds.length > 500) return { ok: false, error: "INVALID_INPUT" };

  // Group and every book must belong to the caller — filter client-supplied
  // ids against a scoped lookup instead of trusting the list.
  const [group, ownedBooks] = await Promise.all([
    db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } }),
    db.book.findMany({
      where: { userId, id: { in: bookIds.slice(0, 500) } },
      select: { id: true },
    }),
  ]);
  if (!group) return { ok: false, error: "NOT_FOUND" };
  const existing = await db.bookGroupMembership.findMany({
    where: { groupId, bookId: { in: ownedBooks.map((b) => b.id) } },
    select: { bookId: true },
  });
  const memberIds = new Set(existing.map((m) => m.bookId));
  const toAdd = ownedBooks.filter((b) => !memberIds.has(b.id)).map((b) => ({ bookId: b.id, groupId }));
  if (toAdd.length === 0) return { ok: true, added: 0 };

  try {
    // SQLite: no createMany skipDuplicates — the (bookId, groupId) unique
    // constraint plus per-row upserts keep concurrent duplicates safe.
    await db.$transaction((tx) =>
      Promise.all(
        toAdd.map((item) =>
          tx.bookGroupMembership.upsert({
            where: { bookId_groupId: { bookId: item.bookId, groupId } },
            update: {},
            create: item,
          }),
        ),
      ),
    );
    revalidateGroups();
    for (const item of toAdd) revalidatePath(`/books/${item.bookId}`);
    // v2.11.0 — hook point for future shelf-based achievements
    try {
      await syncAchievements(userId);
    } catch {}
    return { ok: true, added: toAdd.length };
  } catch (e) {
    return { ok: false, error: dbErrorMessage(e) };
  }
}

export async function removeBookFromGroup(bookId: string, groupId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  // Membership is removable only when the owning group belongs to the caller.
  const result = await db.bookGroupMembership.deleteMany({
    where: { bookId, groupId, group: { userId } },
  });
  if (result.count === 0) return fail("NOT_FOUND");
  revalidateGroups();
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}
