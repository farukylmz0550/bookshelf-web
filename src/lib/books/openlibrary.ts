// SPDX-License-Identifier: GPL-3.0-only
// OpenLibrary client — legacy src/books/openlibrary/* port.
// Features: retry 3x backoff, 429/5xx, 20MiB guard, User-Agent, author parallel.

const USER_AGENT = "Bookshelf/1.0";
const TIMEOUT_MS = 10000;
const MAX_BYTES = 20 * 1024 * 1024;

async function fetchJsonWithRetry(url: string, attempt = 0): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    clearTimeout(id);
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        return fetchJsonWithRetry(url, attempt + 1);
      }
      return null;
    }
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    if (len && parseInt(len, 10) > MAX_BYTES) return null;
    const text = await res.text();
    if (text.length > MAX_BYTES) return null;
    return JSON.parse(text);
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      return fetchJsonWithRetry(url, attempt + 1);
    }
    return null;
  }
}

export type OpenLibraryBook = {
  title: string;
  authors?: string;
  publishers?: string;
  publishDate?: string;
  publishPlaces?: string;
  numberOfPages?: string;
  languages?: string;
  subjects?: string;
  isbn10?: string;
  isbn13?: string;
  coverUrl?: string;
};

export async function fetchBook(isbn: string): Promise<OpenLibraryBook | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  // Try detailed isbn endpoint first
  const detail = (await fetchJsonWithRetry(`https://openlibrary.org/isbn/${clean}.json`)) as Record<
    string,
    unknown
  > | null;
  if (detail && typeof detail.title === "string") {
    const title = detail.title as string;
    const publishers = Array.isArray(detail.publishers) ? (detail.publishers as string[]).join(", ") : undefined;
    const publishDate = typeof detail.publish_date === "string" ? detail.publish_date : undefined;
    const publishPlaces = Array.isArray(detail.publish_places)
      ? (detail.publish_places as unknown[])
          .map((p) => (typeof p === "string" ? p : ((p as Record<string, string>).name ?? "")))
          .join(", ")
      : undefined;
    const pages = detail.number_of_pages ? String(detail.number_of_pages) : undefined;
    const languages = Array.isArray(detail.languages)
      ? (detail.languages as { key: string }[]).map((l) => l.key.split("/").pop() ?? "").join(", ")
      : undefined;
    const isbn10 = Array.isArray(detail.isbn_10) ? (detail.isbn_10 as string[])[0] : undefined;
    const isbn13 = Array.isArray(detail.isbn_13) ? (detail.isbn_13 as string[])[0] : undefined;
    const subjects = Array.isArray(detail.subjects) ? (detail.subjects as string[]).slice(0, 15).join(", ") : undefined;

    // Authors — fetch work or authors parallel (simplified: use by_statement or authors)
    let authors: string | undefined;
    if (Array.isArray(detail.authors)) {
      const authorKeys = (detail.authors as { key: string }[]).map((a) => a.key).slice(0, 8);
      const authorNames = await Promise.all(
        authorKeys.map(async (k) => {
          const data = (await fetchJsonWithRetry(`https://openlibrary.org${k}.json`)) as Record<string, unknown> | null;
          return typeof data?.name === "string" ? (data.name as string) : null;
        }),
      );
      authors = authorNames.filter(Boolean).join(", ") || undefined;
    }
    if (!authors && typeof detail.by_statement === "string") authors = detail.by_statement;

    // Cover
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg?default=false`;

    return {
      title,
      authors,
      publishers,
      publishDate,
      publishPlaces,
      numberOfPages: pages,
      languages,
      subjects,
      isbn10,
      isbn13,
      coverUrl,
    };
  }

  // Fallback to books API
  const data = (await fetchJsonWithRetry(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`,
  )) as Record<string, unknown> | null;
  if (!data) return null;
  const entry = (data as Record<string, unknown>)[`ISBN:${clean}`] as Record<string, unknown> | undefined;
  if (!entry) return null;
  return {
    title: (entry.title as string) ?? clean,
    authors: Array.isArray(entry.authors)
      ? (entry.authors as { name: string }[]).map((a) => a.name).join(", ")
      : undefined,
    publishers: Array.isArray(entry.publishers)
      ? (entry.publishers as { name: string }[]).map((p) => p.name).join(", ")
      : undefined,
    coverUrl: (entry.cover as { medium?: string; large?: string } | undefined)?.medium,
  };
}

export async function searchBook(title: string, author?: string | null): Promise<OpenLibraryBook | null> {
  const q = encodeURIComponent([title, author].filter(Boolean).join(" "));
  const data = (await fetchJsonWithRetry(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=title,author_name,number_of_pages_median,isbn`)) as { docs?: Array<Record<string, unknown>> } | null;
  const row = data?.docs?.[0];
  if (!row || typeof row.title !== "string") return null;
  const pages = typeof row.number_of_pages_median === "number" ? String(row.number_of_pages_median) : undefined;
  return { title: row.title, authors: Array.isArray(row.author_name) ? row.author_name.join(", ") : undefined, numberOfPages: pages };
}

export async function fetchBooksWithThrottle(isbns: string[]): Promise<OpenLibraryBook[]> {
  const results: OpenLibraryBook[] = [];
  let consecutiveFailures = 0;
  for (const isbn of isbns) {
    await new Promise((r) => setTimeout(r, 200)); // throttle 0.2s
    const book = await fetchBook(isbn).catch(() => null);
    if (book) {
      results.push(book);
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) break; // network_problem abort
    }
  }
  return results;
}
