-- v3.18.0 — physical locations and copy-level placement.
-- Existing Book.copies values are preserved and expanded into idempotent copy rows.

CREATE TABLE "LibraryLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LibraryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BookCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "copyNumber" INTEGER NOT NULL,
    "barcode" TEXT,
    "locationId" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    CONSTRAINT "BookCopy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookCopy_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LibraryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LibraryLocation_userId_parentId_name_key" ON "LibraryLocation"("userId", "parentId", "name");
CREATE INDEX "LibraryLocation_userId_parentId_idx" ON "LibraryLocation"("userId", "parentId");
CREATE INDEX "LibraryLocation_userId_archivedAt_idx" ON "LibraryLocation"("userId", "archivedAt");
CREATE UNIQUE INDEX "BookCopy_userId_bookId_copyNumber_key" ON "BookCopy"("userId", "bookId", "copyNumber");
CREATE UNIQUE INDEX "BookCopy_userId_barcode_key" ON "BookCopy"("userId", "barcode");
CREATE INDEX "BookCopy_userId_bookId_idx" ON "BookCopy"("userId", "bookId");
CREATE INDEX "BookCopy_userId_locationId_idx" ON "BookCopy"("userId", "locationId");
CREATE INDEX "BookCopy_userId_barcode_idx" ON "BookCopy"("userId", "barcode");

WITH RECURSIVE numbers(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 999
)
INSERT INTO "BookCopy" ("id", "userId", "bookId", "copyNumber", "condition", "createdAt")
SELECT lower(hex(randomblob(16))), b."userId", b."id", numbers.n, 'GOOD', CURRENT_TIMESTAMP
FROM "Book" b
JOIN numbers ON numbers.n <= CASE WHEN b."copies" >= 1 THEN b."copies" ELSE 1 END
WHERE NOT EXISTS (
    SELECT 1 FROM "BookCopy" existing
    WHERE existing."userId" = b."userId" AND existing."bookId" = b."id"
);
