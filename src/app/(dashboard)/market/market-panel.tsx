// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock3, Flag, Shield, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import type { MarketItemType } from "@/generated/prisma/client";
import { activatePower, buyMarketItem, extendChallenge } from "@/app/actions/market";

type MarketState = {
  serverNow: string;
  parchmentTenths: number;
  inventory: Record<MarketItemType, number>;
  pricesTenths: Record<MarketItemType, number>;
  powers: { type: "PAGE_XP" | "FINISH_XP"; expiresAt: string }[];
  eligibleChallenges: { id: string; title: string; done: number; target: number; endAt: Date | string }[];
};

type MarketDict = Record<string, string>;

const ITEMS: { item: MarketItemType; icon: typeof Shield; title: string; description: string }[] = [
  { item: "STREAK_SHIELD", icon: Shield, title: "shield", description: "shieldDescription" },
  { item: "PAGE_XP_BOOST", icon: Zap, title: "pageBoost", description: "pageBoostDescription" },
  { item: "FINISH_XP_BOOST", icon: Sparkles, title: "finishBoost", description: "finishBoostDescription" },
  { item: "CHALLENGE_EXTENSION", icon: Flag, title: "challengeExtension", description: "challengeExtensionDescription" },
];

function formatParchment(tenths: number) {
  const value = Math.max(0, tenths) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function MarketPanel({ initial, dict }: { initial: MarketState; dict: MarketDict }) {
  const [state, setState] = useState(initial);
  const [challengeId, setChallengeId] = useState(initial.eligibleChallenges[0]?.id ?? "");
  const [now, setNow] = useState(() => new Date(initial.serverNow).getTime());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function buy(item: MarketItemType) {
    startTransition(async () => {
      const result = await buyMarketItem(item);
      if (!result.ok) {
        toast.error(result.error === "INSUFFICIENT_PARCHMENT" ? dict.insufficientParchment : dict.error);
        return;
      }
      setState((current) => ({
        ...current,
        parchmentTenths: current.parchmentTenths - result.costTenths,
        inventory: { ...current.inventory, [item]: result.quantity },
        pricesTenths: {
          ...current.pricesTenths,
          ...(item === "STREAK_SHIELD" ? { STREAK_SHIELD: current.pricesTenths.STREAK_SHIELD * 2 } : {}),
        },
      }));
      toast.success(dict.purchaseSuccess);
    });
  }

  function activate(item: MarketItemType) {
    startTransition(async () => {
      const result = await activatePower(item);
      if (!result.ok) {
        toast.error(result.error === "POWER_ALREADY_ACTIVE" ? dict.alreadyActive : dict.error);
        return;
      }
      const type = item === "PAGE_XP_BOOST" ? "PAGE_XP" : "FINISH_XP";
      setState((current) => ({
        ...current,
        inventory: { ...current.inventory, [item]: current.inventory[item] - 1 },
        powers: [...current.powers.filter((power) => power.type !== type), { type, expiresAt: result.expiresAt }],
      }));
      toast.success(dict.activated);
    });
  }

  function applyExtension() {
    if (!challengeId) return;
    startTransition(async () => {
      const result = await extendChallenge(challengeId);
      if (!result.ok) {
        toast.error(dict.error);
        return;
      }
      setState((current) => ({
        ...current,
        inventory: {
          ...current.inventory,
          CHALLENGE_EXTENSION: current.inventory.CHALLENGE_EXTENSION - 1,
        },
        eligibleChallenges: current.eligibleChallenges.filter((challenge) => challenge.id !== challengeId),
      }));
      setChallengeId(state.eligibleChallenges.find((challenge) => challenge.id !== challengeId)?.id ?? "");
      toast.success(dict.extended);
    });
  }

  function activeFor(item: MarketItemType) {
    const type = item === "PAGE_XP_BOOST" ? "PAGE_XP" : item === "FINISH_XP_BOOST" ? "FINISH_XP" : null;
    return type ? state.powers.find((power) => power.type === type && new Date(power.expiresAt).getTime() > now) : null;
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <p className="text-xs text-muted-foreground">{dict.balance} · {dict.currency}</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-semibold text-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/parchment-currency.png" alt="" className="h-8 w-8 object-contain" />
            {formatParchment(state.parchmentTenths)}
          </p>
        </div>
        <p className="max-w-[260px] text-right text-xs text-muted-foreground">{dict.earnHint}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map(({ item, icon: Icon, title, description }) => {
          const active = activeFor(item);
          const quantity = state.inventory[item];
          const isPower = item === "PAGE_XP_BOOST" || item === "FINISH_XP_BOOST";
          return (
            <section key={item} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
                  <Icon size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-foreground">{dict[title]}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{dict[description]}</p>
                </div>
              </div>

              {active && (
                <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                  <Clock3 size={13} />
                  {dict.activeRemaining.replace(
                    "{time}",
                    `${Math.max(1, Math.ceil((new Date(active.expiresAt).getTime() - now) / 3_600_000))}h`,
                  )}
                </p>
              )}

              {item === "CHALLENGE_EXTENSION" && quantity > 0 && (
                <select
                  value={challengeId}
                  onChange={(event) => setChallengeId(event.target.value)}
                  className="mt-4 w-full rounded-[10px] border border-[var(--border)] bg-background px-3 py-2 text-sm"
                >
                  {state.eligibleChallenges.length === 0 ? (
                    <option value="">{dict.noEligibleChallenge}</option>
                  ) : (
                    state.eligibleChallenges.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>
                        {challenge.title} · {challenge.done}/{challenge.target}
                      </option>
                    ))
                  )}
                </select>
              )}

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{dict.inventory}</p>
                  <p className="text-xl font-semibold">{quantity}</p>
                </div>
                <div className="flex gap-2">
                  {isPower && quantity > 0 && (
                    <button
                      onClick={() => activate(item)}
                      disabled={pending || !!active}
                      className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-40"
                    >
                      {dict.activate}
                    </button>
                  )}
                  {item === "CHALLENGE_EXTENSION" && quantity > 0 && (
                    <button
                      onClick={applyExtension}
                      disabled={pending || !challengeId}
                      className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-40"
                    >
                      {dict.apply}
                    </button>
                  )}
                  <button
                    onClick={() => buy(item)}
                    disabled={pending || state.parchmentTenths < state.pricesTenths[item]}
                    className="flex items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/parchment-currency.png" alt="" className="h-4 w-4 object-contain" />
                    {formatParchment(state.pricesTenths[item])}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
