// SPDX-License-Identifier: GPL-3.0-only
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { getMyApiTokens } from "@/app/actions/tokens";
import { ApiTokensManager } from "@/components/settings/api-tokens-manager";

export const metadata = { title: "API Tokens" };

export default async function ApiTokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  const dict = await getDictionary();
  const tokens = await getMyApiTokens();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.apiTokens?.title ?? "API Tokens"}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.apiTokens?.subtitle ?? "Use tokens for the REST API and MCP endpoint."}
        </p>
      </header>
      <ApiTokensManager tokens={tokens as any} dict={dict.apiTokens ?? {}} isAdmin={!!user?.isAdmin} />
    </div>
  );
}
