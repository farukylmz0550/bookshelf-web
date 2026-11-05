// SPDX-License-Identifier: GPL-3.0-only
import { requireUserId } from "@/lib/session";
import { getStreakInfo } from "@/lib/streak";
import { getDictionary } from "@/i18n/get-dictionary";
import { MarketCard } from "./market-card";

export default async function MarketPage() {
  const userId = await requireUserId();
  const streak = await getStreakInfo(userId);
  const dict = await getDictionary();
  if (!streak) return null;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{dict.market.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.market.description}</p>
      </header>
      <MarketCard
        shieldBalance={streak.shieldBalance}
        shieldCost={streak.shieldCost}
        canPurchase={streak.canPurchaseShield}
        dict={dict.market}
      />
    </div>
  );
}
