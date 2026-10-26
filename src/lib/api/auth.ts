// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — request authentication for the REST API and the MCP endpoint.
//
// Two credentials are accepted:
//   • Authorization: Bearer bs_…  — a personal API token (preferred)
//   • the normal NextAuth session cookie (same-origin browser use)
//
// Session requests are checked for a same-origin Origin header on mutating
// methods: otherwise a third-party page could drive the API with the user's
// cookie. Bearer tokens are immune to CSRF by construction.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApiError } from "./responses";
import { hasScope, scopesForRole, type ApiScope } from "./scopes";
import { resolveApiToken, type ApiTokenKind } from "./tokens";

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
  kind: ApiTokenKind | "SESSION";
  scopes: ApiScope[];
  via: "token" | "session";
  tokenId?: string;
  userName: string;
  userEmail: string;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  const origin = request.headers.get("origin");
  // Non-browser clients (curl, MCP SDK over Node) send no Origin.
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new ApiError(403, "csrf", "Cross-origin session requests are not allowed");
}

/**
 * Authenticate the request and enforce the required scope(s).
 * Throws ApiError(401/403) on failure.
 */
export async function authenticateRequest(request: Request, required?: ApiScope | ApiScope[]): Promise<AuthContext> {
  const header = request.headers.get("authorization");
  let context: Omit<AuthContext, "scopes"> & { scopes: ApiScope[] };

  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) throw new ApiError(401, "invalid_authorization", "Use Authorization: Bearer <token>");
    const resolved = await resolveApiToken(match[1].trim());
    if (!resolved) throw new ApiError(401, "invalid_token", "Token is invalid, expired or revoked");
    if (resolved.kind === "ADMIN" && !resolved.user.isAdmin) {
      throw new ApiError(403, "admin_required", "Admin tokens require an admin account");
    }
    context = {
      userId: resolved.userId,
      isAdmin: resolved.user.isAdmin,
      kind: resolved.kind,
      scopes: resolved.scopes,
      via: "token",
      tokenId: resolved.tokenId,
      userName: resolved.user.name,
      userEmail: resolved.user.email,
    };
  } else {
    const session = await auth();
    if (!session?.user?.id) throw new ApiError(401, "unauthorized", "Missing API token or session");
    assertSameOrigin(request);
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isAdmin: true, approved: true, name: true, email: true },
    });
    if (!user?.approved) throw new ApiError(403, "not_approved", "Account is not approved");
    context = {
      userId: user.id,
      isAdmin: user.isAdmin,
      kind: "SESSION",
      scopes: scopesForRole(user.isAdmin),
      via: "session",
      userName: user.name,
      userEmail: user.email,
    };
  }

  if (required && !hasScope(context.scopes, required)) {
    throw new ApiError(403, "insufficient_scope", "Token is missing the required scope", {
      required,
      granted: context.scopes,
    });
  }
  return context;
}

export function requireAdminContext(context: AuthContext): void {
  if (!context.isAdmin || !hasScope(context.scopes, "admin:data")) {
    throw new ApiError(403, "admin_required", "Administrator access is required");
  }
}

/**
 * Resolve the user id a request operates on. Non-admin callers may only act on
 * their own account; admin callers with admin:data may pass any userId.
 */
export function resolveTargetUserId(context: AuthContext, requested?: string | null): string {
  if (!requested || requested === context.userId) return context.userId;
  if (!context.isAdmin || !hasScope(context.scopes, "admin:data")) {
    throw new ApiError(403, "forbidden", "You may only access your own data");
  }
  return requested;
}

export function requireScope(context: AuthContext, scope: ApiScope): void {
  if (!hasScope(context.scopes, scope)) {
    throw new ApiError(403, "insufficient_scope", "Token is missing the required scope", {
      required: [scope],
      granted: context.scopes,
    });
  }
}
