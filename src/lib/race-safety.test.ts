// SPDX-License-Identifier: GPL-3.0-only
// v2.9.0 — concurrency regression tests (settings singleton, page-log XP,
// finish idempotency, group order). Runs the real server actions against an
// isolated throwaway SQLite database built from the project migrations, with
// session/auth mocked so the actions run like an authenticated request.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated Prisma client on a temp SQLite file, schema built from migrations.
vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-race-"));
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
  requireUserId: async () => "raceuser",
  requireAdmin: async () => "raceuser",
  requireAdminPage: async () => "raceuser",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { db } from "@/lib/db";
import { defaultAppConfig } from "@/lib/app-config";
import { calculateFinishXp } from "@/lib/gamification-pure";
import { logPagesRead } from "@/app/actions/books";
import { finishBookWithXp } from "@/app/actions/streak";
import { createGroup } from "@/app/actions/groups";

const RACE_USER_ID = "raceuser";

async function seedRaceUser() {
  await db.user.create({
    data: {
      id: RACE_USER_ID,
      email: "race@bookshelf.test",
      passwordHash: "x",
      name: "Race",
      isAdmin: true,
      approved: true,
    },
  });
}

async function seedBook(fields: Partial<{ numberOfPages: string; currentPage: number; status: string }>) {
  return db.book.create({
    data: {
      userId: RACE_USER_ID,
      title: "Race Book",
      numberOfPages: fields.numberOfPages ?? null,
      currentPage: fields.currentPage ?? null,
      status: (fields.status as never) ?? "TO_READ",
    },
  });
}

beforeAll(async () => {
  await seedRaceUser();
});

beforeEach(async () => {
  // Fresh per-test state: wipe everything user-scoped (v3.0.0 — AppSettings
  // removed; site-wide values come from config.yaml/code defaults).
  await db.user.deleteMany();
  await seedRaceUser();
});

describe("logPagesRead optimistic lock (v2.9.0 race fix)", () => {
  it("double page-log advances pages once and awards XP once", async () => {
    // Realistic state: the book was never opened, so currentPage is NULL.
    const book = await seedBook({ numberOfPages: "100", status: "TO_READ" });
    const results = await Promise.all([logPagesRead(book.id), logPagesRead(book.id)]);

    // Expected values derive from the same defaults the action reads, so the
    // assertions hold regardless of optional env overrides.
    const settings = defaultAppConfig();
    const step = Math.max(1, Math.min(5000, settings.pagesPerReadEvent));

    const stored = await db.book.findUnique({ where: { id: book.id } });
    expect(stored?.currentPage).toBe(step);

    const user = await db.user.findUnique({ where: { id: RACE_USER_ID } });
    expect(user?.xp).toBe(Math.floor(step / 10) * settings.xpPagesPer10); // exactly once

    expect(await db.bookReadEvent.count({ where: { bookId: book.id } })).toBe(0);
    expect(results.some((r) => r.ok)).toBe(true);
  });

  it("concurrent auto-finish creates one read event and awards finish XP once", async () => {
    const book = await seedBook({ numberOfPages: "100", currentPage: 90, status: "READING" });
    const results = await Promise.all([logPagesRead(book.id), logPagesRead(book.id)]);

    const stored = await db.book.findUnique({ where: { id: book.id } });
    expect(stored?.status).toBe("FINISHED");
    expect(stored?.currentPage).toBe(100);
    expect(await db.bookReadEvent.count({ where: { bookId: book.id } })).toBe(1);

    const settings = defaultAppConfig();
    const expectedXp = calculateFinishXp(100, 0, {
      bookFinishedBase: settings.xpBookFinishedBase,
      pagesPer10: settings.xpPagesPer10,
      perLevelBase: settings.xpPerLevelBase,
    });
    const user = await db.user.findUnique({ where: { id: RACE_USER_ID } });
    expect(user?.xp).toBe(expectedXp);
    expect(results.some((r) => r.ok && r.finished)).toBe(true);
  });
});

describe("finishBookWithXp idempotency guard (v2.9.0)", () => {
  it("a duplicate invocation right after the first awards no extra XP", async () => {
    const book = await seedBook({ numberOfPages: "100", currentPage: 100, status: "FINISHED" });
    const settings = defaultAppConfig();
    const expectedXp = calculateFinishXp(100, 0, {
      bookFinishedBase: settings.xpBookFinishedBase,
      pagesPer10: settings.xpPagesPer10,
      perLevelBase: settings.xpPerLevelBase,
    });

    const first = await finishBookWithXp(book.id, 100);
    const second = await finishBookWithXp(book.id, 100);
    expect(first).toBe(expectedXp);
    expect(second).toBe(0);

    const user = await db.user.findUnique({ where: { id: RACE_USER_ID } });
    expect(user?.xp).toBe(expectedXp);
  });

  it("bails out for books that are not finished or not owned", async () => {
    const reading = await seedBook({ numberOfPages: "100", currentPage: 10, status: "READING" });
    expect(await finishBookWithXp(reading.id, 100)).toBe(0);

    await db.user.create({
      data: { id: "someoneelse", email: "other@bookshelf.test", passwordHash: "x", name: "Other" },
    });
    const finishedForeignOwner = await db.book.create({
      data: {
        userId: "someoneelse",
        title: "Foreign",
        status: "FINISHED",
        numberOfPages: "100",
        currentPage: 100,
      },
    });
    expect(await finishBookWithXp(finishedForeignOwner.id, 100)).toBe(0);
  });
});

describe("createGroup order race (v2.9.0)", () => {
  it("concurrent creates produce distinct sequential orders", async () => {
    const [a, b] = await Promise.all([createGroup("Alpha"), createGroup("Beta")]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const groups = await db.bookGroup.findMany({ where: { userId: RACE_USER_ID }, orderBy: { order: "asc" } });
    expect(groups.map((g) => g.name).sort()).toEqual(["Alpha", "Beta"]);
    expect(groups.map((g) => g.order)).toEqual([0, 1]);
  });

  it("concurrent same-name creates yield one group and one duplicate error", async () => {
    const [a, b] = await Promise.all([createGroup("Same"), createGroup("Same")]);
    const oks = [a, b].filter((r) => r.ok).length;
    const dupes = [a, b].filter((r) => !r.ok && r.error === "DUPLICATE_NAME").length;
    expect(oks + dupes).toBe(2);
    expect(oks).toBe(1);
    expect((await db.bookGroup.findMany({ where: { userId: RACE_USER_ID } })).length).toBe(1);
  });
});
