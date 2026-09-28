// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { Search, AlertCircle } from "lucide-react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useAddBookForm, type AddBookFormDict } from "@/lib/books/use-add-book-form";

export function AddBookForm({ dict, onAdded }: { dict: AddBookFormDict; onAdded?: () => void }) {
  const form = useAddBookForm(dict, { onAdded });

  return (
    <div className="space-y-3">
      {/* Header — Where am I? → What can I do? per UI_Design_Language:482 */}
      <div className="flex items-baseline justify-between">
        <h2 className="font-[var(--font-serif)] text-[15px] font-semibold tracking-tight text-foreground">
          {dict.bookTitle} — {dict.add}
        </h2>
        <span className="text-xs text-muted-foreground">
          {dict.pages && form.numberOfPages ? `${dict.pages}: ${form.numberOfPages}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {dict.isbn}
          </label>
          <div className="flex gap-1">
            <input
              value={form.isbn}
              onChange={(e) => form.setIsbn(e.target.value)}
              placeholder={dict.isbn}
              aria-invalid={!!form.lookupError}
              className={`w-full rounded-[8px] border bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
                form.lookupError ? "border-[var(--destructive)] bg-[var(--error-soft)]" : "border-[var(--border)]"
              }`}
            />
            <BarcodeScanner onDetected={form.handleScan} title={dict.scan} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => form.handleLookup()}
          disabled={form.lookupPending || !form.isbn.trim()}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-secondary px-3.5 py-2 font-[var(--font-sans)] text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Search size={14} />
          {form.lookupPending ? "..." : dict.lookup}
        </button>

        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {dict.bookTitle} <span className="text-[var(--destructive)]">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => form.setTitle(e.target.value)}
            placeholder={dict.bookTitle}
            aria-invalid={!!form.addError}
            className={`w-full rounded-[8px] border bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-serif)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
              form.addError ? "border-[var(--destructive)] bg-[var(--error-soft)]" : "border-[var(--border)]"
            }`}
          />
        </div>

        <div className="min-w-[120px]">
          <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {dict.author}
          </label>
          <input
            value={form.author}
            onChange={(e) => form.setAuthor(e.target.value)}
            placeholder={dict.author}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <button
          type="button"
          onClick={form.handleAdd}
          disabled={form.addPending || !form.title.trim()}
          className="rounded-[8px] bg-[var(--accent)] px-5 py-2 font-[var(--font-sans)] text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {form.addPending ? "..." : dict.add}
        </button>
      </div>

      {/* States — distinguishable without color alone per UI_Design_Language:532 */}
      {form.lookupError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[8px] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-text)]"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{form.lookupError}</span>
        </div>
      )}
      {form.addError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[8px] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-text)]"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{form.addError}</span>
        </div>
      )}

      {form.pending && (
        <div className="text-xs text-muted-foreground" aria-live="polite">
          ...
        </div>
      )}
    </div>
  );
}
