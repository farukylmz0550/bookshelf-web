// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { GroupsManager } from "./groups-manager";
import Link from "next/link";
import { groupAuthors, groupGenres } from "@/lib/collections";

export default async function GroupsPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const groups = await db.bookGroup.findMany({
    where: { userId, mode: "STATIC" },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, order: true },
  });
  // Single grouped query — counts without N+1.
  const groupedCounts = await db.bookGroupMembership.groupBy({
    by: ["groupId"],
    where: { group: { userId, mode: "STATIC" } },
    _count: { groupId: true },
  });
  const counts = new Map(groupedCounts.map((c) => [c.groupId, c._count.groupId]));
  const books = await db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  const genres = groupGenres(books).slice(0, 12);
  const authors = groupAuthors(books).slice(0, 12);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.groups.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.groups.subtitle}</p>
      </header>
      <GroupsManager
        groups={groups}
        counts={Object.fromEntries(counts)}
        dict={{
          ...dict.groups,
          booksLabel: dict.common.books,
          cancelLabel: dict.facts.cancel,
          saveLabel: dict.facts.save,
          searchLabel: dict.filter.search,
        }}
      />
      <AutomaticSection
        title={dict.groups.genres}
        allLabel={dict.groups.viewAll}
        allHref="/genres"
        items={genres.map((genre) => ({ name: genre.name, count: genre.total, href: `/genres/${encodeURIComponent(genre.name)}` }))}
        booksLabel={dict.common.books}
      />
      <AutomaticSection
        title={dict.groups.authors}
        allLabel={dict.groups.viewAll}
        allHref="/authors"
        items={authors.map((author) => ({ name: author.name, count: author.total, href: `/authors/${encodeURIComponent(author.name)}` }))}
        booksLabel={dict.common.books}
      />
    </div>
  );
}

function AutomaticSection({ title, allLabel, allHref, items, booksLabel }: { title: string; allLabel: string; allHref: string; items: { name: string; count: number; href: string }[]; booksLabel: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-serif)] text-lg font-semibold">{title}</h2>
        <Link href={allHref} className="text-sm text-[var(--accent)] hover:underline">{allLabel}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-elevated)]">
            <p className="truncate font-[var(--font-serif)] text-sm font-semibold">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.count} {booksLabel}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
