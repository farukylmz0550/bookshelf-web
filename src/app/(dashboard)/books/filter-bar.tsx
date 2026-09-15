// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import { Filters, defaultFilters, SORT_TITLE, SORT_RATING, SORT_YEAR } from "@/lib/books/filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TRIGGER_CLS =
  "rounded-[8px] border-[var(--border)] bg-[var(--surface-elevated)] text-foreground focus-visible:ring-[var(--ring)] text-xs";

export function FilterBar({
  onChange,
  tagsInUse,
  dict,
  groups,
}: {
  onChange: (f: Filters) => void;
  tagsInUse: string[];
  dict: Record<string, string>;
  groups?: { id: string; name: string; color: string | null }[];
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expanded, setExpanded] = useState(false);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  }

  const hasActiveFilters =
    filters.minRating > 0 ||
    filters.signed !== "any" ||
    filters.lent !== "any" ||
    filters.status !== "any" ||
    filters.tag !== "any" ||
    filters.groupId !== "any";

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-2">
        <input
          placeholder={dict.search}
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-secondary px-3 py-1.5 font-[var(--font-sans)] text-[13px] text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {dict.filters}
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <Select value={filters.searchField} onValueChange={(v) => update({ searchField: v ?? "all" })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.search}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{dict.allFields}</SelectItem>
              <SelectItem value="title">{dict.title}</SelectItem>
              <SelectItem value="authors">{dict.authors}</SelectItem>
              <SelectItem value="isbn">{dict.isbn}</SelectItem>
              <SelectItem value="publishers">{dict.publishers}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(filters.minRating)}
            onValueChange={(v) => update({ minRating: parseInt(v ?? "0", 10) })}
          >
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.anyRating}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{dict.anyRating}</SelectItem>
              <SelectItem value="5">★★★★★</SelectItem>
              <SelectItem value="4">★★★★☆ & up</SelectItem>
              <SelectItem value="3">★★★☆☆ & up</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => update({ status: v ?? "any" })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{dict.status}</SelectItem>
              <SelectItem value="TO_READ">{dict.toRead ?? "To read"}</SelectItem>
              <SelectItem value="READING">{dict.reading ?? "Reading"}</SelectItem>
              <SelectItem value="FINISHED">{dict.finished ?? "Finished"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.signed} onValueChange={(v) => update({ signed: v ?? "any" })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.signed}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{dict.signed}</SelectItem>
              <SelectItem value="yes">{dict.yes}</SelectItem>
              <SelectItem value="no">{dict.no}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.lent} onValueChange={(v) => update({ lent: v ?? "any" })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.lending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{dict.lending}</SelectItem>
              <SelectItem value="home">{dict.atHome}</SelectItem>
              <SelectItem value="out">{dict.onLoan}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.tag} onValueChange={(v) => update({ tag: v ?? "any" })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.tag}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{dict.tag}</SelectItem>
              {tagsInUse.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groups && groups.length > 0 && (
            <Select value={filters.groupId} onValueChange={(v) => update({ groupId: v ?? "any" })}>
              <SelectTrigger className={TRIGGER_CLS} aria-label={dict.group}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{dict.allGroups}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filters.sort} onValueChange={(v) => update({ sort: v ?? SORT_TITLE })}>
            <SelectTrigger className={TRIGGER_CLS} aria-label={dict.sortByTitle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SORT_TITLE}>{dict.sortByTitle}</SelectItem>
              <SelectItem value={SORT_RATING}>{dict.sortByRating}</SelectItem>
              <SelectItem value={SORT_YEAR}>{dict.sortByYear}</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => update({ asc: !filters.asc })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground"
          >
            {filters.asc ? "↑ A–Z" : "↓ Z–A"}
          </button>
          <button
            onClick={() => {
              setFilters(defaultFilters);
              onChange(defaultFilters);
            }}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {dict.clear}
          </button>
        </div>
      )}
    </div>
  );
}
