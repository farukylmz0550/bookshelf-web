// SPDX-License-Identifier: GPL-3.0-only
import { z } from "zod";
import { db } from "@/lib/db";

export const inventoryItemStateSchema = z.enum(["EXPECTED", "FOUND", "MISSING", "UNEXPECTED", "WRONG_LOCATION"]);

async function locationScope(userId: string, scopeLocationId?: string | null): Promise<string[] | null | undefined> {
  if (!scopeLocationId) return null;
  const root = await db.libraryLocation.findFirst({ where: { id: scopeLocationId, userId }, select: { id: true } });
  if (!root) return undefined;
  const ids = [root.id];
  for (let index = 0; index < ids.length; index += 1) {
    const children = await db.libraryLocation.findMany({
      where: { userId, parentId: ids[index] },
      select: { id: true },
    });
    ids.push(...children.map((child) => child.id));
  }
  return ids;
}

async function summary(userId: string, auditId: string) {
  const groups = await db.inventoryAuditItem.groupBy({
    by: ["state"],
    where: { audit: { id: auditId, userId } },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((group) => [group.state, group._count._all]));
}

export async function startInventoryAudit(userId: string, scopeLocationId?: string | null) {
  const scope = await locationScope(userId, scopeLocationId);
  if (scope === undefined) return { ok: false as const, error: "LOCATION_NOT_FOUND" };
  const existing = await db.inventoryAudit.findFirst({ where: { userId, status: "OPEN" }, select: { id: true } });
  if (existing) return { ok: true as const, audit: await getInventoryAudit(userId, existing.id) };
  const copies = await db.bookCopy.findMany({
    where: { userId, archivedAt: null, ...(scope ? { locationId: { in: scope } } : {}) },
    select: { id: true },
  });
  const audit = await db.$transaction(async (tx) => {
    const created = await tx.inventoryAudit.create({ data: { userId, scopeLocationId: scopeLocationId ?? null } });
    if (copies.length > 0)
      await tx.inventoryAuditItem.createMany({
        data: copies.map((copy) => ({ auditId: created.id, copyId: copy.id })),
      });
    return created;
  });
  return { ok: true as const, audit: await getInventoryAudit(userId, audit.id) };
}

export async function getInventoryAudit(userId: string, auditId: string) {
  const audit = await db.inventoryAudit.findFirst({ where: { id: auditId, userId }, include: { scopeLocation: true } });
  if (!audit) return null;
  return { ...audit, summary: await summary(userId, auditId) };
}

export async function listInventoryAudits(userId: string) {
  const audits = await db.inventoryAudit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { scopeLocation: true },
  });
  return Promise.all(audits.map(async (audit) => ({ ...audit, summary: await summary(userId, audit.id) })));
}

export async function listInventoryItems(userId: string, auditId: string) {
  const audit = await db.inventoryAudit.findFirst({ where: { id: auditId, userId }, select: { id: true } });
  if (!audit) return { ok: false as const, error: "NOT_FOUND" };
  return {
    ok: true as const,
    items: await db.inventoryAuditItem.findMany({
      where: { auditId },
      include: { copy: { include: { book: true, location: true } } },
      orderBy: { id: "asc" },
    }),
  };
}

export async function recordInventoryScan(
  userId: string,
  auditId: string,
  input: { copyId?: string; barcode?: string; source?: string; note?: string },
) {
  const audit = await db.inventoryAudit.findFirst({
    where: { id: auditId, userId },
    select: { id: true, status: true, scopeLocationId: true },
  });
  if (!audit) return { ok: false as const, error: "NOT_FOUND" };
  if (audit.status !== "OPEN") return { ok: false as const, error: "AUDIT_COMPLETED" };
  const copy = await db.bookCopy.findFirst({
    where: { userId, ...(input.copyId ? { id: input.copyId } : { barcode: input.barcode }) },
    include: { location: true, book: true },
  });
  if (!copy) return { ok: false as const, error: "COPY_NOT_FOUND" };
  const expected = await db.inventoryAuditItem.findUnique({
    where: { auditId_copyId: { auditId, copyId: copy.id } },
    select: { id: true },
  });
  const state = expected ? "FOUND" : "WRONG_LOCATION";
  const item = expected
    ? await db.inventoryAuditItem.update({
        where: { id: expected.id },
        data: { state, scannedAt: new Date(), source: input.source ?? "scan", note: input.note },
      })
    : await db.inventoryAuditItem.create({
        data: {
          auditId,
          copyId: copy.id,
          state,
          scannedAt: new Date(),
          source: input.source ?? "scan",
          note: input.note,
        },
      });
  return { ok: true as const, item, summary: await summary(userId, auditId) };
}

export async function completeInventoryAudit(userId: string, auditId: string) {
  const audit = await db.inventoryAudit.findFirst({
    where: { id: auditId, userId },
    select: { id: true, status: true },
  });
  if (!audit) return { ok: false as const, error: "NOT_FOUND" };
  if (audit.status !== "OPEN") return { ok: false as const, error: "AUDIT_COMPLETED" };
  await db.$transaction([
    db.inventoryAuditItem.updateMany({ where: { auditId, state: "EXPECTED" }, data: { state: "MISSING" } }),
    db.inventoryAudit.update({ where: { id: auditId }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);
  return { ok: true as const, audit: await getInventoryAudit(userId, auditId) };
}
