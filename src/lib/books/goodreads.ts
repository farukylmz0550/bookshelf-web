// SPDX-License-Identifier: GPL-3.0-only
// Goodreads CSV import — legacy parity for Goodreads exports.
// Single responsibility: Goodreads CSV parsing, ISBN normalization,
// shelf→status/tags mapping and import result counting.

import { z } from "zod";
import { normalizeIsbn, isValidIsbn10, isValidIsbn13 } from "./model";

export const GOODREADS_CSV_MAX_BYTES = 20 * 1024 * 1024; // 20 MiB
export const GOODREADS_MAX_ROWS = 5000; // DoS guard
export const GOODREADS_MAX_ERROR_MESSAGES = 10;

/** RFC 4180 parser: quoted fields, escaped quotes, commas inside quotes, CRLF, UTF-8 (input is a decoded string). */
export function parseCsvText(input: string): string[][] {
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1); // BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  row.push(field);
  rows.push(row);
  while (rows.length > 0 && rows[rows.length - 1].every((f) => f.trim() === "")) rows.pop();
  return rows;
}

export function headerIndex(headers: string[], candidates: string[]): number {
  const lowered = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lowered.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function cleanIsbnRaw(raw: string): string {
  let v = raw.trim();
  if (v.startsWith('="') && v.endsWith('"')) v = v.slice(2, -1);
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  v = v.replace(/\.0+$/i, ""); // Excel float remnant: 9780439708180.0
  return normalizeIsbn(v);
}

/** Parse Goodreads "Date Read" values (e.g. 2024/03/15, 2024-03-15) as UTC dates — no server-TZ dependence. */
export function parseGoodreadsDate(raw: string | null | undefined): Date | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})[/\-.](\d{1,2})(?:[/\-.](\d{1,2}))?$/);
  if (!match) {
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? "1")));
}

/**
 * Normalize Goodreads ISBN noise. ISBN13 is preferred when valid.
 * Never fabricates an ISBN — invalid/empty input yields null.
 */
export function normalizeGoodreadsIsbn(raw13?: string | null, raw10?: string | null): string | null {
  const c13 = raw13 ? cleanIsbnRaw(raw13) : "";
  if (c13.length === 13 && isValidIsbn13(c13)) return c13;
  const c10 = raw10 ? cleanIsbnRaw(raw10) : "";
  if (c10.length === 10 && isValidIsbn10(c10)) return c10;
  return null;
}

export type BookStatusLiteral = "TO_READ" | "READING" | "FINISHED";

const STATUS_SHELVES: [string, BookStatusLiteral][] = [
  ["read", "FINISHED"],
  ["currently-reading", "READING"],
  ["to-read", "TO_READ"],
];

/** Goodreads Bookshelves → status (only unambiguous; precedence read > currently-reading > to-read) + custom shelves as tags. */
export function parseShelves(bookshelves?: string | null): { status: BookStatusLiteral | null; tags: string[] } {
  if (!bookshelves?.trim()) return { status: null, tags: [] };
  const items = bookshelves
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let status: BookStatusLiteral | null = null;
  for (const [shelf, literal] of STATUS_SHELVES) {
    if (items.includes(shelf)) {
      status = literal;
      break; // first match in precedence order wins
    }
  }
  const tags = items.filter((i) => !STATUS_SHELVES.some(([name]) => name === i));
  return { status, tags };
}

export type GoodreadsRow = {
  title: string;
  author?: string;
  isbn: string | null; // preferred valid ISBN (ISBN13 first)
  isbn13: string | null; // validated ISBN13, when available
  rating: number; // 0-5
  dateRead: Date | null;
  tags: string[];
  notes: string | null;
  status: BookStatusLiteral | null;
  // v3.3.0 — source-side values (Calibre/StoryGraph) fill these; Goodreads
  // rows leave them undefined and rely on Open Library enrichment.
  pages?: number | null;
  series?: string | null;
  publishers?: string | null;
};

export const rowSchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(300).optional(),
  isbn: z.string().nullable(),
  isbn13: z.string().nullable(),
  rating: z.number().int().min(0).max(5),
  dateRead: z.date().nullable(),
  tags: z.array(z.string().max(100)).max(30),
  notes: z.string().trim().max(1000).nullable(),
  status: z.enum(["TO_READ", "READING", "FINISHED"]).nullable(),
});

export type GoodreadsParseResult = { rows: GoodreadsRow[]; invalidRows: string[] } | { error: string };

/** Parse a Goodreads export into importable rows. One bad row never aborts the import. */
export function parseGoodreadsRows(text: string): GoodreadsParseResult {
  const csv = parseCsvText(text);
  if (csv.length === 0) return { error: "Invalid CSV — the file is empty" };
  const headers = csv[0];
  const titleIdx = headerIndex(headers, ["Title"]);
  if (titleIdx === -1) return { error: "Invalid CSV — no Title column" };
  const authorIdx = headerIndex(headers, ["Author", "Author l-f"]);
  const isbnIdx = headerIndex(headers, ["ISBN"]);
  const isbn13Idx = headerIndex(headers, ["ISBN13"]);
  const ratingIdx = headerIndex(headers, ["My Rating"]);
  const dateReadIdx = headerIndex(headers, ["Date Read"]);
  const shelvesIdx = headerIndex(headers, ["Bookshelves"]);
  const notesIdx = headerIndex(headers, ["Private Notes"]);

  const rows: GoodreadsRow[] = [];
  const invalidRows: string[] = [];

  for (let n = 1; n < csv.length; n++) {
    const cells = csv[n];
    const title = (titleIdx < cells.length ? cells[titleIdx] : "").trim();
    if (!title) {
      invalidRows.push(`Row ${n + 1}: missing Title`);
      continue;
    }
    const author = authorIdx !== -1 && authorIdx < cells.length ? cells[authorIdx].trim() || undefined : undefined;
    const isbn = normalizeGoodreadsIsbn(
      isbn13Idx !== -1 && isbn13Idx < cells.length ? cells[isbn13Idx] : null,
      isbnIdx !== -1 && isbnIdx < cells.length ? cells[isbnIdx] : null,
    );
    const rawRating = ratingIdx !== -1 && ratingIdx < cells.length ? cells[ratingIdx].trim() : "";
    const rawDate = dateReadIdx !== -1 && dateReadIdx < cells.length ? cells[dateReadIdx].trim() : "";
    const parsedDate = parseGoodreadsDate(rawDate);
    const shelves = shelvesIdx !== -1 && shelvesIdx < cells.length ? cells[shelvesIdx] : null;
    const { status, tags } = parseShelves(shelves);
    const rawNotes = notesIdx !== -1 && notesIdx < cells.length ? cells[notesIdx].trim() : "";

    const validated = rowSchema.safeParse({
      title,
      author,
      isbn,
      isbn13: isbn && isbn.length === 13 ? isbn : null,
      rating: Math.max(0, Math.min(5, Math.floor(parseFloat(rawRating) || 0))),
      dateRead: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
      tags,
      notes: rawNotes || null,
      status,
    });
    if (!validated.success) {
      invalidRows.push(`Row ${n + 1}: ${validated.error.issues[0]?.message ?? "invalid row"}`);
      continue;
    }
    rows.push(validated.data);
  }

  return { rows, invalidRows };
}
