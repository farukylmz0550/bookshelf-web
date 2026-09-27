// SPDX-License-Identifier: GPL-3.0-only
import { expect, type Page } from "@playwright/test";

// v3.5.1 — borrowers are selected from people; people are created on /people.
export async function createPerson(page: Page, name: string) {
  await page.goto("/people");
  await page.getByPlaceholder("Person name").fill(name);
  await page.getByRole("button", { name: /^add$/i }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}
