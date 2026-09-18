// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — OPDS 1.2 catalog feed builders (pure XML). Sibling of the Kobo
// sync: the same per-user capability token protects the feed, book files
// stream from the caller's URL template via the existing Kobo download
// endpoint, and covers are served from Open Library as-is.
// Spec: https://specs.opds.io/opds-1.2

export const OPDS_NAV_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=navigation";
export const OPDS_ACQ_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=acquisition";
export const REL_ACQUISITION = "http://opds-spec.org/acquisition";
export const REL_IMAGE = "http://opds-spec.org/image";
export const REL_IMAGE_THUMB = "http://opds-spec.org/image/thumbnail";

/** XML-escape text/attribute content. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type OpdsFeedMeta = {
  id: string;
  title: string;
  selfHref: string;
  upHref?: string;
  updated: Date;
};

export type OpdsNavEntry = {
  id: string;
  title: string;
  href: string;
  content: string;
  count?: number;
  updated?: Date;
};

/** A navigation feed: entries link to other feeds (no acquisition links). */
export function opdsNavigationFeed(meta: OpdsFeedMeta, entries: OpdsNavEntry[]): string {
  const body = entries
    .map(
      (e) => `  <entry>
    <id>${esc(e.id)}</id>
    <title>${esc(e.title)}</title>
    <updated>${esc((e.updated ?? meta.updated).toISOString())}</updated>
    <content type="text">${esc(e.content)}</content>
    <link href="${esc(e.href)}" rel="alternate" type="${esc(OPDS_ACQ_CONTENT_TYPE)}"/>
  </entry>`,
    )
    .join("\n");
  return feedWrap(meta, body);
}

export type OpdsEntryBook = {
  id: string;
  title: string;
  author: string | null;
  summary: string | null;
  language: string | null;
  published?: string | null;
  coverUrl: string | null;
  downloadHref: string | null;
  updated: Date;
};

/** An acquisition feed entry: cover + EPUB download for one book. */
export function opdsBookEntryXml(book: OpdsEntryBook): string {
  const authorXml = book.author
    ? `  <author>
    <name>${esc(book.author)}</name>
  </author>
`
    : "";
  const links: string[] = [];
  if (book.coverUrl) {
    links.push(`    <link rel="${REL_IMAGE}" href="${esc(book.coverUrl)}" type="image/jpeg"/>`);
    links.push(`    <link rel="${REL_IMAGE_THUMB}" href="${esc(book.coverUrl)}" type="image/jpeg"/>`);
  }
  if (book.downloadHref) {
    links.push(`    <link rel="${REL_ACQUISITION}" href="${esc(book.downloadHref)}" type="application/epub+zip"/>`);
  }
  return `  <entry>
    <id>${esc(book.id)}</id>
    <title>${esc(book.title)}</title>
${authorXml}    <updated>${esc(book.updated.toISOString())}</updated>
${book.language ? `    <dcterms:language>${esc(book.language)}</dcterms:language>\n` : ""}${book.summary ? `    <summary type="text">${esc(book.summary)}</summary>\n` : ""}${links.join("\n") ? links.join("\n") + "\n" : ""}  </entry>`;
}

export type OpdsAcqFeed = {
  id: string;
  title: string;
  selfHref: string;
  upHref?: string;
  updated: Date;
  books: OpdsEntryBook[];
};

/** An acquisition feed: one entry per book with image + download links. */
export function opdsAcquisitionFeed(feed: OpdsAcqFeed): string {
  const body = feed.books.map(opdsBookEntryXml).join("\n");
  return feedWrap(feed, body);
}

function feedWrap(feed: OpdsFeedMeta, body: string): string {
  const up = feed.upHref ? `  <link rel="up" href="${esc(feed.upHref)}"/>\n` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:dcterms="http://purl.org/dc/terms/">
  <id>${esc(feed.id)}</id>
  <title>${esc(feed.title)}</title>
  <updated>${esc(feed.updated.toISOString())}</updated>
  <link rel="self" href="${esc(feed.selfHref)}"/>
${up}  ${body}
</feed>`;
}
