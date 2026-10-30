// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — REST API v1 router.
//
// A single optional catch-all route keeps the versioned surface in one place:
// every endpoint authenticates through lib/api/auth, resolves an explicit
// target user (admin tokens may pass ?userId=), calls the same service layer
// as the UI and serialises a stable `{ data, meta? }` envelope.

import { z } from "zod";
import { authenticateRequest, resolveTargetUserId, requireAdminContext, type AuthContext } from "@/lib/api/auth";
import { ApiError, json, noContent, readJson, validationError } from "@/lib/api/responses";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api/tokens";
import { SCOPE_GROUPS, type ApiScope } from "@/lib/api/scopes";
import * as books from "@/lib/services/books";
import * as lending from "@/lib/services/lending";
import * as people from "@/lib/services/people";
import * as quotes from "@/lib/services/quotes";
import * as groups from "@/lib/services/groups";
import * as goals from "@/lib/services/goals";
import * as challenges from "@/lib/services/challenges";
import * as stats from "@/lib/services/stats";
import * as health from "@/lib/services/health";
import * as locations from "@/lib/services/locations";
import * as smartCollections from "@/lib/services/smart-collections";
import * as batchBooks from "@/lib/services/batch-books";
import { buildHealthReport } from "@/lib/books/health";
import * as users from "@/lib/services/users";
import { db } from "@/lib/db";
import { verifyTotpCode } from "@/lib/totp";

const API_VERSION = "1";
const BASE = "/api/v1";

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw validationError(
      parsed.error.issues.map((issue) => ({ path: issue.path as (string | number)[], message: issue.message })),
    );
  return parsed.data;
}

function queryInt(params: URLSearchParams, key: string, fallback: number, max = 500): number {
  const raw = params.get(key);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
}

function userIdOf(context: AuthContext, params: URLSearchParams): string {
  return resolveTargetUserId(context, params.get("userId"));
}

async function requireUserExists(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new ApiError(404, "user_not_found", "User not found");
}

