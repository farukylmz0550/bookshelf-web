// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.3.0 — challenge creation form (client): title, target and window dates.
import { useState, useTransition } from "react";
import { createChallenge } from "@/app/actions/challenges";
import { Button } from "@/components/ui/button";

type ChallengeDict = {
  create: string;
  createCta: string;
  titleLabel: string;
  targetLabel: string;
  startLabel: string;
  endLabel: string;
  created: string;
  invalidWindow: string;
  invalidTarget: string;
};

export function ChallengeCard({ dict }: { dict: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("5");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const d = dict as unknown as ChallengeDict;

  function submit() {
    if (!start || !end) {
      setMsg(d.invalidWindow);
      return;
    }
    startTransition(async () => {
      const res = await createChallenge({ title, target: Number(target), startAt: start, endAt: end });
      if (res.ok) {
        setOpen(false);
        setTitle("");
        setTarget("5");
        setStart("");
        setEnd("");
        setMsg(d.created);
      } else {
        setMsg(res.error === "InvalidTarget" ? d.invalidTarget : d.invalidWindow);
      }
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          {d.createCta}
        </Button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            {d.titleLabel}
            <input
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {d.targetLabel}
            <input
              type="number"
              min={1}
              max={1000}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {d.startLabel}
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {d.endLabel}
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button size="sm" onClick={submit} disabled={pending}>
              {d.create}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              ×
            </Button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
