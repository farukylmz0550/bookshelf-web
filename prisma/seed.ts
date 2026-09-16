// SPDX-License-Identifier: GPL-3.0-only
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { ACHIEVEMENT_RULES } from "../src/lib/gamification";

const dbUrl = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^"|"$/g, "");
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const db = new PrismaClient({ adapter });

async function main() {
  for (const rule of ACHIEVEMENT_RULES) {
    await db.achievement.upsert({
      where: { key: rule.key },
      update: {},
      create: {
        key: rule.key,
        titleKey: `${rule.key}_title`,
        descriptionKey: `${rule.key}_desc`,
        iconKey: rule.key,
        recurrence: rule.recurrence === "MONTHLY" ? "MONTHLY" : "NONE",
      },
    });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
