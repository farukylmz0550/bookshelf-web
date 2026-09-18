// SPDX-License-Identifier: GPL-3.0-only
/** Buckets finish dates into their last-6-months' "YYYY-MM" label, zero-filled. */
export function monthlyFinishCounts(finishedAt: Date[], now = new Date()): { month: string; count: number }[] {
  const months: { key: string; month: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }

  const counts = new Map(months.map((m) => [m.key, 0]));
  for (const date of finishedAt) {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return months.map((m) => ({ month: m.month, count: counts.get(m.key) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Annual Reading Summary (v2.7.0) — pure aggregation over existing data.
//
// Definition of "book read" (v2.7.0, user-defined): one BookReadEvent = one
// read session. A session is created by a book completion (FINISHED) or by a
// partial "I read N pages" log — finishing a book is NOT required to have
// "read". Re-reading the same book adds +1 again (re-reads count).
// Year/month membership follows the local-clock convention already used by
// `finishedInYear`/`finishedInMonth` (lib/goals.ts); day boundaries for
// activity/streak data follow the UTC convention (lib/streak.ts).
// ---------------------------------------------------------------------------

export type AnnualReadEvent = {
  id: string;
  bookId: string;
  bookTitle: string | null;
  author: string | null;
  /** Book's own page count (string legacy field) — for longest/shortest book. */
  bookPages: string | null;
  tags: string | null;
  /** Pages logged by this event — null when the completion has no page data. */
  pagesRead: number | null;
  readAt: Date;
};

export type AnnualBookHighlight = {
  title: string;
  author: string | null;
  /** Valid page count — null when the book has no usable page data. */
  pages: number | null;
};

export type AnnualReadingSummary = {
  year: number;
  booksRead: number;
  /** Sum of valid page counts — null when no book has a valid page count. */
  pagesRead: number | null;
  /** Books whose valid page counts contributed to pagesRead/averagePages. */
  pagesKnown: number;
  /** Only books with valid page counts are included (missing ≠ zero). */
  averagePages: number | null;
  /** UTC days with recorded reading activity (count > 0) in the year. */
  readingDays: number;
  /** Longest unbroken activity run overlapping the year (counted whole). */
  longestStreak: number;
  /** Books completed per month, index 0 = January, always 12 entries. */
  monthlyBooks: number[];
  topAuthor: string | null;
  topAuthorCount: number | null;
  topGenre: string | null;
  topGenreCount: number | null;
  uniqueAuthors: number;
  uniqueGenres: number;
  firstBook: AnnualBookHighlight | null;
  lastBook: AnnualBookHighlight | null;
  longestBook: AnnualBookHighlight | null;
  shortestBook: AnnualBookHighlight | null;
  /**
   * Not computable: `User.xp` is a lifetime total and no XP-history table
   * exists in the schema, so a reliable per-year XP total cannot be derived.
   * Kept as null (unavailable) rather than fabricated (§10).
   */
  xpEarned: number | null;
};

/** Parse a legacy `numberOfPages` string into a valid page count (> 0 integer). */
export function parsePageCount(raw: string | null | undefined): number | null {
  const parsed = parseInt((raw ?? "").trim(), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * v3.1.0 — human display for a reading-minute total (device-reported or
 * future timer data): "< 1h" → "42m", larger → "2h 30m", zero → "—".
 */
export function formatReadingMinutes(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m === 0) return "—";
  if (m < 60) return String(m);
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`;
}

function highlightOf(title: string | null, author: string | null, pages: number | null): AnnualBookHighlight {
  return { title: title ?? "—", author, pages };
}

/**
 * Build the annual summary from already-loaded read events. All metrics derive
 * from the passed rows only — nothing is fabricated when data is missing
 * (unavailable = null, actual zero = 0).
 */
export function buildAnnualSummary(
  year: number,
  events: AnnualReadEvent[],
  activities: { date: Date; count: number }[],
  longestStreak: number,
): AnnualReadingSummary {
  const yearEvents = events.filter((e) => e.readAt.getFullYear() === year);

  // Pages — only events with logged pages contribute; missing pages never
  // count as zero (completions of books without a page count are excluded
  // from pages/average but still count in booksRead).
  let pagesRead = 0;
  let pagesKnown = 0;
  for (const event of yearEvents) {
    if (event.pagesRead !== null && event.pagesRead > 0) {
      pagesRead += event.pagesRead;
      pagesKnown += 1;
    }
  }

  // Monthly aggregation (local month, same convention as finishedInMonth).
  const monthlyBooks = new Array<number>(12).fill(0);
  for (const event of yearEvents) monthlyBooks[event.readAt.getMonth()] += 1;

  // Authors — exact (case-insensitive, trimmed) grouping; no fuzzy matching.
  // Re-reads legitimately increase an author's count.
  const authorCounts = new Map<string, { display: string; count: number }>();
  for (const event of yearEvents) {
    const author = event.author?.trim();
    if (!author) continue;
    const key = author.toLowerCase();
    const entry = authorCounts.get(key);
    if (entry) entry.count += 1;
    else authorCounts.set(key, { display: author, count: 1 });
  }
  const topAuthorEntry = [...authorCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Tags — each distinct tag counts once per event (a book with "fantasy,
  // fantasy" adds 1, not 2); re-reads of a tagged book count again.
  const genreCounts = new Map<string, { display: string; count: number }>();
  for (const event of yearEvents) {
    const seen = new Set<string>();
    for (const rawTag of (event.tags ?? "").split(",")) {
      const tag = rawTag.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = genreCounts.get(key);
      if (entry) entry.count += 1;
      else genreCounts.set(key, { display: tag, count: 1 });
    }
  }
  const topGenreEntry = [...genreCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Notable reads — chronological (sorted desc by readAt: index 0 = last,
  // last index = first) + page-count extremes over DISTINCT books (ties
  // broken by earlier read).
  const sorted = [...yearEvents].sort((a, b) => b.readAt.getTime() - a.readAt.getTime());

  const seenBooks = new Set<string>();
  const distinctBookPages: { event: AnnualReadEvent; pages: number }[] = [];
  for (const event of yearEvents) {
    if (seenBooks.has(event.bookId)) continue;
    seenBooks.add(event.bookId);
    const pages = parsePageCount(event.bookPages);
    if (pages !== null) distinctBookPages.push({ event, pages });
  }
  const byPages = distinctBookPages.sort((a, b) => {
    if (b.pages !== a.pages) return b.pages - a.pages;
    return a.event.readAt.getTime() - b.event.readAt.getTime();
  });

  const readingDays = activities.filter((a) => {
    const day = new Date(a.date.getTime() - a.date.getUTCMilliseconds());
    return day.getUTCFullYear() === year && a.count > 0;
  }).length;

  return {
    year,
    booksRead: yearEvents.length,
    pagesRead: pagesKnown > 0 ? pagesRead : null,
    pagesKnown,
    averagePages: pagesKnown > 0 ? Math.round((pagesRead / pagesKnown) * 10) / 10 : null,
    readingDays,
    longestStreak,
    monthlyBooks,
    topAuthor: topAuthorEntry?.display ?? null,
    topAuthorCount: topAuthorEntry?.count ?? null,
    topGenre: topGenreEntry?.display ?? null,
    topGenreCount: topGenreEntry?.count ?? null,
    uniqueAuthors: authorCounts.size,
    uniqueGenres: genreCounts.size,
    firstBook:
      sorted.length > 0
        ? highlightOf(
            sorted[sorted.length - 1].bookTitle,
            sorted[sorted.length - 1].author,
            parsePageCount(sorted[sorted.length - 1].bookPages),
          )
        : null,
    lastBook:
      sorted.length > 0
        ? highlightOf(sorted[0].bookTitle, sorted[0].author, parsePageCount(sorted[0].bookPages))
        : null,
    longestBook:
      byPages.length > 0 ? highlightOf(byPages[0].event.bookTitle, byPages[0].event.author, byPages[0].pages) : null,
    shortestBook:
      byPages.length > 0
        ? highlightOf(
            byPages[byPages.length - 1].event.bookTitle,
            byPages[byPages.length - 1].event.author,
            byPages[byPages.length - 1].pages,
          )
        : null,
    xpEarned: null,
  };
}
