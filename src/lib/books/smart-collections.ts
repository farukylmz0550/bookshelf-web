// SPDX-License-Identifier: GPL-3.0-only

import { z } from "zod";

const predicateSchema = z.object({
  field: z.enum(["status", "rating", "tag", "series", "author", "language", "publishYear", "pages"]),
  operator: z.enum(["equals", "contains", "gte", "lte"]),
  value: z.union([z.string().trim().min(1).max(200), z.number().int().min(0).max(100000)]),
});

export const smartRuleSchema: z.ZodType<SmartRule> = z.lazy(() =>
  z.object({
    version: z.literal(1),
    all: z.array(predicateSchema).max(12).default([]),
    any: z.array(predicateSchema).max(12).default([]),
  }),
);

export type SmartPredicate = z.infer<typeof predicateSchema>;
export type SmartRule = { version: 1; all: SmartPredicate[]; any: SmartPredicate[] };

export type SmartBook = {
  status: string;
  rating: number;
  tags: string | null;
  series: string | null;
  author: string | null;
  languages: string | null;
  publishDate: string | null;
  numberOfPages: string | null;
};

export function parseSmartRule(value: unknown): { ok: true; rule: SmartRule } | { ok: false; error: string } {
  const parsed = smartRuleSchema.safeParse(value);
  return parsed.success ? { ok: true, rule: parsed.data } : { ok: false, error: "INVALID_RULE" };
}

function textValue(book: SmartBook, field: SmartPredicate["field"]): string {
  if (field === "status") return book.status;
  if (field === "tag") return book.tags ?? "";
  if (field === "series") return book.series ?? "";
  if (field === "author") return book.author ?? "";
  if (field === "language") return book.languages ?? "";
  if (field === "publishYear") return book.publishDate?.match(/(?<!\d)(\d{4})(?!\d)/)?.[1] ?? "";
  return field === "pages" ? (book.numberOfPages ?? "") : String(book.rating);
}

function matches(book: SmartBook, predicate: SmartPredicate): boolean {
  const actual = textValue(book, predicate.field).toLocaleLowerCase();
  const expected = String(predicate.value).toLocaleLowerCase();
  if (predicate.operator === "contains") return actual.includes(expected);
  if (predicate.operator === "equals") return actual === expected;
  const actualNumber = Number(actual);
  const expectedNumber = Number(predicate.value);
  return (
    Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber) &&
    (predicate.operator === "gte" ? actualNumber >= expectedNumber : actualNumber <= expectedNumber)
  );
}

/** Evaluate a validated rule without database access or dynamic query construction. */
export function matchesSmartRule(book: SmartBook, rule: SmartRule): boolean {
  return (
    rule.all.every((predicate) => matches(book, predicate)) &&
    (rule.any.length === 0 || rule.any.some((predicate) => matches(book, predicate)))
  );
}

export function summarizeSmartRule(rule: SmartRule): string {
  const predicates = [...rule.all, ...rule.any];
  return predicates.length === 0
    ? "All books"
    : predicates.map((predicate) => `${predicate.field} ${predicate.operator} ${predicate.value}`).join(" · ");
}
