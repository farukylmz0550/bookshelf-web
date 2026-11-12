// SPDX-License-Identifier: GPL-3.0-only
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getMarketState } from "@/lib/services/market";
import { MarketPanel } from "./market-panel";

export default async function MarketPage() {
  const userId = await requireUserId();
  const state = await getMarketState(userId);
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{dict.market.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.market.description}</p>
      </header>
      <MarketPanel initial={state} dict={dict.market} />
    </div>
  );
}
