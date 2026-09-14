// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { normalizeIsbn, isValidIsbn10, isValidIsbn13, parseRating } from "@/lib/books/model";

describe("normalizeIsbn", () => {
  it("strips non-digit characters", () => {
    expect(normalizeIsbn("978-0-13-468599-1")).toBe("9780134685991");
  });
  it("preserves X for ISBN-10", () => {
    expect(normalizeIsbn("0-804-42957-X")).toBe("080442957X");
  });
});

describe("isValidIsbn13", () => {
  it("validates correct checksum", () => {
    expect(isValidIsbn13("9780134685991")).toBe(true);
  });
  it("rejects incorrect checksum", () => {
    expect(isValidIsbn13("9780134685990")).toBe(false);
  });
});

describe("isValidIsbn10", () => {
  it("validates correct checksum", () => {
    expect(isValidIsbn10("080442957X")).toBe(true);
  });
  it("rejects incorrect checksum", () => {
    expect(isValidIsbn10("0804429570")).toBe(false);
  });
});

describe("parseRating", () => {
  it("returns 0 for empty string", () => {
    expect(parseRating("")).toBe(0);
  });
  it("clamps to 0-5 range", () => {
    expect(parseRating("6")).toBe(5);
    expect(parseRating("-1")).toBe(0);
  });
  it("floors to integer", () => {
    expect(parseRating("3.7")).toBe(3);
  });
});
