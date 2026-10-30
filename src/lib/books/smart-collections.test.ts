// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { matchesSmartRule, parseSmartRule, summarizeSmartRule, type SmartBook } from "./smart-collections";

const book: SmartBook = {
  status: "READING",
  rating: 4,
  tags: "fiction, classic",
  series: "Earthsea",
  author: "Ursula Le Guin",
  languages: "eng",
  publishDate: "1968",
  numberOfPages: "300",
};

describe("smart collections", () => {
  it("validates and evaluates allow-listed predicates", () => {
    const parsed = parseSmartRule({
      version: 1,
      all: [{ field: "status", operator: "equals", value: "READING" }],
      any: [
        { field: "rating", operator: "gte", value: 5 },
        { field: "tag", operator: "contains", value: "classic" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(matchesSmartRule(book, parsed.rule)).toBe(true);
  });

  it("rejects unknown fields and does not run arbitrary queries", () => {
    expect(parseSmartRule({ version: 1, all: [{ field: "sql", operator: "equals", value: "DROP" }] }).ok).toBe(false);
  });

  it("produces deterministic human-readable summaries", () => {
    expect(
      summarizeSmartRule({ version: 1, all: [{ field: "status", operator: "equals", value: "READING" }], any: [] }),
    ).toBe("status equals READING");
  });
});
