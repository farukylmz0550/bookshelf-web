-- CreateTable
CREATE TABLE "QrLoginSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "scannedAt" DATETIME,
    "confirmedAt" DATETIME,
    CONSTRAINT "QrLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QrLoginSession_tokenHash_key" ON "QrLoginSession"("tokenHash");

-- CreateIndex
CREATE INDEX "QrLoginSession_userId_idx" ON "QrLoginSession"("userId");
