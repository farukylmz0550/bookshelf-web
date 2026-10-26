// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — API token scopes.
//
// A token carries a subset of the scopes below. Every scope is deliberately
// fine-grained so a read-only integration can never mutate data. ADMIN tokens
// add the two admin:* scopes; they are still bound to their owner account.

export const ALL_SCOPES = [
  "books:read",
  "books:write",
  "quotes:read",
  "quotes:write",
  "lending:read",
  "lending:write",
  "people:read",
  "people:write",
  "groups:read",
  "groups:write",
  "goals:read",
  "goals:write",
  "challenges:read",
  "challenges:write",
  "stats:read",
  "user:read",
  "user:write",
  "admin:users",
  "admin:data",
] as const;

export type ApiScope = (typeof ALL_SCOPES)[number];

export const SCOPE_GROUPS: { name: string; scopes: ApiScope[] }[] = [
  { name: "Books", scopes: ["books:read", "books:write"] },
  { name: "Quotes", scopes: ["quotes:read", "quotes:write"] },
  { name: "Lending", scopes: ["lending:read", "lending:write"] },
  { name: "People", scopes: ["people:read", "people:write"] },
  { name: "Shelves", scopes: ["groups:read", "groups:write"] },
  { name: "Goals", scopes: ["goals:read", "goals:write"] },
  { name: "Challenges", scopes: ["challenges:read", "challenges:write"] },
  { name: "Statistics", scopes: ["stats:read"] },
  { name: "Account", scopes: ["user:read", "user:write"] },
  { name: "Administration", scopes: ["admin:users", "admin:data"] },
];

/** Everything a normal user token may hold. */
export const DEFAULT_USER_SCOPES: ApiScope[] = [
  "books:read",
  "books:write",
  "quotes:read",
  "quotes:write",
  "lending:read",
  "lending:write",
  "people:read",
  "people:write",
  "groups:read",
  "groups:write",
  "goals:read",
  "goals:write",
  "challenges:read",
  "challenges:write",
  "stats:read",
  "user:read",
  "user:write",
];

/** Everything an admin token may hold. */
export const DEFAULT_ADMIN_SCOPES: ApiScope[] = [...DEFAULT_USER_SCOPES, "admin:users", "admin:data"];

export const ADMIN_ONLY_SCOPES: ApiScope[] = ["admin:users", "admin:data"];

export function isApiScope(value: string): value is ApiScope {
  return (ALL_SCOPES as readonly string[]).includes(value);
}

/** Scopes a token of this kind is allowed to hold. */
export function allowedScopes(kind: "USER" | "ADMIN"): ApiScope[] {
  return kind === "ADMIN" ? DEFAULT_ADMIN_SCOPES : DEFAULT_USER_SCOPES;
}

/**
 * Normalise and validate a requested scope list. Unknown scopes and scopes
 * above the token kind's ceiling are rejected instead of silently dropped.
 */
export function normalizeScopes(kind: "USER" | "ADMIN", requested?: string[] | string): ApiScope[] {
  const list =
    requested === undefined
      ? kind === "ADMIN"
        ? DEFAULT_ADMIN_SCOPES
        : DEFAULT_USER_SCOPES
      : Array.isArray(requested)
        ? requested
        : requested.split(/[\s,]+/).filter(Boolean);
  const allowed = new Set<string>(allowedScopes(kind));
  const unique: ApiScope[] = [];
  for (const raw of list) {
    const scope = raw.trim();
    if (!scope) continue;
    if (!isApiScope(scope)) throw new Error(`Unknown scope: ${scope}`);
    if (!allowed.has(scope)) throw new Error(`Scope ${scope} requires an ADMIN token`);
    if (!unique.includes(scope)) unique.push(scope);
  }
  return unique;
}

export function parseScopes(value: string | null | undefined): ApiScope[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s): s is ApiScope => isApiScope(s));
}

export function hasScope(scopes: readonly string[], required: ApiScope | ApiScope[]): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((scope) => scopes.includes(scope));
}

export function serializeScopes(scopes: readonly ApiScope[]): string {
  return scopes.join(" ");
}

/** Scopes implied by the caller's role (session auth gets everything). */
export function scopesForRole(isAdmin: boolean): ApiScope[] {
  return isAdmin ? DEFAULT_ADMIN_SCOPES : DEFAULT_USER_SCOPES;
}
