-- v3.0.0 — config.yaml replaces the AppSettings table; Kobo eReader sync.

-- Site-wide reading/XP values moved to config.yaml (app-config loader).
DROP TABLE IF EXISTS "AppSettings";

-- Per-user Kobo sync token (one row per user, embedded in the device's
-- api_endpoint URL).
CREATE TABLE "KoboSyncToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KoboSyncToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KoboSyncToken_userId_key" ON "KoboSyncToken"("userId");
CREATE UNIQUE INDEX "KoboSyncToken_token_key" ON "KoboSyncToken"("token");

-- Per-user URL template the Kobo device downloads book files from.
ALTER TABLE "User" ADD COLUMN "fileSourceUrl" TEXT;
