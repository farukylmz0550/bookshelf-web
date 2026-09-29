// SPDX-License-Identifier: GPL-3.0-only
// v3.12.0 — QR login regression tests. Runs the REAL lib functions
// (token generation, hash lookup, atomic consumption) against an isolated
// throwaway SQLite database built from the project migrations.

import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated Prisma client on a temp SQLite file, schema built from migrations.
vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-qrlogin-"));
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

import { db } from "@/lib/db";
import {
  cleanupQrLoginSessions,
  consumeQrLoginSession,
  generateQrLoginToken,
  hashQrToken,
  markQrLoginScanned,
} from "@/lib/qr-login";
import { checkRateLimit, DEFAULT_LIMITS } from "@/lib/rate-limit";

const USER_ID = "qr-user-1";

async function createSession(userId: string, ttlSeconds = 60) {
  const token = generateQrLoginToken();
  const row = await db.qrLoginSession.create({
    data: {
      tokenHash: hashQrToken(token),
      userId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    },
  });
  return { token, sessionId: row.id };
}

describe("QR login (v3.12.0)", () => {
  beforeAll(async () => {
    await db.qrLoginSession.deleteMany();
    await db.user.deleteMany();
    await db.user.create({
      data: { id: USER_ID, email: "qr@bookshelf.test", passwordHash: "x", name: "QR User", approved: true },
    });
  });

  it("generates 256-bit base64url tokens — unpredictable and unique", () => {
    const a = generateQrLoginToken();
    const b = generateQrLoginToken();
    // 32 bytes → 43 chars base64url, no padding, URL-safe alphabet only.
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    // The stored form is a hash — never the raw token.
    expect(hashQrToken(a)).not.toBe(a);
    expect(hashQrToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("happy path: scan marks without consuming, confirm consumes and returns the owner", async () => {
    const { token } = await createSession(USER_ID);
    await markQrLoginScanned(token);
    // Scanning alone must not authenticate — the token is still claimable.
    const claimed = await consumeQrLoginSession(token);
    expect(claimed?.userId).toBe(USER_ID);
    // Consumed now.
    await expect(consumeQrLoginSession(token)).resolves.toBeNull();
  });

  it("expired tokens are rejected", async () => {
    const { token } = await createSession(USER_ID, 0);
    await expect(consumeQrLoginSession(token)).resolves.toBeNull();
  });

  it("random tokens are rejected (invalid token / malformed payload)", async () => {
    const random = generateQrLoginToken();
    await expect(consumeQrLoginSession(random)).resolves.toBeNull();
    await expect(consumeQrLoginSession("")).resolves.toBeNull();
  });

  it("cancelled tokens are rejected (row deleted, not consumed)", async () => {
    const { token, sessionId } = await createSession(USER_ID);
    await db.qrLoginSession.delete({ where: { id: sessionId } });
    await expect(consumeQrLoginSession(token)).resolves.toBeNull();
  });

  it("concurrent confirmation: two parallel consumes yield exactly ONE session", async () => {
    const { token } = await createSession(USER_ID);
    const [a, b] = await Promise.all([consumeQrLoginSession(token), consumeQrLoginSession(token)]);
    const successes = [a, b].filter(Boolean);
    expect(successes).toHaveLength(1);
    expect(successes[0]?.userId).toBe(USER_ID);
  });

  it("cleanup removes expired and consumed rows but keeps a live pending one", async () => {
    const expired = await createSession(USER_ID, -10);
    const used = await createSession(USER_ID);
    await consumeQrLoginSession(used.token);
    const live = await createSession(USER_ID);
    await cleanupQrLoginSessions();
    await expect(db.qrLoginSession.findUnique({ where: { id: expired.sessionId } })).resolves.toBeNull();
    await expect(db.qrLoginSession.findUnique({ where: { id: used.sessionId } })).resolves.toBeNull();
    await expect(db.qrLoginSession.findUnique({ where: { id: live.sessionId } })).resolves.not.toBeNull();
  });

  it("rate limiting: repeated failed QR attempts hit the qr budget", async () => {
    const key = "qr-confirm:test-ip-1";
    // DEFAULT_LIMITS.qr = 10/min — the first 10 pass, the 11th is blocked.
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key, DEFAULT_LIMITS.qr)).toBe(true);
    }
    expect(checkRateLimit(key, DEFAULT_LIMITS.qr)).toBe(false);
  });
});
