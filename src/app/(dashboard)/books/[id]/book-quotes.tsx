// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.4.0 — book quotes section: list, add, edit in place, confirm-guarded
// delete. All mutations go through ownership-scoped server actions; toasts
// surface outcomes (same sonner pattern as the rest of the detail page).
import { useState, useTransition } from "react";
import { addQuote, updateQuote, deleteQuote } from "@/app/actions/quotes";
import { validateQuoteText } from "@/lib/quotes";
import { hapticFeedback } from "@/lib/haptic";

type QuotesDict = {
  title: string;
  add: string;
  save: string;
  edit: string;
  cancel: string;
  delete: string;
  deleteConfirm: string;
  textPlaceholder: string;
  pagePlaceholder: string;
  page: string; // "{n}" template
  empty: string;
  added: string;
  updated: string;
  deleted: string;
  errorGeneric: string;
  invalidPage: string;
};

function pageLabel(template: string, page: number): string {
  return template.replace("{n}", String(page));
}

export function BookQuotes({
  bookId,
  quotes,
  dict,
}: {
  bookId: string;
  quotes: { id: string; text: string; page: number | null; createdAt: string }[];
  dict: Record<string, string>;
}) {
  const d = dict as unknown as QuotesDict;
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newPage, setNewPage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPage, setEditPage] = useState("");
  const [pending, startTransition] = useTransition();

  function fail(message: string) {
    import("sonner").then(({ toast }) => toast.error(message));
  }

  function done(message: string) {
    import("sonner").then(({ toast }) => toast.success(message));
    setAdding(false);
    setNewText("");
    setNewPage("");
    setEditingId(null);
  }

  function submitNew() {
    const error = validateQuoteText(newText);
    if (error) {
      fail(d.errorGeneric);
      return;
    }
    const parsedPage = newPage.trim() === "" ? null : parseInt(newPage, 10);
    if (parsedPage !== null && (isNaN(parsedPage) || parsedPage < 1)) {
      fail(d.invalidPage);
      return;
    }
    startTransition(async () => {
      const res = await addQuote({ bookId, text: newText, page: parsedPage });
      if (res.ok) {
        hapticFeedback("light");
        done(d.added);
      } else if (res.error === "InvalidPage") {
        fail(d.invalidPage);
      } else {
        fail(d.errorGeneric);
      }
    });
  }

  function submitEdit(id: string) {
    const error = validateQuoteText(editText);
    if (error) {
      fail(d.errorGeneric);
      return;
    }
    const parsedPage = editPage.trim() === "" ? null : parseInt(editPage, 10);
    if (parsedPage !== null && (isNaN(parsedPage) || parsedPage < 1)) {
      fail(d.invalidPage);
      return;
    }
    startTransition(async () => {
      const res = await updateQuote(id, { text: editText, page: parsedPage });
      if (res.ok) done(d.updated);
      else if (res.error === "InvalidPage") fail(d.invalidPage);
      else fail(d.errorGeneric);
    });
  }

  function remove(id: string) {
    if (!confirm(d.deleteConfirm)) return;
    startTransition(async () => {
      const res = await deleteQuote(id, bookId);
      if (res.ok) done(d.deleted);
      else fail(d.errorGeneric);
    });
  }

  return (
    <section className="space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{d.title}</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-[8px] border border-[var(--border)] px-3 py-1 text-xs text-foreground transition-colors hover:bg-[var(--accent-soft)]"
          >
            {d.add}
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder={d.textPlaceholder}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={newPage}
              onChange={(e) => setNewPage(e.target.value)}
              placeholder={d.pagePlaceholder}
              className="w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <div className="ml-auto flex gap-2">
              <button
                onClick={submitNew}
                disabled={pending}
                className="rounded-[8px] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {d.add}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                  setNewPage("");
                }}
                disabled={pending}
                className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
              >
                {d.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {quotes.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">{d.empty}</p>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) =>
            editingId === q.id ? (
              <li
                key={q.id}
                className="space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
              >
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={editPage}
                    onChange={(e) => setEditPage(e.target.value)}
                    placeholder={d.pagePlaceholder}
                    className="w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => submitEdit(q.id)}
                      disabled={pending}
                      className="rounded-[8px] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {d.save}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={pending}
                      className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
                    >
                      {d.cancel}
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={q.id} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <p className="whitespace-pre-wrap font-[var(--font-serif)] text-sm text-foreground">{q.text}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {q.page !== null && <span>{pageLabel(d.page, q.page)}</span>}
                  <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setEditText(q.text);
                        setEditPage(q.page === null ? "" : String(q.page));
                      }}
                      className="transition-colors hover:text-foreground"
                    >
                      {d.edit}
                    </button>
                    <button onClick={() => remove(q.id)} className="transition-colors hover:text-foreground">
                      {d.delete}
                    </button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
