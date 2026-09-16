/* eslint-disable @typescript-eslint/no-require-imports */
// SPDX-License-Identifier: GPL-3.0-only
// @ts-check
// Documented exception to CONTRIBUTING.md "TypeScript everywhere" — see CONTRIBUTING.md
// Plain-JS Docker fallback for prisma/seed.ts (TS source of truth). tsx is dev-only, so production
// image runs this file with plain node + better-sqlite3. Keep ACHIEVEMENTS in sync with seed.ts / gamification.ts.
// v2.11.0 — recurrence: "NONE" = permanent, "MONTHLY" = re-earnable each month.
// The entrypoint seeds on every boot; existing rows are never modified.
const Database = require("better-sqlite3");

function cuid() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "c";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

const ACHIEVEMENTS = [
  { key: "first_book", recurrence: "NONE" },
  { key: "first_finish", recurrence: "NONE" },
  { key: "ten_finished", recurrence: "NONE" },
  { key: "books_25", recurrence: "NONE" },
  { key: "books_50", recurrence: "NONE" },
  { key: "books_100", recurrence: "NONE" },
  { key: "pages_1000", recurrence: "NONE" },
  { key: "pages_5000", recurrence: "NONE" },
  { key: "pages_10000", recurrence: "NONE" },
  { key: "first_lending", recurrence: "NONE" },
  { key: "five_authors", recurrence: "NONE" },
  { key: "first_shelf", recurrence: "NONE" },
  { key: "first_goal", recurrence: "NONE" },
  { key: "week_streak", recurrence: "NONE" },
  { key: "month_streak", recurrence: "NONE" },
  { key: "century_streak", recurrence: "NONE" },
  { key: "monthly_reader", recurrence: "MONTHLY" },
  { key: "monthly_bookworm", recurrence: "MONTHLY" },
  { key: "monthly_page_turner", recurrence: "MONTHLY" },
  { key: "monthly_regular_reader", recurrence: "MONTHLY" },
  { key: "monthly_goal", recurrence: "MONTHLY" },
];

const dbUrl = (process.env.DATABASE_URL || "file:./prisma/dev.db").replace(/^file:/, "").replace(/^"|"$/g, "");
const db = new Database(dbUrl);
db.pragma("journal_mode = WAL");

for (const a of ACHIEVEMENTS) {
  const existing = db.prepare("SELECT id FROM Achievement WHERE key = ?").get(a.key);
  if (!existing) {
    db.prepare(
      "INSERT INTO Achievement (id, key, titleKey, descriptionKey, iconKey, recurrence) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(cuid(), a.key, `${a.key}_title`, `${a.key}_desc`, a.key, a.recurrence);
    console.log("Created achievement: " + a.key);
  } else {
    console.log("Achievement already exists: " + a.key);
  }
}

db.close();
console.log("Seeding complete.");
