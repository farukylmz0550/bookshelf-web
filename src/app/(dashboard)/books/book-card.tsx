// SPDX-License-Identifier: GPL-3.0-only
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen, BookPlus, Check, Copy, RotateCcw, Share2, X } from "lucide-react";
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
  lentOut: string;
  signed: string;
  reading: string;
  finished: string;
  logPagesButton: string;
  logPagesToast: string;
  logPagesError: string;
  reReadButton: string;
  bookFinishedToast: string;
  earlyFinishBlocked: string;
  pagesPromptTitle: string;
  pagesPromptPlaceholder: string;
  pagesPromptInvalid: string;
  save: string;
  cancel: string;
  openBook?: string;
  shareBook?: string;
  copyLink?: string;
  linkCopied?: string;
  menuClose?: string;
};

export function BookCard({
  book,
  lentOut,
  statusLabels,
  pagesPerReadEvent,
  pageMode,
  dict,
  groups,
  onFinished,
}: {
  book: Book;
  lentOut: boolean;
  statusLabels?: StatusLabels;
  pagesPerReadEvent: number;
  pageMode: "FIXED" | "VARIABLE";
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

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

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
    if (pageMode === "VARIABLE" || !knownPages) {
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
    const entered = parseInt(pageInput, 10);
    if (isNaN(entered) || entered < 1) {
      setPagePromptError(true);
      return;
    }
    setPagePromptError(false);
    setPagesPromptOpen(false);
    hapticFeedback("light");
    startTransition(async () => {
      if (pageMode === "VARIABLE") {
        const amount = knownPages ? Math.min(entered, Math.max(1, pagesLeft ?? entered)) : entered;
        const res = await logPagesRead(book.id, amount);
        if (!res.ok) {
          toast.error(dict.logPagesError);
          return;
        }
        toast.success(
          res.finished
            ? dict.bookFinishedToast
            : dict.logPagesToast
                .replace("{count}", String(res.logged ?? amount))
                .replace("{streak}", String(res.streak ?? 0)),
        );
        router.refresh();
        return;
      }
      const total = entered;
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

  function openBook() {
    setMenuOpen(false);
    router.push(`/books/${book.id}`);
  }

  async function copyBookLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/books/${book.id}`);
      toast.success(dict.linkCopied ?? "Link copied");
    } catch {
      toast.error(dict.logPagesError);
    }
    setMenuOpen(false);
  }

  async function shareBook() {
    const url = `${window.location.origin}/books/${book.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: book.title, text: book.author ?? book.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(dict.linkCopied ?? "Link copied");
      }
    } catch {
      // The user cancelling the native share sheet is expected.
    }
    setMenuOpen(false);
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
            <div className="absolute end-2 top-2 rounded-[4px] bg-[var(--accent)] px-2 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-white shadow-sm">
              {dict.lentOut}
            </div>
          )}
          {book.signed && (
            <div className="absolute start-2 top-2 rounded-[4px] bg-[var(--warning-soft)] px-1.5 py-0.5 font-[var(--font-sans)] text-[9px] font-medium text-[var(--warning-text)]">
              {dict.signed}
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
          {/* v3.9.0 — Faz 3 (UI_Improvement_Plan.md §4): the card is calm —
              cover, title, author, subtle metadata, one status indicator.
              Actions (log pages, re-read) live in the long-press menu and the
              detail page. */}
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
              <span className="ms-auto rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 font-[var(--font-sans)] text-[11px] font-medium text-foreground">
                {pending ? "…" : statusLabel(book.status, statusLabels)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Long-press action sheet — rendered outside the Link so actions never
          navigate accidentally. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4"
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-[20px] bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-[16px] sm:pb-4 sm:zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={book.title}
          >
            <div className="mb-3 flex items-start gap-3 border-b border-[var(--border)] pb-3">
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-[4px] bg-[var(--surface-elevated)]">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BookOpen className="m-2 text-muted-foreground" size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-[var(--font-serif)] text-sm font-semibold text-foreground line-clamp-2">
                  {book.title}
                </h3>
                <p className="mt-0.5 truncate font-[var(--font-sans)] text-xs text-muted-foreground">
                  {book.author ?? statusLabel(status, statusLabels)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={dict.menuClose ?? dict.cancel}
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-[var(--border)] pb-3">
              <button
                type="button"
                onClick={openBook}
                className="flex flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <BookOpen size={18} />
                {dict.openBook ?? "Open book"}
              </button>
              <button
                type="button"
                onClick={shareBook}
                className="flex flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Share2 size={18} />
                {dict.shareBook ?? "Share"}
              </button>
              <button
                type="button"
                onClick={copyBookLink}
                className="flex flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Copy size={18} />
                {dict.copyLink ?? "Copy link"}
              </button>
            </div>
            <p className="mb-1 mt-3 px-1 font-[var(--font-sans)] text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {statusLabel(status, statusLabels)}
            </p>
            <div className="flex flex-col gap-1">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s !== status) changeStatus(s);
                    setMenuOpen(false);
                  }}
                  className={`rounded-[8px] px-3 py-2 text-start font-[var(--font-sans)] text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    s === status ? "bg-[var(--surface-elevated)] font-medium" : ""
                  }`}
                >
                  {s === status && <Check size={15} className="me-2 inline" />}
                  {statusLabel(s, statusLabels)}
                </button>
              ))}
              {(status === "READING" || status === "FINISHED") && (
                <div className="my-1 h-px bg-[var(--border)]" role="separator" />
              )}
              {status === "READING" && (
                // v3.11.0 — the menu's primary action gets the accent fill so
                // it no longer reads as a secondary list item (palette tokens
                // only; hover uses the established accent-hover state).
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMenuOpen(false);
                    logPages();
                  }}
                  className="flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 py-2.5 text-start font-[var(--font-sans)] text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <BookPlus size={16} />
                  {dict.logPagesButton}
                </button>
              )}
              {status === "FINISHED" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMenuOpen(false);
                    reRead();
                  }}
                  className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-start font-[var(--font-sans)] text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <RotateCcw size={14} />
                  {dict.reReadButton}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-2 w-full rounded-[8px] px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {dict.cancel}
            </button>
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
            className="w-full max-w-xs rounded-[12px] bg-[var(--surface)] p-4 shadow-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
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
