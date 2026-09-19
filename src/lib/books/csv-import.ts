// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — Calibre and StoryGraph CSV imports. Both map onto the same
// GoodreadsRow shape, so the shared import pipeline (dedupe, Open Library
// enrichment, XP) is reused unchanged. Header-based format detection lets one
// action accept all three sources.

import {
  parseCsvText,
  headerIndex,
  normalizeGoodreadsIsbn,
  parseGoodreadsDate,
  rowSchema,
  type GoodreadsRow,
} from "./goodreads";

export type CsvFormat = "goodreads" | "calibre" | "storygraph";

/**
 * Pure header signature detection. Returns null for unknown layouts — the
 * caller answers "invalidCsv" instead of guessing.
 */
export function detectCsvFormat(text: string): CsvFormat | null {
  const bom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = bom.split(/\r?\n/, 1)[0] ?? "";
  const header = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const has = (...names: string[]) => names.every((n) => header.includes(n));

  if (has("bookshelves") || has("bookshelves with positions")) return "goodreads";
  if (has("read status") || has("owned copies")) return "storygraph";
  if (has("authors") && (has("series") || has("publisher") || has("comments"))) return "calibre";
  return null;
}

/** Calibre "Read" column values (true/yes/1) → FINISHED. */
const isTruthy = (v: string | null) => /^(true|yes|1)$/i.test((v ?? "").trim());

