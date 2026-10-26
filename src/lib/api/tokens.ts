// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — personal API token storage.
//
// Raw tokens look like `bs_usr_<43 base64url chars>` (or `bs_adm_…`). Only a
// SHA-256 hash is stored; the plaintext is returned exactly once by
// createApiToken() and never logged.

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import {
  DEFAULT_ADMIN_SCOPES,
  DEFAULT_USER_SCOPES,
  normalizeScopes,
  parseScopes,
  serializeScopes,
  type ApiScope,
} from "./scopes";

export type ApiTokenKind = "USER" | "ADMIN";

export interface CreatedApiToken {
  id: string;
  name: string;
  kind: ApiTokenKind;
  prefix: string;
  scopes: ApiScope[];
  createdAt: Date;
  expiresAt: Date | null;
  /** Plaintext token — shown once to the caller. */
  token: string;
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  kind: ApiTokenKind;
  prefix: string;
  scopes: ApiScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface ResolvedApiToken {
  tokenId: string;
  userId: string;
  kind: ApiTokenKind;
  scopes: ApiScope[];
  user: { id: string; isAdmin: boolean; approved: boolean; name: string; email: string };
}

const TOKEN_RE = /^bs_(usr|adm)_[A-Za-z0-9_-]{20,}$/;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function tokenPrefix(raw: string): string {
  // Enough to recognize a token in the UI without revealing useful entropy.
  return `${raw.slice(0, 11)}…`;
}

export function generateRawToken(kind: ApiTokenKind): string {
  const body = randomBytes(32).toString("base64url");
  return `bs_${kind === "ADMIN" ? "adm" : "usr"}_${body}`;
}

export async function createApiToken(input: {
  userId: string;
  name: string;
  kind?: ApiTokenKind;
  scopes?: string[] | string;
  expiresAt?: Date | null;
}): Promise<CreatedApiToken> {
  const kind: ApiTokenKind = input.kind === "ADMIN" ? "ADMIN" : "USER";
  const name = input.name.trim().slice(0, 100);
  if (!name) throw new Error("Token name is required");
  const scopes = normalizeScopes(kind, input.scopes);
  if (scopes.length === 0) throw new Error("At least one scope is required");

  const raw = generateRawToken(kind);
  const row = await db.apiToken.create({
    data: {
      userId: input.userId,
      name,
      kind,
      tokenHash: hashToken(raw),
      prefix: tokenPrefix(raw),
      scopes: serializeScopes(scopes),
      expiresAt: input.expiresAt ?? null,
    },
  });

  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ApiTokenKind,
    prefix: row.prefix,
    scopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    token: raw,
  };
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const rows = await db.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as ApiTokenKind,
    prefix: row.prefix,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  }));
}

/** Revoke one of the caller's tokens. Returns false when it does not exist. */
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const result = await db.apiToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Resolve a raw bearer token. Returns null for malformed/unknown tokens;
 * revoked and expired tokens also resolve to null. The owning user must still
 * exist and be approved.
 */
export async function resolveApiToken(raw: string): Promise<ResolvedApiToken | null> {
  if (!TOKEN_RE.test(raw)) return null;
  const row = await db.apiToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      user: { select: { id: true, isAdmin: true, approved: true, name: true, email: true } },
    },
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.user.approved) return null;

  // lastUsedAt is informational; never let a write failure reject the request.
  void db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  return {
    tokenId: row.id,
    userId: row.userId,
    kind: row.kind as ApiTokenKind,
    scopes: parseScopes(row.scopes),
    user: row.user,
  };
}

export function defaultScopesFor(kind: ApiTokenKind): ApiScope[] {
  return kind === "ADMIN" ? DEFAULT_ADMIN_SCOPES : DEFAULT_USER_SCOPES;
}
