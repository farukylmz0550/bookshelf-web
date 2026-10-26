// SPDX-License-Identifier: GPL-3.0-only
export type IsbnLookupResult = {
  isbn: string;
  title: string;
  author?: string;
  coverUrl?: string;
  numberOfPages?: string;
  publishers?: string;
  publishDate?: string;
  publishPlaces?: string;
  languages?: string;
  subjects?: string;
  isbn10?: string;
  isbn13?: string;
};

/** Looks up a single ISBN via the Open Library API. Returns null if not found. */
export async function lookupIsbn(isbn: string): Promise<IsbnLookupResult | null> {
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  try {
    const { fetchMetadataFromProviders } = await import("@/lib/extensions/server-providers");
    const extensionHit = await fetchMetadataFromProviders(cleaned);
    if (extensionHit && extensionHit.title) return extensionHit as IsbnLookupResult;
  } catch {}
  const { fetchBook } = await import("./books/openlibrary");
  const book = await fetchBook(cleaned);
  if (!book) return null;
  return {
    isbn: cleaned,
    title: book.title,
    author: book.authors,
    coverUrl: book.coverUrl,
    numberOfPages: book.numberOfPages,
    publishers: book.publishers,
    publishDate: book.publishDate,
    publishPlaces: book.publishPlaces,
    languages: book.languages,
    subjects: book.subjects,
    isbn10: book.isbn10,
    isbn13: book.isbn13,
  };
}

/** Looks up many ISBNs (bulk import) with throttle & abort on 3 consecutive failures. */
export async function lookupIsbns(isbns: string[]): Promise<IsbnLookupResult[]> {
  const { fetchBooksWithThrottle } = await import("./books/openlibrary");
  if (isbns.length > 5) {
    const books = await fetchBooksWithThrottle(isbns);
    return books
      .map((b, i) => ({
        isbn: isbns[i].replace(/[^0-9Xx]/g, ""),
        title: b.title,
        author: b.authors,
        coverUrl: b.coverUrl,
        numberOfPages: b.numberOfPages,
        publishers: b.publishers,
        publishDate: b.publishDate,
        publishPlaces: b.publishPlaces,
        languages: b.languages,
        subjects: b.subjects,
        isbn10: b.isbn10,
        isbn13: b.isbn13,
      }))
      .filter((r) => !!r.title);
  }
  const results = await Promise.all(isbns.map((isbn) => lookupIsbn(isbn).catch(() => null)));
  return results.filter((r): r is IsbnLookupResult => r !== null);
}
