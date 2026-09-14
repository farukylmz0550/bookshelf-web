// SPDX-License-Identifier: GPL-3.0-only
// Groups / Shelves (v2.8.0) — pure validation & ordering logic.
// Server actions (src/app/actions/groups.ts) call these; unit-tested in
// groups.test.ts. No DB access here so every rule stays testable in isolation.

export const GROUP_NAME_MAX = 60;

// Muted swatches drawn from the design language (works on light & dark).
export const GROUP_COLORS: string[] = [
  "#BB4F35", // burnt ochre
  "#B56F76", // dusty rose
  "#CC7661", // terra orange
  "#D6BA9B", // terracotta sand
  "#CB9D06", // yellow ochre
  "#93907E", // muted sage
  "#7A8B6F", // sage
  "#8093A4", // dusty blue
  "#7D6B91", // plum
  "#B9484E", // dusty red
  "#8C6A4A", // leather
  "#6B7280", // slate
];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateGroupName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, error: "INVALID_NAME" };
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "INVALID_NAME" };
  if (name.length > GROUP_NAME_MAX) return { ok: false, error: "NAME_TOO_LONG" };
  return { ok: true, value: name };
}

/**
 * A group color is optional. Only palette entries or a strict 6-digit hex are
 * accepted — anything else (named colors, urls, css fragments) is rejected, so
 * rendering can safely place the value inside style attributes.
 */
export function validateGroupColor(raw: unknown): ValidationResult<string | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "INVALID_COLOR" };
  const color = raw.trim();
  if (!color) return { ok: true, value: null };
  if (GROUP_COLORS.includes(color)) return { ok: true, value: color };
  if (HEX_COLOR_RE.test(color)) return { ok: true, value: color.toLowerCase() };
  return { ok: false, error: "INVALID_COLOR" };
}

export type ReorderResult = { ok: true; ordered: string[] } | { ok: false; error: string };

/**
 * Validate a client-supplied ordering against the caller's own group ids.
 * The input must be a complete permutation of the user's groups — foreign,
 * duplicate or missing ids are rejected. Output preserves the requested order;
 * the caller persists it as compact sequential `order` values (0..n-1).
 */
export function applyReorder(userGroupIds: string[], input: unknown): ReorderResult {
  if (!Array.isArray(input) || input.some((id) => typeof id !== "string")) {
    return { ok: false, error: "INVALID_IDS" };
  }
  const userSet = new Set(userGroupIds);
  const seen = new Set<string>();
  for (const id of input) {
    if (!userSet.has(id)) return { ok: false, error: "INVALID_IDS" };
    if (seen.has(id)) return { ok: false, error: "INVALID_IDS" };
    seen.add(id);
  }
  if (input.length !== userGroupIds.length) return { ok: false, error: "INVALID_IDS" };
  return { ok: true, ordered: input };
}

/** Max group color dots shown on a book card; overflow renders as "+n". */
export const GROUP_DOTS_MAX = 3;
