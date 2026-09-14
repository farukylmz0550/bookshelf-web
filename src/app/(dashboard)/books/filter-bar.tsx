// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import { Filters, defaultFilters, SORT_TITLE, SORT_RATING, SORT_YEAR } from "@/lib/books/filters";

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
          <select
            value={filters.searchField}
            onChange={(e) => update({ searchField: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 font-[var(--font-sans)] text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="all">{dict.allFields}</option>
            <option value="title">{dict.title}</option>
            <option value="authors">{dict.authors}</option>
            <option value="isbn">{dict.isbn}</option>
            <option value="publishers">{dict.publishers}</option>
          </select>
          <select
            value={String(filters.minRating)}
            onChange={(e) => update({ minRating: parseInt(e.target.value, 10) })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="0">{dict.anyRating}</option>
            <option value="5">★★★★★</option>
            <option value="4">★★★★☆ & up</option>
            <option value="3">★★★☆☆ & up</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="any">{dict.status}</option>
            <option value="TO_READ">{dict.toRead ?? "To read"}</option>
            <option value="READING">{dict.reading ?? "Reading"}</option>
            <option value="FINISHED">{dict.finished ?? "Finished"}</option>
          </select>
          <select
            value={filters.signed}
            onChange={(e) => update({ signed: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="any">{dict.signed}</option>
            <option value="yes">{dict.yes}</option>
            <option value="no">{dict.no}</option>
          </select>
          <select
            value={filters.lent}
            onChange={(e) => update({ lent: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="any">{dict.lending}</option>
            <option value="home">{dict.atHome}</option>
            <option value="out">{dict.onLoan}</option>
          </select>
          <select
            value={filters.tag}
            onChange={(e) => update({ tag: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="any">{dict.tag}</option>
            {tagsInUse.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {groups && groups.length > 0 && (
            <select
              value={filters.groupId}
              onChange={(e) => update({ groupId: e.target.value })}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              aria-label={dict.group}
            >
              <option value="any">{dict.allGroups}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs font-[var(--font-sans)] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value={SORT_TITLE}>{dict.sortByTitle}</option>
            <option value={SORT_RATING}>{dict.sortByRating}</option>
            <option value={SORT_YEAR}>{dict.sortByYear}</option>
          </select>
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
