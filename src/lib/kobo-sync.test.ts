// SPDX-License-Identifier: GPL-3.0-only
// v3.0.0 — Kobo eReader sync simulation tests. Replays the device's request
// patterns (calibre-web cps/kobo.py reference) against the catch-all route
// handler with an isolated throwaway SQLite database (race-safety.test.ts
// pattern), so the whole device flow is exercised without hardware:
// handshake resources → library sync → download proxy → progress write-back.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookshelf-kobo-"));
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("@/lib/session", () => ({
  requireUserId: async () => USER_ID,
  requireAdmin: async () => USER_ID,
  requireAdminPage: async () => USER_ID,
}));

import { db } from "@/lib/db";
import { generateKoboToken, applyFileSourceTemplate } from "@/lib/kobo";
import { GET, POST, DELETE } from "@/app/api/kobo/[token]/[...path]/route";

const USER_ID = "kobouser";
const TOKEN = generateKoboToken();

let bookA: { id: string };
let bookB: { id: string };

async function seed() {
  await db.user.create({
    data: {
      id: USER_ID,
      email: "kobo@bookshelf.test",
      passwordHash: "x",
      name: "Kobo",
      approved: true,
      fileSourceUrl: "https://nas.local/files/{isbn}.epub",
    },
  });
  await db.koboSyncToken.create({ data: { userId: USER_ID, token: TOKEN } });
  bookA = await db.book.create({
    data: {
      userId: USER_ID,
      title: "Test Book A",
      author: "Test Author",
      isbn: "9780140328721",
      numberOfPages: "200",
      status: "TO_READ",
      coverUrl: "https://covers.example/1.jpg",
    },
  });
  bookB = await db.book.create({
    data: {
      userId: USER_ID,
      title: "Test Book B",
      isbn: "9780140328722",
      status: "READING",
      currentPage: 50,
    },
  });
}

function req(path: string, init: RequestInit = {}, token = TOKEN): Request {
  return new Request(`http://localhost:3000/api/kobo/${token}/${path}`, init);
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ token: TOKEN, path }) });
const ctxToken = (token: string, path: string[]) => ({ params: Promise.resolve({ token, path }) });

beforeAll(async () => {});

beforeEach(async () => {
  await db.user.deleteMany();
  await seed();
});

