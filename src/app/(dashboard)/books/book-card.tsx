// SPDX-License-Identifier: GPL-3.0-only
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { BookPlus, RotateCcw } from "lucide-react";
import { setBookStatus, logPagesRead, startReRead, updateBook } from "@/app/actions/books";
import { useSwipe, useLongPress } from "@/lib/touch-gestures";
import { hapticFeedback } from "@/lib/haptic";
import { GROUP_DOTS_MAX } from "@/lib/groups";
import { getNextStatus, getPrevStatus, statusLabel, STATUS_ORDER, type StatusLabels } from "@/lib/books/status-cycle";

type Book = {
  id: string;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  signed?: boolean | null;
  status?: string | null;
  currentPage?: number | null;
  numberOfPages?: string | null;
  groupIds?: string[];
};

export type GroupInfo = { id: string; name: string; color: string | null };

type CardDict = {
  toRead: string;
  reading: string;
  finished: string;
  logPagesButton: string;
  logPagesToast: string;
  logPagesError: string;
  pagesLeft: string;
  reReadButton: string;
  bookFinishedToast: string;
  earlyFinishBlocked: string;
  pagesPromptTitle: string;
  pagesPromptPlaceholder: string;
  pagesPromptInvalid: string;
  save: string;
  cancel: string;
};

