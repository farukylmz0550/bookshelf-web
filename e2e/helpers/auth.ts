// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page } from "@playwright/test";

/** Click a settings button and wait for its server action POST to complete. */
export async function clickSetting(page: Page, name: string | RegExp) {
  const post = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name }).first().click();
  await post;
}

/** Dismiss the GDPR cookie-consent modal if it is blocking the page. */
export async function dismissCookieConsent(page: Page) {
  const accept = page.getByRole("button", { name: /^accept$/i });
  try {
    await accept.click({ timeout: 3000 });
  } catch {
    // Modal not shown — fine
  }
}

export async function createAdminViaSetup(page: Page, admin: { name: string; email: string; password: string }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/setup");
    await dismissCookieConsent(page);
    try {
      await expect(page.getByRole("button", { name: /create admin account/i })).toBeVisible({ timeout: 3000 });
      break;
    } catch {
      await page.request.post("/api/test/reset").catch(() => {});
      try {
        const { execSync } = await import("node:child_process");
        execSync(
          "python3 -c \"import sqlite3; conn=sqlite3.connect('prisma/dev.db'); conn.execute('PRAGMA busy_timeout=5000'); conn.executescript('DELETE FROM UserAchievement; DELETE FROM LendingRecord; DELETE FROM Book; DELETE FROM Person; DELETE FROM Goal; DELETE FROM User;'); conn.commit(); conn.close()\"",
          { stdio: "ignore" },
        );
      } catch {}
      await new Promise((r) => setTimeout(r, 700));
      if (attempt === 2) throw new Error("setup form not visible after reset");
    }
  }
  await page.getByPlaceholder("Name").fill(admin.name);
  await page.getByPlaceholder("you@example.com").fill(admin.email);
  await page.getByPlaceholder("Min 8 characters").fill(admin.password);
  await page.getByRole("button", { name: /create admin account/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await dismissCookieConsent(page);
  await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL(/\/books/, { timeout: 10000 });
}

export async function register(page: Page, user: { name: string; email: string; password: string }) {
  await page.goto("/register");
  await dismissCookieConsent(page);
  await page.getByPlaceholder("Name").fill(user.name);
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("Min 8 characters").fill(user.password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/registration successful/i)).toBeVisible();
  await page.getByRole("link", { name: /go to login/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  // v3.7.0 — logout lives in Settings → Account card (sidebar/mobile header
  // buttons are gone). The logout confirm dialog is auto-accepted.
  await page.goto("/settings");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}
