// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — remote MCP server.
//
// The MCP endpoint shares the REST API's personal tokens. Tool visibility is
// filtered by token scopes: a books:read token can read books but any write
// tool call returns a tool error, and admin tools require admin:data/users.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth";
import { hasScope, type ApiScope } from "@/lib/api/scopes";
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
import * as inventory from "@/lib/services/inventory";
import { buildHealthReport } from "@/lib/books/health";
import * as users from "@/lib/services/users";
import { json } from "@/lib/api/responses";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function guard(context: AuthContext, scope: ApiScope): string | null {
  if (!hasScope(context.scopes, scope)) return `Missing scope: ${scope}`;
  return null;
}

export function createMcpServer(context: AuthContext): McpServer {
  const server = new McpServer(
    { name: "bookshelf", version: "3.16.0" },
    {
      instructions:
        "BookShelf personal library. Use list_books/search_books before mutating; dates are ISO 8601; statuses are TO_READ, READING, FINISHED.",
    },
  );

  const register = (
    name: string,
    scope: ApiScope,
    config: unknown,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>,
  ) => {
    (server as unknown as { registerTool: (...a: unknown[]) => void }).registerTool(
      name,
      config,
      async (args: Record<string, unknown>) => {
        const missing = guard(context, scope);
        if (missing) return fail(missing);
        try {
          return await handler(args);
        } catch (error) {
          return fail(error instanceof Error ? error.message : "Request failed");
        }
      },
    );
  };

  register(
    "list_books",
    "books:read",
    {
      description: "List the caller's books, optionally filtered.",
      inputSchema: {
        search: z.string().optional(),
        status: z.enum(["TO_READ", "READING", "FINISHED"]).optional(),
        tag: z.string().optional(),
        groupId: z.string().optional(),
        lent: z.enum(["any", "home", "out"]).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (args) =>
      ok(
        await books.listBooks(context.userId, {
          search: args.search as string | undefined,
          status: args.status as string | undefined,
          tag: args.tag as string | undefined,
          groupId: args.groupId as string | undefined,
          lent: args.lent as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        }),
      ),
  );

  register(
    "get_book",
    "books:read",
    {
      description: "Get one book by id.",
      inputSchema: { id: z.string().min(1) },
    },
    async (args) => {
      const book = await books.getBook(context.userId, args.id as string);
      return book ? ok(book) : fail("Book not found");
    },
  );

  register(
    "add_book",
    "books:write",
    {
      description: "Add a book to the library.",
      inputSchema: {
        title: z.string().min(1),
        author: z.string().optional(),
        isbn: z.string().optional(),
        numberOfPages: z.string().optional(),
        coverUrl: z.string().url().optional(),
        publishers: z.string().optional(),
        publishDate: z.string().optional(),
        series: z.string().optional(),
        subtitle: z.string().optional(),
      },
    },
    async (args) => {
      const result = await books.createBook(context.userId, args as books.AddBookInput);
      return result.ok ? ok(result.book) : fail(result.error);
    },
  );

  register(
    "lookup_books_by_isbn",
    "books:read",
    {
      description: `Look up up to ${batchBooks.MAX_BATCH_ISBNS} ISBNs and classify invalid, duplicate, and unresolved entries without changing the library.`,
      inputSchema: { isbns: z.array(z.string().max(40)).min(1).max(batchBooks.MAX_BATCH_ISBNS) },
    },
    async (args) => ok(await batchBooks.lookupBooksBatch(context.userId, args.isbns as string[])),
  );

  register(
    "add_books_batch",
    "books:write",
    {
      description: `Add up to ${batchBooks.MAX_BATCH_ISBNS} reviewed ISBN lookup results. Existing ISBNs are skipped and retries are idempotent when an idempotency key is supplied.`,
      inputSchema: {
        items: z.array(z.record(z.string(), z.unknown())).min(1).max(batchBooks.MAX_BATCH_ISBNS),
        idempotencyKey: z.string().min(1).max(120).optional(),
      },
    },
    async (args) =>
      ok(
        await batchBooks.createBooksBatch(
          context.userId,
          args.items as never[],
          args.idempotencyKey as string | undefined,
        ),
      ),
  );

  register(
    "update_book",
    "books:write",
    {
      description: "Update metadata of one of the caller's books.",
      inputSchema: {
        id: z.string().min(1),
        title: z.string().optional(),
        author: z.string().optional(),
        rating: z.number().int().min(0).max(5).optional(),
        notes: z.string().optional(),
        tags: z.string().optional(),
        signed: z.boolean().optional(),
        copies: z.number().int().min(1).max(999).optional(),
        numberOfPages: z.string().optional(),
        currentPage: z.number().int().min(0).optional(),
      },
    },
    async (args) => {
      const { id, ...patch } = args;
      const result = await books.updateBook(context.userId, id as string, patch as books.UpdateBookInput);
      return result.ok ? ok(result.book) : fail(result.error);
    },
  );

  register(
    "set_book_status",
    "books:write",
    {
      description: "Set a book's status (FINISHED requires all pages read when a page count is known).",
      inputSchema: { id: z.string().min(1), status: z.enum(["TO_READ", "READING", "FINISHED"]) },
    },
    async (args) => {
      const result = await books.setBookStatus(context.userId, args.id as string, args.status as books.BookStatusValue);
      if (!result.ok) return fail(result.error);
      return ok(await books.getBook(context.userId, args.id as string));
    },
  );

  register(
    "log_pages_read",
    "books:write",
    {
      description: "Log pages read for a book (advances currentPage and the reading streak).",
      inputSchema: { id: z.string().min(1), pages: z.number().int().min(1).max(5000).optional() },
    },
    async (args) => ok(await books.logPagesRead(context.userId, args.id as string, args.pages as number | undefined)),
  );

  register(
    "list_quotes",
    "quotes:read",
    {
      description: "List quotes for a book.",
      inputSchema: { bookId: z.string().min(1) },
    },
    async (args) => ok(await quotes.listQuotes(context.userId, args.bookId as string)),
  );

  register(
    "add_quote",
    "quotes:write",
    {
      description: "Add a quote to a book.",
      inputSchema: {
        bookId: z.string().min(1),
        text: z.string().min(1),
        page: z.number().int().min(1).max(100000).nullable().optional(),
      },
    },
    async (args) => {
      const result = await quotes.addQuote(context.userId, args as never);
      return result.ok ? ok(result.quote) : fail(result.error);
    },
  );

  register(
    "list_lending",
    "lending:read",
    {
      description: "List lending records.",
      inputSchema: { open: z.boolean().optional() },
    },
    async (args) => ok(await lending.listLending(context.userId, { open: args.open as boolean | undefined })),
  );

  register(
    "lend_book",
    "lending:write",
    {
      description: "Lend a book to a person.",
      inputSchema: {
        bookId: z.string().min(1),
        personId: z.string().min(1),
        dueDate: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const result = await lending.createLending(
        context.userId,
        args.bookId as string,
        args.personId as string,
        args.dueDate as string | null | undefined,
      );
      return result.ok ? ok(result.lending) : fail(result.error);
    },
  );

  register(
    "return_book",
    "lending:write",
    {
      description: "Mark a lending record as returned.",
      inputSchema: { lendingId: z.string().min(1) },
    },
    async (args) => {
      const result = await lending.returnLending(context.userId, args.lendingId as string);
      return result.ok ? ok(result.lending) : fail(result.error);
    },
  );

  register("list_people", "people:read", { description: "List borrowers.", inputSchema: {} }, async () =>
    ok(await people.listPeople(context.userId)),
  );

  register(
    "create_person",
    "people:write",
    { description: "Create a borrower.", inputSchema: { name: z.string().min(1).max(200) } },
    async (args) => {
      const result = await people.createPerson(context.userId, args.name as string);
      return result.ok ? ok(result.person) : fail(result.error);
    },
  );

  register("list_shelves", "groups:read", { description: "List shelves/groups.", inputSchema: {} }, async () =>
    ok(await groups.listGroups(context.userId)),
  );

  register(
    "create_shelf",
    "groups:write",
    { description: "Create a shelf.", inputSchema: { name: z.string().min(1), color: z.string().optional() } },
    async (args) => {
      const result = await groups.createGroup(context.userId, args.name, args.color);
      return result.ok ? ok({ id: result.groupId }) : fail(result.error);
    },
  );

  register(
    "add_book_to_shelf",
    "groups:write",
    {
      description: "Add a book to a shelf.",
      inputSchema: { bookId: z.string().min(1), shelfId: z.string().min(1) },
    },
    async (args) => {
      const result = await groups.addBookToGroup(context.userId, args.bookId as string, args.shelfId as string);
      return result.ok ? ok({ ok: true }) : fail(result.error);
    },
  );

  register("get_goals", "goals:read", { description: "Get yearly/monthly reading goals.", inputSchema: {} }, async () =>
    ok(await goals.getGoal(context.userId)),
  );

  register(
    "set_goals",
    "goals:write",
    {
      description: "Confirm reading goals. They are locked until next year once confirmed.",
      inputSchema: { yearly: z.number().int().min(0).max(999), monthly: z.number().int().min(0).max(999) },
    },
    async (args) => {
      const result = await goals.confirmGoals(context.userId, args.yearly as number, args.monthly as number);
      return result.ok ? ok(result.goal) : fail(result.error);
    },
  );

  register(
    "list_challenges",
    "challenges:read",
    { description: "List seasonal challenges.", inputSchema: {} },
    async () => ok(await challenges.listChallenges(context.userId)),
  );

  register(
    "create_challenge",
    "challenges:write",
    {
      description: "Create a seasonal challenge.",
      inputSchema: {
        title: z.string().min(1),
        target: z.number().int().min(1),
        startAt: z.string(),
        endAt: z.string(),
      },
    },
    async (args) => {
      const result = await challenges.createChallenge(context.userId, args as never);
      return result.ok ? ok(result.challenge) : fail(result.error);
    },
  );

  register(
    "get_stats",
    "stats:read",
    { description: "Reading statistics for the caller.", inputSchema: {} },
    async () => ok(await stats.getStats(context.userId)),
  );

  register(
    "books_health_report",
    "books:read",
    {
      description: "Generate a deterministic data-quality report for the caller's books.",
      inputSchema: { limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() },
    },
    async (args) =>
      ok(
        await health.getBooksHealthReport(context.userId, {
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        }),
      ),
  );

  register(
    "preview_book_repair",
    "books:read",
    { description: "Preview non-mutating repair suggestions for one book.", inputSchema: { id: z.string().min(1) } },
    async (args) => {
      const book = await health.getBookForRepairPreview(context.userId, args.id as string);
      return book
        ? ok({ book, findings: buildHealthReport([book]).findings, applySupported: false })
        : fail("Book not found");
    },
  );

  register(
    "list_locations",
    "books:read",
    { description: "List the caller's physical library locations.", inputSchema: {} },
    async () => ok(await locations.listLocations(context.userId)),
  );
  register(
    "create_location",
    "books:write",
    {
      description: "Create a physical library location.",
      inputSchema: {
        name: z.string().min(1).max(120),
        kind: z.enum(["ROOM", "SECTION", "SHELF", "BOX"]),
        parentId: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const result = await locations.createLocation(
        context.userId,
        args as { name: unknown; kind: unknown; parentId?: string | null },
      );
      return result.ok ? ok(result.location) : fail(result.error);
    },
  );
  register(
    "list_book_copies",
    "books:read",
    { description: "List physical copies for one book.", inputSchema: { bookId: z.string().min(1) } },
    async (args) => {
      const result = await locations.listBookCopies(context.userId, args.bookId as string);
      return result.ok ? ok(result.copies) : fail(result.error);
    },
  );
  register(
    "assign_book_copy_location",
    "books:write",
    {
      description: "Assign or clear a physical location for a book copy.",
      inputSchema: { copyId: z.string().min(1), locationId: z.string().nullable() },
    },
    async (args) => {
      const result = await locations.assignCopyLocation(
        context.userId,
        args.copyId as string,
        args.locationId as string | null,
      );
      return result.ok ? ok(result.copy) : fail(result.error);
    },
  );
  register(
    "start_inventory_audit",
    "books:write",
    {
      description: "Start or resume a physical inventory audit for the library or a location tree.",
      inputSchema: { scopeLocationId: z.string().nullable().optional() },
    },
    async (args) => {
      const result = await inventory.startInventoryAudit(
        context.userId,
        args.scopeLocationId as string | null | undefined,
      );
      return result.ok ? ok(result.audit) : fail(result.error);
    },
  );
  register(
    "record_inventory_scan",
    "books:write",
    {
      description: "Record an idempotent copy scan in an open inventory audit.",
      inputSchema: {
        auditId: z.string().min(1),
        copyId: z.string().optional(),
        barcode: z.string().optional(),
        source: z.string().optional(),
        note: z.string().optional(),
      },
    },
    async (args) => {
      const result = await inventory.recordInventoryScan(context.userId, args.auditId as string, args);
      return result.ok ? ok(result) : fail(result.error);
    },
  );
  register(
    "complete_inventory_audit",
    "books:write",
    {
      description: "Complete an inventory audit and mark unscanned expected copies as missing.",
      inputSchema: { auditId: z.string().min(1) },
    },
    async (args) => {
      const result = await inventory.completeInventoryAudit(context.userId, args.auditId as string);
      return result.ok ? ok(result.audit) : fail(result.error);
    },
  );
  register(
    "get_inventory_summary",
    "books:read",
    { description: "List physical inventory audits and their found/missing summary.", inputSchema: {} },
    async () => ok(await inventory.listInventoryAudits(context.userId)),
  );
  register(
    "preview_collection",
    "books:read",
    {
      description: "Preview books matching an allow-listed smart collection rule.",
      inputSchema: { rule: z.unknown() },
    },
    async (args) => {
      const result = await smartCollections.previewSmartCollection(context.userId, args.rule);
      return result.ok ? ok(result) : fail(result.error);
    },
  );
  register(
    "create_smart_collection",
    "books:write",
    {
      description: "Create a smart collection using a validated rule AST.",
      inputSchema: { name: z.string().min(1).max(60), rule: z.unknown(), color: z.string().optional() },
    },
    async (args) => {
      const result = await smartCollections.createSmartCollection(context.userId, args.name, args.rule, args.color);
      return result.ok ? ok(result) : fail(result.error);
    },
  );

  register(
    "admin_list_users",
    "admin:users",
    { description: "List all users (ADMIN only).", inputSchema: {} },
    async () => {
      if (!context.isAdmin) return fail("Administrator access is required");
      return ok(await users.listUsersForAdmin());
    },
  );

  register(
    "admin_get_user",
    "admin:users",
    { description: "Get a user by id (ADMIN only).", inputSchema: { userId: z.string().min(1) } },
    async (args) => {
      if (!context.isAdmin) return fail("Administrator access is required");
      const user = await users.getUserForAdmin(args.userId as string);
      return user ? ok(user) : fail("User not found");
    },
  );

  server.registerResource(
    "library-summary",
    "bookshelf://stats",
    {
      title: "Reading statistics",
      description: "Aggregated statistics for the token owner",
      mimeType: "application/json",
    },
    async () => {
      if (!hasScope(context.scopes, "stats:read")) {
        return { contents: [{ uri: "bookshelf://stats", text: "Missing scope: stats:read" }] };
      }
      return {
        contents: [
          {
            uri: "bookshelf://stats",
            text: JSON.stringify(await stats.getStats(context.userId), null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  server.registerResource(
    "library-books",
    "bookshelf://books",
    { title: "Library books", description: "The token owner's books as JSON", mimeType: "application/json" },
    async () => {
      if (!hasScope(context.scopes, "books:read")) {
        return { contents: [{ uri: "bookshelf://books", text: "Missing scope: books:read" }] };
      }
      const result = await books.listBooks(context.userId, { limit: 500 });
      return {
        contents: [
          { uri: "bookshelf://books", text: JSON.stringify(result.books, null, 2), mimeType: "application/json" },
        ],
      };
    },
  );

  return server;
}

export async function handleMcpRequest(request: Request, context: AuthContext): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = createMcpServer(context);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export function mcpError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "MCP request failed";
  return json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status: 400 });
}
