// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.3.0 — challenge card with ownership-scoped delete (confirm-guarded).
import { useTransition } from "react";
import { deleteChallenge } from "@/app/actions/challenges";
import { Button } from "@/components/ui/button";

export type ChallengeItemProps = {
  id: string;
  title: string;
  window: string;
  done: number;
  target: number;
  completed: boolean;
  dict: {
    completed: string;
    delete: string;
    deleteConfirm: string;
  };
};

export function ChallengeItem({ id, title, window, done, target, completed, dict }: ChallengeItemProps) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(dict.deleteConfirm)) return;
    startTransition(async () => {
      await deleteChallenge(id);
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-[var(--font-serif)] text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{window}</p>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
              {dict.completed}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label={dict.delete}>
            {dict.delete}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm tabular-nums text-muted-foreground">
        {done}/{target}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full ${completed ? "bg-[var(--success)]" : "bg-[var(--primary)]"}`}
          style={{ width: `${Math.min(100, (done / target) * 100)}%` }}
        />
      </div>
    </div>
  );
}
