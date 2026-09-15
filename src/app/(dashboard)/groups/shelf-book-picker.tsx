// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v2.10.0 — bulk shelf picker: a large (~80% viewport) centered dialog that
// lets the user select books to add to one shelf in a single pass. Data is
// fetched on open via listBooksForShelfPicker; the mutation goes through
// addBooksToGroup (ownership-scoped, duplicate-safe).

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addBooksToGroup, listBooksForShelfPicker } from "@/app/actions/groups";

export type PickerDict = {
  title: string;
  hint: string;
  onShelf: string;
  addCount: string;
  empty: string;
  search: string;
  addedManyToast: string;
  error: string;
};

type PickerBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  onShelf: boolean;
};

export function ShelfBookPicker({
  groupId,
  trigger,
  dict,
}: {
  groupId: string;
  trigger: React.ReactNode;
  dict: PickerDict;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<PickerBook[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listBooksForShelfPicker(groupId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setBooks(res.books);
      else setBooks([]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, groupId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.title.toLowerCase().includes(q) || (b.author ?? "").toLowerCase().includes(q));
  }, [books, search]);

  const selectedCount = Array.from(selected).filter((id) => !books.find((b) => b.id === id)?.onShelf).length;

  function toggle(id: string, onShelf: boolean) {
    if (onShelf) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (submitting || selectedCount === 0) return;
    setSubmitting(true);
    const res = await addBooksToGroup(groupId, Array.from(selected));
    setSubmitting(false);
    if (res.ok) {
      toast.success(dict.addedManyToast.replace("{count}", String(res.added ?? 0)));
      setOpen(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(dict.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSelected(new Set());
          setSearch("");
          setBooks([]);
        }
        setOpen(o);
      }}
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
      >
        {trigger}
      </span>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[92vw] max-w-none flex-col gap-3 sm:h-[80vh] sm:max-h-[80vh] sm:w-[80vw] sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.hint}</DialogDescription>
        </DialogHeader>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.search}
          className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <p className="py-16 text-center font-[var(--font-sans)] text-sm text-muted-foreground">{dict.empty}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((book) => {
                const isSelected = selected.has(book.id);
                const active = isSelected && !book.onShelf;
                return (
                  <button
                    key={book.id}
                    type="button"
                    disabled={book.onShelf}
                    aria-pressed={active}
                    onClick={() => toggle(book.id, book.onShelf)}
                    className={`group relative flex h-[190px] flex-col overflow-hidden rounded-[12px] border bg-[var(--surface-elevated)] text-left transition-[colors,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      book.onShelf
                        ? "cursor-default opacity-60"
                        : active
                          ? "scale-[0.97] border-[var(--accent)] ring-2 ring-[var(--ring)]"
                          : "hover:border-[var(--border-strong)]"
                    } border-[var(--border)]`}
                  >
                    <div className="relative h-[65%] w-full shrink-0 bg-[var(--surface)] p-2">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={book.coverUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/logo.svg" alt="" className="h-full w-full object-contain opacity-15" />
                      )}
                      {book.onShelf && (
                        <span className="absolute inset-x-2 bottom-1 truncate rounded-[4px] bg-[var(--surface-elevated)] border border-[var(--border)] px-1 py-0.5 text-center font-[var(--font-sans)] text-[9px] font-medium text-muted-foreground">
                          {dict.onShelf}
                        </span>
                      )}
                      {!book.onShelf && active && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-2 text-left">
                      <span className="line-clamp-2 font-[var(--font-serif)] text-[12px] font-semibold leading-tight text-foreground">
                        {book.title}
                      </span>
                      {book.author && (
                        <span className="line-clamp-1 font-[var(--font-sans)] text-[11px] leading-tight text-foreground/70">
                          {book.author}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="-mx-4 -mb-4 flex items-center justify-end rounded-b-xl border-t bg-muted/50 p-4">
          <Button onClick={submit} disabled={submitting || selectedCount === 0}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {dict.addCount.replace("{count}", String(selectedCount))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
