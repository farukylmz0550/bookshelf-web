// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { clampPages, resolvePagesPerReadEvent } from "./reading-settings";

// v3.5.1 — effective "I read N pages" step: user setting → admin floor →
// site default → 20. The admin floor is a lower bound for everyone.
describe("resolvePagesPerReadEvent", () => {
  it("falls back to the site default when the user has no setting", () => {
    expect(resolvePagesPerReadEvent(null, 0, 30)).toBe(30);
    expect(resolvePagesPerReadEvent(undefined, 0, undefined)).toBe(20);
  });

  it("uses the user setting when set", () => {
    expect(resolvePagesPerReadEvent(5, 0, 20)).toBe(5);
    expect(resolvePagesPerReadEvent(40, 0, 20)).toBe(40);
  });

  it("lifts the user setting to the admin floor", () => {
    expect(resolvePagesPerReadEvent(5, 10, 20)).toBe(10);
    expect(resolvePagesPerReadEvent(null, 10, 20)).toBe(20);
    expect(resolvePagesPerReadEvent(50, 10, 20)).toBe(50);
  });

  it("treats a floor of 0 as disabled", () => {
    expect(resolvePagesPerReadEvent(5, 0, 20)).toBe(5);
  });

  it("clamps out-of-range values", () => {
    expect(resolvePagesPerReadEvent(0, 0, 20)).toBe(1);
    expect(resolvePagesPerReadEvent(5000, 0, 20)).toBe(1000);
    expect(resolvePagesPerReadEvent(-3, 0, 20)).toBe(1);
    expect(resolvePagesPerReadEvent(2.9, 0, 20)).toBe(2);
    expect(resolvePagesPerReadEvent(null, 0, 5000)).toBe(1000);
  });
});

describe("clampPages", () => {
  it("returns the default for non-numeric input", () => {
    expect(clampPages(NaN)).toBe(20);
    expect(clampPages(null)).toBe(20);
    expect(clampPages("10" as unknown as number)).toBe(10);
  });
});
