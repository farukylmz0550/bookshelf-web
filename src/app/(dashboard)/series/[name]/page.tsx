// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — Series detail: the caller's books of one series in the standard
// grid. Ownership-scoped; unknown series render 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppConfig } from "@/lib/app-config";
import { BooksGrid } from "@/app/(dashboard)/books/books-grid";

export default async function SeriesDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const userId = await requireUserId();
  const dict = await getDictionary();
  const settings = await getAppConfig();

  const books = await db.book.findMany({
    where: { userId, series: { not: null } },
    orderBy: { addedAt: "desc" },
  });
  const seriesBooks = books.filter((b) => (b.series ?? "").trim() === name);
  if (seriesBooks.length === 0) notFound();

  const finished = seriesBooks.filter((b) => b.status === "FINISHED").length;

  return (
    <div className="space-y-6">
      <Link
        href="/series"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {dict.series.back}
      </Link>
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{name}</h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {finished}/{seriesBooks.length} {dict.series.finishedOf}
        </p>
      </header>

      <BooksGrid
        books={seriesBooks as never}
        lentMap={{}}
        dict={
          {
            ...dict.books,
            toRead: dict.books.status.TO_READ,
            reading: dict.books.status.READING,
            finished: dict.books.status.FINISHED,
            filter: dict.filter,
            empty: dict.series.emptyShelf,
          } as never
        }
        pagesPerReadEvent={settings.pagesPerReadEvent}
        cardDict={{
          logPagesButton: dict.books.logPagesButton,
          logPagesToast: dict.books.logPagesToast,
          logPagesError: dict.books.logPagesError,
          pagesLeft: dict.books.pagesLeft,
          reReadButton: dict.books.reReadButton,
          bookFinishedToast: dict.books.bookFinishedToast,
          earlyFinishBlocked: dict.books.earlyFinishBlocked,
          pagesPromptTitle: dict.books.pagesPromptTitle,
          pagesPromptPlaceholder: dict.books.pagesPromptPlaceholder,
          pagesPromptInvalid: dict.books.pagesPromptInvalid,
          save: dict.facts.save,
          cancel: dict.facts.cancel,
          nextBookCta: dict.books.nextBookCta,
          nextBookDialogTitle: dict.books.nextBookDialogTitle,
          nextBookEmpty: dict.books.nextBookEmpty,
          startBook: dict.books.startBook,
        }}
      />
    </div>
  );
}
