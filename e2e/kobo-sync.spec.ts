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
});
