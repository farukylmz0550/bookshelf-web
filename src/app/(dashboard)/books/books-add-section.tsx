// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AddBookForm } from "./add-book-form";
import { DetailedAddForm } from "./detailed-add-form";

type Dict = {
  isbn: string;
  lookup: string;
  bookTitle: string;
  author: string;
  add: string;
  pages: string;
  scan: string;
  notFound?: string;
  lookupFailed?: string;
  addSuccess?: string;
  addFailed?: string;
  required?: string;
  detailedAdd?: string;
  addDetailed?: string;
  orWithAllFields?: string;
};

export function BooksAddSection({ dict, excel }: { dict: Dict; excel: React.ReactNode }) {
  const [showDetailed, setShowDetailed] = useState(false);

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <AddBookForm dict={dict} />
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={() => setShowDetailed((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-sans)] text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {showDetailed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {dict.detailedAdd ?? "Detailed add"}
        </button>
        <span className="font-[var(--font-sans)] text-xs text-muted-foreground">
          {dict.orWithAllFields ?? "or with all fields"}
        </span>
      </div>
      {showDetailed && (
        <div className="mt-4 animate-in fade-in">
          <DetailedAddForm dict={dict} onDone={() => setShowDetailed(false)} />
        </div>
      )}
      <div className="mt-4">{excel}</div>
    </div>
  );
}
