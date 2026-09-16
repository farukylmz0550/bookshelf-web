-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "descriptionKey" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE'
);
INSERT INTO "new_Achievement" ("descriptionKey", "iconKey", "id", "key", "titleKey") SELECT "descriptionKey", "iconKey", "id", "key", "titleKey" FROM "Achievement";
DROP TABLE "Achievement";
ALTER TABLE "new_Achievement" RENAME TO "Achievement";
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");
CREATE TABLE "new_UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserAchievement" ("achievementId", "id", "unlockedAt", "userId") SELECT "achievementId", "id", "unlockedAt", "userId" FROM "UserAchievement";
DROP TABLE "UserAchievement";
ALTER TABLE "new_UserAchievement" RENAME TO "UserAchievement";
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_periodKey_key" ON "UserAchievement"("userId", "achievementId", "periodKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
