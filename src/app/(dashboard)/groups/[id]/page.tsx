// SPDX-License-Identifier: GPL-3.0-only
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppSettings } from "@/lib/settings";
import { BooksGrid } from "@/app/(dashboard)/books/books-grid";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const dict = await getDictionary();

  // Ownership-aware: a foreign group id renders 404.
  const group = await db.bookGroup.findFirst({
    where: { id, userId },
    select: { id: true, name: true, color: true },
  });
  if (!group) notFound();

  // The group is the implicit primary filter; memberships constrain the query
  // to the caller's own books in a single indexed lookup.
  const [books, lentRecords, settings] = await Promise.all([
    db.book.findMany({
      where: { userId, groupMemberships: { some: { groupId: id } } },
      orderBy: { addedAt: "desc" },
    }),
    db.lendingRecord.findMany({
      where: { book: { userId }, returnedAt: null },
      select: { bookId: true },
    }),
    getAppSettings(),
  ]);
  const lentMap: Record<string, boolean> = {};
  books.forEach((b) => (lentMap[b.id] = lentRecords.some((r) => r.bookId === b.id)));

  return (
    <div className="space-y-6">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {dict.groups.back}
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border)]"
            style={group.color ? { backgroundColor: group.color } : undefined}
          />
          <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
            {group.name}
          </h1>
        </div>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {books.length} {dict.common.books}
        </p>
      </header>

      <BooksGrid
        books={books as never}
        lentMap={lentMap}
        dict={
          {
            ...dict.books,
            toRead: dict.books.status.TO_READ,
            reading: dict.books.status.READING,
            finished: dict.books.status.FINISHED,
            filter: dict.filter,
            empty: dict.groups.emptyShelf,
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
          nextBookCta: dict.books.nextBookCta,
          nextBookDialogTitle: dict.books.nextBookDialogTitle,
          nextBookEmpty: dict.books.nextBookEmpty,
          startBook: dict.books.startBook,
        }}
      />

      {books.length === 0 && (
        <div className="flex justify-center">
          <Link
            href="/books"
            className="rounded-[8px] bg-[var(--primary)] px-4 py-2 font-[var(--font-sans)] text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {dict.groups.addBooks}
          </Link>
        </div>
      )}
    </div>
  );
}
