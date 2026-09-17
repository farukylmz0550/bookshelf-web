// SPDX-License-Identifier: GPL-3.0-only
// v3.0.0 — Kobo eReader sync endpoint (experimental).
// One catch-all handler for the whole v1 protocol, mirroring calibre-web's
// cps/kobo.py endpoint set. The device's api_endpoint is pointed at
// /api/kobo/<token> and everything below v1/ lands here.
//
// Endpoints:
//   POST/GET /v1/auth/device|refresh  → dummy auth response (device handshake)
//   GET      /v1/initialization       → device resources (image/sync templates)
//   GET      /v1/library/sync         → caller's whole library (books added
//                                       since the last sync) as entitlements
//   GET      /v1/library/{id}/metadata
//   GET/PUT  /v1/library/{id}/state   → progress write-back (currentPage,
//                                       streak activity, finish detection)
//   GET      /download/{bookId}/{fmt} → file proxy: streams the book file from
//                                       the caller's URL template (fileSourceUrl)
//   GET      /{bookId}/{w}/{h}/{grey}/image.jpg → cover redirect
//   ...      anything else            → storeProxy ? proxy to Kobo store : {}

import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import {
  applyKoboProgress,
  koboSyncHeaders,
  proxyToKoboStore,
  readSyncTokenHeader,
  resolveKoboToken,
} from "@/lib/kobo";
import { revalidatePath } from "next/cache";

type Ctx = { params: Promise<{ token: string; path: string[] }> };

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

const KOBO_IMAGEHOST_URL = "https://cdn.kobo.com/book-images";

/** Kobo timestamp format (no millis). Invalid dates fall back to epoch. */
const ts = (d: Date | null | undefined) => {
  const valid = d && !isNaN(d.getTime()) ? d : new Date(0);
  return valid.toISOString().replace(/\.\d+Z$/, "Z");
};

function bookEntitlement(book: { id: string; addedAt: Date }) {
  return {
    Accessibility: "Full",
    ActivePeriod: { From: ts(book.addedAt) },
    Created: ts(book.addedAt),
    CrossRevisionId: book.id,
    Id: book.id,
    IsRemoved: false,
    IsHiddenFromArchive: false,
    IsLocked: false,
    LastModified: ts(book.addedAt),
    OriginCategory: "Imported",
    RevisionId: book.id,
    Status: "Active",
  };
}

function bookMetadata(
  book: {
    id: string;
    title: string;
    author: string | null;
    publishers: string | null;
    publishDate: string | null;
    languages: string | null;
    coverUrl: string | null;
    isbn: string | null;
    isbn10: string | null;
    isbn13: string | null;
    addedAt: Date;
  },
  token: string,
  origin: string,
) {
  const language = (book.languages ?? "").split(",")[0]?.trim().slice(0, 2) || "en";
  return {
    Categories: ["00000000-0000-0000-0000-000000000001"],
    CoverImageId: book.id,
    CoverImage: book.coverUrl ? { Url: book.coverUrl, UrlSizes: {} } : undefined,
    CrossRevisionId: book.id,
    CurrentDisplayPrice: { CurrencyCode: "USD", TotalAmount: 0 },
    CurrentLoveDisplayPrice: { TotalAmount: 0 },
    Description: null,
    DownloadUrls: book.isbn
      ? [
          {
            Format: "EPUB",
            Platform: "Generic",
            Url: `${origin}/api/kobo/${token}/download/${book.id}/epub`,
          },
        ]
      : [],
    EntitlementId: book.id,
    ExternalIds: [],
    Genre: "00000000-0000-0000-0000-000000000001",
    IsEligibleForKoboLove: false,
    IsInternetArchive: false,
    IsPreOrder: false,
    IsSocialEnabled: true,
    Language: language,
    PhoneticPronunciations: {},
    PublicationDate: book.publishDate ? ts(new Date(book.publishDate)) : ts(book.addedAt),
    Publisher: { Imprint: "", Name: book.publishers ?? "" },
    RevisionId: book.id,
    Title: book.title,
    WorkId: book.id,
    ...(book.author ? { Contributors: [book.author], ContributorRoles: [{ Name: book.author }] } : {}),
  };
}

function readingState(book: { id: string; addedAt: Date; status: string; currentPage: number | null }) {
  const knownPages = book.currentPage !== null && book.currentPage > 0;
  return {
    EntitlementId: book.id,
    Created: ts(book.addedAt),
    LastModified: ts(book.addedAt),
    PriorityTimestamp: ts(book.addedAt),
    StatusInfo: {
      LastModified: ts(book.addedAt),
      Status:
        book.status === "FINISHED" ? "Finished" : knownPages || book.status === "READING" ? "Reading" : "ReadyToRead",
      TimesStartedReading: book.status === "TO_READ" ? 0 : 1,
    },
    Statistics: { LastModified: ts(book.addedAt) },
    CurrentBookmark: {
      LastModified: ts(book.addedAt),
      ...(knownPages ? { ProgressPercent: book.currentPage } : {}),
    },
  };
}

