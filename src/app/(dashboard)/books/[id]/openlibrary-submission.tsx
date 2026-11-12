// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOpenLibraryPermission } from "@/app/actions/books";

export function OpenLibrarySubmission({ bookId, enabled: initialEnabled, status, dict }: { bookId: string; enabled: boolean; status: "PENDING" | "SUBMITTED" | "FAILED"; dict: Record<string, string> }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await setOpenLibraryPermission(bookId, next);
      if (!result.ok) {
        setEnabled(!next);
        toast.error(dict.error);
      } else {
        toast.success(dict.saved);
      }
    });
  }
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-serif)] text-sm font-semibold">{dict.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{dict.description}</p>
        </div>
        <span className="rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium">{dict[status]}</span>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} disabled={pending || status === "SUBMITTED"} onChange={(event) => toggle(event.target.checked)} />
        {dict.permission}
      </label>
    </section>
  );
}
