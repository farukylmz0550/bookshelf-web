// SPDX-License-Identifier: GPL-3.0-only

import { z } from "zod";
import { db } from "@/lib/db";

export const locationKindSchema = z.enum(["ROOM", "SECTION", "SHELF", "BOX"]);
export const locationNameSchema = z.string().trim().min(1).max(120);

export async function listLocations(userId: string) {
  return db.libraryLocation.findMany({
    where: { userId },
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { copies: true } } },
  });
}

async function assertNoCycle(userId: string, locationId: string, parentId: string | null): Promise<boolean> {
  let currentId = parentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === locationId || visited.has(currentId)) return false;
    visited.add(currentId);
    const parent = await db.libraryLocation.findFirst({ where: { id: currentId, userId }, select: { parentId: true } });
    if (!parent) return false;
    currentId = parent.parentId;
  }
  return true;
}

export async function createLocation(
  userId: string,
  input: { name: unknown; kind: unknown; parentId?: string | null },
) {
  const parsed = z
    .object({ name: locationNameSchema, kind: locationKindSchema, parentId: z.string().min(1).nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const parentId = parsed.data.parentId ?? null;
  if (
    parentId &&
    !(await db.libraryLocation.findFirst({ where: { id: parentId, userId, archivedAt: null }, select: { id: true } }))
  ) {
    return { ok: false as const, error: "PARENT_NOT_FOUND" };
  }
  try {
    const location = await db.libraryLocation.create({
      data: { userId, name: parsed.data.name, kind: parsed.data.kind, parentId },
    });
    return { ok: true as const, location };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error && error.message.includes("Unique") ? "DUPLICATE_NAME" : "DB_ERROR",
    };
  }
}

export async function updateLocation(
  userId: string,
  locationId: string,
  input: { name?: unknown; parentId?: string | null; archived?: boolean },
) {
  const existing = await db.libraryLocation.findFirst({ where: { id: locationId, userId } });
  if (!existing) return { ok: false as const, error: "NOT_FOUND" };
  const parsed = z
    .object({
      name: locationNameSchema.optional(),
      parentId: z.string().min(1).nullable().optional(),
      archived: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const parentId = parsed.data.parentId === undefined ? existing.parentId : parsed.data.parentId;
  if (
    parentId &&
    !(await db.libraryLocation.findFirst({ where: { id: parentId, userId, archivedAt: null }, select: { id: true } }))
  ) {
    return { ok: false as const, error: "PARENT_NOT_FOUND" };
  }
  if (!(await assertNoCycle(userId, locationId, parentId))) return { ok: false as const, error: "PARENT_CYCLE" };
  try {
    const location = await db.libraryLocation.update({
      where: { id: locationId },
      data: {
        name: parsed.data.name ?? existing.name,
        parentId,
        archivedAt: parsed.data.archived ? new Date() : parsed.data.archived === false ? null : existing.archivedAt,
      },
    });
    return { ok: true as const, location };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error && error.message.includes("Unique") ? "DUPLICATE_NAME" : "DB_ERROR",
    };
  }
}

export async function listBookCopies(userId: string, bookId: string) {
  const book = await db.book.findFirst({ where: { id: bookId, userId }, select: { id: true } });
  if (!book) return { ok: false as const, error: "NOT_FOUND" };
  return {
    ok: true as const,
    copies: await db.bookCopy.findMany({
      where: { userId, bookId },
      include: { location: true },
      orderBy: { copyNumber: "asc" },
    }),
  };
}

/** Keep active copy rows aligned with the legacy Book.copies compatibility count. */
export async function syncBookCopies(userId: string, bookId: string, count: number) {
  const normalizedCount = Math.min(999, Math.max(1, Math.floor(count)));
  const book = await db.book.findFirst({ where: { id: bookId, userId }, select: { id: true } });
  if (!book) return { ok: false as const, error: "NOT_FOUND" };
  const active = await db.bookCopy.findMany({
    where: { userId, bookId, archivedAt: null },
    orderBy: { copyNumber: "asc" },
    select: { id: true, copyNumber: true },
  });
  await db.$transaction(async (tx) => {
    if (active.length < normalizedCount) {
      for (let copyNumber = active.length + 1; copyNumber <= normalizedCount; copyNumber += 1) {
        await tx.bookCopy.create({ data: { userId, bookId, copyNumber } });
      }
    } else if (active.length > normalizedCount) {
      const surplus = active.slice(normalizedCount).map((copy) => copy.id);
      await tx.bookCopy.updateMany({ where: { userId, id: { in: surplus } }, data: { archivedAt: new Date() } });
    }
  });
  return { ok: true as const };
}

export async function assignCopyLocation(userId: string, copyId: string, locationId: string | null) {
  const copy = await db.bookCopy.findFirst({ where: { id: copyId, userId }, select: { id: true } });
  if (!copy) return { ok: false as const, error: "NOT_FOUND" };
  if (
    locationId &&
    !(await db.libraryLocation.findFirst({ where: { id: locationId, userId, archivedAt: null }, select: { id: true } }))
  ) {
    return { ok: false as const, error: "LOCATION_NOT_FOUND" };
  }
  return {
    ok: true as const,
    copy: await db.bookCopy.update({ where: { id: copyId }, data: { locationId }, include: { location: true } }),
  };
}
