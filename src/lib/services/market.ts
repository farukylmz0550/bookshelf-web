// SPDX-License-Identifier: GPL-3.0-only
// Persistence adapter for the Rust-owned market rules in rust/reading_core.

import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import type { MarketItemType, MarketPowerType } from "@/generated/prisma/client";

export const MARKET_ITEMS: MarketItemType[] = [
  "STREAK_SHIELD",
  "PAGE_XP_BOOST",
  "FINISH_XP_BOOST",
  "CHALLENGE_EXTENSION",
];

const POWER_FOR_ITEM: Partial<Record<MarketItemType, MarketPowerType>> = {
  PAGE_XP_BOOST: "PAGE_XP",
  FINISH_XP_BOOST: "FINISH_XP",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors reading_core::parchment_tenths_for_pages; covered by Rust tests.
export function parchmentTenthsForPages(pages: number): number {
  return Math.max(0, Math.floor(pages)) * 5;
}

export function formatParchment(tenths: number): string {
  const value = Math.max(0, Math.floor(tenths)) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export async function pageXpMultiplierFor(userId: string, now = new Date()): Promise<number> {
  return powerMultiplierFor(userId, "PAGE_XP", now);
}

export async function finishXpMultiplierFor(userId: string, now = new Date()): Promise<number> {
  return powerMultiplierFor(userId, "FINISH_XP", now);
}

async function powerMultiplierFor(userId: string, type: MarketPowerType, now: Date): Promise<number> {
  const power = await db.activePower.findUnique({ where: { userId_type: { userId, type } }, select: { expiresAt: true } });
  return power && power.expiresAt.getTime() > now.getTime() ? 2 : 1;
}

export async function getMarketState(userId: string) {
  const now = new Date();
  const [user, inventory, powers, config, challenges] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { parchmentTenths: true, streakShieldPurchases: true } }),
    db.marketInventory.findMany({ where: { userId } }),
    db.activePower.findMany({ where: { userId, expiresAt: { gt: now } } }),
    getAppConfig(),
    db.challenge.findMany({
      where: { userId, completedAt: null, marketExtensionUsedAt: null, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { endAt: "asc" },
      select: { id: true, title: true, target: true, startAt: true, endAt: true },
    }),
  ]);
  if (!user) throw new Error("USER_NOT_FOUND");
  const counts = Object.fromEntries(MARKET_ITEMS.map((item) => [item, 0])) as Record<MarketItemType, number>;
  for (const row of inventory) counts[row.item] = row.quantity;
  const eligibleChallenges = [];
  for (const challenge of challenges) {
    const done = await db.bookReadEvent.count({
      where: { userId, readAt: { gte: challenge.startAt, lte: challenge.endAt } },
    });
    if (done < challenge.target) eligibleChallenges.push({ ...challenge, done });
  }
  return {
    serverNow: now.toISOString(),
    parchmentTenths: user.parchmentTenths,
    inventory: counts,
    powers: powers.map((power) => ({ type: power.type, expiresAt: power.expiresAt.toISOString() })),
    pricesTenths: {
      STREAK_SHIELD: Math.min(2_147_483_647, config.marketStreakShield * 10 * 2 ** Math.min(30, user.streakShieldPurchases)),
      PAGE_XP_BOOST: config.marketPageXpBoost * 10,
      FINISH_XP_BOOST: config.marketFinishXpBoost * 10,
      CHALLENGE_EXTENSION: config.marketChallengeExtension * 10,
    } satisfies Record<MarketItemType, number>,
    eligibleChallenges,
  };
}

export async function purchaseMarketItem(userId: string, item: MarketItemType) {
  if (!MARKET_ITEMS.includes(item)) throw new Error("INVALID_ITEM");
  const config = await getAppConfig();
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { streakShieldPurchases: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");
    const fixedPrices: Record<Exclude<MarketItemType, "STREAK_SHIELD">, number> = {
      PAGE_XP_BOOST: config.marketPageXpBoost,
      FINISH_XP_BOOST: config.marketFinishXpBoost,
      CHALLENGE_EXTENSION: config.marketChallengeExtension,
    };
    const cost = item === "STREAK_SHIELD"
      ? Math.min(2_147_483_647, config.marketStreakShield * 10 * 2 ** Math.min(30, user.streakShieldPurchases))
      : fixedPrices[item] * 10;
    const debited = await tx.user.updateMany({
      where: { id: userId, parchmentTenths: { gte: cost } },
      data: {
        parchmentTenths: { decrement: cost },
        ...(item === "STREAK_SHIELD"
          ? { streakShieldBalance: { increment: 1 }, streakShieldPurchases: { increment: 1 } }
          : {}),
      },
    });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_PARCHMENT");
    const inventory = await tx.marketInventory.upsert({
      where: { userId_item: { userId, item } },
      update: { quantity: { increment: 1 } },
      create: { userId, item, quantity: 1 },
    });
    await tx.marketPurchase.create({ data: { userId, item, priceTenths: cost } });
    return { purchased: true as const, costTenths: cost, quantity: inventory.quantity };
  });
}

export async function activateMarketPower(userId: string, item: MarketItemType, now = new Date()) {
  const type = POWER_FOR_ITEM[item];
  if (!type) throw new Error("NOT_A_POWER");
  const expiresAt = new Date(now.getTime() + DAY_MS);
  return db.$transaction(async (tx) => {
    const existing = await tx.activePower.findUnique({ where: { userId_type: { userId, type } } });
    if (existing && existing.expiresAt.getTime() > now.getTime()) throw new Error("POWER_ALREADY_ACTIVE");
    const inventory = await tx.marketInventory.updateMany({
      where: { userId, item, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (inventory.count !== 1) throw new Error("ITEM_NOT_OWNED");
    const power = await tx.activePower.upsert({
      where: { userId_type: { userId, type } },
      update: { activatedAt: now, expiresAt },
      create: { userId, type, activatedAt: now, expiresAt },
    });
    await tx.marketItemUse.create({ data: { userId, item } });
    return { activated: true as const, expiresAt: power.expiresAt };
  });
}

export async function applyChallengeExtension(userId: string, challengeId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const challenge = await tx.challenge.findFirst({
      where: {
        id: challengeId,
        userId,
        completedAt: null,
        marketExtensionUsedAt: null,
        startAt: { lte: now },
        endAt: { gte: now },
      },
    });
    if (!challenge) throw new Error("CHALLENGE_NOT_ELIGIBLE");
    const done = await tx.bookReadEvent.count({
      where: { userId, readAt: { gte: challenge.startAt, lte: challenge.endAt } },
    });
    if (done >= challenge.target) throw new Error("CHALLENGE_NOT_ELIGIBLE");
    const inventory = await tx.marketInventory.updateMany({
      where: { userId, item: "CHALLENGE_EXTENSION", quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (inventory.count !== 1) throw new Error("ITEM_NOT_OWNED");
    const extended = await tx.challenge.updateMany({
      where: { id: challengeId, userId, marketExtensionUsedAt: null },
      data: { endAt: new Date(challenge.endAt.getTime() + 3 * DAY_MS), marketExtensionUsedAt: now },
    });
    if (extended.count !== 1) throw new Error("CHALLENGE_NOT_ELIGIBLE");
    await tx.marketItemUse.create({ data: { userId, item: "CHALLENGE_EXTENSION", targetId: challengeId } });
    return { extended: true as const, endAt: new Date(challenge.endAt.getTime() + 3 * DAY_MS) };
  });
}
