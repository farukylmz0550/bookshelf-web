// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { BookCard, type GroupInfo } from "./book-card";
import { FilterBar } from "./filter-bar";
import { Filters, defaultFilters, arrange } from "@/lib/books/filters";
import { getInitialView, setViewCookie, type ViewMode } from "@/lib/books/view-mode";
import { statusLabel, type StatusLabels } from "@/lib/books/status-cycle";
import { setBookStatus } from "@/app/actions/books";

type Book = {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  publishers?: string | null;
  tags?: string | null;
  rating?: number | null;
  signed?: boolean | null;
  status?: string | null;
  publishDate?: string | null;
  coverUrl?: string | null;
  currentPage?: number | null;
  numberOfPages?: string | null;
  groupIds?: string[];
};

type CardDict = {
  logPagesButton: string;
  logPagesToast: string;
  logPagesError: string;
  pagesLeft: string;
  reReadButton: string;
  bookFinishedToast: string;
  earlyFinishBlocked: string;
  nextBookCta: string;
  nextBookDialogTitle: string;
  nextBookEmpty: string;
  startBook: string;
};

export function BooksGrid({
  books,
  lentMap,
  dict,
  cardDict,
  pagesPerReadEvent,
  groups,
}: {
  books: Book[];
  lentMap: Record<string, boolean>;
  dict: { empty: string; noResults?: string; filter?: { status?: string } } & Record<string, string>;
  cardDict: CardDict;
  pagesPerReadEvent: number;
  groups?: GroupInfo[];
}) {
  const router = useRouter();
  // v2.7.0 — "start a new book" flow after finishing one
  const [nextBookOpen, setNextBookOpen] = useState(false);
  const toReadBooks = useMemo(() => books.filter((b) => (b.status ?? "TO_READ") === "TO_READ"), [books]);
  const statusLabels: StatusLabels = {
    toRead: dict.toRead ?? "To read",
    reading: dict.reading ?? "Reading",
    finished: dict.finished ?? "Finished",
  };
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [view, setView] = useState<ViewMode>("card");
  const tagsInUse = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.tags) b.tags.split(",").forEach((t) => set.add(t.trim()));
    });
    return Array.from(set).filter(Boolean).sort();
  }, [books]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(getInitialView());
  }, []);

  function handleViewChange(mode: ViewMode) {
    setView(mode);
    setViewCookie(mode);
  }

  const filtered = useMemo(() => {
    const map = new Map(Object.entries(lentMap));
    return arrange(books as never, filters, map as never) as unknown as Book[];
  }, [books, filters, lentMap]);

  const total = books.length;
  const shown = filtered.length;

  return (
    <div className="space-y-4">
      <FilterBar
        onChange={setFilters}
        tagsInUse={tagsInUse}
        dict={(dict as Record<string, unknown>).filter as Record<string, string>}
        groups={groups}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="font-[var(--font-sans)] text-xs text-muted-foreground">
          {shown === total ? `${total} ${dict.booksCount ?? "books"}` : `${shown} ${dict.ofTotal ?? "of"} ${total}`}
        </p>
        <div className="flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
          <button
            type="button"
            onClick={() => handleViewChange("card")}
            aria-label="Card view"
            aria-pressed={view === "card"}
            className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              view === "card"
                ? "bg-[var(--accent)] text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              view === "list"
                ? "bg-[var(--accent)] text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="mb-4 h-16 w-16 opacity-20" />
          <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
            {total === 0 ? dict.empty : (dict.noResults ?? "No results — try clearing filters")}
          </p>
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book as Book}
              lentOut={!!lentMap[book.id]}
              statusLabels={statusLabels}
              pagesPerReadEvent={pagesPerReadEvent}
              groups={groups}
              dict={{
                toRead: statusLabels.toRead,
                reading: statusLabels.reading,
                finished: statusLabels.finished,
                ...cardDict,
              }}
              onFinished={() => setNextBookOpen(true)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="hidden grid-cols-[3rem_1fr_12rem_6rem_5rem] gap-3 border-b border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 sm:grid">
            <span className="font-[var(--font-sans)] text-[10px] uppercase tracking-widest text-muted-foreground">
              {dict.cover ?? "Cover"}
            </span>
            <span className="font-[var(--font-sans)] text-[10px] uppercase tracking-widest text-muted-foreground">
              {dict.title}
            </span>
            <span className="font-[var(--font-sans)] text-[10px] uppercase tracking-widest text-muted-foreground">
              {dict.author}
            </span>
            <span className="font-[var(--font-sans)] text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              {dict.filter?.status ?? "Status"}
            </span>
            <span className="font-[var(--font-sans)] text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              {dict.rating ?? "Rating"}
            </span>
          </div>
          {filtered.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="grid grid-cols-[3rem_1fr] sm:grid-cols-[3rem_1fr_12rem_6rem_5rem] gap-3 items-center border-b border-[var(--border)] last:border-b-0 bg-[var(--surface)] px-3 py-2.5 hover:bg-[var(--surface-elevated)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <div className="h-10 w-8 overflow-hidden rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] shrink-0">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.svg" alt="" className="h-4 w-4 opacity-20" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-[var(--font-serif)] text-sm font-medium leading-tight text-foreground truncate">
                  {book.title}
                </p>
                <p className="font-[var(--font-sans)] text-xs text-muted-foreground sm:hidden truncate">
                  {book.author ?? "—"}
                </p>
                {lentMap[book.id] && (
                  <span className="mt-1 inline-block rounded-[4px] bg-[var(--accent)] px-1.5 py-0.5 font-[var(--font-sans)] text-[10px] text-white sm:hidden">
                    On Loan
                  </span>
                )}
              </div>
              <p className="hidden font-[var(--font-sans)] text-sm text-muted-foreground truncate sm:block">
                {book.author ?? "—"}
              </p>
              <span className="hidden justify-center sm:flex">
                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-[var(--font-sans)] text-xs text-muted-foreground">
                  {statusLabel(book.status ?? "TO_READ", statusLabels)}
                </span>
              </span>
              <span className="hidden justify-center sm:flex font-[var(--font-sans)] text-xs text-[var(--warning)]">
                {book.rating ? "★".repeat(book.rating) : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* v2.7.0 — after finishing a book: pick a to-read book to start next */}
      {nextBookOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setNextBookOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={cardDict.nextBookDialogTitle}
          >
            <h3 className="mb-3 font-[var(--font-serif)] text-sm font-semibold text-foreground">
              {cardDict.nextBookDialogTitle}
            </h3>
            {toReadBooks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{cardDict.nextBookEmpty}</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {toReadBooks.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        await setBookStatus(book.id, "READING");
                        setNextBookOpen(false);
                        router.refresh();
                      }}
                      className="flex w-full items-baseline justify-between gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-[var(--font-serif)] text-sm text-foreground">
                          {book.title}
                        </span>
                        <span className="block truncate font-[var(--font-sans)] text-xs text-muted-foreground">
                          {book.author ?? "—"}
                        </span>
                      </span>
                      <span className="shrink-0 font-[var(--font-sans)] text-xs font-medium text-[var(--accent)]">
                        {cardDict.startBook}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
