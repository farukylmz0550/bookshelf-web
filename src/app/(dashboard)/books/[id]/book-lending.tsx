// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLending, returnLending } from "@/app/actions/lending";
import { updateBook } from "@/app/actions/books";

type Book = { id: string; copies: number | null; title: string };
type Lending = {
  id: string;
  borrowerName: string;
  personName?: string | null;
  lentAt: Date | string;
  returnedAt?: Date | string | null;
};
type Person = { id: string; name: string };

export function BookLending({
  book,
  lendings,
  persons,
  dict,
}: {
  book: Book;
  lendings: Lending[];
  persons: Person[];
  dict: Record<string, string>;
}) {
  const [copies, setCopies] = useState(String(book.copies ?? 1));
  const [borrower, setBorrower] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const out = lendings.filter((l) => !l.returnedAt).length;

  const today = new Date();
  const minDue = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  function saveCopies() {
    const n = Math.max(1, Math.min(999, parseInt(copies || "1", 10)));
    startTransition(async () => {
      await updateBook(book.id, { copies: n });
      router.refresh();
    });
  }

  function onLend(e: React.FormEvent) {
    e.preventDefault();
    if (!borrower.trim()) return;
    const due = dueDate || null;
    if (due && isNaN(new Date(due).getTime())) return; // client-side UX guard; server is authoritative
    startTransition(async () => {
      try {
        await createLending(book.id, borrower.trim(), due);
        setBorrower("");
        setDueDate("");
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onReturn(id: string) {
    startTransition(async () => {
      await returnLending(id);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-medium">{dict.lending}</h2>

      <div className="flex items-center gap-2 text-sm">
        <label className="text-muted-foreground">{dict.copies}</label>
        <input
          type="number"
          min={1}
          max={999}
          value={copies}
          onChange={(e) => setCopies(e.target.value)}
          className="w-20 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          onClick={saveCopies}
          disabled={pending}
          className="rounded-[8px] border border-[var(--border)] px-3 py-1 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {dict.save}
        </button>
        <span className="text-xs text-muted-foreground">
          {out} {dict.out} / {book.copies ?? 1} {dict.total} ·{" "}
          {out === 0 ? dict.allHere : out >= (book.copies ?? 1) ? dict.allOut : dict.someHere}
        </span>
      </div>

      <form onSubmit={onLend} className="flex flex-wrap gap-2">
        <input
          list="persons"
          value={borrower}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder={dict.borrowerPlaceholder}
          className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <input
          type="date"
          value={dueDate}
          min={minDue}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label={dict.dueDate}
          className="w-[140px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <datalist id="persons">
          {persons.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={pending || !borrower.trim()}
          className="rounded-[8px] bg-[var(--primary)] px-4 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {dict.lend}
        </button>
      </form>

      <ul className="space-y-1 text-sm">
        {lendings.length === 0 ? (
          <li className="text-muted-foreground">{dict.noHistory}</li>
        ) : (
          lendings.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between rounded-[8px] border border-[var(--border)] px-3 py-2"
            >
              <span>
                {l.personName ?? l.borrowerName} — {new Date(l.lentAt).toLocaleDateString()}{" "}
                {l.returnedAt
                  ? `(${dict.returned} ${new Date(l.returnedAt).toLocaleDateString()})`
                  : `(${dict.outLabel})`}
              </span>
              {!l.returnedAt && (
                <button
                  onClick={() => onReturn(l.id)}
                  disabled={pending}
                  className="rounded-[8px] border border-[var(--border)] px-2 py-1 text-xs text-foreground transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
                >
                  {dict.takeBack}
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
