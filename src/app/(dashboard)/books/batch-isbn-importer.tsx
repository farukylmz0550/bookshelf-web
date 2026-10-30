// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { Check, ListPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { createBooksBatchAction, lookupBooksBatchAction } from "@/app/actions/books";
import type { IsbnLookupResult } from "@/lib/isbn";

type Item = { raw: string; isbn: string; status: string; data?: IsbnLookupResult };
type Dict = {
  batchTitle: string;
  batchHint: string;
  batchLookup: string;
  batchAdd: string;
  batchReady: string;
  batchDuplicate: string;
  batchInvalid: string;
  batchFailed: string;
  batchEmpty: string;
  batchAdded: string;
  scan: string;
};

export function BatchIsbnImporter({ dict, onAdded }: { dict: Dict; onAdded?: () => void }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const appendIsbn = (isbn: string) => setText((value) => (value.trim() ? `${value.trim()}\n${isbn}` : isbn));
  const labelFor = (status: string) =>
    status === "ready"
      ? dict.batchReady
      : status === "duplicate"
        ? dict.batchDuplicate
        : status === "invalid"
          ? dict.batchInvalid
          : dict.batchFailed;

  function preview() {
    const isbns = text
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (isbns.length === 0) {
      toast.error(dict.batchEmpty);
      return;
    }
    startTransition(async () => {
      const result = await lookupBooksBatchAction(isbns);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems(result.data.items);
      setSelected(
        new Set(result.data.items.filter((item) => item.status === "ready" && item.data).map((item) => item.isbn)),
      );
    });
  }

  function addSelected() {
    const books = items.filter((item) => selected.has(item.isbn) && item.data).map((item) => item.data!);
    if (books.length === 0) return;
    startTransition(async () => {
      const result = await createBooksBatchAction(books);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const added = result.data.items.filter((item) => item.status === "added").length;
      toast.success(`${dict.batchAdded}: ${added}`, { icon: <Check size={16} /> });
      setItems([]);
      setSelected(new Set());
      setText("");
      onAdded?.();
    });
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="mb-2 flex items-center gap-2">
        <ListPlus size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">{dict.batchTitle}</h3>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{dict.batchHint}</p>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          placeholder="978…\n0-…-X"
          className="min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <div className="flex flex-col gap-2">
          <BarcodeScanner onDetected={appendIsbn} title={dict.scan} />
          <button
            type="button"
            onClick={preview}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-40"
          >
            <Search size={14} /> {dict.batchLookup}
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <label
              key={`${item.isbn}-${index}`}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-2 text-xs"
            >
              <input
                type="checkbox"
                checked={selected.has(item.isbn)}
                disabled={item.status !== "ready" || !item.data}
                onChange={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(item.isbn)) next.delete(item.isbn);
                    else next.add(item.isbn);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate">{item.data?.title ?? item.isbn}</span>
              <span className="text-muted-foreground">{labelFor(item.status)}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={addSelected}
            disabled={pending || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            <Check size={14} /> {dict.batchAdd} ({selected.size})
          </button>
        </div>
      )}
    </div>
  );
}