export function BookCard({
  book,
  lentOut,
  statusLabels,
  pagesPerReadEvent,
  dict,
  groups,
  onFinished,
}: {
  book: Book;
  lentOut: boolean;
  statusLabels?: StatusLabels;
  pagesPerReadEvent: number;
  dict: CardDict;
  groups?: GroupInfo[];
  onFinished?: (title: string) => void;
}) {
  const rating = book.rating ?? 0;
  const status = book.status ?? "TO_READ";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressedRef = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [pagesPromptOpen, setPagesPromptOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [pagePromptError, setPagePromptError] = useState(false);

  const totalPages = book.numberOfPages ? parseInt(book.numberOfPages, 10) : null;
  const knownPages = totalPages !== null && !isNaN(totalPages) && totalPages > 0;
  const pagesLeft = knownPages ? Math.max(0, totalPages - (book.currentPage ?? 0)) : null;
  // v2.9.6 — the button logs exactly what its label says: the configured step,
  // or whatever remains when fewer than a full step is left.
  const pagesToLog =
    knownPages && pagesLeft !== null ? Math.max(1, Math.min(pagesPerReadEvent, pagesLeft)) : pagesPerReadEvent;

  // v2.8.0 — group dots: capped, tooltip-backed, never the sole identifier.
  const memberGroups = useMemo(() => {
    if (!groups || !book.groupIds?.length) return [];
    return book.groupIds.map((id) => groups.find((g) => g.id === id)).filter((g): g is GroupInfo => !!g);
  }, [groups, book.groupIds]);

  function changeStatus(next: string) {
    hapticFeedback("medium");
    startTransition(async () => {
      const res = await setBookStatus(book.id, next as "TO_READ" | "READING" | "FINISHED");
      if (!res.ok) {
        toast.error(res.error === "RemainingPages" ? dict.earlyFinishBlocked : dict.logPagesError);
        return;
      }
      if (next === "FINISHED") toast.success(dict.bookFinishedToast);
      router.refresh();
      if (next === "FINISHED" && onFinished) onFinished(book.title);
    });
  }

  function logPages() {
    hapticFeedback("light");
    // v2.9.6 — books without a page count ask for it first; the count is
    // saved and the reading is logged for that book in the same step.
    if (!knownPages) {
      setPageInput("");
      setPagesPromptOpen(true);
      return;
    }
    startTransition(async () => {
      const res = await logPagesRead(book.id, pagesToLog);
      if (!res.ok) {
        toast.error(dict.logPagesError);
        return;
      }
      toast.success(
        res.finished
          ? dict.bookFinishedToast
          : dict.logPagesToast
              .replace("{count}", String(res.logged ?? pagesToLog))
              .replace("{streak}", String(res.streak ?? 0)),
      );
      router.refresh();
      if (res.finished && onFinished) onFinished(book.title);
    });
  }

  function confirmPageCount() {
    const total = parseInt(pageInput, 10);
    if (isNaN(total) || total < 1) {
      setPagePromptError(true);
      return;
    }
    setPagePromptError(false);
    setPagesPromptOpen(false);
    hapticFeedback("light");
    startTransition(async () => {
      await updateBook(book.id, { numberOfPages: String(total) });
      const remaining = total - (book.currentPage ?? 0);
      if (remaining > 0) {
        const res = await logPagesRead(book.id, Math.max(1, Math.min(pagesPerReadEvent, remaining)));
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
        if (res.finished && onFinished) onFinished(book.title);
      }
      router.refresh();
    });
  }

  function reRead() {
    hapticFeedback("medium");
    startTransition(async () => {
      const res = await startReRead(book.id);
      if (!res.ok) {
        toast.error(dict.logPagesError);
        return;
      }
      toast.success(dict.reReadButton);
      router.refresh();
    });
  }

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => changeStatus(getNextStatus(status)),
    onSwipeRight: () => changeStatus(getPrevStatus(status)),
    threshold: 60,
  });

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      longPressedRef.current = true;
      setPressing(false);
      setMenuOpen(true);
    },
    onPressStart: () => setPressing(true),
    onPressEnd: () => setPressing(false),
    delay: 450,
  });

  return (
    <>
      <Link
        href={`/books/${book.id}`}
        className={`group flex h-[380px] flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] transition-[colors,transform] duration-150 hover:border-[var(--border-strong)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
          pressing ? "scale-[0.97] opacity-90" : ""
        }`}
        {...swipeHandlers}
        {...longPressHandlers}
        onClick={(e) => {
          // Swallow the tap that triggered the long-press
          if (longPressedRef.current) {
            e.preventDefault();
            longPressedRef.current = false;
          }
        }}
      >
        {/* Fixed cover area — 60% — cover fits fully */}
        <div className="relative h-[60%] shrink-0 overflow-hidden bg-[var(--surface-elevated)] p-2">
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--surface-elevated)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="h-14 w-14 opacity-15" />
            </div>
          )}
          {lentOut && (
            <div className="absolute right-2 top-2 rounded-[4px] bg-[var(--accent)] px-2 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-white shadow-sm">
              On Loan
            </div>
          )}
          {book.signed && (
            <div className="absolute left-2 top-2 rounded-[4px] bg-[var(--warning-soft)] px-1.5 py-0.5 font-[var(--font-sans)] text-[9px] font-medium text-[var(--warning-text)]">
              Signed
            </div>
          )}
        </div>

        {/* Fixed metadata area — 40% — okunabilir, 152px */}
        <div className="flex h-[40%] flex-col justify-center gap-1 px-3 py-3">
          <h3 className="font-[var(--font-serif)] text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
            {book.title}
          </h3>
          {book.author ? (
            <p className="font-[var(--font-sans)] text-sm leading-tight text-foreground/80 line-clamp-1">
              {book.author}
            </p>
          ) : (
            <p className="font-[var(--font-sans)] text-sm leading-tight text-foreground/80 opacity-0 select-none line-clamp-1">
              —
            </p>
          )}
          {memberGroups.length > 0 && (
            <span
              className="flex items-center gap-1"
              title={memberGroups.map((g) => g.name).join(", ")}
              aria-label={memberGroups.map((g) => g.name).join(", ")}
            >
              {memberGroups.slice(0, GROUP_DOTS_MAX).map((g) => (
                <span
                  key={g.id}
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full border border-[var(--border)]"
                  style={g.color ? { backgroundColor: g.color } : undefined}
                />
              ))}
              {memberGroups.length > GROUP_DOTS_MAX && (
                <span className="font-[var(--font-sans)] text-[10px] text-muted-foreground">
                  +{memberGroups.length - GROUP_DOTS_MAX}
                </span>
              )}
            </span>
          )}
          <div className="flex items-center gap-1.5 pt-0.5">
            {rating > 0 ? (
              <span
                className="font-[var(--font-sans)] text-xs tracking-tight text-[var(--warning)]"
                aria-label={`Rating ${rating} of 5`}
              >
                {"★".repeat(rating)}
                <span className="text-muted-foreground/30">{"☆".repeat(5 - rating)}</span>
              </span>
            ) : (
              <span className="text-xs text-transparent select-none">★</span>
            )}
            {book.status && (
              <span className="ml-auto rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 font-[var(--font-sans)] text-[11px] font-medium text-foreground">
                {pending ? "…" : statusLabel(book.status, statusLabels)}
              </span>
            )}
          </div>
          {/* v2.7.0 — remaining pages for books being read + streak-only actions */}
          {status === "READING" && knownPages && (
            <p className="font-[var(--font-sans)] text-[11px] tabular-nums text-muted-foreground">
              {dict.pagesLeft.replace("{count}", String(pagesLeft))}
            </p>
          )}
          {status === "READING" && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                logPages();
              }}
              className="inline-flex w-full items-center justify-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <BookPlus size={12} />
              {dict.logPagesButton.replace("{count}", String(pagesToLog))}
            </button>
          )}
          {status === "FINISHED" && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                reRead();
              }}
              className="inline-flex w-full items-center justify-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <RotateCcw size={12} />
              {dict.reReadButton}
            </button>
          )}
        </div>
      </Link>

      {/* Long-press status menu — rendered outside the Link so taps don't navigate */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(false);
          }}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-card p-4 shadow-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={book.title}
          >
            <h3 className="mb-3 font-[var(--font-serif)] text-sm font-semibold text-foreground line-clamp-1">
              {book.title}
            </h3>
            <div className="flex flex-col gap-1">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s !== status) changeStatus(s);
                    setMenuOpen(false);
                  }}
                  className={`rounded-[8px] px-3 py-2 text-left font-[var(--font-sans)] text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    s === status ? "bg-[var(--surface-elevated)] font-medium" : ""
                  }`}
                >
                  {statusLabel(s, statusLabels)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* v2.9.6 — page-count prompt for page-less books: save the count and log
          the reading for this book in one step */}
      {pagesPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.preventDefault();
            setPagesPromptOpen(false);
          }}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-card p-4 shadow-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={dict.pagesPromptTitle}
          >
            <h3 className="mb-1 font-[var(--font-serif)] text-sm font-semibold text-foreground">
              {dict.pagesPromptTitle}
            </h3>
            <p className="mb-3 truncate font-[var(--font-sans)] text-xs text-muted-foreground">{book.title}</p>
            <input
              type="number"
              min={1}
              autoFocus
              value={pageInput}
              onChange={(e) => {
                setPageInput(e.target.value);
                setPagePromptError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPageCount();
              }}
              placeholder={dict.pagesPromptPlaceholder}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            {pagePromptError && (
              <p className="mt-1.5 font-[var(--font-sans)] text-xs text-[var(--error-text)]">
                {dict.pagesPromptInvalid}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmPageCount}
                disabled={pending}
                className="flex-1 rounded-[8px] bg-[var(--primary)] px-3 py-2 font-[var(--font-sans)] text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {dict.save}
              </button>
              <button
                type="button"
                onClick={() => setPagesPromptOpen(false)}
                className="flex-1 rounded-[8px] border border-[var(--border)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)]"
              >
                {dict.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