export async function GET(request: Request, ctx: Ctx) {
  const cfg = await getAppConfig();
  if (!cfg.koboEnabled) return json({ error: "kobo disabled" }, { status: 404 });

  const { token, path } = await ctx.params;
  const auth = await resolveKoboToken(token);
  if (!auth) return json({ error: "unauthorized" }, { status: 401 });

  const route = path.join("/");
  const origin = new URL(request.url).origin;
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { fileSourceUrl: true, koboToken: { select: { token: true, lastSyncAt: true } } },
  });
  const deviceToken = user?.koboToken?.token ?? token;

  // Device handshake
  if (route === "v1/initialization") {
    const resources: Record<string, unknown> = {
      image_host: origin,
      image_url_template: `${origin}/api/kobo/${deviceToken}/{ImageId}/{width}/{height}/false/image.jpg`,
      image_url_quality_template: `${origin}/api/kobo/${deviceToken}/{ImageId}/{width}/{height}/{Quality}/isGreyscale/image.jpg`,
      library_sync: `${origin}/api/kobo/${deviceToken}/v1/library/sync`,
      store_auth_url: "https://authorize.kobo.com/Login",
      account_page: "https://www.kobo.com/account/settings",
      user_profile: `${origin}/api/kobo/${deviceToken}/v1/user/profile`,
    };
    if (cfg.koboStoreProxy) {
      try {
        const storeRes = await fetch("https://storeapi.kobo.com/v1/initialization", {
          headers: { "user-agent": request.headers.get("user-agent") ?? "BookShelf" },
          signal: AbortSignal.timeout(10_000),
        });
        if (storeRes.ok) {
          const parsed = (await storeRes.json()) as { Resources?: Record<string, unknown> };
          if (parsed?.Resources) Object.assign(resources, parsed.Resources);
        }
      } catch {
        // fall back to native resources
      }
    }
    return json({ Resources: resources }, { headers: { "x-kobo-apitoken": "e30=" } });
  }

  if (route === "v1/library/sync") {
    const lastSync = user?.koboToken?.lastSyncAt ?? null;
    const books = await db.book.findMany({
      where: { userId: auth.userId, ...(lastSync ? { addedAt: { gt: lastSync } } : {}) },
      orderBy: { addedAt: "asc" },
    });
    const syncResults = books.map((book) => ({
      NewEntitlement: {
        BookEntitlement: bookEntitlement(book),
        BookMetadata: bookMetadata(book, deviceToken, origin),
        ...(book.status === "READING" || (book.currentPage ?? 0) > 0 ? { ReadingState: readingState(book) } : {}),
      },
    }));
    await db.koboSyncToken.update({ where: { token: deviceToken }, data: { lastSyncAt: new Date() } });
    const syncToken = readSyncTokenHeader(request.headers) ?? (lastSync ? ts(lastSync) : ts(new Date(0)));
    return json(syncResults, { headers: koboSyncHeaders(syncToken) });
  }

  // GET /v1/library/{id}/state — current progress for the book
  const stateMatch = route.match(/^v1\/library\/([^/]+)\/state$/);
  if (stateMatch) {
    const book = await db.book.findFirst({ where: { id: stateMatch[1], userId: auth.userId } });
    if (!book) return json({ error: "not found" }, { status: 404 });
    return json([readingState(book)]);
  }

  // GET /v1/library/{id}/metadata
  const metaMatch = route.match(/^v1\/library\/([^/]+)\/metadata$/);
  if (metaMatch) {
    const book = await db.book.findFirst({ where: { id: metaMatch[1], userId: auth.userId } });
    if (!book) return json({ error: "not found" }, { status: 404 });
    return json([bookMetadata(book, deviceToken, origin)]);
  }

  // GET /download/{bookId}/{format} — stream the file from the URL template
  const dlMatch = route.match(/^download\/([^/]+)\/([^/]+)$/);
  if (dlMatch) {
    const book = await db.book.findFirst({ where: { id: dlMatch[1], userId: auth.userId } });
    if (!book) return json({ error: "not found" }, { status: 404 });
    if (!user?.fileSourceUrl) return json({ error: "no file source configured" }, { status: 404 });
    const { applyFileSourceTemplate } = await import("@/lib/kobo");
    const target = applyFileSourceTemplate(user.fileSourceUrl, book);
    if (!target) return json({ error: "book has no ISBN" }, { status: 404 });
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok || !res.body) return json({ error: "file source error" }, { status: 502 });
      return new Response(res.body, {
        headers: {
          "content-type": res.headers.get("content-type") ?? "application/octet-stream",
          "content-length": res.headers.get("content-length") ?? "",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return json({ error: "file source unreachable" }, { status: 502 });
    }
  }

  // Cover images: {bookId}/{width}/{height}/{isGreyscale}/image.jpg
  const coverMatch = route.match(/^([^/]+)\/(\d+)\/(\d+)\/([^/]+)\/image\.jpg$/);
  if (coverMatch) {
    const book = await db.book.findFirst({
      where: { id: coverMatch[1], userId: auth.userId },
      select: { coverUrl: true },
    });
    if (book?.coverUrl) return Response.redirect(book.coverUrl, 307);
    if (cfg.koboStoreProxy) {
      return Response.redirect(
        `${KOBO_IMAGEHOST_URL}/${coverMatch[1]}/${coverMatch[2]}/${coverMatch[3]}/false/image.jpg`,
        307,
      );
    }
    return json({ error: "not found" }, { status: 404 });
  }

  // Unimplemented but proxied-friendly endpoints
  return cfg.koboStoreProxy ? proxyToKoboStore(request, "/" + path.join("/")) : json({});
}

