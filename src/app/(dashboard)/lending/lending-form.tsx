// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { createLending } from "@/app/actions/lending";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Book = { id: string; title: string };

export function LendingForm({
  books,
  dict,
}: {
  books: Book[];
  dict: {
    book: string;
    borrower: string;
    lendCta: string;
    namePlaceholder: string;
    dueDate: string;
    dueDateOptional: string;
  };
}) {
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [borrowerName, setBorrowerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const minDue = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  function handleSubmit() {
    if (!bookId || !borrowerName) return;
    const due = dueDate || null;
    if (due) {
      const normalized = new Date(due);
      if (isNaN(normalized.getTime())) return; // client-side UX guard; server is authoritative
    }
    startTransition(async () => {
      await createLending(bookId, borrowerName, due);
      setBorrowerName("");
      setDueDate("");
    });
  }

  const inputCls =
    "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.book}
        </label>
        <Select value={bookId} onValueChange={(v) => setBookId(v ?? "")}>
          <SelectTrigger
            className="w-full rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] text-foreground focus-visible:ring-[var(--ring)]"
            aria-label={dict.book}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {books.map((book) => (
              <SelectItem key={book.id} value={book.id}>
                {book.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[160px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.borrower}
        </label>
        <input
          value={borrowerName}
          onChange={(e) => setBorrowerName(e.target.value)}
          placeholder={dict.namePlaceholder}
          className={inputCls}
        />
      </div>
      <div className="min-w-[150px]">
        <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {dict.dueDate} <span className="normal-case tracking-normal opacity-60">({dict.dueDateOptional})</span>
        </label>
        <input
          type="date"
          value={dueDate}
          min={minDue}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputCls}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={pending || !bookId || !borrowerName}
        className="rounded-[8px] bg-[var(--accent)] px-5 py-2 font-[var(--font-sans)] text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {dict.lendCta}
      </button>
    </div>
  );
}
