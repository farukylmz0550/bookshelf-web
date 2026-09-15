// SPDX-License-Identifier: GPL-3.0-only
import type { Locator, Page } from "@playwright/test";

// v2.10.0 — native <select> elements were replaced with styled Base UI
// selects (trigger button + portal listbox), so Playwright's native
// selectOption() no longer applies. Click the trigger, wait for the portal
// listbox and pick an option by label or index.
export async function pickSelectOption(
  page: Page,
  trigger: Locator,
  option: string | { label: string } | { index: number },
) {
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor();
  if (typeof option === "string") {
    await listbox.getByRole("option", { name: option }).first().click();
  } else if ("label" in option) {
    await listbox.getByRole("option", { name: option.label }).first().click();
  } else {
    await listbox.getByRole("option").nth(option.index).click();
  }
}

// Book detail status select ("Status:" aria-label) + the dict label for the
// status value.
export function bookStatusTrigger(page: Page) {
  return page.getByRole("combobox", { name: /status/i });
}

export async function setBookStatusUI(page: Page, label: string) {
  await pickSelectOption(page, bookStatusTrigger(page), label);
}
