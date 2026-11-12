-- Parchment market: exact half-unit page rewards, durable inventory and powers.
ALTER TABLE "User" ADD COLUMN "parchmentTenths" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Challenge" ADD COLUMN "marketExtensionUsedAt" DATETIME;

CREATE TABLE "MarketInventory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MarketInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MarketInventory_userId_item_key" ON "MarketInventory"("userId", "item");
CREATE INDEX "MarketInventory_userId_idx" ON "MarketInventory"("userId");
INSERT INTO "MarketInventory" ("id", "userId", "item", "quantity", "updatedAt")
SELECT lower(hex(randomblob(12))), "id", 'STREAK_SHIELD', "streakShieldBalance", CURRENT_TIMESTAMP
FROM "User" WHERE "streakShieldBalance" > 0;

CREATE TABLE "MarketPurchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "priceTenths" INTEGER NOT NULL,
  "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MarketPurchase_userId_item_purchasedAt_idx" ON "MarketPurchase"("userId", "item", "purchasedAt");

CREATE TABLE "ActivePower" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "ActivePower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ActivePower_userId_type_key" ON "ActivePower"("userId", "type");
CREATE INDEX "ActivePower_userId_expiresAt_idx" ON "ActivePower"("userId", "expiresAt");

CREATE TABLE "MarketItemUse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "targetId" TEXT,
  "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketItemUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MarketItemUse_userId_item_usedAt_idx" ON "MarketItemUse"("userId", "item", "usedAt");
CREATE INDEX "MarketItemUse_targetId_idx" ON "MarketItemUse"("targetId");
