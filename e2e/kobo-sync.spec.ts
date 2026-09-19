// SPDX-License-Identifier: GPL-3.0-only
// v3.0.0 — Kobo sync e2e: the Settings → Kobo Sync card produces a device
// api_endpoint URL whose endpoints answer WITHOUT a NextAuth session (the
// device cannot hold one) — path-token auth, public in the proxy middleware.
import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("Kobo sync (v3.0.0)", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
  });

  test("settings exposes the Kobo card and creates a sync URL", async ({ page }) => {
    await page.goto("/settings");
    const create = page.getByRole("button", { name: /sync url/i }).first();
    await expect(create).toBeVisible();
    await create.click();
    await expect(page.getByText(/api_endpoint=/i)).toBeVisible();
  });

  test("device endpoints answer without a session and reject bad tokens", async ({ page }) => {
    // Path-token auth: wrong token is 401 even without any session.
    const bad = await page.request.get("/api/kobo/not-a-real-token/v1/library/sync");
    expect(bad.status()).toBe(401);

    // Create the URL in the UI, extract the token, then act as the device
    // from a fresh (cookie-less) browser context — exactly what the device is.
    await page.goto("/settings");
    await page
      .getByRole("button", { name: /sync url/i })
      .first()
      .click();
    const code = page.locator("code", { hasText: "api_endpoint=" }).first();
    await expect(code).toBeVisible();
    const text = await code.textContent();
    expect(text).toMatch(/api_endpoint=(\S+)/);
    const token = text!.split("/api/kobo/")[1]!.trim();

    const device = await page.context().browser()?.newContext();
    if (device) {
      const res = await device.request.get(`/api/kobo/${token}/v1/library/sync`);
      expect(res.status()).toBe(200);
      const auth = await (
        await device.request.post(`/api/kobo/${token}/v1/auth/device`, { data: { UserKey: "" } })
      ).json();
      expect((auth as { TokenType?: string }).TokenType).toBe("Bearer");
      await device.close();
    }
  });

  test("kepub downloads are rejected while kepubify is disabled (default)", async ({ page }) => {
    // Seed a book with an ISBN + a per-user fileSourceUrl directly
    const { execSync } = await import("node:child_process");
    execSync(
      `python3 -c "
import sqlite3, uuid
conn = sqlite3.connect('prisma/dev.db')
uid = conn.execute('SELECT id FROM User LIMIT 1').fetchone()[0]
bid = uuid.uuid4().hex
conn.execute('INSERT INTO Book (id, userId, title, status, isbn) VALUES (?,?,?,?,?)',
             (bid, uid, 'Kepub Book', 'READING', '9780142437239'))
conn.execute(\\"UPDATE User SET fileSourceUrl='https://books.example/{isbn}.epub' WHERE id=?\\", (uid,))
conn.commit(); conn.close()"`,
      { stdio: "ignore" },
    );

    // Create the device token and act without a session
    await page.goto("/settings");
    await page
      .getByRole("button", { name: /sync url/i })
      .first()
      .click();
    const code = page.locator("code", { hasText: "api_endpoint=" }).first();
    await expect(code).toBeVisible();
    const token = (await code.textContent())!.split("/api/kobo/")[1]!.trim();

    const device = await page.context().browser()?.newContext();
    if (device) {
      // Sync metadata: no KEPUB entry in DownloadUrls while disabled
      const sync = (await device.request.get(`/api/kobo/${token}/v1/library/sync`)) as {
        status: () => number;
        json: () => Promise<unknown>;
      };
      expect(sync.status()).toBe(200);
      const body = (await sync.json()) as Array<{
        NewEntitlement?: {
          BookEntitlement?: { Id?: string };
          BookMetadata?: { DownloadUrls?: Array<{ Format?: string }> };
        };
      }>;
      const urls = body?.[0]?.NewEntitlement?.BookMetadata?.DownloadUrls ?? [];
      expect(urls.map((u) => u.Format)).toEqual(["EPUB"]);

      // Direct kepub download → 404 (graceful, feature off)
      const bookId = body?.[0]?.NewEntitlement?.BookEntitlement?.Id;
      const dl = await device.request.get(`/api/kobo/${token}/download/${bookId}/kepub`);
      expect(dl.status()).toBe(404);
      await device.close();
    }
  });
});
