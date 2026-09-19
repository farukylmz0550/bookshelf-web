// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — book quotes e2e: add, edit, confirm-guarded delete on the book
// detail page.
import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("Book quotes (v3.4.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);

    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
conn.execute('INSERT INTO Book (id, userId, title, status) VALUES (?,?,?,?)',
             (uuid.uuid4().hex, uid, 'Quote Book', 'READING'))
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Quote Book/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /quotes/i })).toBeVisible();
  });

  /** Fresh navigation to the Quote Book detail page (avoids stale URLs). */
  async function openQuoteBook(page: import("@playwright/test").Page) {
    await page.goto("/books");
    await page
      .getByRole("link", { name: /Quote Book/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /quotes/i })).toBeVisible();
  }

  test("empty state, add and display a quote", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /quotes/i })).toBeVisible();
    await expect(page.getByText(/no quotes yet/i)).toBeVisible();

    await page.getByRole("button", { name: /^add$/i }).first().click();
    await page.getByPlaceholder(/quote text/i).fill("So we beat on, boats against the current.");
    await page.getByPlaceholder(/page/i).fill("180");
    await page.getByRole("button", { name: /^add$/i }).last().click();

    await expect(page.getByText(/quote added/i)).toBeVisible();
    await expect(page.getByText(/boats against the current/i)).toBeVisible();
    await expect(page.getByText(/p\. 180/)).toBeVisible();
  });

  test("edit updates the quote text in place", async ({ page }) => {
    // Seed directly, then reload to see it listed
    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
bid = conn.execute(\\"SELECT id FROM Book WHERE title='Quote Book' LIMIT 1\\").fetchone()[0]
conn.execute('INSERT INTO Quote (id, userId, bookId, bookTitle, text) VALUES (?,?,?,?,?)',
             (uuid.uuid4().hex, uid, bid, 'Quote Book', 'Original text'))
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );
    await openQuoteBook(page);
    await expect(page.getByText(/Original text/).first()).toBeVisible();

    await page
      .locator("li")
      .getByRole("button", { name: /^edit$/i })
      .first()
      .click();
    await page.locator("li textarea").first().fill("Edited passage");
    await page
      .locator("li")
      .getByRole("button", { name: /^save$/i })
      .first()
      .click();
    await expect(page.getByText(/quote updated/i)).toBeVisible();
    await expect(page.getByText(/Edited passage/)).toBeVisible();
  });

  test("delete works after confirm", async ({ page }) => {
    await page.getByRole("button", { name: /^add$/i }).first().click();
    await page.getByPlaceholder(/quote text/i).fill("To be deleted");
    await page.getByRole("button", { name: /^add$/i }).last().click();
    await expect(page.getByText(/quote added/i)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /^delete$/i })
      .first()
      .click();
    await expect(page.getByText(/quote deleted/i)).toBeVisible();
    await expect(page.getByText(/no quotes yet/i)).toBeVisible();
  });
});
