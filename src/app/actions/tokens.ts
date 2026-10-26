// SPDX-License-Identifier: GPL-3.0-only
"use server";

import { auth } from "@/auth";
import { listApiTokens } from "@/lib/api/tokens";

export async function getMyApiTokens() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return listApiTokens(session.user.id);
}

export async function createApiTokenAction(input: { name: string; kind: "USER" | "ADMIN"; scopes?: string[] }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const { createApiToken } = await import("@/lib/api/tokens");
  return createApiToken({ userId: session.user.id, name: input.name, kind: input.kind, scopes: input.scopes });
}

export async function revokeApiTokenAction(tokenId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const { revokeApiToken } = await import("@/lib/api/tokens");
  await revokeApiToken(session.user.id, tokenId);
}
