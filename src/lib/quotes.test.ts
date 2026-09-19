// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — quote text validation.
import { describe, it, expect } from "vitest";
import { QUOTE_MAX_LENGTH, validateQuoteText } from "./quotes";

describe("validateQuoteText", () => {
  it("accepts ordinary text with surrounding whitespace", () => {
    expect(validateQuoteText("  So we beat on, boats against the current.  ")).toBeNull();
  });

  it("rejects empty/whitespace-only input", () => {
    expect(validateQuoteText("")).toBe("EmptyText");
    expect(validateQuoteText("   \n\t ")).toBe("EmptyText");
  });

  it("rejects text beyond the character budget", () => {
    expect(validateQuoteText("a".repeat(QUOTE_MAX_LENGTH))).toBeNull();
    expect(validateQuoteText("a".repeat(QUOTE_MAX_LENGTH + 1))).toBe("TooLong");
  });
});
