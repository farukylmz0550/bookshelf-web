// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { levelForXp, levelName } from "@/lib/gamification-pure";

type User = { id: string; name: string; xp: number };

const PAGE_SIZE = 20;

export function LeaderboardTable({
  xpPerLevelBase = 100,
  xpLevelNames = [],
  users,
  currentUserId,
  dict,
}: {
  users: User[];
  currentUserId: string;
  dict: { rank: string; name: string; level: string; xp: string };
  xpPerLevelBase?: number;
  /** v3.1.0 — custom level names from config.yaml (optional). */
  xpLevelNames?: readonly string[];
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const slice = users.slice(start, start + PAGE_SIZE);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[3rem_1fr_5rem_6rem] gap-4 border-b border-border bg-muted/50 px-4 py-2">
        <span className="text-[11px] text-muted-foreground">#</span>
        <span className="text-[11px] text-muted-foreground">{dict.name}</span>
        <span className="text-[11px] text-center text-muted-foreground">{dict.level}</span>
        <span className="text-[11px] text-right text-muted-foreground">{dict.xp}</span>
      </div>
      {slice.map((user, i) => (
        <div
          key={user.id}
          className={`grid grid-cols-[3rem_1fr_5rem_6rem] items-center gap-4 border-b border-border last:border-b-0 px-4 py-2.5 transition-colors ${
            user.id === currentUserId ? "bg-primary/5" : ""
          }`}
        >
          <span className="text-sm tabular-nums text-muted-foreground">{start + i + 1}</span>
          <span className="text-sm text-foreground">{user.name}</span>
          <span className="text-center text-sm text-muted-foreground">
            {levelForXp(user.xp, xpPerLevelBase)}
            {levelName(levelForXp(user.xp, xpPerLevelBase), xpLevelNames) && (
              <span
                className="ml-1 text-[10px] text-muted-foreground/80"
                title={levelName(levelForXp(user.xp, xpPerLevelBase), xpLevelNames) ?? undefined}
              >
                {levelName(levelForXp(user.xp, xpPerLevelBase), xpLevelNames)}
              </span>
            )}
          </span>
          <span className="text-right text-sm tabular-nums text-muted-foreground">{user.xp}</span>
        </div>
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
