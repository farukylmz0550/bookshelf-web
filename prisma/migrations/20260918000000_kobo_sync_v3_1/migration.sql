-- v3.1.0 — Kobo sync delta state + device reading-time write-back.

-- Per-book sync state: metadata hash for ChangedEntitlement detection and
-- device archive tombstones (bookId is NOT a cascade FK so a cascaded book
-- delete leaves the tombstone alive for the next IsRemoved sync).
CREATE TABLE "KoboSyncedBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "metaHash" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KoboSyncedBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KoboSyncedBook_userId_bookId_key" ON "KoboSyncedBook"("userId", "bookId");
CREATE INDEX "KoboSyncedBook_userId_idx" ON "KoboSyncedBook"("userId");

-- Device-reported cumulative reading minutes (Kobo Statistics).
ALTER TABLE "Book" ADD COLUMN "koboSpentMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Book" ADD COLUMN "koboRemainingMinutes" INTEGER;

-- Per-day reading minutes derived from the device delta (stats "hours read").
ALTER TABLE "DailyActivity" ADD COLUMN "minutesRead" INTEGER NOT NULL DEFAULT 0;
