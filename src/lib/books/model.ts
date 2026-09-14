// SPDX-License-Identifier: GPL-3.0-only
// Book model helpers — legacy src/books/model.py port.
// Single responsibility: Book identity & field parsing.

export function parseRating(value: string): number {
  const t = value.trim();
  if (t === "") return 0;
  const f = parseFloat(t);
  if (Number.isNaN(f)) return 0;
  return Math.max(0, Math.min(5, Math.floor(f)));
}

export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, "");
}

export function isValidIsbn10(s: string): boolean {
  const c = normalizeIsbn(s);
  if (c.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = c[i];
    let v: number;
    if (i === 9 && (ch === "X" || ch === "x")) v = 10;
    else {
      const d = parseInt(ch, 10);
      if (Number.isNaN(d)) return false;
      v = d;
    }
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(s: string): boolean {
  const c = normalizeIsbn(s);
  if (c.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(c[i], 10);
    if (Number.isNaN(d)) return false;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return sum % 10 === 0;
}
