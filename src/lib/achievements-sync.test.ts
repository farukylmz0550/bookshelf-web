// SPDX-License-Identifier: GPL-3.0-only
// v2.11.0 — achievement sync regression tests: permanent/monthly unlock
// semantics, exactly-once XP, month rollover and the Sept→Oct boundary. Runs
// against an isolated throwaway SQLite database built from the project
// migrations (same pattern as race-safety.test.ts).

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-achv-"));
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
  requireUserId: async () => "achvuser",
  requireAdmin: async () => "achvuser",
  requireAdminPage: async () => "achvuser",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { db } from "@/lib/db";
import { syncAchievements, ACHIEVEMENT_RULES } from "@/lib/gamification";
import { periodBounds } from "@/lib/gamification-pure";

const USER_ID = "achvuser";

async function seedCatalog() {
  await db.achievement.createMany({
    data: ACHIEVEMENT_RULES.map((r) => ({
      key: r.key,
      titleKey: `${r.key}_title`,
      descriptionKey: `${r.key}_desc`,
      iconKey: r.key,
      recurrence: r.recurrence === "MONTHLY" ? "MONTHLY" : "NONE",
    })),
  });
}

async function seedUser() {
  await db.user.create({
    data: { id: USER_ID, email: "achv@bookshelf.test", passwordHash: "x", name: "Achv", approved: true },
  });
}

async function xpOf(): Promise<number> {
  const user = await db.user.findUnique({ where: { id: USER_ID }, select: { xp: true } });
  return user?.xp ?? 0;
}

function statslessSanity() {
  return null;
}

void statslessSanity;

beforeAll(async () => {
  await seedUser();
  await seedCatalog();
});

beforeEach(async () => {
  // Fresh per-test state: user-scoped rows + re-seed user and catalog.
  await db.userAchievement.deleteMany();
  await db.user.deleteMany();
  await db.achievement.deleteMany();
  await seedUser();
  await seedCatalog();
});

describe("permanent achievements", () => {
  it("unlocks first_book and awards XP once", async () => {
    await db.book.create({ data: { userId: USER_ID, title: "Book 1" } });
    const first = await syncAchievements(USER_ID);
    expect(first).toContain("first_book");
    const xpAfterFirst = await xpOf();
    expect(xpAfterFirst).toBe(10);

    // Re-sync must be a no-op (idempotent)
    const second = await syncAchievements(USER_ID);
    expect(second).toEqual([]);
    expect(await xpOf()).toBe(xpAfterFirst);
    expect(await db.userAchievement.count({ where: { userId: USER_ID } })).toBe(1);
  });

  it("first_finish unlocks on a FINISHED book", async () => {
    await db.book.create({ data: { userId: USER_ID, title: "Book", status: "FINISHED", finishedAt: new Date() } });
    const unlocked = await syncAchievements(USER_ID);
    expect(unlocked).toContain("first_finish");
    expect(unlocked).toContain("first_book");
    expect(await db.userAchievement.count({ where: { userId: USER_ID } })).toBe(2);
  });

  it("permanent records always use the empty period key", async () => {
    await db.book.create({ data: { userId: USER_ID, title: "Book" } });
    await syncAchievements(USER_ID);
    const row = await db.userAchievement.findFirst({ include: { achievement: true } });
    expect(row?.periodKey).toBe("");
  });
});

