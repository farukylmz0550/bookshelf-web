// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useTransition, useCallback } from "react";
import { Flame, Shield } from "lucide-react";
import { hapticFeedback } from "@/lib/haptic";

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  isTodayActive: boolean;
  shieldCost: number;
  canUseShield: boolean;
}

export function StreakWidget({
  currentStreak,
  longestStreak,
  isTodayActive,
  shieldCost,
  canUseShield,
}: StreakWidgetProps) {
  const [isPending, startTransition] = useTransition();

  const handleUseShield = useCallback(() => {
    if (!confirm("Use streak protection?")) return;
    hapticFeedback("heavy");
    startTransition(async () => {
      const mod = await import("@/app/actions/streak");
      await mod.useStreakShield();
    });
  }, []);

  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              currentStreak > 0 ? "bg-[var(--accent-soft)]" : "bg-muted"
            }`}
          >
            <Flame
              size={22}
              className={currentStreak > 0 ? "text-[var(--primary)]" : "text-muted-foreground"}
              fill={currentStreak > 0 ? "currentColor" : "none"}
            />
          </div>
          <div>
            <div className="text-2xl font-bold">{currentStreak}</div>
            <div className="text-xs text-muted-foreground">day streak</div>
          </div>
        </div>
        {longestStreak > 0 && (
          <div className="text-right text-xs text-muted-foreground">
            Longest: <span className="font-medium text-foreground">{longestStreak}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className={`h-7 w-7 rounded-lg text-[10px] font-medium flex items-center justify-center transition-colors ${
                i === todayIndex
                  ? isTodayActive
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--primary)] text-[var(--primary)]"
                  : i < todayIndex
                    ? "bg-muted text-muted-foreground"
                    : "bg-transparent text-muted-foreground/40"
              }`}
            >
              {day[0]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-center text-xs">
        {isTodayActive ? (
          <span className="font-medium text-[var(--success)]">Read today!</span>
        ) : (
          <span className="text-[var(--error-text)]">Not read today</span>
        )}
      </div>

      {canUseShield && (
        <button
          onClick={handleUseShield}
          disabled={isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2.5 text-xs font-medium text-[var(--warning-text)] transition-colors hover:bg-[var(--warning-soft)]/70 disabled:opacity-50"
        >
          <Shield size={14} />
          Use streak shield ({shieldCost} XP)
        </button>
      )}
    </div>
  );
}
