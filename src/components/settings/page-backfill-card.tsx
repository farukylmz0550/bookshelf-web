// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { backfillPageCounts } from "@/app/actions/books";

/**
 * v2.9.6 — fills missing page counts from Open Library for the caller's books.
 * Chunked server action: press again while books remain without a count.
 * v3.0.0 — moved from Admin to Settings (it is user-scoped, not admin power).
 */
export function PageBackfillCard({ dict }: { dict: { desc: string; run: string; running: string; done: string } }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(dict.running);
    startTransition(async () => {
      const res = await backfillPageCounts();
      setMsg(
        res.ok
          ? dict.done.replace("{filled}", String(res.filled ?? 0)).replace("{missing}", String(res.notFound ?? 0))
          : (res.error ?? "Failed"),
      );
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.desc}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {dict.run}
        </button>
        {msg && <span className="font-[var(--font-sans)] text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
