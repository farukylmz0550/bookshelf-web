-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'USER',
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'USER',
    "manifest" TEXT NOT NULL,
    "installPath" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultTheme" BOOLEAN NOT NULL DEFAULT false,
    "installedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtensionUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extensionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtensionUser_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtensionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtensionStorage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extensionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtensionStorage_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtensionStorage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Extension_slug_key" ON "Extension"("slug");

-- CreateIndex
CREATE INDEX "Extension_type_scope_idx" ON "Extension"("type", "scope");

-- CreateIndex
CREATE INDEX "ExtensionUser_userId_idx" ON "ExtensionUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionUser_extensionId_userId_key" ON "ExtensionUser"("extensionId", "userId");

-- CreateIndex
CREATE INDEX "ExtensionStorage_userId_idx" ON "ExtensionStorage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionStorage_extensionId_userId_key_key" ON "ExtensionStorage"("extensionId", "userId", "key");
