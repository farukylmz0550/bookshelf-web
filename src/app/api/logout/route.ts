// SPDX-License-Identifier: GPL-3.0-only
// v3.10.1 — stale-session sign-out for the dashboard layout. signOut() writes
// cookies, and Next 16 only allows cookie writes inside Server Actions or
// Route Handlers (render-time writes throw E1180, surfacing in production as
// React error #441). A ghost session — cookie present, user row gone — is
// therefore cleaned up here, in a Route Handler, and the dashboard layout
// simply redirects to this endpoint instead of calling signOut() in render.

import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = new URL("/login", request.url);
  await signOut({ redirectTo: target.toString() });
  // signOut({ redirectTo }) redirects; this is a fallback if it returns.
  return Response.redirect(target);
}
