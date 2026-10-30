// SPDX-License-Identifier: GPL-3.0-only

import { db } from "@/lib/db";
import { buildHealthReport, type HealthReport } from "@/lib/books/health";

const healthBookSelect = {
  id: true,
  title: true,
  author: true,
  coverUrl: true,
  publishers: true,
  publishDate: true,
  numberOfPages: true,
  languages: true,
  isbn: true,
  isbn10: true,
  isbn13: true,
  status: true,
  currentPage: true,
  copies: true,
} as const;

export type HealthReportPage = HealthReport & { limit: number; offset: number };

/** Generate a user-scoped health report without writing books or creating run records. */
export async function getBooksHealthReport(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<HealthReportPage> {
  const books = await db.book.findMany({ where: { userId }, select: healthBookSelect, orderBy: { id: "asc" } });
  const report = buildHealthReport(books);
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  const offset = Math.max(0, options.offset ?? 0);
  return { ...report, findings: report.findings.slice(offset, offset + limit), limit, offset };
}

/** Load one owned book for a non-mutating repair preview. */
export async function getBookForRepairPreview(userId: string, bookId: string) {
  return db.book.findFirst({ where: { id: bookId, userId }, select: healthBookSelect });
}
