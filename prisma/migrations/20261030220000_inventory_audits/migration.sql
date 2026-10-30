-- v3.21.0 — physical inventory audits are immutable after completion.
CREATE TABLE "InventoryAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "scopeLocationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryAudit_scopeLocationId_fkey" FOREIGN KEY ("scopeLocationId") REFERENCES "LibraryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "InventoryAuditItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auditId" TEXT NOT NULL,
  "copyId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'EXPECTED',
  "scannedAt" DATETIME,
  "source" TEXT,
  "note" TEXT,
  CONSTRAINT "InventoryAuditItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryAuditItem_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryAuditItem_auditId_copyId_key" ON "InventoryAuditItem"("auditId", "copyId");
CREATE INDEX "InventoryAudit_userId_status_idx" ON "InventoryAudit"("userId", "status");
CREATE INDEX "InventoryAudit_userId_scopeLocationId_idx" ON "InventoryAudit"("userId", "scopeLocationId");
CREATE INDEX "InventoryAuditItem_auditId_state_idx" ON "InventoryAuditItem"("auditId", "state");
CREATE INDEX "InventoryAuditItem_copyId_idx" ON "InventoryAuditItem"("copyId");
