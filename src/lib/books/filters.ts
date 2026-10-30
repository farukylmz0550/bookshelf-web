// SPDX-License-Identifier: GPL-3.0-only
// Filters — legacy src/books/filters.py port.
// Single responsibility: filter & sort.

export const SIGNED_ANY = "any";
export const SIGNED_YES = "yes";
export const SIGNED_NO = "no";
export const LENT_ANY = "any";
export const LENT_HOME = "home";
export const LENT_OUT = "out";
export const SORT_TITLE = "title";
export const SORT_RATING = "rating";
export const SORT_YEAR = "year";
export const SEARCH_ALL = "all";

export type Filters = {
  search: string;
  searchField: string; // all | title | authors | isbn | publishers
  minRating: number;
  signed: string; // any | yes | no
  lent: string; // any | home | out
  status: string; // any | not_read | want_to_read | reading | read
  tag: string;
  groupId: string; // v2.8.0 — any | <groupId>
  locationId: string; // v3.18.0 — any | unassigned | <locationId>
  sort: string; // title | rating | year
  asc: boolean;
};

export const defaultFilters: Filters = {
  search: "",
  searchField: "all",
  minRating: 0,
  signed: SIGNED_ANY,
  lent: LENT_ANY,
  status: "any",
  tag: "any",
  groupId: "any",
  locationId: "any",
  sort: SORT_TITLE,
  asc: true,
};

export function isSigned(signed: boolean, filter: string): boolean {
  if (filter === SIGNED_ANY) return true;
  if (filter === SIGNED_YES) return signed;
  if (filter === SIGNED_NO) return !signed;
  return true;
}

export function haystack(
  book: {
    title: string;
    author?: string | null;
    isbn?: string | null;
    publishers?: string | null;
    tags?: string | null;
    signed?: boolean;
    status?: string;
  },
  lentOut: boolean,
): string {
  const parts = [
    book.title ?? "",
    book.author ?? "",
    book.isbn ?? "",
    book.publishers ?? "",
    book.tags ?? "",
    book.signed ? "yes" : "no",
    lentOut ? "out" : "home",
    book.status ?? "",
  ];
  return parts.join(" ").toLowerCase();
}

export function allows(
  book: {
    rating?: number | null;
    signed?: boolean;
    status?: string;
    tags?: string | null;
    title?: string;
    author?: string | null;
    isbn?: string | null;
    publishers?: string | null;
    groupIds?: string[]; // v2.8.0 — memberships for group filtering
    locationIds?: string[];
    hasUnassignedCopy?: boolean;
  },
  lentOut: boolean,
  f: Filters,
): boolean {
  if (f.minRating > 0 && (book.rating ?? 0) < f.minRating) return false;
  if (!isSigned(!!book.signed, f.signed)) return false;
  if (f.lent !== LENT_ANY) {
    if (f.lent === LENT_HOME && lentOut) return false;
    if (f.lent === LENT_OUT && !lentOut) return false;
  }
  if (f.status !== "any" && (book.status ?? "") !== f.status) return false;
  if (f.tag !== "any" && f.tag !== "" && !book.tags?.toLowerCase().includes(f.tag.toLowerCase())) return false;
  // v2.8.0 — group condition ANDs with the tag/status/search conditions above.
  if (f.groupId !== "any" && !book.groupIds?.includes(f.groupId)) return false;
  if (f.locationId !== "any") {
    if (f.locationId === "unassigned" ? !book.hasUnassignedCopy : !book.locationIds?.includes(f.locationId))
      return false;
  }
  if (f.search.trim()) {
    const q = f.search.toLowerCase();
    const hay = haystack(book as never, lentOut);
    if (f.searchField === "title" && !book.title?.toLowerCase().includes(q)) return false;
    else if (f.searchField === "authors" && !book.author?.toLowerCase().includes(q)) return false;
    else if (f.searchField === "isbn" && !book.isbn?.toLowerCase().includes(q)) return false;
    else if (f.searchField === "publishers" && !book.publishers?.toLowerCase().includes(q)) return false;
    else if (f.searchField === SEARCH_ALL && !hay.includes(q)) return false;
  }
  return true;
}

export function sortKey(
  book: { title?: string; rating?: number | null; publishDate?: string | null },
  sort: string,
): string | number {
  if (sort === SORT_RATING) return -(book.rating ?? 0);
  if (sort === SORT_YEAR) {
    const m = book.publishDate?.match(/(?<!\d)(\d{4})(?!\d)/);
    return m ? -parseInt(m[1], 10) : 0;
  }
  return (book.title ?? "").toLowerCase();
}

export function arrange<T extends { title?: string; id: string }>(
  books: T[],
  filters: Filters,
  lentMap: Map<string, boolean>,
): T[] {
  const filtered = books.filter((b) => allows(b as never, lentMap.get(b.id) ?? false, filters));
  const sorted = [...filtered].sort((a, b) => {
    const ka = sortKey(a as never, filters.sort);
    const kb = sortKey(b as never, filters.sort);
    if (ka < kb) return filters.asc ? -1 : 1;
    if (ka > kb) return filters.asc ? 1 : -1;
    // tie-break by title
    return (a.title ?? "").toLowerCase().localeCompare((b.title ?? "").toLowerCase());
  });
  return sorted;
}
