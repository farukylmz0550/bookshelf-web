// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — quote validation: shared by server actions and the client form
// (character budget). Pure — no DB, no Next imports.
export const QUOTE_MAX_LENGTH = 2000;

export type QuoteValidationError = "EmptyText" | "TooLong";

/** Validate a quote body: non-empty after trim, within the character budget. */
export function validateQuoteText(text: string): QuoteValidationError | null {
  if (!text || text.trim().length === 0) return "EmptyText";
  if (text.trim().length > QUOTE_MAX_LENGTH) return "TooLong";
  return null;
}
