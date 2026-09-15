-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookGroup" ("color", "createdAt", "id", "name", "order", "userId") SELECT "color", "createdAt", "id", "name", "order", "userId" FROM "BookGroup";
DROP TABLE "BookGroup";
ALTER TABLE "new_BookGroup" RENAME TO "BookGroup";
CREATE INDEX "BookGroup_userId_idx" ON "BookGroup"("userId");
CREATE UNIQUE INDEX "BookGroup_userId_name_key" ON "BookGroup"("userId", "name");
CREATE TABLE "new_BookGroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookGroupMembership_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BookGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookGroupMembership" ("addedAt", "bookId", "groupId", "id") SELECT "addedAt", "bookId", "groupId", "id" FROM "BookGroupMembership";
DROP TABLE "BookGroupMembership";
ALTER TABLE "new_BookGroupMembership" RENAME TO "BookGroupMembership";
CREATE INDEX "BookGroupMembership_bookId_idx" ON "BookGroupMembership"("bookId");
CREATE INDEX "BookGroupMembership_groupId_idx" ON "BookGroupMembership"("groupId");
CREATE UNIQUE INDEX "BookGroupMembership_bookId_groupId_key" ON "BookGroupMembership"("bookId", "groupId");
CREATE TABLE "new_BookReadEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "bookTitle" TEXT,
    "pagesRead" INTEGER,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookReadEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookReadEvent_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookReadEvent" ("bookId", "bookTitle", "id", "pagesRead", "readAt", "userId") SELECT "bookId", "bookTitle", "id", "pagesRead", "readAt", "userId" FROM "BookReadEvent";
DROP TABLE "BookReadEvent";
ALTER TABLE "new_BookReadEvent" RENAME TO "BookReadEvent";
CREATE INDEX "BookReadEvent_userId_readAt_idx" ON "BookReadEvent"("userId", "readAt");
CREATE INDEX "BookReadEvent_bookId_idx" ON "BookReadEvent"("bookId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATETIME,
    "streakShieldCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("approved", "createdAt", "currentStreak", "email", "id", "isAdmin", "lastActiveDate", "longestStreak", "name", "passwordHash", "showOnLeaderboard", "streakShieldCount", "xp") SELECT "approved", "createdAt", "currentStreak", "email", "id", "isAdmin", "lastActiveDate", "longestStreak", "name", "passwordHash", "showOnLeaderboard", "streakShieldCount", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_id_idx" ON "User"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");
