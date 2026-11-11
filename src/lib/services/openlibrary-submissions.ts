// SPDX-License-Identifier: GPL-3.0-only
// Queue and submit manual records through Open Library's authenticated import API.
import { db } from "@/lib/db";

type BookMetadata = {
  id: string;
  title: string;
  author?: string | null;
  subtitle?: string | null;
  publishers?: string | null;
  publishDate?: string | null;
  numberOfPages?: string | null;
  languages?: string | null;
  subjects?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
};

function list(value: string | null | undefined) {
  return value
    ?.split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Convert the local detailed form into Open Library's import schema. */
export function toOpenLibraryImportPayload(book: BookMetadata): Record<string, unknown> {
  const pages = Number.parseInt(book.numberOfPages ?? "", 10);
  return {
    title: book.title,
    ...(book.subtitle ? { subtitle: book.subtitle } : {}),
    ...(list(book.author)?.length ? { authors: list(book.author)!.map((name) => ({ name })) } : {}),
    ...(list(book.publishers)?.length ? { publishers: list(book.publishers) } : {}),
    ...(book.publishDate ? { publish_date: book.publishDate } : {}),
    ...(Number.isFinite(pages) && pages > 0 ? { number_of_pages: pages } : {}),
    ...(list(book.languages)?.length ? { languages: list(book.languages) } : {}),
    ...(list(book.subjects)?.length ? { subjects: list(book.subjects) } : {}),
    ...(book.isbn10 ? { isbn_10: list(book.isbn10) } : {}),
    ...(book.isbn13 ? { isbn_13: list(book.isbn13) } : {}),
    source_records: [`bookshelf:${book.id}`],
  };
}

export async function queueOpenLibrarySubmission(bookId: string, payload: Record<string, unknown>) {
  return db.openLibrarySubmission.upsert({
    where: { bookId },
    update: { payload: JSON.stringify(payload), status: "PENDING", lastError: null },
    create: { bookId, payload: JSON.stringify(payload) },
  });
}

function cookieHeader(response: Response) {
  return response.headers.get("set-cookie")?.split(",").map((part) => part.split(";")[0]).join("; ") ?? "";
}

/** Submit one queued record when Open Library credentials are configured. */
export async function submitOpenLibrarySubmission(bookId: string, payload: Record<string, unknown>) {
  const username = process.env.OPENLIBRARY_USERNAME;
  const password = process.env.OPENLIBRARY_PASSWORD;
  if (!username || !password) return { submitted: false as const, reason: "NOT_CONFIGURED" };

  const row = await db.openLibrarySubmission.findUnique({ where: { bookId }, include: { book: { select: { openLibrarySubmissionEnabled: true } } } });
  if (!row) return { submitted: false as const, reason: "NOT_QUEUED" };
  if (!row.book.openLibrarySubmissionEnabled) return { submitted: false as const, reason: "CONSENT_REQUIRED" };

  try {
    const login = await fetch("https://openlibrary.org/account/login.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "BookShelf/3.21" },
      body: JSON.stringify({ username, password }),
    });
    if (!login.ok) throw new Error(`Open Library login failed (${login.status})`);
    const cookie = cookieHeader(login);
    if (!cookie) throw new Error("Open Library login did not return a session");

    const response = await fetch("https://openlibrary.org/api/import?debug=true", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: cookie,
        "User-Agent": "BookShelf/3.21",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
    if (!response.ok || result?.success === false) throw new Error(result?.error || `Open Library import failed (${response.status})`);

    await db.openLibrarySubmission.update({
      where: { bookId },
      data: { status: "SUBMITTED", attempts: { increment: 1 }, lastError: null },
    });
    return { submitted: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Open Library import failed";
    await db.openLibrarySubmission.update({
      where: { bookId },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: message },
    });
    return { submitted: false as const, reason: message };
  }
}

export async function processOpenLibrarySubmissions(limit = 10) {
  const rows = await db.openLibrarySubmission.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 5 }, book: { openLibrarySubmissionEnabled: true } },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(50, limit)),
  });
  let submitted = 0;
  for (const row of rows) {
    const result = await submitOpenLibrarySubmission(row.bookId, JSON.parse(row.payload) as Record<string, unknown>);
    if (result.submitted) submitted++;
  }
  return { attempted: rows.length, submitted, remaining: Math.max(0, rows.length - submitted) };
}
