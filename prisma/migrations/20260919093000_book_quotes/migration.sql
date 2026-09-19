-- v3.4.0 — user-added quotes/excerpts attached to a book (optional page ref).

CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "bookTitle" TEXT,
    "text" TEXT NOT NULL,
    "page" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Quote_userId_createdAt_idx" ON "Quote"("userId", "createdAt");
CREATE INDEX "Quote_bookId_idx" ON "Quote"("bookId");
