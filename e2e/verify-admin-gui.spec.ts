// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { pickSelectOption, setBookStatusUI } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup } from "./helpers/auth";

test.describe("verify admin@admin.admin GUI", () => {
  test("login as existing admin and exercise core flows", async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, { name: "admin", email: "admin@admin.admin", password: "password123" });
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("admin@admin.admin");
    await page.getByPlaceholder("••••••••").fill("password123");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page).toHaveURL(/\/books/);
    await expect(page.locator("aside").getByText("admin").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-01-books.png", fullPage: true });

    await page.getByPlaceholder("Title").first().fill("Verify Book");
    await page.getByPlaceholder("Author").fill("Verify Author");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Verify Book").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-02-added.png", fullPage: true });

    await page.locator("a[href^='/books/']").first().click();
    await expect(page.getByRole("heading", { name: /facts/i })).toBeVisible();
    await page.getByRole("button", { name: /^edit$/i }).click();
    await page.getByLabel("Subtitle").fill("Verify Sub");
    await page
      .getByRole("button", { name: /^save$/i })
      .first()
      .click();
    await expect(page.getByText("Verify Sub")).toBeVisible();

    await page.goto("/books");
    await page.locator("a[href^='/books/']").first().click();
    await setBookStatusUI(page, "Finished");
    await page.screenshot({ path: "e2e/screenshots/verify-03-finished.png", fullPage: true });

    await page.goto("/lending");
    await pickSelectOption(page, page.getByRole("combobox", { name: "Book" }), { index: 0 });
    await page.getByPlaceholder("Name").fill("Verify Friend");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.getByText("Verify Friend")).toBeVisible();

    await page.goto("/people");
    await expect(page.getByText("Verify Friend")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-04-people.png", fullPage: true });

    await page.goto("/stats");
    await expect(page.getByText("Total books", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-05-stats.png", fullPage: true });

    await page.goto("/achievements");
    await expect(page.getByText("First Book", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-06-achievements.png", fullPage: true });

    await page.goto("/leaderboard");
    await expect(page.getByText("admin").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-07-leaderboard.png", fullPage: true });

    await page.goto("/admin/covers");
    await expect(page.getByRole("heading", { name: /cover cache/i })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/verify-08-admin.png", fullPage: true });
  });
});
