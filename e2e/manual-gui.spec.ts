// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { pickSelectOption } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { dismissCookieConsent, clickSetting } from "./helpers/auth";

test.describe("manual GUI", () => {
  test("full flow: setup → books → lending → people → stats → achievements → leaderboard → admin → i18n/theme", async ({
    page,
  }) => {
    test.setTimeout(120000); // long end-to-end flow with screenshots
    await resetDb(page);
    await page.goto("/");
    await dismissCookieConsent(page);
    await expect(page).toHaveURL(/\/setup/);
    await page.getByPlaceholder("Name").fill("ManualAdmin");
    await page.getByPlaceholder("you@example.com").fill("manual@bookshelf.test");
    await page.getByPlaceholder("Min 8 characters").fill("password123");
    await page.getByRole("button", { name: /create admin account/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: "e2e/screenshots/01-setup-login.png", fullPage: true });

    await page.getByPlaceholder("you@example.com").fill("manual@bookshelf.test");
    await page.getByPlaceholder("••••••••").fill("password123");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page).toHaveURL(/\/books/);
    await expect(page.locator("aside").getByText("ManualAdmin").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/02-books-empty.png", fullPage: true });

    await page.getByPlaceholder("Title").first().fill("Manual Book One");
    await page.getByPlaceholder("Author").fill("Author One");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Manual Book One").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/03-book-added.png", fullPage: true });

    await page.getByPlaceholder("Title").first().fill("History of Time");
    await page.getByPlaceholder("Author").fill("Stephen Hawking");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("History of Time").first()).toBeVisible();
    await page.getByPlaceholder("Search...").fill("History");
    await expect(page.getByText("History of Time").first()).toBeVisible();
    await expect(page.getByText("Manual Book One").first()).toBeHidden();
    await page.getByPlaceholder("Search...").fill("");
    await page.screenshot({ path: "e2e/screenshots/04-filter.png", fullPage: true });

    await page.locator("a[href^='/books/']").first().click();
    await expect(page.getByRole("heading", { name: /facts/i })).toBeVisible();
    await page.getByRole("button", { name: /^edit$/i }).click();
    await page.getByLabel("Subtitle").fill("A Brief History");
    await page
      .getByRole("button", { name: /^save$/i })
      .first()
      .click();
    await expect(page.getByText("A Brief History")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/05-book-detail.png", fullPage: true });

    await page.goto("/lending");
    await pickSelectOption(page, page.getByRole("combobox", { name: "Book" }), { index: 0 });
    await page.getByPlaceholder("Name").fill("Test Friend");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.getByText("Test Friend")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/06-lending.png", fullPage: true });

    await page.goto("/people");
    await expect(page.getByText("Test Friend")).toBeVisible();
    await page.getByPlaceholder("Person name").fill("New Person");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("New Person")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/07-people.png", fullPage: true });

    await page.goto("/stats");
    await expect(page.getByText("Total books", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/08-stats.png", fullPage: true });

    await page.goto("/achievements");
    await expect(page.getByText("First Book", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/09-achievements.png", fullPage: true });

    await page.goto("/leaderboard");
    await expect(page.getByText("ManualAdmin").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/10-leaderboard.png", fullPage: true });

    await page.goto("/admin/covers");
    await expect(page.getByRole("heading", { name: /cover cache/i })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/11-admin.png", fullPage: true });

    await page.goto("/settings");
    // Theme & locale live in Settings (Settings-only design); wait for each action
    await clickSetting(page, /Türkçe/i);
    await clickSetting(page, "Dark");
    await page.screenshot({ path: "e2e/screenshots/12-i18n-theme.png", fullPage: true });
    // Switch back to English so the Excel step matches EN labels
    await clickSetting(page, /^English/);

    await page.goto("/books");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^template$/i }).click(),
    ]);
    expect(dl.suggestedFilename()).toBe("isbn_list.xlsx");
  });
});
