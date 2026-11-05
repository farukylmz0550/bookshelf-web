CREATE TABLE "OpenLibrarySubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpenLibrarySubmission_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OpenLibrarySubmission_bookId_key" ON "OpenLibrarySubmission"("bookId");
CREATE INDEX "OpenLibrarySubmission_status_createdAt_idx" ON "OpenLibrarySubmission"("status", "createdAt");
