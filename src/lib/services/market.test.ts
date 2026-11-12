// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { formatParchment, parchmentTenthsForPages } from "./market";

describe("Parchment units", () => {
  it("credits one half-unit per real page and formats at most one decimal", () => {
    expect(formatParchment(parchmentTenthsForPages(1))).toBe("0.5");
    expect(formatParchment(parchmentTenthsForPages(2))).toBe("1");
    expect(formatParchment(parchmentTenthsForPages(20))).toBe("10");
    expect(formatParchment(1001)).toBe("100.1");
  });

  it("never rewards non-positive progress", () => {
    expect(parchmentTenthsForPages(0)).toBe(0);
    expect(parchmentTenthsForPages(-20)).toBe(0);
  });
});