async function route(request: Request, segments: string[], context: AuthContext): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const params = url.searchParams;

  // --------------------------------------------------------------- health
  if (segments[0] === "health" && segments[1] === "books") {
    const userId = userIdOf(context, params);
    await requireUserExists(userId);
    if (segments.length === 2 && (method === "GET" || method === "POST")) {
      const result = await health.getBooksHealthReport(userId, {
        limit: queryInt(params, "limit", 100),
        offset: queryInt(params, "offset", 0),
      });
      return json({
        data: result.findings,
        meta: { generatedAt: result.generatedAt, summary: result.summary, limit: result.limit, offset: result.offset },
      });
    }
    if (segments.length === 4 && segments[3] === "repair-preview" && method === "POST") {
      const book = await health.getBookForRepairPreview(userId, segments[2]);
      if (!book) throw new ApiError(404, "not_found", "Book not found");
      const report = buildHealthReport([book]);
      return json({ data: { book, findings: report.findings, applySupported: false } });
    }
  }

  // ------------------------------------------------------------- locations
  if (segments[0] === "locations") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") return json({ data: await locations.listLocations(userId) });
    if (segments.length === 1 && method === "POST") {
      const result = await locations.createLocation(
        userId,
        (await readJson(request)) as { name: unknown; kind: unknown; parentId?: string | null },
      );
      if (!result.ok)
        throw new ApiError(result.error === "DUPLICATE_NAME" ? 409 : 400, "location_create_failed", result.error);
      return json({ data: result.location }, { status: 201 });
    }
    if (segments.length === 2 && (method === "PATCH" || method === "PUT")) {
      const result = await locations.updateLocation(
        userId,
        segments[1],
        (await readJson(request)) as { name?: unknown; parentId?: string | null; archived?: boolean },
      );
      if (!result.ok)
        throw new ApiError(
          result.error === "NOT_FOUND" || result.error === "PARENT_NOT_FOUND" ? 404 : 400,
          "location_update_failed",
          result.error,
        );
      return json({ data: result.location });
    }
  }

  if (segments[0] === "books" && segments[1] && segments[2] === "copies") {
    const userId = userIdOf(context, params);
    if (segments.length === 3 && method === "GET") {
      const result = await locations.listBookCopies(userId, segments[1]);
      if (!result.ok) throw new ApiError(404, "not_found", "Book not found");
      return json({ data: result.copies });
    }
  }

  // ---------------------------------------------------------- batch ISBNs
  if (segments[0] === "books" && segments[1] === "batch-lookup" && segments.length === 2 && method === "POST") {
    const body = parseBody(
      z.object({ isbns: z.array(z.string().max(40)).min(1).max(batchBooks.MAX_BATCH_ISBNS) }),
      await readJson(request),
    );
    return json({ data: await batchBooks.lookupBooksBatch(userIdOf(context, params), body.isbns) });
  }
  if (segments[0] === "books" && segments[1] === "batch-create" && segments.length === 2 && method === "POST") {
    const body = parseBody(
      z.object({
        items: z.array(z.record(z.string(), z.unknown())).min(1).max(batchBooks.MAX_BATCH_ISBNS),
        idempotencyKey: z.string().trim().min(1).max(120).optional(),
      }),
      await readJson(request),
    );
    return json(
      {
        data: await batchBooks.createBooksBatch(userIdOf(context, params), body.items as never[], body.idempotencyKey),
      },
      { status: 201 },
    );
  }

  if (segments[0] === "copies" && segments[1] && segments[2] === "location" && method === "POST") {
    const body = parseBody(z.object({ locationId: z.string().min(1).nullable() }), await readJson(request));
    const result = await locations.assignCopyLocation(userIdOf(context, params), segments[1], body.locationId);
    if (!result.ok) throw new ApiError(404, "not_found", result.error);
    return json({ data: result.copy });
  }

  // ---------------------------------------------------------------- books
  if (segments[0] === "books" && segments.length === 1) {
    const userId = userIdOf(context, params);
    await requireUserExists(userId);
    if (method === "GET") {
      const result = await books.listBooks(userId, {
        search: params.get("search") ?? undefined,
        searchField: params.get("searchField") ?? undefined,
        status: params.get("status") ?? undefined,
        tag: params.get("tag") ?? undefined,
        groupId: params.get("groupId") ?? undefined,
        lent: params.get("lent") ?? undefined,
        signed: params.get("signed") ?? undefined,
        sort: params.get("sort") ?? undefined,
        asc: params.get("asc") !== "false",
        limit: queryInt(params, "limit", 100),
        offset: queryInt(params, "offset", 0),
      });
      return json({ data: result.books, meta: { total: result.total, limit: result.limit, offset: result.offset } });
    }
    if (method === "POST") {
      const body = await readJson(request);
      const result = await books.createBook(userId, body as books.AddBookInput);
      if (!result.ok) throw new ApiError(400, "invalid_book", result.error);
      return json({ data: result.book }, { status: 201 });
    }
  }

  if (segments[0] === "books" && segments[1]) {
    const userId = userIdOf(context, params);
    const bookId = segments[1];
    if (segments.length === 2) {
      if (method === "GET") {
        const book = await books.getBook(userId, bookId);
        if (!book) throw new ApiError(404, "not_found", "Book not found");
        return json({ data: book });
      }
      if (method === "PATCH" || method === "PUT") {
        const result = await books.updateBook(userId, bookId, (await readJson(request)) as books.UpdateBookInput);
        if (!result.ok) throw new ApiError(result.error === "NOT_FOUND" ? 404 : 400, "invalid_book", result.error);
        return json({ data: result.book });
      }
      if (method === "DELETE") {
        const deleted = await books.deleteBook(userId, bookId);
        if (!deleted) throw new ApiError(404, "not_found", "Book not found");
        return noContent();
      }
    }
    if (segments.length === 3 && segments[2] === "status" && method === "POST") {
      const body = parseBody(z.object({ status: books.bookStatusSchema }), await readJson(request));
      const result = await books.setBookStatus(userId, bookId, body.status);
      if (!result.ok) {
        throw result.error === "NOT_FOUND"
          ? new ApiError(404, "not_found", "Book not found")
          : new ApiError(409, "remaining_pages", "Finish the remaining pages first");
      }
      return json({ data: await books.getBook(userId, bookId) });
    }
    if (segments.length === 3 && segments[2] === "progress" && method === "POST") {
      const body = parseBody(
        z.object({ pages: z.number().int().min(1).max(5000).optional() }),
        await readJson(request),
      );
      const result = await books.logPagesRead(userId, bookId, body.pages);
      if (!result.ok) {
        throw result.error === "Not found"
          ? new ApiError(404, "not_found", "Book not found")
          : new ApiError(409, "conflict", result.error);
      }
      return json({ data: result });
    }
    if (segments.length === 3 && segments[2] === "quotes") {
      if (method === "GET") {
        return json({ data: await quotes.listQuotes(userId, bookId) });
      }
      if (method === "POST") {
        const body = await readJson(request);
        const result = await quotes.addQuote(userId, { ...(body as object), bookId } as never);
        if (!result.ok) throw new ApiError(400, "invalid_quote", result.error);
        return json({ data: result.quote }, { status: 201 });
      }
    }
  }

  // --------------------------------------------------------------- quotes
  if (segments[0] === "quotes" && segments[1]) {
    const userId = userIdOf(context, params);
    if (method === "PATCH" || method === "PUT") {
      const result = await quotes.updateQuote(userId, segments[1], (await readJson(request)) as never);
      if (!result.ok) throw new ApiError(result.error === "NotFound" ? 404 : 400, "invalid_quote", result.error);
      return json({ data: result.quote });
    }
    if (method === "DELETE") {
      const deleted = await quotes.deleteQuote(userId, segments[1]);
      if (!deleted) throw new ApiError(404, "not_found", "Quote not found");
      return noContent();
    }
  }

  // -------------------------------------------------------------- lending
  if (segments[0] === "lending") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") {
      return json({
        data: await lending.listLending(userId, {
          open: params.get("open") === "true",
          limit: queryInt(params, "limit", 200),
        }),
      });
    }
    if (segments.length === 1 && method === "POST") {
      const body = parseBody(
        z.object({ bookId: z.string().min(1), personId: z.string().min(1), dueDate: z.string().nullable().optional() }),
        await readJson(request),
      );
      const result = await lending.createLending(userId, body.bookId, body.personId, body.dueDate);
      if (!result.ok) throw new ApiError(result.error === "NOT_FOUND" ? 404 : 409, "lending_failed", result.error);
      return json({ data: result.lending }, { status: 201 });
    }
    if (segments.length === 3 && segments[2] === "return" && method === "POST") {
      const result = await lending.returnLending(userId, segments[1]);
      if (!result.ok) throw new ApiError(404, "not_found", "Lending record not found");
      return json({ data: result.lending });
    }
  }

  // --------------------------------------------------------------- people
  if (segments[0] === "people") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") return json({ data: await people.listPeople(userId) });
    if (segments.length === 1 && method === "POST") {
      const body = parseBody(z.object({ name: z.string().min(1).max(200) }), await readJson(request));
      const result = await people.createPerson(userId, body.name);
      if (!result.ok) throw new ApiError(409, "person_exists", result.error);
      return json({ data: result.person }, { status: 201 });
    }
    if (segments.length === 2 && method === "DELETE") {
      const result = await people.removePerson(userId, segments[1]);
      if (!result.ok)
        throw new ApiError(result.error === "Not found" ? 404 : 409, "person_delete_failed", result.error);
      return noContent();
    }
  }

  // --------------------------------------------------------------- groups
  if (segments[0] === "groups") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") return json({ data: await groups.listGroups(userId) });
    if (segments.length === 1 && method === "POST") {
      const body = parseBody(
        z.object({
          name: z.unknown(),
          color: z.unknown().optional(),
          mode: z.enum(["STATIC", "SMART"]).optional(),
          rule: z.unknown().optional(),
        }),
        await readJson(request),
      );
      if (body.mode === "SMART") {
        const result = await smartCollections.createSmartCollection(userId, body.name, body.rule, body.color);
        if (!result.ok)
          throw new ApiError(result.error === "DUPLICATE_NAME" ? 409 : 400, "invalid_group", result.error);
        return json({ data: result.group }, { status: 201 });
      }
      const result = await groups.createGroup(userId, body.name, body.color);
      if (!result.ok) throw new ApiError(400, "invalid_group", result.error);
      return json({ data: { id: result.groupId } }, { status: 201 });
    }
    if (segments.length === 2 && method === "PATCH") {
      const body = parseBody(z.object({ name: z.unknown() }), await readJson(request));
      const result = await groups.renameGroup(userId, segments[1], body.name);
      if (!result.ok) throw new ApiError(result.error === "NOT_FOUND" ? 404 : 400, "invalid_group", result.error);
      return json({ data: { ok: true } });
    }
    if (segments.length === 2 && method === "DELETE") {
      const result = await groups.deleteGroup(userId, segments[1]);
      if (!result.ok) throw new ApiError(404, "not_found", "Group not found");
      return noContent();
    }
    if (segments.length === 3 && segments[2] === "preview" && method === "POST") {
      const group = await db.bookGroup.findFirst({
        where: { id: segments[1], userId, mode: "SMART" },
        select: { ruleJson: true },
      });
      if (!group) throw new ApiError(404, "not_found", "Smart collection not found");
      let rule: unknown;
      try {
        rule = group.ruleJson ? JSON.parse(group.ruleJson) : null;
      } catch {
        throw new ApiError(422, "invalid_rule", "Smart collection rule is invalid");
      }
      const result = await smartCollections.previewSmartCollection(userId, rule);
      if (!result.ok) throw new ApiError(422, "invalid_rule", result.error);
      return json({ data: result });
    }
    if (segments.length === 3 && segments[2] === "rebuild" && method === "POST") {
      const result = await smartCollections.rebuildSmartCollection(userId, segments[1]);
      if (!result.ok)
        throw new ApiError(result.error === "NOT_FOUND" ? 404 : 422, "smart_collection_rebuild_failed", result.error);
      return json({ data: result });
    }
    if (segments.length === 4 && segments[2] === "books") {
      if (method === "POST") {
        const result = await groups.addBookToGroup(userId, segments[3], segments[1]);
        if (!result.ok) throw new ApiError(404, "not_found", "Book or group not found");
        return json({ data: { ok: true } }, { status: 201 });
      }
      if (method === "DELETE") {
        const result = await groups.removeBookFromGroup(userId, segments[3], segments[1]);
        if (!result.ok) throw new ApiError(404, "not_found", "Membership not found");
        return noContent();
      }
    }
  }

  // ---------------------------------------------------------------- goals
  if (segments[0] === "goals") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") return json({ data: await goals.getGoal(userId) });
    if (segments.length === 1 && (method === "PUT" || method === "POST")) {
      const body = parseBody(
        z.object({ yearly: z.number().int().min(0).max(999), monthly: z.number().int().min(0).max(999) }),
        await readJson(request),
      );
      const result = await goals.confirmGoals(userId, body.yearly, body.monthly);
      if (!result.ok) throw new ApiError(409, "goal_locked", result.error);
      return json({ data: result.goal });
    }
  }

  // ----------------------------------------------------------- challenges
  if (segments[0] === "challenges") {
    const userId = userIdOf(context, params);
    if (segments.length === 1 && method === "GET") return json({ data: await challenges.listChallenges(userId) });
    if (segments.length === 1 && method === "POST") {
      const body = parseBody(
        z.object({
          title: z.string().min(1).max(200),
          target: z.number().int().min(1),
          startAt: z.string(),
          endAt: z.string(),
        }),
        await readJson(request),
      );
      const result = await challenges.createChallenge(userId, body);
      if (!result.ok) throw new ApiError(400, "invalid_challenge", result.error);
      return json({ data: result.challenge }, { status: 201 });
    }
    if (segments.length === 2 && method === "DELETE") {
      const deleted = await challenges.deleteChallenge(userId, segments[1]);
      if (!deleted) throw new ApiError(404, "not_found", "Challenge not found");
      return noContent();
    }
  }

  // ---------------------------------------------------------------- stats
  if (segments[0] === "stats" && segments.length === 1 && method === "GET") {
    const userId = userIdOf(context, params);
    await requireUserExists(userId);
    return json({ data: await stats.getStats(userId) });
  }

  // ---------------------------------------------------------------- user
  if (segments[0] === "user" && segments.length === 1) {
    const userId = userIdOf(context, params);
    await requireUserExists(userId);
    if (method === "GET") return json({ data: await users.getUserProfile(userId) });
    if (method === "PATCH" || method === "PUT") {
      const body = parseBody(users.updateProfileSchema, await readJson(request));
      const result = await users.updateProfileName(userId, body.name);
      if (!result.ok) throw new ApiError(400, "invalid_profile", result.error);
      return json({ data: await users.getUserProfile(userId) });
    }
  }

  // --------------------------------------------------------------- tokens
  // Token management is session-only: a leaked token must not be able to
  // mint a more powerful token (especially an ADMIN one).
  if (segments[0] === "tokens") {
    if (context.via !== "session") {
      throw new ApiError(403, "session_required", "Token management requires a signed-in browser session");
    }
    if (segments.length === 1 && method === "GET") {
      return json({ data: await listApiTokens(context.userId) });
    }
    if (segments.length === 1 && method === "POST") {
      const body = parseBody(
        z.object({
          name: z.string().min(1).max(100),
          kind: z.enum(["USER", "ADMIN"]).default("USER"),
          scopes: z.array(z.string()).optional(),
          expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
          totpCode: z.string().optional(),
        }),
        await readJson(request),
      );
      if (body.kind === "ADMIN") {
        if (!context.isAdmin) throw new ApiError(403, "admin_required", "Only an admin can create ADMIN tokens");
        const admin = await db.user.findUnique({
          where: { id: context.userId },
          select: { totpSecret: true, totpEnabled: true },
        });
        if (admin?.totpEnabled && admin.totpSecret) {
          if (!body.totpCode || verifyTotpCode(admin.totpSecret, body.totpCode) !== "VALID") {
            throw new ApiError(403, "invalid_totp", "A valid TOTP code is required for ADMIN tokens");
          }
        }
      }
      const created = await createApiToken({
        userId: context.userId,
        name: body.name,
        kind: body.kind,
        scopes: body.scopes,
        expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : null,
      });
      return json({ data: created }, { status: 201 });
    }
    if (segments.length === 2 && method === "DELETE") {
      const revoked = await revokeApiToken(context.userId, segments[1]);
      if (!revoked) throw new ApiError(404, "not_found", "Token not found");
      return noContent();
    }
  }

  // ---------------------------------------------------------------- admin
  if (segments[0] === "admin") {
    requireAdminContext(context);
    if (segments[1] === "users" && segments.length === 2 && method === "GET") {
      return json({ data: await users.listUsersForAdmin() });
    }
    if (segments[1] === "users" && segments[2]) {
      const target = segments[2];
      if (segments.length === 3 && method === "GET") {
        const user = await users.getUserForAdmin(target);
        if (!user) throw new ApiError(404, "not_found", "User not found");
        return json({ data: user });
      }
      if (segments.length === 3 && method === "PATCH") {
        const body = parseBody(
          z.object({ approved: z.boolean().optional(), isAdmin: z.boolean().optional() }),
          await readJson(request),
        );
        if (body.approved !== undefined) {
          const ok = await users.setUserApproved(context.userId, target, body.approved);
          if (!ok) throw new ApiError(404, "not_found", "User not found");
        }
        if (body.isAdmin !== undefined) {
          const current = await db.user.findUnique({ where: { id: target }, select: { isAdmin: true } });
          if (!current) throw new ApiError(404, "not_found", "User not found");
          if (current.isAdmin !== body.isAdmin) await users.toggleUserAdmin(context.userId, target);
        }
        return json({ data: await users.getUserForAdmin(target) });
      }
      if (segments.length === 3 && method === "DELETE") {
        await users.deleteUserForAdmin(context.userId, target);
        return noContent();
      }
    }
    if (segments[1] === "scopes" && method === "GET") {
      return json({ data: SCOPE_GROUPS });
    }
  }

  throw new ApiError(404, "not_found", `No API route for ${method} ${BASE}/${segments.join("/")}`);
}

