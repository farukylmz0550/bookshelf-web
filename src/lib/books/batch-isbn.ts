// SPDX-License-Identifier: GPL-3.0-only
import { isValidIsbn10, isValidIsbn13, normalizeIsbn } from "./model";

export const MAX_BATCH_ISBNS = 50;

export type BatchIsbnStatus = "ready" | "duplicate" | "invalid" | "lookup_failed" | "added";

export function normalizeBatchIsbn(value: string): string {
  return normalizeIsbn(value.trim());
}

export function isValidBatchIsbn(value: string): boolean {
  const normalized = normalizeBatchIsbn(value);
  return normalized.length === 10 ? isValidIsbn10(normalized) : normalized.length === 13 && isValidIsbn13(normalized);
}

export function uniqueBatchIsbns(values: string[]): Array<{ raw: string; isbn: string; status: BatchIsbnStatus }> {
  const seen = new Set<string>();
  return values.map((raw) => {
    const isbn = normalizeBatchIsbn(raw);
    if (!isbn || !isValidBatchIsbn(isbn)) return { raw, isbn, status: "invalid" };
    if (seen.has(isbn)) return { raw, isbn, status: "duplicate" };
    seen.add(isbn);
    return { raw, isbn, status: "ready" };
  });
}
