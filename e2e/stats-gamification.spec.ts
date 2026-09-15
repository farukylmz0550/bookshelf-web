// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { setBookStatusUI } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login, dismissCookieConsent, clickSetting } from "./helpers/auth";

test.describe("stats / gamification / achievements / leaderboard / excel / i18n / theme", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("stats page shows level/xp and goal progress", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Stats Book");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Stats Book", { exact: true }).first()).toBeVisible();

    await page.goto("/stats");
    await expect(page.getByText("Level", { exact: true })).toBeVisible();

    // v2.7.0 — goals are confirmed once and then locked for the year
    await page.locator('form input[type="number"]').first().fill("10");
    await page.getByRole("button", { name: /confirm goals/i }).click();
    await expect(page.locator('form input[type="number"]')).toHaveCount(0);
    await expect(page.locator("p.text-lg.font-semibold.tabular-nums", { hasText: "10" }).first()).toBeVisible();

    await page.goto("/books");
    await page.locator("a[href^='/books/']").first().click();
    await setBookStatusUI(page, "Finished");
    await page.goto("/stats");
    await expect(page.getByText("Finished", { exact: true })).toBeVisible();
  });

  test("achievements unlock", async ({ page }) => {
    await page.goto("/achievements");
    await expect(page.getByText("First Book", { exact: true })).toBeVisible();

    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Ach Book 1");
    await page.getByPlaceholder("Author").fill("Author A");
    await page.getByRole("button", { name: /^add$/i }).click();
    await page.goto("/achievements");
    await expect(page.getByText("First Book").first()).toBeVisible();

    await page.goto("/books");
    await page.locator("a[href^='/books/']").first().click();
    await setBookStatusUI(page, "Finished");
    await page.goto("/achievements");
    await expect(page.getByText("Bookworm Beginnings")).toBeVisible();

    await page.goto("/lending");
    await page.getByPlaceholder("Name").fill("Test Friend");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await page.goto("/achievements");
    await expect(page.getByText("Generous Reader")).toBeVisible();
  });

  test("leaderboard shows self highlighted", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByText("Admin").first()).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  });

  test("i18n locale switch", async ({ page }) => {
    await page.goto("/settings");
    await dismissCookieConsent(page);
    // Language switching lives in Settings (Settings-only design)
    await clickSetting(page, /Türkçe/i);
    await page.goto("/books");
    await expect(page.getByText("Kitaplar").first()).toBeVisible();
  });

  test("theme toggle dark/light", async ({ page }) => {
    await page.goto("/settings");
    await dismissCookieConsent(page);
    const html = page.locator("html");
    await clickSetting(page, "Dark");
    await expect.poll(async () => await html.getAttribute("class")).toContain("dark");
  });

  test("excel: template download, export", async ({ page }) => {
    await page.goto("/books");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^template$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("isbn_list.xlsx");

    await page.getByPlaceholder("Title").first().fill("Excel Book");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Excel Book", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /^export$/i }).click();
    await expect(page.getByRole("button", { name: /^export$/i })).toBeVisible();
  });

  test("admin covers page requires admin", async ({ page }) => {
    await page.goto("/admin/covers");
    await expect(page.getByRole("heading", { name: /cover cache/i })).toBeVisible();
  });

  test("non-admin cannot access admin covers", async ({ page }) => {
    await page.goto("/register");
    await dismissCookieConsent(page);
    await page.getByPlaceholder("Name").fill("Normal");
    await page.getByPlaceholder("you@example.com").fill("normal@bookshelf.test");
    await page.getByPlaceholder("Min 8 characters").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/registration successful/i)).toBeVisible();
    // Approve the pending user as admin before first login
    await login(page, admin.email, admin.password);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Approve" }).first().click();
    await page.getByRole("button", { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, "normal@bookshelf.test", "password123");
    await page.goto("/admin/covers");
    // Non-admins are redirected away from admin pages
    await expect(page).toHaveURL(/\/books/);
  });
});
