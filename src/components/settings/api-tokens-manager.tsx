// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { createApiTokenAction, revokeApiTokenAction } from "@/app/actions/tokens";
import { toast } from "sonner";

type Token = {
  id: string;
  name: string;
  kind: string;
  prefix: string;
  scopes: string[];
  createdAt: string | Date;
  lastUsedAt: string | Date | null;
  expiresAt: string | Date | null;
  revokedAt: string | Date | null;
};

export function ApiTokensManager({ tokens, dict, isAdmin }: { tokens: Token[]; dict: Record<string, string>; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"USER" | "ADMIN">("USER");
  const [created, setCreated] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createApiTokenAction({ name, kind });
        setCreated(res.token);
        setName("");
        toast.success(dict.created ?? "Token created");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : (dict.error ?? "Failed"));
      }
    });
  };

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      try {
        await revokeApiTokenAction(id);
        toast.success(dict.revoked ?? "Revoked");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : (dict.error ?? "Failed"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)]">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.name ?? "Token name"}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-[var(--font-sans)] text-sm text-foreground"
              placeholder={dict.namePlaceholder ?? "CI/CD, MCP client"}
            />
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <label className="font-[var(--font-sans)] text-xs text-muted-foreground">{dict.kind ?? "Type"}</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "USER" | "ADMIN")}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 font-[var(--font-sans)] text-sm text-foreground"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          )}
          <button
            disabled={pending || !name.trim()}
            onClick={handleCreate}
            className="rounded-[10px] bg-[var(--accent)] px-3.5 py-1.5 font-[var(--font-sans)] text-[11px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            {pending ? (dict.creating ?? "Creating...") : (dict.create ?? "Create token")}
          </button>
        </div>
        {created && (
          <div className="mx-4 mb-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:mx-5">
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground mb-1">
              {dict.copyOnce ?? "Copy this token now. It won't be shown again."}
            </p>
            <code className="block break-all font-[var(--font-mono)] text-xs text-foreground">{created}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(created);
                toast.success(dict.copied ?? "Copied");
              }}
              className="mt-2 rounded-[10px] border border-[var(--border)] px-2.5 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground hover:bg-[var(--surface)]"
            >
              {dict.copy ?? "Copy"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)] overflow-hidden">
        <header className="px-4 py-3 sm:px-5">
          <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
            {dict.yourTokens ?? "Your tokens"}
          </h2>
        </header>
        <div className="divide-y divide-[var(--border)]">
          {tokens.length === 0 ? (
            <p className="px-4 py-6 text-center font-[var(--font-sans)] text-sm text-muted-foreground sm:px-5">
              {dict.none ?? "No tokens yet."}
            </p>
          ) : (
            tokens.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">
                    {t.name} <span className="text-muted-foreground">({t.kind})</span>
                  </p>
                  <p className="font-[var(--font-mono)] text-xs text-muted-foreground">{t.prefix}</p>
                  <p className="font-[var(--font-sans)] text-[11px] text-muted-foreground">{t.scopes.join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.revokedAt ? (
                    <span className="font-[var(--font-sans)] text-[11px] text-muted-foreground">
                      {dict.revoked ?? "Revoked"}
                    </span>
                  ) : (
                    <button
                      disabled={pending}
                      onClick={() => handleRevoke(t.id)}
                      className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-[var(--error-text)] transition-colors hover:bg-[var(--error-soft)]"
                    >
                      {dict.revoke ?? "Revoke"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
