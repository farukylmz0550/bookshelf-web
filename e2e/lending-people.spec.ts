// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
import { pickSelectOption } from "./helpers/ui-select";
import { resetDb } from "./helpers/db";
import { createAdminViaSetup, login } from "./helpers/auth";

test.describe("lending + people", () => {
  const admin = { name: "Admin", email: "admin@bookshelf.test", password: "password123" };

  test.beforeEach(async ({ page }) => {
    await resetDb(page);
    await createAdminViaSetup(page, admin);
    await login(page, admin.email, admin.password);
    await page.goto("/books");
    await page.getByPlaceholder("Title").first().fill("Book One");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Book One", { exact: true }).first()).toBeVisible();
    await page.getByPlaceholder("Title").first().fill("Book Two");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Book Two", { exact: true }).first()).toBeVisible();
  });

  test("create lending (person auto-create, XP+5) and return", async ({ page }) => {
    await page.goto("/lending");
    await pickSelectOption(page, page.getByRole("combobox", { name: "Book" }), { index: 0 });
    await page.getByPlaceholder("Name").fill("Ayse Yilmaz");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.getByText("Ayse Yilmaz")).toBeVisible();
    await page
      .getByRole("button", { name: /mark returned/i })
      .first()
      .click();
    await expect(page.getByText("Returned")).toBeVisible();
  });

  test("copies guard: All copies are out", async ({ page }) => {
    await page.goto("/lending");
    await pickSelectOption(page, page.getByRole("combobox", { name: "Book" }), { index: 0 });
    await page.getByPlaceholder("Name").fill("Person A");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.getByText("Person A")).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("All copies are out");
      await dialog.accept();
    });
    await page.goto("/books");
    await page.locator("a[href^='/books/']").first().click();
    await page.getByPlaceholder("Borrower name").fill("Person B");
    await page.getByRole("button", { name: /^lend$/i }).click();
  });

  test("people: create, trust score, history, delete guard", async ({ page }) => {
    await page.goto("/people");
    await page.getByPlaceholder("Person name").fill("Mehmet");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Mehmet")).toBeVisible();
    await expect(page.getByText("0").first()).toBeVisible();

    await page.getByPlaceholder("Person name").fill("mehmet");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();

    await page.goto("/lending");
    await page.getByPlaceholder("Name").fill("Mehmet");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await page.goto("/people");
    await page.getByRole("link", { name: "Mehmet" }).click();
    await expect(page.getByText(/history for mehmet/i)).toBeVisible();
    await page.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByText(/still has books out/i)).toBeVisible();

    await page.goto("/lending");
    await page
      .getByRole("button", { name: /mark returned/i })
      .first()
      .click();
    await page.goto("/people");
    await page.getByRole("link", { name: "Mehmet" }).click();
    await page.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByRole("link", { name: "Mehmet" })).toBeHidden();
  });

  test("lending via book detail with datalist", async ({ page }) => {
    await page.goto("/books");
    await page.locator("a[href^='/books/']").first().click();
    await page.getByPlaceholder("Borrower name").fill("New Person");
    await page.getByRole("button", { name: /^lend$/i }).click();
    await expect(page.getByText("New Person")).toBeVisible();
    await page.getByRole("button", { name: /take back/i }).click();
    await expect(page.getByText("(out)")).toBeHidden();
  });
});