export async function handleV1Request(request: Request, segments: string[]): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return json({ data: null }, { status: 204 });

  // Public surface: discovery + OpenAPI.
  if (segments.length === 0 && method === "GET") {
    return json({
      data: {
        name: "BookShelf API",
        version: API_VERSION,
        documentation: `${BASE}/openapi.json`,
        authentication: "Authorization: Bearer <personal API token>",
      },
    });
  }
  if (segments.length === 1 && segments[0] === "openapi.json" && method === "GET") {
    return json(buildOpenApi(new URL(request.url).origin));
  }

  const required = requiredScope(method, segments);
  const context = await authenticateRequest(request, required);
  return route(request, segments, context);
}

function requiredScope(method: string, segments: string[]): ApiScope {
  const [root, id, child] = segments;
  const write = method !== "GET" && method !== "HEAD";
  if (root === "admin") return "admin:data";
  switch (root) {
    case "health":
      return "books:read";
    case "locations":
      return write ? "books:write" : "books:read";
    case "copies":
      return "books:write";
    case "books":
      if (id === "batch-lookup") return "books:read";
      return write ? "books:write" : "books:read";
    case "quotes":
      return write ? "quotes:write" : "quotes:read";
    case "lending":
      return write ? "lending:write" : "lending:read";
    case "people":
      return write ? "people:write" : "people:read";
    case "groups":
      return write ? "groups:write" : "groups:read";
    case "goals":
      return write ? "goals:write" : "goals:read";
    case "challenges":
      return write ? "challenges:write" : "challenges:read";
    case "stats":
      return "stats:read";
    case "user":
      return write ? "user:write" : "user:read";
    case "tokens":
      return "user:write";
    default:
      // Unknown routes still require authentication, then 404.
      if (id === "openapi.json" && !child) return "books:read";
      return "books:read";
  }
}

