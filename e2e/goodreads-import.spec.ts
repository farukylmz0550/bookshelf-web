// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Page } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

function goodreadsCsv(title: string, isbn13: string) {
  return `Book Id,Title,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Private Notes,My Review,Spoiler,Owned Copies
1,${title},Test Author,,"=""0439064864""","=""${isbn13}""",5,4.2,Publisher,Paperback,300,2001,2001,2024/03/15,2024/01/01,read,book #1,private note,no,1`;
}

/**
 * Set the Goodreads CSV file and wait for the server action response.
 * If the change event lands before React hydration, no request happens — retry.
 * The response (not just the request) is awaited: enrichment can take seconds.
 */
async function importCsv(page: Page, buffer: Buffer, filename = "goodreads.csv") {
  const input = page.locator('input[type="file"][accept=".csv,text/csv"]');
  await expect(async () => {
    const post = page.waitForEvent("response", {
      predicate: (r) => r.request().method() === "POST" && r.url().includes("/books"),
      timeout: 45_000,
    });
    await input.setInputFiles({ name: filename, mimeType: "text/csv", buffer });
    await post;
  }).toPass({ timeout: 90_000 });
}

test.describe("Goodreads CSV import", () => {
  // Open Library enrichment can take ~30s when OL rate-limits (3 attempts × 10s timeout).
  test.setTimeout(120_000);
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("imports a valid Goodreads CSV and shows the summary (A, O)", async ({ page }) => {
    await page.goto("/books");
    await importCsv(page, Buffer.from(goodreadsCsv("Imported Book One", "9780439708180"), "utf8"));
    await expect(page.getByText(/import complete/i)).toBeVisible();
    // The grid refreshes via revalidatePath — imported book appears.
    await expect(page.getByText("Imported Book One").first()).toBeVisible();
  });

  test("skips a book that already exists in the user's library (J: duplicate)", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("ISBN").first().fill("9780439708180");
    await page.getByPlaceholder("Title").first().fill("Duplicate Book");
    await page.getByPlaceholder("Author").first().fill("Auth");
    await expect(page.getByRole("button", { name: /^add$/i })).toBeEnabled();
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Duplicate Book").first()).toBeVisible();

    // Import the same ISBN via Goodreads CSV — must be skipped, not duplicated.
    await importCsv(page, Buffer.from(goodreadsCsv("Duplicate Book", "9780439708180"), "utf8"));
    await expect(page.locator('span:has-text("Duplicates skipped 1")')).toBeVisible();
  });

  test("rejects an invalid Goodreads CSV with an actionable message (M)", async ({ page }) => {
    await page.goto("/books");
    await importCsv(page, Buffer.from(`Foo,Bar\n1,2\n`, "utf8"), "broken.csv");
    await expect(page.getByText(/invalid csv/i)).toBeVisible();
  });

  test("existing Excel import still works (regression)", async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("button", { name: /template/i })).toBeVisible();
    await expect(page.getByText(/import csv/i)).toBeVisible();
  });
});
