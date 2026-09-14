// SPDX-License-Identifier: GPL-3.0-only
// Tags — legacy src/books/tags.py port.

export function canonical(s: string): string {
  return s.trim().toLowerCase();
}

export function display(s: string): string {
  const c = canonical(s);
  if (!c) return "";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function splitTags(s: string): string[] {
  return s.split(",").map(canonical).filter(Boolean);
}

export function show(tagsCsv: string): string {
  return splitTags(tagsCsv).map(display).join(", ");
}