function buildOpenApi(origin: string) {
  const bearer = [{ bearerAuth: [] }];
  const userParam = {
    name: "userId",
    in: "query",
    required: false,
    schema: { type: "string" },
    description: "Admin tokens with admin:data may target another user.",
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "BookShelf API",
      version: "3.16.0",
      description:
        "Token-authenticated REST API for BookShelf. Create tokens in Settings → API tokens. USER tokens only access their owner's data; ADMIN tokens additionally unlock admin:data and admin:users.",
    },
    servers: [{ url: `${origin}${BASE}` }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "bs_usr_… / bs_adm_…" } },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
          },
        },
      },
    },
    security: bearer,
    paths: {
      "/books": {
        get: { summary: "List books", parameters: [userParam], responses: { "200": { description: "OK" } } },
        post: { summary: "Create a book", responses: { "201": { description: "Created" } } },
      },
      "/health/books": {
        get: { summary: "Generate a deterministic book health report", responses: { "200": { description: "OK" } } },
      },
      "/health/books/{id}/repair-preview": {
        post: { summary: "Preview safe repair suggestions for a book", responses: { "200": { description: "OK" } } },
      },
      "/books/{id}": {
        get: {
          summary: "Get a book",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } },
        },
        patch: { summary: "Update a book", responses: { "200": { description: "OK" } } },
        delete: { summary: "Delete a book", responses: { "204": { description: "Deleted" } } },
      },
      "/books/{id}/status": {
        post: { summary: "Set TO_READ / READING / FINISHED", responses: { "200": { description: "OK" } } },
      },
      "/books/{id}/progress": { post: { summary: "Log pages read", responses: { "200": { description: "OK" } } } },
      "/books/{id}/quotes": {
        get: { summary: "List quotes", responses: { "200": { description: "OK" } } },
        post: { summary: "Add a quote", responses: { "201": { description: "Created" } } },
      },
      "/quotes/{id}": {
        patch: { summary: "Update a quote", responses: { "200": { description: "OK" } } },
        delete: { summary: "Delete a quote", responses: { "204": { description: "Deleted" } } },
      },
      "/lending": {
        get: { summary: "List lending records", responses: { "200": { description: "OK" } } },
        post: { summary: "Lend a book", responses: { "201": { description: "Created" } } },
      },
      "/lending/{id}/return": { post: { summary: "Return a book", responses: { "200": { description: "OK" } } } },
      "/people": {
        get: { summary: "List people", responses: { "200": { description: "OK" } } },
        post: { summary: "Create a person", responses: { "201": { description: "Created" } } },
      },
      "/people/{id}": { delete: { summary: "Delete a person", responses: { "204": { description: "Deleted" } } } },
      "/groups": {
        get: { summary: "List shelves", responses: { "200": { description: "OK" } } },
        post: { summary: "Create a shelf", responses: { "201": { description: "Created" } } },
      },
      "/groups/{id}": {
        patch: { summary: "Rename a shelf", responses: { "200": { description: "OK" } } },
        delete: { summary: "Delete a shelf", responses: { "204": { description: "Deleted" } } },
      },
      "/groups/{id}/books/{bookId}": {
        post: { summary: "Add a book to a shelf", responses: { "201": { description: "Created" } } },
        delete: { summary: "Remove a book from a shelf", responses: { "204": { description: "Deleted" } } },
      },
      "/goals": {
        get: { summary: "Get reading goals", responses: { "200": { description: "OK" } } },
        put: {
          summary: "Confirm reading goals (locked until next year once set)",
          responses: { "200": { description: "OK" } },
        },
      },
      "/challenges": {
        get: { summary: "List challenges", responses: { "200": { description: "OK" } } },
        post: { summary: "Create a challenge", responses: { "201": { description: "Created" } } },
      },
      "/challenges/{id}": {
        delete: { summary: "Delete a challenge", responses: { "204": { description: "Deleted" } } },
      },
      "/stats": { get: { summary: "Reading statistics", responses: { "200": { description: "OK" } } } },
      "/user": {
        get: { summary: "Current user profile", responses: { "200": { description: "OK" } } },
        patch: { summary: "Update display name", responses: { "200": { description: "OK" } } },
      },
      "/tokens": {
        get: { summary: "List your API tokens (session only)", responses: { "200": { description: "OK" } } },
        post: { summary: "Create an API token (session only)", responses: { "201": { description: "Created" } } },
      },
      "/tokens/{id}": {
        delete: { summary: "Revoke a token (session only)", responses: { "204": { description: "Revoked" } } },
      },
      "/admin/users": { get: { summary: "List all users (ADMIN)", responses: { "200": { description: "OK" } } } },
      "/admin/users/{id}": {
        get: { summary: "Get a user (ADMIN)", responses: { "200": { description: "OK" } } },
        patch: { summary: "Approve or promote/demote a user (ADMIN)", responses: { "200": { description: "OK" } } },
        delete: { summary: "Delete a user (ADMIN)", responses: { "204": { description: "Deleted" } } },
      },
    },
  };
}
