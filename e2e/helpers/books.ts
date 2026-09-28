// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page } from "@playwright/test";

// v3.8.0 — Faz 2: the add-book form moved into a dialog behind the primary
// "+ Add book" action (UI_Improvement_Plan.md §2). Open it before filling
// the book form.
export async function openAddBook(page: Page) {
  await page
    .getByRole("button", { name: /add book/i })
    .first()
    .click();
  await expect(page.getByPlaceholder("Title").first()).toBeVisible();
}
