// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBook } from "@/app/actions/books";

type Book = {
  id: string;
  title: string;
  subtitle?: string | null;
  publishers?: string | null;
  publishDate?: string | null;
  publishPlaces?: string | null;
  editionName?: string | null;
  series?: string | null;
  numberOfPages?: string | null;
  languages?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  subjects?: string | null;
  author?: string | null;
  isbn?: string | null;
};

export function BookFacts({ book, dict }: { book: Book; dict: Record<string, string> }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({
    title: book.title ?? "",
    subtitle: book.subtitle ?? "",
    author: book.author ?? "",
    publishers: book.publishers ?? "",
    publishDate: book.publishDate ?? "",
    publishPlaces: book.publishPlaces ?? "",
    editionName: book.editionName ?? "",
    series: book.series ?? "",
    numberOfPages: book.numberOfPages ?? "",
    languages: book.languages ?? "",
    isbn10: book.isbn10 ?? "",
    isbn13: book.isbn13 ?? "",
    subjects: book.subjects ?? "",
  });

  function onSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBook(book.id, form as never);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const fields: Array<[string, string]> = [
    ["title", dict.title],
    ["subtitle", dict.subtitle],
    ["author", dict.authors],
    ["publishers", dict.publishers],
    ["publishDate", dict.publishDate],
    ["publishPlaces", dict.publishPlaces],
    ["editionName", dict.edition],
    ["series", dict.series],
    ["numberOfPages", dict.pages],
    ["languages", dict.languages],
    ["isbn10", dict.isbn10],
    ["isbn13", dict.isbn13],
    ["subjects", dict.subjects],
  ];

  if (!editing) {
    return (
      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{dict.facts}</h2>
          <button
            onClick={() => setEditing(true)}
            className="rounded-[8px] border border-[var(--border)] px-3 py-1 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {dict.edit}
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {fields.map(([key, label]) => (
            <div key={key} className="flex gap-2">
              <dt className="min-w-[110px] text-muted-foreground">{label}:</dt>
              <dd className="flex-1 truncate">{(form as Record<string, string>)[key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 font-medium">{dict.editFacts}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-[var(--error-text)]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onSave}
          disabled={pending}
          className="rounded-[8px] bg-[var(--primary)] px-4 py-1.5 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {dict.save}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-[8px] border border-[var(--border)] px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--accent-soft)]"
        >
          {dict.cancel}
        </button>
      </div>
    </section>
  );
}
