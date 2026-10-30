// SPDX-License-Identifier: GPL-3.0-only

import { isValidIsbn10, isValidIsbn13, normalizeIsbn } from "./model";

export const healthFindingCodes = [
  "missing_author",
  "missing_cover",
  "missing_publisher",
  "missing_publish_date",
  "missing_pages",
  "missing_language",
  "invalid_isbn",
  "isbn_mismatch",
  "duplicate_isbn",
  "possible_duplicate_title_author",
  "invalid_page_count",
  "invalid_progress",
  "invalid_copies",
] as const;

export type HealthFindingCode = (typeof healthFindingCodes)[number];
export type HealthSeverity = "critical" | "warning" | "info";

export type HealthBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  publishers: string | null;
  publishDate: string | null;
  numberOfPages: string | null;
  languages: string | null;
  isbn: string | null;
  isbn10: string | null;
  isbn13: string | null;
  status: string;
  currentPage: number | null;
  copies: number;
};

export type HealthFinding = {
  findingCode: HealthFindingCode;
  severity: HealthSeverity;
  bookId: string;
  bookTitle: string;
  reason: string;
  suggestedAction: "lookup_metadata" | "repair_isbn" | "review_duplicate" | "review_book";
};

export type HealthReport = {
  generatedAt: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    missingMetadata: number;
    duplicateCandidates: number;
    totalFindings: number;
  };
  findings: HealthFinding[];
};

const severityRank: Record<HealthSeverity, number> = { critical: 0, warning: 1, info: 2 };

function value(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizedTitleAuthor(book: Pick<HealthBook, "title" | "author">): string {
  return `${value(book.title).toLocaleLowerCase()}\u0000${value(book.author).toLocaleLowerCase()}`;
}

function addFinding(
  findings: HealthFinding[],
  book: HealthBook,
  findingCode: HealthFindingCode,
  severity: HealthSeverity,
  reason: string,
  suggestedAction: HealthFinding["suggestedAction"],
): void {
  findings.push({ findingCode, severity, bookId: book.id, bookTitle: book.title, reason, suggestedAction });
}

function addDuplicateFindings(
  findings: HealthFinding[],
  books: HealthBook[],
  keyOf: (book: HealthBook) => string,
  code: "duplicate_isbn" | "possible_duplicate_title_author",
  reason: string,
): void {
  const buckets = new Map<string, HealthBook[]>();
  for (const book of books) {
    const key = keyOf(book);
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(book);
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (const book of bucket) {
      addFinding(
        findings,
        book,
        code,
        "warning",
        reason,
        code === "duplicate_isbn" ? "review_duplicate" : "review_duplicate",
      );
    }
  }
}

/** Build the deterministic, non-mutating library health report for one user. */
export function buildHealthReport(books: HealthBook[], generatedAt = new Date().toISOString()): HealthReport {
  const findings: HealthFinding[] = [];
  for (const book of books) {
    const isbn = value(book.isbn);
    if (!value(book.author))
      addFinding(findings, book, "missing_author", "warning", "Author is missing", "lookup_metadata");
    if (!value(book.coverUrl))
      addFinding(findings, book, "missing_cover", "info", "Cover is missing", "lookup_metadata");
    if (!value(book.publishers))
      addFinding(findings, book, "missing_publisher", "info", "Publisher is missing", "lookup_metadata");
    if (!value(book.publishDate))
      addFinding(findings, book, "missing_publish_date", "info", "Publication date is missing", "lookup_metadata");
    if (!value(book.numberOfPages))
      addFinding(findings, book, "missing_pages", "warning", "Page count is missing", "lookup_metadata");
    if (!value(book.languages))
      addFinding(findings, book, "missing_language", "info", "Language is missing", "lookup_metadata");

    if (isbn) {
      const normalized = normalizeIsbn(isbn);
      const valid =
        normalized.length === 10
          ? isValidIsbn10(normalized)
          : normalized.length === 13
            ? isValidIsbn13(normalized)
            : false;
      if (!valid)
        addFinding(findings, book, "invalid_isbn", "critical", "ISBN checksum or length is invalid", "repair_isbn");
    }

    const isbn10 = value(book.isbn10) ? normalizeIsbn(value(book.isbn10)) : "";
    const isbn13 = value(book.isbn13) ? normalizeIsbn(value(book.isbn13)) : "";
    if (isbn && isbn10 && normalizeIsbn(isbn) !== isbn10 && normalizeIsbn(isbn) !== isbn13) {
      addFinding(
        findings,
        book,
        "isbn_mismatch",
        "warning",
        "Primary ISBN differs from ISBN-10/ISBN-13 fields",
        "repair_isbn",
      );
    }

    const pages = value(book.numberOfPages) ? Number.parseInt(value(book.numberOfPages), 10) : null;
    if (value(book.numberOfPages) && (!Number.isInteger(pages) || (pages ?? 0) <= 0)) {
      addFinding(
        findings,
        book,
        "invalid_page_count",
        "critical",
        "Page count must be a positive integer",
        "review_book",
      );
    }
    if (
      book.currentPage !== null &&
      (book.currentPage < 0 || (pages !== null && Number.isInteger(pages) && book.currentPage > pages))
    ) {
      addFinding(
        findings,
        book,
        "invalid_progress",
        "critical",
        "Reading progress is outside the page range",
        "review_book",
      );
    }
    if (!Number.isInteger(book.copies) || book.copies < 1) {
      addFinding(findings, book, "invalid_copies", "critical", "Copies must be at least 1", "review_book");
    }
  }

  addDuplicateFindings(
    findings,
    books,
    (book) => {
      const values = [book.isbn, book.isbn10, book.isbn13].map((isbn) => normalizeIsbn(value(isbn))).filter(Boolean);
      return values[0] ?? "";
    },
    "duplicate_isbn",
    "Another book in this library has the same ISBN",
  );
  addDuplicateFindings(
    findings,
    books,
    normalizedTitleAuthor,
    "possible_duplicate_title_author",
    "Title and author match another book; review before merging",
  );

  findings.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.findingCode.localeCompare(b.findingCode) ||
      a.bookId.localeCompare(b.bookId),
  );
  const summary = {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
    missingMetadata: findings.filter((finding) => finding.findingCode.startsWith("missing_")).length,
    duplicateCandidates: findings.filter((finding) => finding.findingCode.includes("duplicate")).length,
    totalFindings: findings.length,
  };
  return { generatedAt, summary, findings };
}
