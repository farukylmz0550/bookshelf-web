// SPDX-License-Identifier: GPL-3.0-only
// v3.16.0 — shared HTTP helpers for the REST API and MCP endpoint.

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function noContent(): Response {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 204, headers });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Parse a JSON body, translating malformed input into a 400 ApiError. */
export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof Error) {
    // Keep expected ownership/lookup failures readable instead of leaking stacks.
    if (error.message === "Unauthorized")
      return json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
    if (error.message.startsWith("Forbidden")) {
      return json({ error: { code: "forbidden", message: error.message } }, { status: 403 });
    }
    if (error.message === "Not found") {
      return json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
    }
    return json({ error: { code: "internal_error", message: error.message } }, { status: 500 });
  }
  return json({ error: { code: "internal_error", message: "Unexpected error" } }, { status: 500 });
}

/** Format a Zod issue list into the API's error envelope. */
export function validationError(issues: { path: (string | number)[]; message: string }[]): ApiError {
  return new ApiError(400, "validation_error", "Invalid request", {
    issues: issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}
