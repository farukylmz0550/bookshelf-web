// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { addBook } from "@/app/actions/books";

type Dict = {
  bookTitle: string;
  author: string;
  add: string;
  addSuccess?: string;
  addFailed?: string;
  required?: string;
  addDetailed?: string;
  openLibraryConsent?: string;
  openLibraryConsentHint?: string;
  openLibrarySubmitted?: string;
  openLibraryQueued?: string;
};

const EMPTY_FORM = {
  title: "",
  author: "",
  isbn: "",
  subtitle: "",
  publishers: "",
  publishDate: "",
  publishPlaces: "",
  editionName: "",
  series: "",
  numberOfPages: "",
  languages: "",
  isbn10: "",
  isbn13: "",
  subjects: "",
  coverUrl: "",
};

export function DetailedAddForm({ dict, onDone }: { dict: Dict; onDone?: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitToOpenLibrary, setSubmitToOpenLibrary] = useState(false);

  function update(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
    if (error) setError(null);
  }

  function handleAdd() {
    const title = form.title.trim();
    if (!title) {
      setError(dict.required ?? "Title is required");
      toast.error(dict.required ?? "Title is required");
      return;
    }
    startTransition(async () => {
      const result = await addBook({
        title,
        author: form.author.trim() || undefined,
        isbn: form.isbn.trim() || undefined,
        coverUrl: form.coverUrl.trim() || undefined,
        subtitle: form.subtitle.trim() || undefined,
        publishers: form.publishers.trim() || undefined,
        publishDate: form.publishDate.trim() || undefined,
        publishPlaces: form.publishPlaces.trim() || undefined,
        editionName: form.editionName.trim() || undefined,
        series: form.series.trim() || undefined,
        numberOfPages: form.numberOfPages.trim() || undefined,
        languages: form.languages.trim() || undefined,
        isbn10: form.isbn10.trim() || undefined,
        isbn13: form.isbn13.trim() || undefined,
        subjects: form.subjects.trim() || undefined,
        submitToOpenLibrary,
      });
      if (!result.ok) {
        const msg = result.error || (dict.addFailed ?? "Could not add the book");
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(dict.addSuccess ?? "Book added", {
        description: submitToOpenLibrary
          ? result.openLibrarySubmission === "SUBMITTED"
            ? dict.openLibrarySubmitted
            : result.openLibrarySubmission === "QUEUED"
              ? dict.openLibraryQueued
              : undefined
          : undefined,
        icon: <Check size={16} />,
      });
      setForm(EMPTY_FORM);
      setSubmitToOpenLibrary(false);
      onDone?.();
    });
  }

  const inputCls =
    "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
  const labelCls =
    "mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

  return (
    <div className="space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <p className="font-[var(--font-serif)] text-sm font-semibold text-foreground">
        {dict.addDetailed ?? "Add detailed book"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Title *</label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder={dict.bookTitle}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Subtitle</label>
          <input
            value={form.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            placeholder="Subtitle"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{dict.author}</label>
          <input
            value={form.author}
            onChange={(e) => update("author", e.target.value)}
            placeholder={dict.author}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>ISBN</label>
          <input
            value={form.isbn}
            onChange={(e) => update("isbn", e.target.value)}
            placeholder="978..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>ISBN 10</label>
          <input
            value={form.isbn10}
            onChange={(e) => update("isbn10", e.target.value)}
            placeholder="ISBN10"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>ISBN 13</label>
          <input
            value={form.isbn13}
            onChange={(e) => update("isbn13", e.target.value)}
            placeholder="ISBN13"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Publisher</label>
          <input
            value={form.publishers}
            onChange={(e) => update("publishers", e.target.value)}
            placeholder="Publisher"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Publish date</label>
          <input
            value={form.publishDate}
            onChange={(e) => update("publishDate", e.target.value)}
            placeholder="2024"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Publish place</label>
          <input
            value={form.publishPlaces}
            onChange={(e) => update("publishPlaces", e.target.value)}
            placeholder="Istanbul"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Edition</label>
          <input
            value={form.editionName}
            onChange={(e) => update("editionName", e.target.value)}
            placeholder="1. Edition"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Series</label>
          <input
            value={form.series}
            onChange={(e) => update("series", e.target.value)}
            placeholder="Series"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Pages</label>
          <input
            value={form.numberOfPages}
            onChange={(e) => update("numberOfPages", e.target.value)}
            placeholder="320"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Languages</label>
          <input
            value={form.languages}
            onChange={(e) => update("languages", e.target.value)}
            placeholder="tr, en"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Subjects</label>
          <input
            value={form.subjects}
            onChange={(e) => update("subjects", e.target.value)}
            placeholder="fiction, history"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Cover URL</label>
          <input
            value={form.coverUrl}
            onChange={(e) => update("coverUrl", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
      </div>
      <label className="flex items-start gap-2 rounded-[8px] border border-[var(--border)] bg-background p-3 text-sm">
        <input
          type="checkbox"
          checked={submitToOpenLibrary}
          onChange={(event) => setSubmitToOpenLibrary(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block font-medium text-foreground">
            {dict.openLibraryConsent ?? "Contribute this book's metadata to Open Library"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {dict.openLibraryConsentHint ?? "Optional. Only bibliographic metadata is sent; no ebook file is uploaded."}
          </span>
        </span>
      </label>
      {error && (
        <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-text)]">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !form.title.trim()}
          className="rounded-[8px] bg-[var(--accent)] px-5 py-2 font-[var(--font-sans)] text-sm font-medium text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:opacity-40"
        >
          {pending ? "..." : dict.add}
        </button>
      </div>
    </div>
  );
}
