// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { Shield, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type MarketDict = {
  shield: string;
  shieldDescription: string;
  inventory: string;
  buy: string;
  buying: string;
  success: string;
  insufficientXp: string;
};

export function MarketCard({
  shieldBalance,
  shieldCost,
  canPurchase,
  dict,
}: {
  shieldBalance: number;
  shieldCost: number;
  canPurchase: boolean;
  dict: MarketDict;
}) {
  const [balance, setBalance] = useState(shieldBalance);
  const [pending, startTransition] = useTransition();
  function buy() {
    startTransition(async () => {
      try {
        const { purchaseStreakShield } = await import("@/app/actions/streak");
        await purchaseStreakShield();
        setBalance((value) => value + 1);
        toast.success(dict.success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Purchase failed");
      }
    });
  }
  return (
    <section className="max-w-xl rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="font-medium text-foreground">{dict.shield}</h2>
            <p className="text-sm text-muted-foreground">{dict.shieldDescription}</p>
          </div>
        </div>
        <ShoppingBag size={18} className="text-muted-foreground" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{dict.inventory}</p>
          <p className="text-2xl font-semibold text-foreground">{balance}</p>
        </div>
        <button
          onClick={buy}
          disabled={!canPurchase || pending}
          className="rounded-[10px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-40"
        >
          {pending ? dict.buying : dict.buy.replace("{cost}", String(shieldCost))}
        </button>
      </div>
      {!canPurchase && <p className="mt-3 text-xs text-muted-foreground">{dict.insufficientXp}</p>}
    </section>
  );
}
