// SPDX-License-Identifier: GPL-3.0-only
// v3.11.2 — TOTP login deadlock regression tests. Runs the REAL authorize()
// from src/auth.ts against an isolated throwaway SQLite database built from
// the project migrations, with the rate limiter forced into production mode
// and the NextAuth factory intercepted only to capture the provider.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { Auth, type AuthConfig } from "@auth/core";
import { generateSync } from "otplib";

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
  config: null as AuthConfig | null,
}));

vi.mock("next-auth", async () => {
  const { CredentialsSignin } = await import("@auth/core/errors");
  const NextAuth = (config: AuthConfig) => {
    captured.config = config;
    const provider = config.providers[0] as {
      options?: { authorize?: (c: Record<string, unknown>, r: unknown) => Promise<unknown> };
    };
    captured.authorize = provider.options?.authorize ?? null;
    return {
      handlers: {},
      auth: async () => null,
      signIn: async () => null,
      signOut: async () => null,
    };
  };
  return { NextAuth, default: NextAuth, CredentialsSignin };
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
      await expect(attempt({ email: EMAIL, password: PASSWORD })).rejects.toMatchObject({
        type: "CredentialsSignin",
        code: "TOTP_REQUIRED",
      });
    }
  });

  it("5 wrong codes pass, the 6th gets a distinct TOTP_THROTTLED (not null)", async () => {
    for (let i = 0; i < 5; i++) {
      try {
        const r = await attempt({ email: EMAIL, password: PASSWORD, totp: "000000" });
        if (r === null) throw new Error(`attempt ${i + 1} unexpectedly resolved null`);
        expect.unreachable(`attempt ${i + 1} did not reject`);
      } catch (e) {
        expect(e).toMatchObject({ type: "CredentialsSignin", code: "INVALID_TOTP" });
      }
    }
    // The throttle must surface as its OWN error — not a silent null that the
    // login form shows as "invalid credentials" while hiding the code field.
    await expect(attempt({ email: EMAIL, password: PASSWORD, totp: "000000" })).rejects.toMatchObject({
      type: "CredentialsSignin",
      code: "TOTP_THROTTLED",
    });
  });

  it("wrong password still fails generically (null → CredentialsSignin)", async () => {
    await expect(attempt({ email: EMAIL, password: "wrong", totp: "000000" })).resolves.toBeNull();
  });

  it("preserves second-factor error codes through the real Auth.js HTTP callback and requires a valid code", async () => {
    const email = "http-totp@bookshelf.test";
    const secret = createTotpSecret();
    await db.user.create({
      data: {
        email,
        name: "HTTP TOTP User",
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        approved: true,
        totpEnabled: true,
        totpSecret: secret,
      },
    });
    if (!captured.config) throw new Error("Auth config was not captured");
    const config: AuthConfig = {
      ...captured.config,
      secret: "isolated-auth-http-regression-test",
      trustHost: true,
      basePath: "/api/auth",
      logger: { error: () => undefined },
    };
    async function callback(password: string, totp = "") {
      const csrf = await Auth(new Request("https://bookshelf.test/api/auth/csrf"), config);
      const { csrfToken } = await csrf.json();
      const cookies = csrf.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      const response = await Auth(
        new Request("https://bookshelf.test/api/auth/callback/credentials", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Auth-Return-Redirect": "1",
            cookie: cookies,
            "x-forwarded-for": "10.1.0.1",
          },
          body: new URLSearchParams({ email, password, totp, csrfToken, callbackUrl: "https://bookshelf.test/books" }),
        }),
        config,
      );
      const { url } = await response.json();
      return { response, url: new URL(url) };
    }
    for (const [password, totp, code] of [
      [PASSWORD, "", "TOTP_REQUIRED"],
      [PASSWORD, "invalid", "INVALID_TOTP"],
      ["wrong-password", "", "credentials"],
    ]) {
      const result = await callback(password, totp);
      expect(result.url.searchParams.get("error")).toBe("CredentialsSignin");
      expect(result.url.searchParams.get("code")).toBe(code);
      expect(
        result.response.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token=")),
      ).toBe(false);
    }
    const success = await callback(PASSWORD, generateSync({ secret }));
    expect(success.url.href).toBe("https://bookshelf.test/books");
    expect(
      success.response.headers.getSetCookie().some((cookie) => cookie.startsWith("__Secure-authjs.session-token=")),
    ).toBe(true);
  });
});
