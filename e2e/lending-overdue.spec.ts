// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { pickSelectOption } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("lending due dates + overdue reminders", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("lending page: optional due date is stored and displayed as a badge (I: UI)", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Due Date Book");
    await page.getByPlaceholder("Author").first().fill("Author");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Due Date Book").first()).toBeVisible();

    await page.goto("/lending");
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const iso = future.toISOString().slice(0, 10);
    await pickSelectOption(page, page.getByRole("combobox", { name: "Book" }), { label: "Due Date Book" });
    await page.getByPlaceholder("Name").fill("Friend One");
    await page.locator('input[type="date"]').fill(iso);
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.locator('span.rounded-full:has-text("Due")').first()).toBeVisible();
  });

  test("overdue reminder endpoint rejects unauthenticated requests (I: cron-secret)", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/push/overdue-remind", { method: "POST" });
      return r.status;
    });
    // Dev server runs without CRON_SECRET → 503; with secret configured but wrong → 401
    expect([401, 503]).toContain(res);
  });

  test("streak endpoint still works alongside overdue endpoint", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/push/streak-remind", { method: "POST" });
      return r.status;
    });
    expect([401, 503]).toContain(res);
  });
});
