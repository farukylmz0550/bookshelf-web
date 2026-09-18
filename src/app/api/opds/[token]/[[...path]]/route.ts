// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — OPDS 1.2 catalog. The device/app authenticates with the SAME
// per-user capability token as the Kobo sync: /api/opds/<token>/...
// Root = navigation feed (All books + one entry per series/author),
// /all + /series/<name> + /author/<name> = acquisition feeds with covers and
// the EPUB download (streamed by the existing Kobo file proxy endpoint).
// Spec: https://specs.opds.io/opds-1.2

import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import { resolveKoboToken } from "@/lib/kobo";
import { groupAuthors, groupSeries } from "@/lib/collections";
import {
  OPDS_NAV_CONTENT_TYPE,
  OPDS_ACQ_CONTENT_TYPE,
  opdsAcquisitionFeed,
  opdsBookEntryXml,
  opdsNavigationFeed,
  type OpdsEntryBook,
  type OpdsNavEntry,
} from "@/lib/opds";

type Ctx = { params: Promise<{ token: string; path?: string[] }> };

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function GET(request: Request, ctx: Ctx) {
  const cfg = await getAppConfig();
  if (!cfg.koboEnabled) return json({ error: "opds disabled" }, 404);

  const { token, path = [] } = await ctx.params;
  const auth = await resolveKoboToken(token);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const origin = new URL(request.url).origin;
  const root = `${origin}/api/opds/${token}`;
  const updated = new Date();

  const books = await db.book.findMany({ where: { userId: auth.userId }, orderBy: { addedAt: "desc" } });

  const toEntry = (book: (typeof books)[number]): OpdsEntryBook => ({
    id: `urn:bookshelf:${book.id}`,
    title: book.title,
    author: book.author?.trim() || null,
    summary: book.subjects ? (book.subjects.split(",")[0]?.trim() ?? null) : null,
    language: (book.languages ?? "").split(",")[0]?.trim().slice(0, 2) || null,
    published: book.publishDate ?? null,
    coverUrl: book.coverUrl,
    downloadHref: book.isbn ? `${origin}/api/kobo/${token}/download/${book.id}/epub` : null,
    updated: book.addedAt,
  });

  // Root navigation feed: all books + one entry per series + per author
  if (path.length === 0) {
    const series = groupSeries(books);
    const authors = groupAuthors(books);
    const entries: OpdsNavEntry[] = [
      {
        id: "urn:bookshelf:all",
        title: "All books",
        href: `${root}/all`,
        content: `${books.length} books`,
      },
      ...series.map((s) => ({
        id: `urn:bookshelf:series:${s.name}`,
        title: `Series: ${s.name}`,
        href: `${root}/series/${encodeURIComponent(s.name)}`,
        content: `${s.finished}/${s.total} finished`,
      })),
      ...authors.map((a) => ({
        id: `urn:bookshelf:author:${a.name}`,
        title: a.name,
        href: `${root}/author/${encodeURIComponent(a.name)}`,
        content: `${a.finished}/${a.total} finished`,
      })),
    ];
    return new Response(
      opdsNavigationFeed({ id: `urn:bookshelf:root:${token}`, title: "BookShelf", selfHref: root, updated }, entries),
      { headers: { "content-type": OPDS_NAV_CONTENT_TYPE } },
    );
  }

  // /all — acquisition feed of the whole library
  if (path.length === 1 && path[0] === "all") {
    return new Response(
      opdsAcquisitionFeed({
        id: `urn:bookshelf:all:${token}`,
        title: "All books",
        selfHref: `${root}/all`,
        upHref: root,
        updated,
        books: books.map(toEntry),
      }),
      { headers: { "content-type": OPDS_ACQ_CONTENT_TYPE } },
    );
  }

  // /series/{name} — acquisition feed of one series
  if (path.length === 2 && path[0] === "series") {
    const name = decodeURIComponent(path[1]).trim();
    const series = groupSeries(books).find((s) => s.name === name);
    if (!series) return json({ error: "not found" }, 404);
    return new Response(
      opdsAcquisitionFeed({
        id: `urn:bookshelf:series:${series.name}`,
        title: series.name,
        selfHref: `${root}/series/${encodeURIComponent(series.name)}`,
        upHref: root,
        updated,
        books: series.books.map(toEntry),
      }),
      { headers: { "content-type": OPDS_ACQ_CONTENT_TYPE } },
    );
  }

  // /author/{name} — acquisition feed of one author
  if (path.length === 2 && path[0] === "author") {
    const name = decodeURIComponent(path[1]).trim();
    const author = groupAuthors(books).find((a) => a.name === name);
    if (!author) return json({ error: "not found" }, 404);
    return new Response(
      opdsAcquisitionFeed({
        id: `urn:bookshelf:author:${author.name}`,
        title: author.name,
        selfHref: `${root}/author/${encodeURIComponent(author.name)}`,
        upHref: root,
        updated,
        books: author.books.map(toEntry),
      }),
      { headers: { "content-type": OPDS_ACQ_CONTENT_TYPE } },
    );
  }

  return json({ error: "not found" }, 404);
}

export const runtime = "nodejs";
void opdsBookEntryXml;
