// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — remote MCP endpoint (Streamable HTTP, stateless JSON responses).
//
// Authentication uses the same Bearer tokens as /api/v1. Configure a client
// with:  URL https://your-instance/api/mcp  +  Authorization: Bearer bs_…

import { authenticateRequest } from "@/lib/api/auth";
import { handleApiError, json, preflight } from "@/lib/api/responses";
import { handleMcpRequest, mcpError } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  try {
    const context = await authenticateRequest(request);
    return await handleMcpRequest(request, context);
  } catch (error) {
    // ApiError gets the REST envelope; transport failures get a JSON-RPC error.
    if (error instanceof Error && "status" in error) return handleApiError(error);
    return mcpError(error);
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET() {
  return json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "This MCP server is stateless; use POST with JSON-RPC messages." },
      id: null,
    },
    { status: 405 },
  );
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}

export async function OPTIONS() {
  return preflight();
}
