// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { pickSelectOption, setBookStatusUI } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("Annual Summary (v2.7.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("summary section is gated by the window (always visible in dev/e2e)", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: /annual summary/i })).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("shows the no-reading-data empty state for a year without books", async ({ page }) => {
    await page.goto("/stats");
    // No read events — the featured year shows the empty state, not fake zeros.
    await expect(page.getByText(/no reading data for/i)).toBeVisible();
  });

  test("renders summary sections after completing a book", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Wrapped Book");
    await page.getByPlaceholder("Author").first().fill("Test Author");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Wrapped Book").first()).toBeVisible();

    // Page-less books: manual finish stays available → completion + read event
    await page.getByText("Wrapped Book").first().click();
    const finishPost = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/books/"), {
      timeout: 15000,
    });
    await setBookStatusUI(page, "Finished");
    await finishPost.catch(() => {});
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: /annual summary/i })).toBeVisible();
    await expect(page.getByText(/you read 1 book/i)).toBeVisible();
  });

  test("year selector switches between years", async ({ page }) => {
    await page.goto("/stats?year=2020");
    await expect(page.getByText(/no reading data for 2020/i)).toBeVisible();
    const select = page.getByRole("combobox");
    await expect(select).toBeVisible();
    await pickSelectOption(page, select, { label: String(new Date().getFullYear()) });
    await expect(page).toHaveURL(/year=\d+/);
  });
});

test.describe("Reading flow (v2.7.0)", () => {
  const admin = { name: "Admin2", email: "admin2@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("goal lock: forms lock after confirming, with lock hint", async ({ page }) => {
    await page.goto("/stats");
    await page.locator('form input[type="number"]').first().fill("5");
    await page.locator('form input[type="number"]').nth(1).fill("2");
    await page.getByRole("button", { name: /confirm goals/i }).click();
    // Locked cards replace the form
    await expect(page.getByText(/goals are set once per year/i)).toBeVisible();
    await expect(page.locator('form input[type="number"]')).toHaveCount(0);
  });

  test("books page shows the page-log button on READING books and logs pages", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Streak Book");
    await page.getByPlaceholder("Author").first().fill("Auth");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Streak Book").first()).toBeVisible();

    // Start reading via the book detail status select
    await page.getByText("Streak Book").first().click();
    const readPost = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/books/"), {
      timeout: 15000,
    });
    await setBookStatusUI(page, "Reading");
    await readPost.catch(() => {});
    await page.goto("/books");
    // v2.11.0 — the header CTA + the card button both exist; use the header one
    const button = page.locator('button:has-text("Read 20 pages")').first();
    await expect(button).toBeVisible();
    // v2.9.6 — page-less books ask for the page count first; the count is
    // saved and the reading is logged in the same step.
    await button.click();
    await page.getByPlaceholder(/e\.g\. 352/i).fill("100");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/20 pages logged/i)).toBeVisible();
  });
});