describe("Kobo sync — device flow simulation", () => {
  it("rejects bad tokens with 401", async () => {
    const res = await GET(req("v1/library/sync"), ctxToken("short", ["v1", "library", "sync"]));
    expect(res.status).toBe(401);
    const res2 = await GET(req("v1/library/sync"), ctxToken("a".repeat(40), ["v1", "library", "sync"]));
    expect(res2.status).toBe(401);
  });

  it("POST /v1/auth/device returns a dummy bearer handshake", async () => {
    const res = await POST(
      req("v1/auth/device", { method: "POST", body: JSON.stringify({ UserKey: "k" }) }),
      ctxToken(TOKEN, ["v1", "auth", "device"]),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.TokenType).toBe("Bearer");
    expect(body.AccessToken).toBeTruthy();
  });

  it("GET /v1/initialization returns resources with our templates", async () => {
    const res = await GET(req("v1/initialization"), ctx(["v1", "initialization"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-kobo-apitoken")).toBe("e30=");
    const body = (await res.json()) as { Resources: Record<string, string> };
    expect(body.Resources.library_sync).toContain("/api/kobo/");
    expect(body.Resources.image_url_template).toContain("{ImageId}");
  });

  it("first sync lists the whole library as NewEntitlements with download URLs", async () => {
    const res = await GET(req("v1/library/sync"), ctx(["v1", "library", "sync"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-kobo-synctoken")).toBeTruthy();
    const results = (await res.json()) as Array<
      Record<string, { BookEntitlement: { Id: string }; BookMetadata: Record<string, unknown> }>
    >;
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.NewEntitlement !== undefined)).toBe(true);
    const meta = results[0].NewEntitlement.BookMetadata;
    expect(meta.Title).toBe("Test Book A");
    const downloads = meta.DownloadUrls as Array<{ Format: string; Url: string }>;
    expect(downloads[0].Url).toContain(
      `/api/kobo/${TOKEN}/download/${results[0].NewEntitlement.BookEntitlement.Id}/epub`,
    );
  });

  it("second sync returns nothing new until another book is added", async () => {
    await GET(req("v1/library/sync"), ctx(["v1", "library", "sync"]));
    const res2 = await GET(req("v1/library/sync"), ctx(["v1", "library", "sync"]));
    expect((await res2.json()) as unknown[]).toHaveLength(0);

    await db.book.create({ data: { userId: USER_ID, title: "New One", isbn: "123", status: "TO_READ" } });
    const res3 = await GET(req("v1/library/sync"), ctx(["v1", "library", "sync"]));
    expect(((await res3.json()) as unknown[]).length).toBe(1);
  });

  it("GET /v1/library/{id}/metadata returns the single book metadata", async () => {
    const res = await GET(req(`v1/library/${bookA.id}/metadata`), ctx(["v1", "library", bookA.id, "metadata"]));
    const [meta] = (await res.json()) as Array<Record<string, unknown>>;
    expect(meta.Title).toBe("Test Book A");
    expect(meta.EntitlementId).toBe(bookA.id);
  });

  it("download proxies the file from the user's URL template", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://nas.local/files/9780140328721.epub");
      return new Response("epub-bytes", { status: 200, headers: { "content-type": "application/epub+zip" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req(`download/${bookA.id}/epub`), ctx(["download", bookA.id, "epub"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/epub+zip");
    expect(await res.text()).toBe("epub-bytes");
    vi.unstubAllGlobals();
  });

  it("download without a configured template answers 404, not a crash", async () => {
    await db.user.update({ where: { id: USER_ID }, data: { fileSourceUrl: null } });
    const res = await GET(req(`download/${bookA.id}/epub`), ctx(["download", bookA.id, "epub"]));
    expect(res.status).toBe(404);
  });

  it("cover request redirects to the book's cover URL", async () => {
    const res = await GET(
      req(`${bookA.id}/600/800/false/image.jpg`),
      ctx([bookA.id, "600", "800", "false", "image.jpg"]),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://covers.example/1.jpg");
  });

  it("state write-back: device progress updates currentPage and awards delta XP", async () => {
    const res = await POST(
      req(`v1/library/${bookB.id}/state`, {
        method: "PUT",
        body: JSON.stringify({
          ReadingStates: [{ CurrentBookmark: { ProgressPercent: 50, Location: { Value: "100" } } }],
        }),
      }),
      ctx(["v1", "library", bookB.id, "state"]),
    );
    const body = (await res.json()) as {
      RequestResult: string;
      UpdateResults: Array<{ CurrentBookmarkResult: { Result: string } }>;
    };
    expect(body.RequestResult).toBe("Success");
    expect(body.UpdateResults[0].CurrentBookmarkResult.Result).toBe("Success");

    const stored = await db.book.findUnique({ where: { id: bookB.id } });
    expect(stored?.currentPage).toBe(100);

    const user = await db.user.findUnique({ where: { id: USER_ID } });
    // delta = 100 - 50 = 50 pages → floor(50/10) * 3 = 15 XP
    expect(user?.xp).toBe(15);

    // re-syncing the same position must not award anything
    await POST(
      req(`v1/library/${bookB.id}/state`, {
        method: "PUT",
        body: JSON.stringify({ ReadingStates: [{ CurrentBookmark: { ProgressPercent: 50 } }] }),
      }),
      ctx(["v1", "library", bookB.id, "state"]),
    );
    const user2 = await db.user.findUnique({ where: { id: USER_ID } });
    expect(user2?.xp).toBe(15);
  });

  it("state write-back to the last page finishes the book exactly once", async () => {
    const res = await POST(
      req(`v1/library/${bookA.id}/state`, {
        method: "PUT",
        body: JSON.stringify({ ReadingStates: [{ CurrentBookmark: { ProgressPercent: 100 } }] }),
      }),
      ctx(["v1", "library", bookA.id, "state"]),
    );
    expect(res.status).toBe(200);
    const stored = await db.book.findUnique({ where: { id: bookA.id } });
    expect(stored?.status).toBe("FINISHED");
    expect(stored?.currentPage).toBe(200);
    expect(await db.bookReadEvent.count({ where: { bookId: bookA.id } })).toBe(1);

    // a duplicate finish report must not duplicate the read event/XP
    await POST(
      req(`v1/library/${bookA.id}/state`, {
        method: "PUT",
        body: JSON.stringify({ ReadingStates: [{ CurrentBookmark: { ProgressPercent: 100 } }] }),
      }),
      ctx(["v1", "library", bookA.id, "state"]),
    );
    expect(await db.bookReadEvent.count({ where: { bookId: bookA.id } })).toBe(1);
    const user = await db.user.findUnique({ where: { id: USER_ID }, select: { xp: true } });
    const base = 50 + Math.floor(200 / 10) * 3; // finish XP for 200 pages
    expect(user?.xp).toBe(base);
  });

  it("malformed state payloads are rejected with 400", async () => {
    const res = await POST(
      req(`v1/library/${bookA.id}/state`, { method: "PUT", body: "not-json" }),
      ctx(["v1", "library", bookA.id, "state"]),
    );
    expect(res.status).toBe(400);
  });

  it("device book deletion never touches the library", async () => {
    const res = await DELETE(req(`v1/library/${bookA.id}`), ctx(["v1", "library", bookA.id]));
    expect(res.status).toBe(204);
    expect(await db.book.count({ where: { id: bookA.id } })).toBe(1);
  });
});

describe("Kobo file source template", () => {
  const book = { isbn: "978-0-14-032872-1", isbn10: "0140328726", isbn13: "9780140328721" };

  it("substitutes isbn placeholders and strips non-digit characters", () => {
    expect(applyFileSourceTemplate("https://nas/{isbn}.epub", book)).toBe("https://nas/9780140328721.epub");
    expect(applyFileSourceTemplate("https://nas/{isbn13}.epub", book)).toBe("https://nas/9780140328721.epub");
    expect(applyFileSourceTemplate("https://nas/{isbn10}.epub", book)).toBe("https://nas/0140328726.epub");
  });

  it("returns null when the book has no ISBN", () => {
    expect(applyFileSourceTemplate("https://nas/{isbn}.epub", { isbn: null, isbn10: null, isbn13: null })).toBeNull();
  });
});
