// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppConfig } from "@/lib/app-config";
import { groupPublishers } from "@/lib/collections";

export default async function PublishersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const config = await getAppConfig();
  if (!config.smartShelfPublishers) notFound();
  const [{ q = "" }, userId, dict] = await Promise.all([searchParams, requireUserId(), getDictionary()]);
  const books = await db.book.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  const query = q.trim().toLocaleLowerCase();
  const publishers = groupPublishers(books).filter(
    (publisher) => !query || publisher.name.toLocaleLowerCase().includes(query),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold">{dict.publishers.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.publishers.subtitle}</p>
      </header>
      <form className="flex max-w-md gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={dict.filter.search}
          className="min-w-0 flex-1 rounded-[10px] border border-[var(--border)] bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)]">
          {dict.publishers.search}
        </button>
      </form>
      {publishers.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <Building2 size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{dict.publishers.empty}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {publishers.map((publisher) => (
            <Link
              key={publisher.name}
              href={`/publishers/${encodeURIComponent(publisher.name)}`}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-elevated)]"
            >
              <p className="truncate font-[var(--font-serif)] text-sm font-semibold">{publisher.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {publisher.total} {dict.common.books}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
