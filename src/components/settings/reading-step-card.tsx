// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.5.1 — per-user "I read N pages" step. One tap on a read CTA credits this
// many pages (the effective value is lifted to the admin floor when the admin
// set one, so the input is disabled below it). Number input with a Save
// action, matching the other Settings cards.

import { useState, useTransition } from "react";
import { updatePagesPerReadEvent } from "@/app/actions/settings";

export function ReadingStepCard({
  initialValue,
  adminFloor,
  siteDefault,
  dict,
}: {
  initialValue: number | null;
  adminFloor: number;
  siteDefault: number;
  dict: {
    title: string;
    desc: string;
    label: string;
    floorHint: string;
    save: string;
    saved: string;
    invalid: string;
  };
}) {
  const [value, setValue] = useState(String(initialValue ?? ""));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveFloor = Math.max(1, adminFloor);
  const min = effectiveFloor;
  const placeholder = String(Math.max(effectiveFloor, siteDefault));

  function save() {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < min || parsed > 1000) {
      setMsg(dict.invalid.replace("{min}", String(min)).replace("{max}", "1000"));
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await updatePagesPerReadEvent(parsed);
      setMsg(res.ok ? dict.saved : dict.invalid.replace("{min}", String(min)).replace("{max}", "1000"));
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">{dict.title}</p>
      <p className="mt-1 font-[var(--font-sans)] text-sm text-muted-foreground">{dict.desc}</p>
      <div className="mt-3 flex items-end gap-3">
        <div>
          <label className="mb-1 block font-[var(--font-sans)] text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {dict.label}
          </label>
          <input
            type="number"
            min={min}
            max={1000}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder={placeholder}
            aria-label={dict.label}
            className="w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 font-[var(--font-sans)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
      {adminFloor > 1 && (
        <p className="mt-2 font-[var(--font-sans)] text-xs text-muted-foreground">
          {dict.floorHint.replace("{min}", String(adminFloor))}
        </p>
      )}
    </div>
  );
}
