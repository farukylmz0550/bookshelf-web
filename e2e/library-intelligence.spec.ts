// SPDX-License-Identifier: GPL-3.0-only
// v3.2.0 — Series/Authors views e2e: grouping pages render, series detail
// filters correctly, and the OPDS catalog root answers for the device token
// (same capability token as Kobo sync, public in the proxy middleware).
import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("Library intelligence (v3.2.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);

    // Seed a small library via the DB: two Dune books + one standalone.
    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
def add(title, author, series, isbn=None):
    conn.execute(
        'INSERT INTO Book (id, userId, title, author, series, status, isbn, addedAt) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',
        (uuid.uuid4().hex, uid, title, author, series, 'TO_READ', isbn))
add('Dune', 'Frank Herbert', 'Dune', '9780441013593')
add('Dune Messiah', 'Frank Herbert', 'Dune')
add('Standalone', None, None)
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );
  });

  test("series view groups books and links to the detail grid", async ({ page }) => {
    await page.goto("/series");
    await page.getByRole("link", { name: /Dune/ }).first().click();
    await expect(page.locator("h1", { hasText: "Dune" })).toBeVisible();
    await expect(page.getByText("Dune Messiah").first()).toBeVisible();
  });

  test("authors view lists the author and links to their page", async ({ page }) => {
    await page.goto("/authors");
    await expect(page.getByText("Frank Herbert")).toBeVisible();
    await page.getByText("Frank Herbert").first().click();
    await expect(page.getByText("Dune Messiah").first()).toBeVisible();
  });

  test("sidebar exposes Series and Authors entries", async ({ page }) => {
    await page.goto("/books");
    await expect(page.locator('a[href="/series"]')).toBeVisible();
    await expect(page.locator('a[href="/authors"]')).toBeVisible();
  });

  test("OPDS catalog answers the device token without a session", async ({ page }) => {
    // Create the sync token via Settings
    await page.goto("/settings");
    await page
      .getByRole("button", { name: /sync url/i })
      .first()
      .click();
    const code = page.locator("code", { hasText: "api_endpoint=" }).first();
    await expect(code).toBeVisible();
    const token = (await code.textContent())!.split("/api/kobo/")[1]!.trim();
    await expect(page.locator("code", { hasText: "/api/opds/" })).toBeVisible();

    const fresh = await page.context().browser()?.newContext();
    if (fresh) {
      const root = await fresh.request.get(`/api/opds/${token}/`);
      expect(root.status()).toBe(200);
      const xml = await root.text();
      expect(xml).toContain("opds-catalog");
      expect(xml).toContain("All books");
      expect(xml).toContain("/series/Dune"); // series nav entry href

      const all = await fresh.request.get(`/api/opds/${token}/all`);
      expect(all.status()).toBe(200);
      const allXml = await all.text();
      expect(allXml).toContain("Dune");
      expect(allXml).toContain('rel="http://opds-spec.org/acquisition"');
      await fresh.close();
    }
  });
});
