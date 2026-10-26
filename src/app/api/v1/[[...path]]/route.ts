// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — versioned REST API entry point.

import { handleV1Request } from "@/lib/api/router";
import { handleApiError, preflight } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { path } = await context.params;
    return await handleV1Request(request, path ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}
export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}
export async function PUT(request: Request, context: RouteContext) {
  return handle(request, context);
}
export async function PATCH(request: Request, context: RouteContext) {
  return handle(request, context);
}
export async function DELETE(request: Request, context: RouteContext) {
  return handle(request, context);
}
export async function OPTIONS() {
  return preflight();
}