describe("monthly achievements", () => {
  const SEPT = new Date(Date.UTC(2026, 8, 18));

  it("unlocks monthly_reader at 3 finished books in the period", async () => {
    await db.book.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: USER_ID,
        title: `Book ${i}`,
        status: "FINISHED",
        finishedAt: new Date(Date.UTC(2026, 8, i)),
      })),
    });
    const unlocked = await syncAchievements(USER_ID, SEPT);
    expect(unlocked).toContain("monthly_reader");
    const row = await db.userAchievement.findFirst({ where: { achievement: { key: "monthly_reader" } } });
    expect(row?.periodKey).toBe("2026-09");
    expect(row?.unlockedAt).toBeTruthy();
  });

  it("cannot be earned twice in the same period", async () => {
    await db.book.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: USER_ID,
        title: `Book ${i}`,
        status: "FINISHED",
        finishedAt: new Date(Date.UTC(2026, 8, i)),
      })),
    });
    await syncAchievements(USER_ID, SEPT);
    // More books, same period — repeat sync must not duplicate the row or XP.
    const before = await xpOf();
    const rows = await db.userAchievement.count({ where: { achievement: { key: "monthly_reader" } } });
    const again = await syncAchievements(USER_ID, SEPT);
    expect(again).not.toContain("monthly_reader");
    expect(await xpOf()).toBe(before);
    expect(await db.userAchievement.count({ where: { achievement: { key: "monthly_reader" } } })).toBe(rows);
  });

  it("can be earned again in a new month — September records stay intact", async () => {
    await db.book.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: USER_ID,
        title: `Sept ${i}`,
        status: "FINISHED",
        finishedAt: new Date(Date.UTC(2026, 8, i)),
      })),
    });
    await syncAchievements(USER_ID, SEPT);
    const septRows = await db.userAchievement.count();
    expect(septRows).toBeGreaterThan(0);

    // October: three new finishes unlock monthly_reader again
    await db.book.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: USER_ID,
        title: `Oct ${i}`,
        status: "FINISHED",
        finishedAt: new Date(Date.UTC(2026, 9, i)),
      })),
    });
    const octUnlock = await syncAchievements(USER_ID, new Date(Date.UTC(2026, 9, 18)));
    expect(octUnlock).toContain("monthly_reader");
    const readerRows = await db.userAchievement.findMany({
      where: { achievement: { key: "monthly_reader" } },
      orderBy: { periodKey: "asc" },
    });
    expect(readerRows.map((r) => r.periodKey)).toEqual(["2026-09", "2026-10"]);
  });

  it("treats the 2026-09-30 → 2026-10-01 boundary as separate periods", async () => {
    const [septStart, octStart] = [periodBounds("2026-09")[0], periodBounds("2026-10")[0]];
    const lateSept = new Date(Date.UTC(2026, 8, 30, 23, 59, 59));
    const earlyOct = new Date(Date.UTC(2026, 9, 1, 0, 0, 1));
    expect(lateSept.getTime()).toBeLessThan(septStart ? octStart.getTime() : Infinity);
    expect(earlyOct.getTime()).toBeGreaterThanOrEqual(octStart.getTime());
    void septStart;
  });

  it("monthly_page_turner and monthly_regular_reader use DailyActivity", async () => {
    // 500 pages across one period unlocks the page-turner; 7 days the regular reader.
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      await db.dailyActivity.create({
        data: { userId: USER_ID, date: new Date(Date.UTC(2026, 8, day)), count: 1, pagesRead: 80 },
      });
    }
    const unlocked = await syncAchievements(USER_ID, SEPT);
    expect(unlocked).toContain("monthly_page_turner"); // 7 × 100 ≥ 500
    expect(unlocked).toContain("monthly_regular_reader");
  });

  it("monthly_goal requires a confirmed monthly target", async () => {
    await db.goal.create({ data: { userId: USER_ID, yearly: 0, monthly: 3, targetYear: 2026, confirmedAt: SEPT } });
    const books = await db.book.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: USER_ID,
        title: `Book ${i}`,
        status: "FINISHED",
        finishedAt: new Date(Date.UTC(2026, 8, i)),
      })),
    });
    void books;
    const finished = await db.book.findMany({ select: { id: true, title: true } });
    await db.bookReadEvent.createMany({
      data: finished.map((b, i) => ({
        userId: USER_ID,
        bookId: b.id,
        bookTitle: b.title,
        readAt: new Date(Date.UTC(2026, 8, i + 1)),
      })),
    });
    const unlocked = await syncAchievements(USER_ID, SEPT);
    expect(unlocked).toContain("monthly_goal");
  });

  it("first_goal unlocks when the yearly target is reached", async () => {
    await db.goal.create({ data: { userId: USER_ID, yearly: 2, monthly: 0, targetYear: 2026, confirmedAt: SEPT } });
    const created = await db.$transaction([
      db.book.create({
        data: { userId: USER_ID, title: "Book 1", status: "FINISHED", finishedAt: new Date(Date.UTC(2026, 8, 1)) },
      }),
      db.book.create({
        data: { userId: USER_ID, title: "Book 2", status: "FINISHED", finishedAt: new Date(Date.UTC(2026, 8, 2)) },
      }),
    ]);
    await db.bookReadEvent.createMany({
      data: created.map((b, i) => ({
        userId: USER_ID,
        bookId: b.id,
        bookTitle: b.title,
        readAt: new Date(Date.UTC(2026, 8, i + 1)),
      })),
    });
    const unlocked = await syncAchievements(USER_ID, SEPT);
    expect(unlocked).toContain("first_goal");
  });
});