export async function POST(request: Request, ctx: Ctx) {
  const cfg = await getAppConfig();
  if (!cfg.koboEnabled) return json({ error: "kobo disabled" }, { status: 404 });

  const { token, path } = await ctx.params;
  const route = path.join("/");

  // Device handshake — POST /v1/auth/device (also /v1/auth/refresh)
  if (route === "v1/auth/device" || route === "v1/auth/refresh") {
    return json({
      AccessToken: Buffer.from(String(token) + Date.now()).toString("base64"),
      RefreshToken: Buffer.from(String(token) + Date.now()).toString("base64"),
      TokenType: "Bearer",
      TrackingId: token,
      UserKey: "",
    });
  }

  const auth = await resolveKoboToken(token);
  if (!auth) return json({ error: "unauthorized" }, { status: 401 });

  // PUT/POST /v1/library/{id}/state — progress write-back
  const stateMatch = route.match(/^v1\/library\/([^/]+)\/state$/);
  if (stateMatch) {
    const book = await db.book.findFirst({ where: { id: stateMatch[1], userId: auth.userId } });
    if (!book) return json({ error: "not found" }, { status: 404 });
    try {
      const body = (await request.json()) as {
        ReadingStates?: Array<{
          CurrentBookmark?: { ProgressPercent?: number; Location?: { Value?: string } };
          StatusInfo?: { Status?: string };
        }>;
      };
      const state = body.ReadingStates?.[0];
      const percent = state?.CurrentBookmark?.ProgressPercent;
      const locationValue = state?.CurrentBookmark?.Location?.Value;
      const config = await getAppConfig();
      const result = await applyKoboProgress(
        book,
        {
          fraction: typeof percent === "number" ? percent / 100 : undefined,
          page: locationValue !== undefined && /^\d+$/.test(String(locationValue)) ? Number(locationValue) : undefined,
        },
        { pagesPerReadEvent: config.pagesPerReadEvent, xpPagesPer10: config.xpPagesPer10 },
      );
      const now = new Date();
      const response: Record<string, unknown> = {
        RequestResult: "Success",
        UpdateResults: [
          {
            EntitlementId: book.id,
            LastModified: ts(now),
            PriorityTimestamp: ts(now),
            ...(result.ok
              ? { CurrentBookmarkResult: { Result: "Success" }, StatusInfoResult: { Result: "Success" } }
              : {}),
          },
        ],
      };
      if (result.ok) {
        if (result.delta > 0 || result.finished) {
          revalidatePath("/books");
          revalidatePath("/stats");
        }
        return json(response);
      }
      return json({ error: "no-position" });
    } catch {
      return json({ error: "malformed request" }, { status: 400 });
    }
  }

  return cfg.koboStoreProxy ? proxyToKoboStore(request, "/" + route) : json({});
}

export async function PUT(request: Request, ctx: Ctx) {
  // Kobo sends reading-state updates as PUT.
  return POST(request, ctx);
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const cfg = await getAppConfig();
  const { token, path } = await ctx.params;
  const auth = await resolveKoboToken(token);
  if (!auth) return json({ error: "unauthorized" }, { status: 401 });
  // v1: deleting a book from the device never deletes it from the library.
  if (path[0] === "v1" && path[1] === "library") return new Response(null, { status: 204 });
  return cfg.koboStoreProxy ? proxyToKoboStore(_request, "/" + path.join("/")) : new Response("", { status: 204 });
}
