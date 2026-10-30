// SPDX-License-Identifier: GPL-3.0-only

import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseSmartRule,
  matchesSmartRule,
  summarizeSmartRule,
  type SmartBook,
  type SmartRule,
} from "@/lib/books/smart-collections";

const bookSelect = {
  id: true,
  title: true,
  author: true,
  status: true,
  rating: true,
  tags: true,
  series: true,
  languages: true,
  publishDate: true,
  numberOfPages: true,
} as const;

async function evaluate(userId: string, rule: SmartRule) {
  const books = await db.book.findMany({
    where: { userId },
    select: bookSelect,
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
  return books.filter((book: SmartBook) => matchesSmartRule(book, rule));
}

export async function previewSmartCollection(userId: string, input: unknown) {
  const parsed = parseSmartRule(input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  const books = await evaluate(userId, parsed.rule);
  return { ok: true as const, rule: parsed.rule, summary: summarizeSmartRule(parsed.rule), total: books.length, books };
}

export async function createSmartCollection(userId: string, name: unknown, input: unknown, color?: unknown) {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable()
        .optional(),
    })
    .safeParse({ name, color: color ?? null });
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const rule = parseSmartRule(input);
  if (!rule.ok) return { ok: false as const, error: rule.error };
  try {
    const group = await db.bookGroup.create({
      data: {
        userId,
        name: parsed.data.name,
        color: parsed.data.color,
        mode: "SMART",
        ruleJson: JSON.stringify(rule.rule),
      },
    });
    return { ok: true as const, group, summary: summarizeSmartRule(rule.rule) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error && error.message.includes("Unique") ? "DUPLICATE_NAME" : "DB_ERROR",
    };
  }
}

export async function rebuildSmartCollection(userId: string, groupId: string) {
  const group = await db.bookGroup.findFirst({
    where: { id: groupId, userId, mode: "SMART" },
    select: { id: true, ruleJson: true },
  });
  if (!group) return { ok: false as const, error: "NOT_FOUND" };
  let raw: unknown;
  try {
    raw = group.ruleJson ? JSON.parse(group.ruleJson) : null;
  } catch {
    return { ok: false as const, error: "INVALID_RULE" };
  }
  const preview = await previewSmartCollection(userId, raw);
  if (!preview.ok) return preview;
  await db.bookGroup.update({ where: { id: groupId }, data: { lastEvaluatedAt: new Date() } });
  return { ok: true as const, groupId, total: preview.total, summary: preview.summary, books: preview.books };
}
