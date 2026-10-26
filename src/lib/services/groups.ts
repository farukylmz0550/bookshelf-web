// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — shelves/groups service.

import { z } from "zod";
import { db } from "@/lib/db";
import { syncAchievements } from "@/lib/gamification";
import { applyReorder, validateGroupColor, validateGroupName } from "@/lib/groups";

export type GroupActionResult = { ok: true } | { ok: false; error: string };

function fail(error: string): GroupActionResult {
  return { ok: false, error };
}

function dbErrorMessage(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
    return "DUPLICATE";
  }
  return "DB_ERROR";
}

const nameField = z.unknown().transform((v) => validateGroupName(v));
const colorField = z
  .unknown()
  .optional()
  .transform((v) => validateGroupColor(v ?? null));
const createGroupSchema = z.object({ name: nameField, color: colorField });
const renameGroupSchema = z.object({ name: nameField });

export async function listGroups(userId: string) {
  const [groups, counts] = await Promise.all([
    db.bookGroup.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.bookGroupMembership.groupBy({
      by: ["groupId"],
      where: { group: { userId } },
      _count: { bookId: true },
    }),
  ]);
  const countMap = new Map(counts.map((c) => [c.groupId, c._count.bookId]));
  return groups.map((g) => ({ ...g, bookCount: countMap.get(g.id) ?? 0 }));
}

export async function createGroup(
  userId: string,
  name: unknown,
  color?: unknown,
): Promise<GroupActionResult & { groupId?: string }> {
  const parsed = createGroupSchema.safeParse({ name, color });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  const nameRes = (
    parsed.data as {
      name: { ok: boolean; error?: string; value?: string };
      color: { ok: boolean; error?: string; value?: string | null };
    }
  ).name;
  const colorRes = (
    parsed.data as {
      name: { ok: boolean; error?: string; value?: string };
      color: { ok: boolean; error?: string; value?: string | null };
    }
  ).color;
  if (!nameRes.ok) return fail(nameRes.error ?? "INVALID_INPUT");
  if (!colorRes.ok) return fail(colorRes.error ?? "INVALID_INPUT");

  try {
    const group = await db.$transaction(async (tx) => {
      const maxOrder = (await tx.bookGroup.aggregate({ where: { userId }, _max: { order: true } }))._max.order;
      return tx.bookGroup.create({
        data: { userId, name: nameRes.value!, color: colorRes.value, order: (maxOrder ?? -1) + 1 },
      });
    });
    try {
      await syncAchievements(userId);
    } catch {}
    return { ok: true, groupId: group.id };
  } catch (e) {
    const message = dbErrorMessage(e);
    return fail(message === "DUPLICATE" ? "DUPLICATE_NAME" : message);
  }
}

export async function renameGroup(userId: string, groupId: string, name: unknown): Promise<GroupActionResult> {
  const parsed = renameGroupSchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  const nameRes = (parsed.data as { name: { ok: boolean; error?: string; value?: string } }).name;
  if (!nameRes.ok) return fail(nameRes.error ?? "INVALID_INPUT");

  const group = await db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
  if (!group) return fail("NOT_FOUND");
  try {
    await db.bookGroup.update({ where: { id: groupId }, data: { name: nameRes.value! } });
    return { ok: true };
  } catch (e) {
    const message = dbErrorMessage(e);
    return fail(message === "DUPLICATE" ? "DUPLICATE_NAME" : message);
  }
}

export async function deleteGroup(userId: string, groupId: string): Promise<GroupActionResult> {
  const result = await db.bookGroup.deleteMany({ where: { id: groupId, userId } });
  return result.count === 0 ? fail("NOT_FOUND") : { ok: true };
}

export async function reorderGroups(userId: string, orderedIds: string[]): Promise<GroupActionResult> {
  const groups = await db.bookGroup.findMany({ where: { userId }, select: { id: true } });
  const reorder = applyReorder(
    groups.map((g) => g.id),
    orderedIds,
  );
  if (!reorder.ok) return fail(reorder.error);
  try {
    await db.$transaction(
      reorder.ordered.map((id, index) => db.bookGroup.updateMany({ where: { id, userId }, data: { order: index } })),
    );
    return { ok: true };
  } catch (e) {
    return fail(dbErrorMessage(e));
  }
}

export async function addBookToGroup(userId: string, bookId: string, groupId: string): Promise<GroupActionResult> {
  const [book, group] = await Promise.all([
    db.book.findFirst({ where: { id: bookId, userId }, select: { id: true } }),
    db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } }),
  ]);
  if (!book || !group) return fail("NOT_FOUND");
  try {
    await db.bookGroupMembership.upsert({
      where: { bookId_groupId: { bookId, groupId } },
      update: {},
      create: { bookId, groupId },
    });
    return { ok: true };
  } catch (e) {
    return fail(dbErrorMessage(e));
  }
}

export async function listBooksForShelfPicker(userId: string, groupId: string) {
  const group = await db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
  if (!group) return { ok: false as const, error: "NOT_FOUND" };
  const [books, memberships] = await Promise.all([
    db.book.findMany({
      where: { userId },
      orderBy: { addedAt: "desc" },
      select: { id: true, title: true, author: true, coverUrl: true },
    }),
    db.bookGroupMembership.findMany({ where: { groupId }, select: { bookId: true } }),
  ]);
  const onShelf = new Set(memberships.map((m) => m.bookId));
  return { ok: true as const, books: books.map((b) => ({ ...b, onShelf: onShelf.has(b.id) })) };
}

export async function addBooksToGroup(userId: string, groupId: string, bookIds: string[]) {
  if (!Array.isArray(bookIds) || bookIds.length === 0 || bookIds.length > 500) {
    return { ok: false as const, error: "INVALID_INPUT" };
  }
  const [group, ownedBooks] = await Promise.all([
    db.bookGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } }),
    db.book.findMany({ where: { userId, id: { in: bookIds.slice(0, 500) } }, select: { id: true } }),
  ]);
  if (!group) return { ok: false as const, error: "NOT_FOUND" };
  const existing = await db.bookGroupMembership.findMany({
    where: { groupId, bookId: { in: ownedBooks.map((b) => b.id) } },
    select: { bookId: true },
  });
  const memberIds = new Set(existing.map((m) => m.bookId));
  const toAdd = ownedBooks.filter((b) => !memberIds.has(b.id)).map((b) => ({ bookId: b.id, groupId }));
  if (toAdd.length === 0) return { ok: true as const, added: 0 };
  try {
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
    try {
      await syncAchievements(userId);
    } catch {}
    return { ok: true as const, added: toAdd.length };
  } catch (e) {
    return { ok: false as const, error: dbErrorMessage(e) };
  }
}

export async function removeBookFromGroup(userId: string, bookId: string, groupId: string): Promise<GroupActionResult> {
  const result = await db.bookGroupMembership.deleteMany({
    where: { bookId, groupId, group: { userId } },
  });
  return result.count === 0 ? fail("NOT_FOUND") : { ok: true };
}
