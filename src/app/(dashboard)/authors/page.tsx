// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — Authors view: the caller's books grouped by the `author` field
// (derived, no new table). Each card links to the author's page.
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { groupAuthors } from "@/lib/collections";
import { BookOpen } from "lucide-react";

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const userId = await requireUserId();
  const dict = await getDictionary();

  const books = await db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  const query = q.trim().toLocaleLowerCase();
  const authors = groupAuthors(books)
    .filter((author) => !query || author.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.authors.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.authors.subtitle}</p>
      </header>

      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder={dict.filter.search} className="min-w-0 flex-1 rounded-[10px] border border-[var(--border)] bg-background px-3 py-2 text-sm" />
        <button className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]">{dict.authors.search}</button>
      </form>

      {authors.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <BookOpen size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.authors.empty}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a) => (
            <Link
              key={a.name}
              href={`/authors/${encodeURIComponent(a.name)}`}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <p className="truncate font-[var(--font-serif)] text-sm font-semibold text-foreground">{a.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {a.finished}/{a.total} {dict.authors.finishedOf}
                {a.reading > 0 ? ` · ${a.reading} ${dict.authors.reading}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