/** Parse a Calibre catalog export. */
export function parseCalibreRows(text: string): { rows: GoodreadsRow[]; invalidRows: string[] } | { error: string } {
  const csv = parseCsvText(text);
  if (csv.length === 0) return { error: "Invalid CSV — the file is empty" };
  const headers = csv[0];
  const titleIdx = headerIndex(headers, ["Title"]);
  if (titleIdx === -1) return { error: "Invalid CSV — no Title column" };
  const authorsIdx = headerIndex(headers, ["Authors"]);
  const isbnIdx = headerIndex(headers, ["ISBN"]);
  const seriesIdx = headerIndex(headers, ["Series"]);
  const tagsIdx = headerIndex(headers, ["Tags"]);
  const publisherIdx = headerIndex(headers, ["Publisher"]);
  const publishedIdx = headerIndex(headers, ["Published", "Date"]);
  const ratingIdx = headerIndex(headers, ["Rating"]);
  const pagesIdx = headerIndex(headers, ["Pages"]);
  const readIdx = headerIndex(headers, ["Read"]);
  const commentsIdx = headerIndex(headers, ["Comments"]);

  const rows: GoodreadsRow[] = [];
  const invalidRows: string[] = [];

  for (let n = 1; n < csv.length; n++) {
    const cells = csv[n];
    const title = (titleIdx < cells.length ? cells[titleIdx] : "").trim();
    if (!title) {
      invalidRows.push(`Row ${n + 1}: missing Title`);
      continue;
    }
    const author = authorsIdx !== -1 && authorsIdx < cells.length ? cells[authorsIdx].trim() || undefined : undefined;
    const rawIsbn = isbnIdx !== -1 && isbnIdx < cells.length ? cells[isbnIdx] : null;
    // Calibre's single ISBN column may hold either form — try both.
    const isbn = normalizeGoodreadsIsbn(rawIsbn, rawIsbn);
    const read = readIdx !== -1 && readIdx < cells.length ? (cells[readIdx] ?? "").trim() : "";
    const isRead = isTruthy(read);
    const rawRating = ratingIdx !== -1 && ratingIdx < cells.length ? cells[ratingIdx].trim() : "";
    const rawPublished = publishedIdx !== -1 && publishedIdx < cells.length ? cells[publishedIdx].trim() : "";
    const publishedDate = rawPublished ? parseGoodreadsDate(rawPublished) : null;
    const rawPages = pagesIdx !== -1 && pagesIdx < cells.length ? parseInt(cells[pagesIdx].trim(), 10) : NaN;

    const validated = rowSchema.safeParse({
      title,
      author,
      isbn,
      isbn13: isbn && isbn.length === 13 ? isbn : null,
      rating: Math.max(0, Math.min(5, Math.floor(parseFloat(rawRating) || 0))),
      dateRead: isRead ? publishedDate : null,
      tags: (tagsIdx !== -1 && tagsIdx < cells.length ? cells[tagsIdx] : "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 30),
      notes: (commentsIdx !== -1 && commentsIdx < cells.length ? cells[commentsIdx].trim() : "") || null,
      status: isRead ? "FINISHED" : null,
    });
    if (!validated.success) {
      invalidRows.push(`Row ${n + 1}: ${validated.error.issues[0]?.message ?? "invalid row"}`);
      continue;
    }
    rows.push({
      ...validated.data,
      pages: isNaN(rawPages) || rawPages <= 0 ? null : rawPages,
      series: seriesIdx !== -1 && seriesIdx < cells.length ? cells[seriesIdx].trim() || null : null,
      publishers: publisherIdx !== -1 && publisherIdx < cells.length ? cells[publisherIdx].trim() || null : null,
    });
  }
  return { rows, invalidRows };
}

/** Parse a StoryGraph export into importable rows. */
export function parseStorygraphRows(text: string): { rows: GoodreadsRow[]; invalidRows: string[] } | { error: string } {
  const csv = parseCsvText(text);
  if (csv.length === 0) return { error: "Invalid CSV — the file is empty" };
  const headers = csv[0];
  const titleIdx = headerIndex(headers, ["Title"]);
  if (titleIdx === -1) return { error: "Invalid CSV — no Title column" };
  const authorsIdx = headerIndex(headers, ["Authors", "Author"]);
  const isbnIdx = headerIndex(headers, ["ISBN"]);
  const isbn13Idx = headerIndex(headers, ["ISBN13"]);
  const ratingIdx = headerIndex(headers, ["My Rating"]);
  const pagesIdx = headerIndex(headers, ["Number of Pages"]);
  const publisherIdx = headerIndex(headers, ["Publisher"]);
  const dateReadIdx = headerIndex(headers, ["Date Read"]);
  const statusIdx = headerIndex(headers, ["Read Status"]);

  const statusMap: Record<string, GoodreadsRow["status"]> = {
    read: "FINISHED",
    "currently-reading": "READING",
    "currently reading": "READING",
    "to-read": "TO_READ",
    "to read": "TO_READ",
  };

  const rows: GoodreadsRow[] = [];
  const invalidRows: string[] = [];

  for (let n = 1; n < csv.length; n++) {
    const cells = csv[n];
    const title = (titleIdx < cells.length ? cells[titleIdx] : "").trim();
    if (!title) {
      invalidRows.push(`Row ${n + 1}: missing Title`);
      continue;
    }
    const author = authorsIdx !== -1 && authorsIdx < cells.length ? cells[authorsIdx].trim() || undefined : undefined;
    const isbn = normalizeGoodreadsIsbn(
      isbn13Idx !== -1 && isbn13Idx < cells.length ? cells[isbn13Idx] : null,
      isbnIdx !== -1 && isbnIdx < cells.length ? cells[isbnIdx] : null,
    );
    const rawRating = ratingIdx !== -1 && ratingIdx < cells.length ? cells[ratingIdx].trim() : "";
    const rawDate = dateReadIdx !== -1 && dateReadIdx < cells.length ? cells[dateReadIdx].trim() : "";
    const parsedDate = parseGoodreadsDate(rawDate);
    const rawStatus = statusIdx !== -1 && statusIdx < cells.length ? cells[statusIdx].trim().toLowerCase() : "";
    const rawPages = pagesIdx !== -1 && pagesIdx < cells.length ? parseInt(cells[pagesIdx].trim(), 10) : NaN;

    const validated = rowSchema.safeParse({
      title,
      author,
      isbn,
      isbn13: isbn && isbn.length === 13 ? isbn : null,
      rating: Math.max(0, Math.min(5, Math.floor(parseFloat(rawRating) || 0))),
      dateRead: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
      tags: [],
      notes: null,
      status: statusMap[rawStatus] ?? null,
    });
    if (!validated.success) {
      invalidRows.push(`Row ${n + 1}: ${validated.error.issues[0]?.message ?? "invalid row"}`);
      continue;
    }
    rows.push({
      ...validated.data,
      pages: isNaN(rawPages) || rawPages <= 0 ? null : rawPages,
      publishers: publisherIdx !== -1 && publisherIdx < cells.length ? cells[publisherIdx].trim() || null : null,
    });
  }
  return { rows, invalidRows };
}

/**
 * Calibre ISBN values are ambiguous — reuse the Goodreads normalizer with the
 * same raw value in both slots (it validates length/checksum per form).
 */
