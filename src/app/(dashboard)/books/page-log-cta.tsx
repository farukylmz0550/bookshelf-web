// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.11.0 — page-level "Read N pages" CTA for /books: always visible near the
// top of the page while the user has a READING book, so the logging flow
// doesn't depend on spotting the small card button. Single reading book logs
// in one tap; multiple books open a picker; page-less books get the same
// page-count prompt as the card button.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus } from "lucide-react";
import { logPagesRead, updateBook } from "@/app/actions/books";
import { hapticFeedback } from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ReadingBookInfo = {
  id: string;
  title: string;
  numberOfPages: string | null;
  currentPage: number | null;
};

export type PageLogCtaDict = {
  label: string;
  logPagesToast: string;
  bookFinishedToast: string;
  logPagesError: string;
  pagesPromptTitle: string;
  pagesPromptPlaceholder: string;
  pagesPromptInvalid: string;
  save: string;
  cancel: string;
};

export function PageLogCta({
  books,
  pagesPerReadEvent,
  dict,
}: {
  books: ReadingBookInfo[];
  pagesPerReadEvent: number;
  dict: PageLogCtaDict;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [promptFor, setPromptFor] = useState<ReadingBookInfo | null>(null);
  const [pageInput, setPageInput] = useState("");
  const [promptError, setPromptError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (books.length === 0) return null;

  const totalPages = (b: ReadingBookInfo): number | null => {
    const parsed = b.numberOfPages ? parseInt(b.numberOfPages, 10) : NaN;
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  };

  const pagesToLog = (b: ReadingBookInfo): number => {
    const total = totalPages(b);
    if (total === null) return pagesPerReadEvent;
    return Math.max(1, Math.min(pagesPerReadEvent, Math.max(0, total - (b.currentPage ?? 0))));
  };

  function logFor(book: ReadingBookInfo) {
    hapticFeedback("light");
    if (totalPages(book) === null) {
      setPageInput("");
      setPromptError(false);
      setPickerOpen(false);
      setPromptFor(book);
      return;
    }
    startTransition(async () => {
      const res = await logPagesRead(book.id, pagesToLog(book));
      if (!res.ok) {
        toast.error(dict.logPagesError);
        return;
      }
      toast.success(
        res.finished
          ? dict.bookFinishedToast
          : dict.logPagesToast
              .replace("{count}", String(res.logged ?? pagesToLog(book)))
              .replace("{streak}", String(res.streak ?? 0)),
      );
      router.refresh();
    });
  }

  function confirmPageCount() {
    const total = parseInt(pageInput, 10);
    if (isNaN(total) || total < 1 || !promptFor) {
      setPromptError(true);
      return;
    }
    setPromptError(false);
    setPromptFor(null);
    hapticFeedback("light");
    startTransition(async () => {
      await updateBook(promptFor.id, { numberOfPages: String(total) });
      const remaining = total - (promptFor.currentPage ?? 0);
      if (remaining > 0) {
        const res = await logPagesRead(promptFor.id, Math.max(1, Math.min(pagesPerReadEvent, remaining)));
        if (!res.ok) {
          toast.error(dict.logPagesError);
          return;
        }
        toast.success(
          res.finished
            ? dict.bookFinishedToast
            : dict.logPagesToast
                .replace("{count}", String(res.logged ?? pagesPerReadEvent))
                .replace("{streak}", String(res.streak ?? 0)),
        );
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => (books.length === 1 ? logFor(books[0]) : setPickerOpen(true))}
        disabled={pending}
      >
        <BookPlus size={14} />
        {dict.label.replace("{count}", String(pagesPerReadEvent))}
      </Button>

      {books.length > 1 && (
        <Dialog
          open={pickerOpen}
          onOpenChange={(open) => {
            if (!open) setPickerOpen(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.label.replace("{count}", String(pagesPerReadEvent))}</DialogTitle>
            </DialogHeader>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {books.map((book) => {
                const total = totalPages(book);
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => logFor(book)}
                    className="flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
                    disabled={pending}
                  >
                    <span className="min-w-0 flex-1 truncate font-[var(--font-sans)] text-sm text-foreground">
                      {book.title}
                    </span>
                    <span className="shrink-0 font-[var(--font-sans)] text-xs tabular-nums text-muted-foreground">
                      {book.currentPage ?? 0}
                      {total !== null ? ` / ${total}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {promptFor && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPromptFor(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.pagesPromptTitle}</DialogTitle>
            </DialogHeader>
            <p className="truncate font-[var(--font-serif)] text-sm font-semibold text-foreground">{promptFor.title}</p>
            <input
              type="number"
              min={1}
              autoFocus
              value={pageInput}
              onChange={(e) => {
                setPageInput(e.target.value);
                setPromptError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPageCount();
              }}
              placeholder={dict.pagesPromptPlaceholder}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            {promptError && (
              <p className="font-[var(--font-sans)] text-xs text-[var(--error-text)]">{dict.pagesPromptInvalid}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={confirmPageCount} disabled={pending}>
                {dict.save}
              </Button>
              <Button variant="outline" onClick={() => setPromptFor(null)}>
                {dict.cancel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
