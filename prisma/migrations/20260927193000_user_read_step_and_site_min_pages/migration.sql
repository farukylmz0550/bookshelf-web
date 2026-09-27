-- v3.5.1 — user-adjustable "I read N pages" step + admin min-pages floor.

-- Per-user read-event page step. NULL = follow the site-wide
-- config.yaml pagesPerReadEvent. Clamped at runtime by the admin floor
-- (see src/lib/reading-settings.ts).
ALTER TABLE "UserSettings" ADD COLUMN "pagesPerReadEvent" INTEGER;

-- Site-wide admin-controlled values that the admin panel edits at runtime
-- (unlike the config.yaml AppConfig). Singleton row. 0 disables the floor.
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'site',
    "minPagesPerReadEvent" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "SiteSettings" ("id", "minPagesPerReadEvent") VALUES ('site', 0);
