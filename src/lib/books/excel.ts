// SPDX-License-Identifier: GPL-3.0-only
// Excel — legacy src/books/excel_io.py port.
// Single responsibility: Excel import/export.

import ExcelJS from "exceljs";
import { normalizeIsbn, isValidIsbn10, isValidIsbn13 } from "./model";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 MiB

const EXPORTED_FIELDS = [
  "isbn",
  "title",
  "subtitle",
  "authors",
  "publishers",
  "publish_date",
  "publish_places",
  "edition_name",
  "series",
  "number_of_pages",
  "languages",
  "isbn_10",
  "isbn_13",
  "subjects",
  "rating",
  "notes",
  "status",
  "tags",
  "started_date",
  "finished_date",
  "signed",
  "copies",
] as const;

const DATE_FIELDS = new Set(["started_date", "finished_date"]);

export type ExportBook = {
  id: string;
  isbn?: string | null;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  publishers?: string | null;
  publishDate?: string | null;
  publishPlaces?: string | null;
  editionName?: string | null;
  series?: string | null;
  numberOfPages?: string | null;
  languages?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  subjects?: string | null;
  rating?: number | null;
  notes?: string | null;
  status: string;
  tags?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  signed?: boolean | null;
  copies?: number | null;
};

function columnValue(book: ExportBook, field: string): string {
  switch (field) {
    case "isbn":
      return book.isbn ?? "";
    case "title":
      return book.title;
    case "subtitle":
      return book.subtitle ?? "";
    case "authors":
      return book.author ?? "";
    case "publishers":
      return book.publishers ?? "";
    case "publish_date":
      return book.publishDate ?? "";
    case "publish_places":
      return book.publishPlaces ?? "";
    case "edition_name":
      return book.editionName ?? "";
    case "series":
      return book.series ?? "";
    case "number_of_pages":
      return book.numberOfPages ?? "";
    case "languages":
      return book.languages ?? "";
    case "isbn_10":
      return book.isbn10 ?? "";
    case "isbn_13":
      return book.isbn13 ?? "";
    case "subjects":
      return book.subjects ?? "";
    case "rating":
      return String(book.rating ?? 0);
    case "notes":
      return book.notes ?? "";
    case "status":
      return book.status;
    case "tags":
      return book.tags ?? "";
    case "started_date":
      return book.startedAt ? new Date(book.startedAt).toISOString().slice(0, 10) : "";
    case "finished_date":
      return book.finishedAt ? new Date(book.finishedAt).toISOString().slice(0, 10) : "";
    case "signed":
      return book.signed ? "yes" : "no";
    case "copies":
      return String(book.copies ?? 1);
    default:
      return "";
  }
}

function readingDays(started?: Date | string | null, finished?: Date | string | null): string {
  if (!started || !finished) return "";
  const s = new Date(started as string);
  const f = new Date(finished as string);
  if (Number.isNaN(s.getTime()) || Number.isNaN(f.getTime()) || f < s) return "";
  return ((f.getTime() - s.getTime()) / 86400000).toFixed(2);
}

export async function buildExportWorkbook(
  books: ExportBook[],
  lendingMap: Map<string, string[]>,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Library", { properties: { defaultColWidth: 14 } });

  const headers = [...EXPORTED_FIELDS, "days", "lent_to"];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.commit();

  for (const book of books) {
    const rowValues = EXPORTED_FIELDS.map((f) => columnValue(book, f));
    const days = readingDays(book.startedAt, book.finishedAt);
    const lentTo = lendingMap.get(book.id)?.join(", ") ?? "";
    rowValues.push(days, lentTo);
    const row = ws.addRow(rowValues);
    // Number formats
    // Apply styling
    row.eachCell((cell, colNumber) => {
      const field = headers[colNumber - 1];
      if (field === "isbn" || field === "isbn_10" || field === "isbn_13") cell.numFmt = "@";
      if (field === "days") cell.numFmt = "0.00";
      if (DATE_FIELDS.has(field)) cell.numFmt = "yyyy-mm-dd";
      // Formula safety: prefix with '
      const v = cell.value as string | null;
      if (typeof v === "string" && /^[=+\-@]/.test(v)) cell.value = `'${v}`;
    });
  }

  // Auto width
  ws.columns.forEach((col) => {
    const header = col.header as string;
    let max = header?.length ?? 10;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (col as any).eachCell?.((cell: ExcelJS.Cell) => {
      const v = cell.value?.toString() ?? "";
      if (v.length > max) max = Math.min(48, Math.max(10, v.length + 2));
    });
    col.width = Math.max(10, Math.min(48, max));
  });

  return wb;
}

export async function buildTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ISBNs");
  const header = ws.addRow(["isbn"]);
  header.font = { bold: true };
  ws.getColumn(1).width = 22;
  ws.getColumn(1).numFmt = "@";
  // Pre-format 500 rows
  for (let i = 2; i <= 500; i++) {
    ws.getCell(`A${i}`).numFmt = "@";
  }
  return wb;
}

export function parseIsbnsFromWorkbook(wb: ExcelJS.Workbook): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        let raw: string;
        if (typeof cell.value === "number") raw = String(cell.value);
        else if (
          cell.value &&
          typeof cell.value === "object" &&
          "text" in (cell.value as unknown as Record<string, unknown>)
        )
          raw = String((cell.value as unknown as { text: string }).text);
        else raw = String(cell.value ?? "");
        const isbn = normalizeIsbn(raw.trim());
        if (!isbn) return;
        const valid = isbn.length === 10 ? isValidIsbn10(isbn) : isbn.length === 13 ? isValidIsbn13(isbn) : false;
        if (!valid) return;
        if (!seen.has(isbn)) {
          seen.add(isbn);
          result.push(isbn);
        }
      });
    });
  });
  return result;
}

export async function readIsbnsFromBuffer(buffer: ArrayBuffer): Promise<string[]> {
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error("FileTooLarge");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return parseIsbnsFromWorkbook(wb);
}
