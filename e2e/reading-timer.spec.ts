// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — in-app reading timer e2e: timer on a READING book records whole
// minutes into DailyActivity (clock fast-forward), survives nothing special —
// plain start/stop through the UI.
import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";
import { setBookStatusUI } from "./helpers/ui-select";

test.describe("Reading timer (v3.4.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  async function seedBook(title: string) {
    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
conn.execute('INSERT INTO Book (id, userId, title, status) VALUES (?,?,?,?)',
             (uuid.uuid4().hex, uid, '${title}', 'TO_READ'))
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );
  }

  test("timer appears on a READING book and records minutes", async ({ page }) => {
    await seedBook("Timer Read");
    // Clock must be installed before load so the 1s interval ticks fast-forward
    await page.clock.install();
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Timer Read/ })
      .first()
      .click();

    // Not yet READING → no timer section
    await expect(page.getByText(/reading timer/i)).toHaveCount(0);

    await setBookStatusUI(page, "Reading");
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Timer Read/ })
      .first()
      .click();
    await expect(page.getByText(/reading timer/i)).toBeVisible();

    // Fast-forward ~11 minutes with the clock while the session runs
    await page.getByRole("button", { name: /^start$/i }).click();
    await page.clock.runFor("11:00");
    await page.getByRole("button", { name: /^stop$/i }).click();

    // Flush toast reports the recorded minutes
    await expect(page.getByText(/min recorded/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("start/pause keeps the timer on screen; nothing recorded under a minute", async ({ page }) => {
    await seedBook("Short Session");
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Short Session/ })
      .first()
      .click();
    await setBookStatusUI(page, "Reading");
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Short Session/ })
      .first()
      .click();

    await page.getByRole("button", { name: /^start$/i }).click();
    await expect(page.locator("text=/^[0-9]+:[0-9]{2}$/").first()).toBeVisible();
    // Let at least one interval tick pass so the paused session keeps a remainder
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: /^pause$/i }).click();
    await expect(page.getByRole("button", { name: /^resume$/i })).toBeVisible();
    await page.getByRole("button", { name: /^stop$/i }).click();
    await expect(page.getByText(/nothing recorded/i)).toBeVisible();
  });
});
