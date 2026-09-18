// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — Series view: the caller's books grouped by the `series` metadata
// field (Open Library enrichment data we already store). Each card shows the
// series progress (finished/total) and links to the series detail grid.
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { groupSeries } from "@/lib/collections";
import { Layers } from "lucide-react";

export default async function SeriesPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const books = await db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  const series = groupSeries(books);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.series.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.series.subtitle}</p>
      </header>

      {series.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <Layers size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.series.empty}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <Link
              key={s.name}
              href={`/series/${encodeURIComponent(s.name)}`}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <p className="truncate font-[var(--font-serif)] text-sm font-semibold text-foreground">{s.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.finished}/{s.total} {dict.series.finishedOf}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${s.total === 0 ? 0 : (s.finished / s.total) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
