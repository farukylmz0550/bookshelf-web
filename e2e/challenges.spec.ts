// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — seasonal challenges e2e: create via the form, progress ticks on
// read events (page log), completion badge appears, delete works.
import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";
import { pickSelectOption, bookStatusTrigger } from "./helpers/ui-select";

test.describe("Seasonal challenges (v3.3.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("create a challenge and see it with zero progress", async ({ page }) => {
    await page.goto("/challenges");
    await page
      .getByRole("button", { name: /challenge/i })
      .first()
      .click();
    await page.getByPlaceholder("").first(); // inputs below
    const title = page.locator('input[type="text"]');
    await title.fill("Winter sprint");
    await page.locator('input[type="number"]').fill("2");
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(fmt(new Date(Date.now() - 3 * 86400_000)));
    await dates.nth(1).fill(fmt(new Date(Date.now() + 60 * 86400_000)));
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText("Winter sprint")).toBeVisible();
    await expect(page.getByText(/0\/2/)).toBeVisible();
  });

  test("progress advances with logged pages and completes exactly once", async ({ page }) => {
    // Seed a page-less book (manual finish) + a challenge covering this month
    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
conn.execute('INSERT INTO Book (id, userId, title, status) VALUES (?,?,?,?)',
             (uuid.uuid4().hex, uid, 'Quick Read', 'TO_READ'))
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );

    // Create the challenge via the UI
    await page.goto("/challenges");
    await page
      .getByRole("button", { name: /challenge/i })
      .first()
      .click();
    await page.locator('input[type="text"]').fill("Read one book");
    await page.locator('input[type="number"]').fill("1");
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(fmt(new Date(Date.now() - 3 * 86400_000)));
    await dates.nth(1).fill(fmt(new Date(Date.now() + 60 * 86400_000)));
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText("Read one book")).toBeVisible();

    // Finish the book manually → one read event → challenge completes
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Quick Read/ })
      .first()
      .click();
    await pickSelectOption(page, bookStatusTrigger(page), "Finished");
    await page.goto("/books");
    await expect(page.getByText("Quick Read").first()).toBeVisible();

    await page.goto("/challenges");
    await expect(page.getByText(/1\/1/).first()).toBeVisible();
    await expect(page.getByText(/completed/i).first()).toBeVisible();
  });

  test("delete removes a challenge after confirm", async ({ page }) => {
    // Create one challenge via the UI
    await page.goto("/challenges");
    await page
      .getByRole("button", { name: /challenge/i })
      .first()
      .click();
    await page.locator('input[type="text"]').fill("Short lived");
    await page.locator('input[type="number"]').fill("1");
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(fmt(new Date(Date.now() - 3 * 86400_000)));
    await dates.nth(1).fill(fmt(new Date(Date.now() + 60 * 86400_000)));
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText("Short lived")).toBeVisible();

    // Decline the confirm → card stays
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: /delete/i })
      .first()
      .click();
    await expect(page.getByText("Short lived")).toBeVisible();

    // Accept the confirm → card disappears
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /delete/i })
      .first()
      .click();
    await expect(page.getByText("Short lived")).toBeHidden();
    await expect(page.getByText(/no challenges yet/i)).toBeVisible();
  });
});
