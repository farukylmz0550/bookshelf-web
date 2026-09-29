// SPDX-License-Identifier: GPL-3.0-only
// v3.11.2 — TOTP login deadlock regression tests. Runs the REAL authorize()
// from src/auth.ts against an isolated throwaway SQLite database built from
// the project migrations, with the rate limiter forced into production mode
// and the NextAuth factory intercepted only to capture the provider.

import { describe, it, expect, beforeAll, vi } from "vitest";

// The login throttle paths under test are no-ops in dev, so force the flag.
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, throttlingEnabled: () => true };
});

// Isolated Prisma client on a temp SQLite file, schema built from migrations.
vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-totp-"));
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

// Capture the credentials provider's authorize() when the auth module builds
// its NextAuth config — the test then drives it exactly like signIn() does.
const captured = vi.hoisted(() => ({
  authorize: null as null | ((c: Record<string, unknown>, r: unknown) => Promise<unknown>),
}));

vi.mock("next-auth", () => {
  const NextAuth = (config: {
    providers: Array<{
      // Credentials() keeps the user's authorize in `options` — the provider
      // object itself carries only the default `() => null`.
      options?: { authorize?: (c: Record<string, unknown>, r: unknown) => Promise<unknown> };
    }>;
  }) => {
    const provider = config.providers.find((p) => typeof p.options?.authorize === "function");
    captured.authorize = provider?.options?.authorize ?? null;
    return {
      handlers: {},
      auth: async () => null,
      signIn: async () => null,
      signOut: async () => null,
    };
  };
  return { NextAuth, default: NextAuth };
});

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createTotpSecret } from "@/lib/totp";

type Credentials = { email?: string; password?: string; totp?: string };

describe("TOTP login (v3.11.2 deadlock fix)", () => {
  const EMAIL = "totp@bookshelf.test";
  const PASSWORD = "correct-horse-battery";
  let authorize: (c: Record<string, unknown>, r: unknown) => Promise<unknown>;

  beforeAll(async () => {
    await db.user.deleteMany();
    await db.user.create({
      data: {
        email: EMAIL,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        name: "TOTP User",
        approved: true,
        totpEnabled: true,
        totpSecret: createTotpSecret(),
      },
    });
    await import("@/auth");
    if (!captured.authorize) throw new Error("authorize() was not captured");
    authorize = captured.authorize;
  });

  function attempt(credentials: Credentials) {
    // A REAL Request with a unique IP per attempt — authorize() checks
    // `instanceof Request` and otherwise keys the login limiter on
    // "anonymous", so plain objects would share one bucket across the suite
    // (this suite targets the per-ACCOUNT TOTP throttle).
    const request = new Request("http://localhost/login", {
      headers: { "x-forwarded-for": `10.0.0.${1 + Math.floor(Math.random() * 250)}` },
    });
    return authorize(credentials, request);
  }

  it("code-less correct-password attempt asks for the code WITHOUT consuming a throttle slot", async () => {
    // 6 code-less probes — under the old ordering each one burned one of the
    // 5 slots per 5 minutes, so the account was locked out before any real
    // code was typed.
    for (let i = 0; i < 6; i++) {
      await expect(attempt({ email: EMAIL, password: PASSWORD })).rejects.toThrowError("TOTP_REQUIRED");
    }
  });

  it("5 wrong codes pass, the 6th gets a distinct TOTP_THROTTLED (not null)", async () => {
    for (let i = 0; i < 5; i++) {
      try {
        const r = await attempt({ email: EMAIL, password: PASSWORD, totp: "000000" });
        if (r === null) throw new Error(`attempt ${i + 1} unexpectedly resolved null`);
        expect.unreachable(`attempt ${i + 1} did not reject`);
      } catch (e) {
        expect((e as Error).message).toBe("INVALID_TOTP");
      }
    }
    // The throttle must surface as its OWN error — not a silent null that the
    // login form shows as "invalid credentials" while hiding the code field.
    await expect(attempt({ email: EMAIL, password: PASSWORD, totp: "000000" })).rejects.toThrowError("TOTP_THROTTLED");
  });

  it("wrong password still fails generically (null → CredentialsSignin)", async () => {
    await expect(attempt({ email: EMAIL, password: "wrong", totp: "000000" })).resolves.toBeNull();
  });
});
