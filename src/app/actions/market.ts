// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import type { MarketItemType } from "@/generated/prisma/client";
import { requireUserId } from "@/lib/session";
import { activateMarketPower, applyChallengeExtension, purchaseMarketItem } from "@/lib/services/market";

function refreshMarket() {
  revalidatePath("/market");
  revalidatePath("/stats");
  revalidatePath("/challenges");
}

export async function buyMarketItem(item: MarketItemType) {
  try {
    const result = await purchaseMarketItem(await requireUserId(), item);
    refreshMarket();
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "PURCHASE_FAILED" };
  }
}

export async function activatePower(item: MarketItemType) {
  try {
    const result = await activateMarketPower(await requireUserId(), item);
    refreshMarket();
    return { ok: true as const, expiresAt: result.expiresAt.toISOString() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "ACTIVATION_FAILED" };
  }
}

export async function extendChallenge(challengeId: string) {
  try {
    const result = await applyChallengeExtension(await requireUserId(), challengeId);
    refreshMarket();
    return { ok: true as const, endAt: result.endAt.toISOString() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "EXTENSION_FAILED" };
  }
}
