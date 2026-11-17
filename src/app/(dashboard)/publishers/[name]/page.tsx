// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppConfig } from "@/lib/app-config";
import { publishersForBook } from "@/lib/collections";
import { getPagesPerReadEventFor } from "@/lib/reading-settings";
import { BooksGrid } from "@/app/(dashboard)/books/books-grid";

export default async function PublisherDetailPage({ params }: { params: Promise<{ name: string }> }) {
  if (!(await getAppConfig()).smartShelfPublishers) notFound();
  const name = decodeURIComponent((await params).name);
  const userId = await requireUserId();
  const [dict, pagesPerReadEvent, books] = await Promise.all([
    getDictionary(),
    getPagesPerReadEventFor(userId),
    db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } }),
  ]);
  const key = name.toLocaleLowerCase();
  const publisherBooks = books.filter((book) =>
    publishersForBook(book).some((publisher) => publisher.toLocaleLowerCase() === key),
  );
  if (publisherBooks.length === 0) notFound();

  return (
    <div className="space-y-6">
      <Link href="/publishers" className="text-sm text-muted-foreground hover:text-foreground">
        {dict.publishers.back}
      </Link>
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {publisherBooks.length} {dict.common.books}
        </p>
      </header>
      <BooksGrid
        books={publisherBooks as never}
        lentMap={{}}
        dict={
          {
            ...dict.books,
            toRead: dict.books.status.TO_READ,
            reading: dict.books.status.READING,
            finished: dict.books.status.FINISHED,
            filter: dict.filter,
            empty: dict.publishers.emptyShelf,
          } as never
        }
        pagesPerReadEvent={pagesPerReadEvent}
        cardDict={{
          lentOut: dict.filter.onLoan,
          signed: dict.books.signedBadge,
          logPagesButton: dict.books.logPagesButton,
          logPagesToast: dict.books.logPagesToast,
          logPagesError: dict.books.logPagesError,
          reReadButton: dict.books.reReadButton,
          bookFinishedToast: dict.books.bookFinishedToast,
          earlyFinishBlocked: dict.books.earlyFinishBlocked,
          pagesPromptTitle: dict.books.pagesPromptTitle,
          pagesPromptPlaceholder: dict.books.pagesPromptPlaceholder,
          pagesPromptInvalid: dict.books.pagesPromptInvalid,
          save: dict.facts.save,
          cancel: dict.facts.cancel,
          nextBookDialogTitle: dict.books.nextBookDialogTitle,
          nextBookEmpty: dict.books.nextBookEmpty,
          startBook: dict.books.startBook,
        }}
      />
    </div>
  );
}
