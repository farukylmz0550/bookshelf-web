// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useTransition, useCallback } from "react";
import { Flame, Shield } from "lucide-react";

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  isTodayActive: boolean;
  shieldCost: number;
  isTodayShielded: boolean;
  shieldBalance: number;
  canPurchaseShield: boolean;
  buyMoreLabel: string;
}

export function StreakWidget({
  currentStreak,
  longestStreak,
  isTodayActive,
  shieldCost,
  isTodayShielded,
  shieldBalance,
  canPurchaseShield,
  buyMoreLabel,
}: StreakWidgetProps) {
  const [isPending, startTransition] = useTransition();

  const buyShield = useCallback(() => {
    startTransition(async () => {
      const mod = await import("@/app/actions/streak");
      await mod.purchaseStreakShield();
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
              currentStreak > 0 ? "bg-[var(--accent-soft)]" : "bg-[var(--surface-elevated)]"
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
          <div className="text-end text-xs text-muted-foreground">
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
                    ? "bg-[var(--surface-elevated)] text-muted-foreground"
                    : "bg-transparent text-muted-foreground/40"
              }`}
            >
              {day[0]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-center text-xs">
        {isTodayShielded ? (
          <span className="flex items-center justify-center gap-1 font-medium text-[var(--warning-text)]">
            <Shield size={12} /> Streak protected today
          </span>
        ) : isTodayActive ? (
          <span className="font-medium text-[var(--success)]">Read today!</span>
        ) : (
          <span className="text-[var(--error-text)]">Not read today</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Shields: {shieldBalance}</span>
        {canPurchaseShield && (
          <button
            onClick={buyShield}
            disabled={isPending}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-foreground hover:bg-[var(--surface-elevated)] disabled:opacity-50"
          >
            Buy shield ({shieldCost} XP)
          </button>
        )}
        {!canPurchaseShield && <span>{buyMoreLabel}</span>}
      </div>
    </div>
  );
}
