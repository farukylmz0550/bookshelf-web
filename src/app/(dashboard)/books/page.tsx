// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppSettings } from "@/lib/settings";
import { BooksAddSection } from "./books-add-section";
import { BooksGrid } from "./books-grid";
import { ExcelActions } from "./excel-actions";
import { PageLogCta } from "./page-log-cta";

export default async function BooksPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();
  const [books, settings, groups, memberships] = await Promise.all([
    db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } }),
    getAppSettings(),
    db.bookGroup.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, color: true },
    }),
    // One indexed query for all memberships — no N+1 per book.
    db.bookGroupMembership.findMany({
      where: { group: { userId } },
      select: { bookId: true, groupId: true },
    }),
  ]);
  const groupsByBook = new Map<string, string[]>();
  memberships.forEach((m) => {
    const list = groupsByBook.get(m.bookId) ?? [];
    list.push(m.groupId);
    groupsByBook.set(m.bookId, list);
  });
  const booksWithGroups = books.map((b) => ({ ...b, groupIds: groupsByBook.get(b.id) ?? [] }));

  const lentRecords = await db.lendingRecord.findMany({
    where: { book: { userId }, returnedAt: null },
    select: { bookId: true },
  });
  const lentSet = new Set(lentRecords.map((r) => r.bookId));
  const lentMap: Record<string, boolean> = {};
  books.forEach((b) => (lentMap[b.id] = lentSet.has(b.id)));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
            {dict.books.title}
          </h1>
          <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
            {books.length} {dict.common.books} · {dict.books.addBook}
          </p>
        </div>
        {/* v2.11.0 — page-log CTA visible on first open so the reading flow
            doesn't depend on finding the small card button */}
        <PageLogCta
          books={books
            .filter((b) => b.status === "READING")
            .map((b) => ({ id: b.id, title: b.title, numberOfPages: b.numberOfPages, currentPage: b.currentPage }))}
          pagesPerReadEvent={settings.pagesPerReadEvent}
          dict={{
            label: dict.books.logPagesButton,
            logPagesToast: dict.books.logPagesToast,
            bookFinishedToast: dict.books.bookFinishedToast,
            logPagesError: dict.books.logPagesError,
            pagesPromptTitle: dict.books.pagesPromptTitle,
            pagesPromptPlaceholder: dict.books.pagesPromptPlaceholder,
            pagesPromptInvalid: dict.books.pagesPromptInvalid,
            save: dict.facts.save,
            cancel: dict.facts.cancel,
          }}
        />
      </header>
      <BooksAddSection
        dict={dict.books as never}
        excel={<ExcelActions dict={dict.excel} goodreadsDict={dict.goodreads as never} />}
      />
      <BooksGrid
        books={booksWithGroups as never}
        lentMap={lentMap}
        dict={
          {
            ...dict.books,
            toRead: dict.books.status.TO_READ,
            reading: dict.books.status.READING,
            finished: dict.books.status.FINISHED,
            filter: dict.filter,
          } as never
        }
        pagesPerReadEvent={settings.pagesPerReadEvent}
        groups={groups}
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
