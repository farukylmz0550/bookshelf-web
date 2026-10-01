// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { LendingForm } from "./lending-form";
import { LendingRow } from "./lending-row";

export default async function LendingPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const [books, people, records] = await Promise.all([
    db.book.findMany({ where: { userId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    // v3.5.1 — borrowers come from /people; create people there, not here.
    db.person.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.lendingRecord.findMany({
      where: { book: { userId } },
      include: { book: { select: { title: true } } },
      orderBy: { lentAt: "desc" },
    }),
  ]);

  const active = records.filter((r) => !r.returnedAt);
  const returned = records.filter((r) => r.returnedAt);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.lending.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {records.length} · {active.length} {dict.lending.activeLoans}
        </p>
      </header>
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <LendingForm
          books={books}
          people={people}
          dict={{
            ...dict.lending,
            noPeople: dict.lending.noPeople ?? dict.people.empty,
            addPeople: dict.lending.addPeople ?? dict.people.add,
            save: dict.facts.save,
          }}
        />
      </div>
      {records.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{dict.lending.empty}</p>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="border-b border-border bg-[var(--surface-elevated)] px-4 py-2">
                <p className="text-[11px] text-muted-foreground">{dict.lending.activeLoans}</p>
              </div>
              {active.map((record) => (
                <LendingRow key={record.id} record={record} dict={dict.lending} />
              ))}
            </div>
          )}
          {returned.length > 0 && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="border-b border-border bg-[var(--surface-elevated)] px-4 py-2">
                <p className="text-[11px] text-muted-foreground">{dict.lending.returnedSection}</p>
              </div>
              {returned.map((record) => (
                <LendingRow key={record.id} record={record} dict={dict.lending} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
