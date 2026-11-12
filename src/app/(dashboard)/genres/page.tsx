// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { groupGenres } from "@/lib/collections";

export default async function GenresPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, userId, dict] = await Promise.all([searchParams, requireUserId(), getDictionary()]);
  const books = await db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  const query = q.trim().toLocaleLowerCase();
  const genres = groupGenres(books)
    .filter((genre) => !query || genre.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold">{dict.genres.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.genres.subtitle}</p>
      </header>
      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder={dict.filter.search} className="min-w-0 flex-1 rounded-[10px] border border-[var(--border)] bg-background px-3 py-2 text-sm" />
        <button className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]">{dict.genres.search}</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {genres.map((genre) => (
          <Link key={genre.name} href={`/genres/${encodeURIComponent(genre.name)}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-elevated)]">
            <p className="truncate font-[var(--font-serif)] text-sm font-semibold">{genre.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{genre.total} {dict.common.books}</p>
          </Link>
        ))}
      </div>
      {genres.length === 0 && <p className="text-sm text-muted-foreground">{dict.genres.empty}</p>}
    </div>
  );
}
