// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useTransition } from "react";
import { returnLending } from "@/app/actions/lending";
import { isOverdue } from "@/lib/lending-due";

type Lending = {
  id: string;
  borrowerName: string;
  lentAt: Date;
  returnedAt: Date | null;
  dueDate: Date | null;
  book: { title: string };
};

export function LendingRow({
  record,
  dict,
}: {
  record: Lending;
  dict: { returned: string; markReturned: string; dueLabel: string; overdues: string };
}) {
  const [pending, startTransition] = useTransition();
  const overdue = isOverdue(record);

  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] last:border-b-0 px-4 py-3 transition-colors hover:bg-[var(--surface-elevated)]">
      <div className="min-w-0 flex-1">
        <p className="font-[var(--font-serif)] text-sm font-medium leading-tight text-foreground truncate">
          {record.book.title}
        </p>
        <p className="font-[var(--font-sans)] text-xs text-muted-foreground">
          {record.borrowerName} · {new Date(record.lentAt).toLocaleDateString()}
        </p>
      </div>
      {record.returnedAt ? (
        <span className="rounded-full bg-[var(--success-soft)] border border-[var(--border)] px-2.5 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-[var(--success-text)]">
          {dict.returned}
        </span>
      ) : record.dueDate ? (
        overdue ? (
          <span className="rounded-full bg-[var(--error-soft)] border border-[var(--border)] px-2.5 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-[var(--error-text)]">
            {dict.overdues} · {new Date(record.dueDate).toLocaleDateString()}
          </span>
        ) : (
          <span className="rounded-full bg-[var(--secondary)] border border-[var(--border)] px-2.5 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-[var(--secondary-foreground)]">
            {dict.dueLabel} {new Date(record.dueDate).toLocaleDateString()}
          </span>
        )
      ) : null}
      {!record.returnedAt && (
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await returnLending(record.id); })}
          className={`ml-3 rounded-[8px] px-3.5 py-1.5 font-[var(--font-sans)] text-[11px] font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
            overdue
              ? "bg-[var(--destructive)] text-white hover:opacity-90"
              : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]"
          }`}
        >
          {dict.markReturned}
        </button>
      )}
    </div>
  );
}
