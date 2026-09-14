// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { canonical, display, splitTags, show } from "@/lib/books/tags";

describe("canonical", () => {
  it("lowercases and trims", () => {
    expect(canonical("  Fiction  ")).toBe("fiction");
  });
});

describe("display", () => {
  it("capitalizes first letter", () => {
    expect(display("fiction")).toBe("Fiction");
  });
  it("returns empty for empty string", () => {
    expect(display("")).toBe("");
  });
});

describe("splitTags", () => {
  it("splits by comma and normalizes", () => {
    expect(splitTags("fiction, Poetry, Sci-Fi")).toEqual(["fiction", "poetry", "sci-fi"]);
  });
  it("filters empty strings", () => {
    expect(splitTags("fiction,,poetry,")).toEqual(["fiction", "poetry"]);
  });
});

describe("show", () => {
  it("displays tags with proper casing", () => {
    expect(show("fiction,poetry")).toBe("Fiction, Poetry");
  });
});
