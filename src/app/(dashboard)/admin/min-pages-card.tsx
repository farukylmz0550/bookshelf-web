// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.5.1 — admin card for the site-wide minimum of the "I read N pages"
// step. 0 disables the floor; any other value lifts every user's effective
// step to at least this many pages (see src/lib/reading-settings.ts).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMinPagesPerReadEvent } from "@/app/actions/admin";

export function MinPagesCard({
  initialValue,
  dict,
}: {
  initialValue: number;
  dict: {
    title: string;
    desc: string;
    label: string;
    disabledLabel: string;
    save: string;
    saved: string;
    invalid: string;
  };
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialValue));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 1000) {
      setMsg(dict.invalid.replace("{max}", "1000"));
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await updateMinPagesPerReadEvent(parsed);
      if (res.ok) {
        setMsg(dict.saved.replace("{min}", String(parsed)));
        router.refresh();
      } else {
        setMsg(dict.invalid.replace("{max}", "1000"));
      }
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">{dict.title}</p>
      <p className="mt-1 font-[var(--font-sans)] text-sm text-muted-foreground">{dict.desc}</p>
      <div className="mt-3 flex items-end gap-3">
        <div>
          <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {value === "0" || value === "" ? dict.disabledLabel : dict.label}
          </label>
          <input
            type="number"
            min={0}
            max={1000}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            aria-label={dict.label}
            className="w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {dict.save}
        </button>
        {msg && <span className="font-[var(--font-sans)] text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
