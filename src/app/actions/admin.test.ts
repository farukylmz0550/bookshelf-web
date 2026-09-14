// SPDX-License-Identifier: GPL-3.0-only
// v2.9.3 — admin self-guard regression tests. An admin must not be able to
// approve/reject, promote/demote or delete their own account. Runs the real
// server actions against an isolated throwaway SQLite database built from the
// project migrations, with session/auth mocked so the actions run like an
// authenticated admin request.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated Prisma client on a temp SQLite file, schema built from migrations.
vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-selfguard-"));
  const dbPath = path.join(dir, "test.db");
  const { default: Database } = await import("better-sqlite3");
  const raw = new Database(dbPath);
  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
  for (const entry of fs.readdirSync(migrationsDir).sort()) {
    const sqlFile = path.join(migrationsDir, entry, "migration.sql");
    if (fs.existsSync(sqlFile)) raw.exec(fs.readFileSync(sqlFile, "utf8"));
  }
  raw.close();
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return { db: new PrismaClient({ adapter }) };
});

vi.mock("@/lib/session", () => ({
  requireUserId: async () => "admin-self",
  requireAdmin: async () => "admin-self",
  requireAdminPage: async () => "admin-self",
}));

import { db } from "@/lib/db";
import { approveUser, rejectUser, toggleAdmin, deleteUser } from "@/app/actions/admin";

const SELF_ID = "admin-self";
const OTHER_ADMIN_ID = "admin-other";
const PENDING_USER_ID = "user-pending";

beforeAll(async () => {
  await db.user.deleteMany();
  await db.user.create({
    data: { id: SELF_ID, email: "self@bookshelf.test", passwordHash: "x", name: "Self", isAdmin: true, approved: true },
  });
  await db.user.create({
    data: {
      id: OTHER_ADMIN_ID,
      email: "other-admin@bookshelf.test",
      passwordHash: "x",
      name: "Other Admin",
      isAdmin: true,
      approved: true,
    },
  });
  await db.user.create({
    data: { id: PENDING_USER_ID, email: "pending@bookshelf.test", passwordHash: "x", name: "Pending" },
  });
});

beforeEach(async () => {
  // Restore invariants that individual tests may change.
  await db.user.update({ where: { id: SELF_ID }, data: { approved: true, isAdmin: true } }).catch(() => {});
});

describe("admin self-guard (v2.9.3)", () => {
  it("approveUser rejects the admin's own account", async () => {
    await db.user.update({ where: { id: SELF_ID }, data: { approved: false } }).catch(() => {});
    await expect(approveUser(SELF_ID)).rejects.toThrow(/own account/i);
    const user = await db.user.findUnique({ where: { id: SELF_ID } });
    expect(user?.approved).toBe(false);
  });

  it("rejectUser rejects the admin's own account", async () => {
    await expect(rejectUser(SELF_ID)).rejects.toThrow(/own account/i);
    const user = await db.user.findUnique({ where: { id: SELF_ID } });
    expect(user?.approved).toBe(true);
  });

  it("toggleAdmin rejects the admin's own account", async () => {
    await expect(toggleAdmin(SELF_ID)).rejects.toThrow(/own admin role/i);
    const user = await db.user.findUnique({ where: { id: SELF_ID } });
    expect(user?.isAdmin).toBe(true);
  });

  it("deleteUser rejects the admin's own account", async () => {
    await expect(deleteUser(SELF_ID)).rejects.toThrow(/own account/i);
    expect(await db.user.findUnique({ where: { id: SELF_ID } })).not.toBeNull();
  });

  it("same actions still work on other users", async () => {
    await db.user.update({ where: { id: SELF_ID }, data: { approved: false } }).catch(() => {});
    await expect(approveUser(PENDING_USER_ID)).resolves.toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: PENDING_USER_ID } }))?.approved).toBe(true);

    await expect(rejectUser(PENDING_USER_ID)).resolves.toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: PENDING_USER_ID } }))?.approved).toBe(false);

    await expect(toggleAdmin(OTHER_ADMIN_ID)).resolves.toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: OTHER_ADMIN_ID } }))?.isAdmin).toBe(false);
    await expect(toggleAdmin(OTHER_ADMIN_ID)).resolves.toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: OTHER_ADMIN_ID } }))?.isAdmin).toBe(true);

    const temp = await db.user.create({
      data: { id: "user-temp", email: "temp@bookshelf.test", passwordHash: "x", name: "Temp" },
    });
    await expect(deleteUser(temp.id)).resolves.toEqual({ ok: true });
    expect(await db.user.findUnique({ where: { id: temp.id } })).toBeNull();
  });

  it("last-admin guards still hold for other admins", async () => {
    await expect(deleteUser(OTHER_ADMIN_ID)).resolves.toEqual({ ok: true });
    // Only SELF remains — demoting/deleting the last admin must fail.
    await expect(toggleAdmin(SELF_ID)).rejects.toThrow(/own admin role/i);
    const tempAdmin = await db.user.create({
      data: {
        id: "admin-temp",
        email: "temp-admin@bookshelf.test",
        passwordHash: "x",
        name: "Temp",
        isAdmin: true,
        approved: true,
      },
    });
    // With two admins, deleting the other one is fine again.
    await expect(deleteUser(tempAdmin.id)).resolves.toEqual({ ok: true });
  });
});
