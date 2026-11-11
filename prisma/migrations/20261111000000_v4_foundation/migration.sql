-- v4.0.0 additive foundation. Existing personal books remain intact.
ALTER TABLE "Book" ADD COLUMN "openLibrarySubmissionEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "notification" TEXT NOT NULL,
    "deliveryDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushDelivery_userId_notification_deliveryDate_key" ON "PushDelivery"("userId", "notification", "deliveryDate");
CREATE INDEX "PushDelivery_deliveryDate_idx" ON "PushDelivery"("deliveryDate");
