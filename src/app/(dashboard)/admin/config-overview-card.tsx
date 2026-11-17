// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Code2, Database, Loader2 } from "lucide-react";
import { disableOwnAdminTotpInDevelopment } from "@/app/actions/admin";

type Dict = {
  title: string;
  desc: string;
  metadataSources: string;
  smartShelves: string;
  developmentMode: string;
  enabled: string;
  disabled: string;
  disableTotp: string;
  disableTotpConfirm: string;
  totpDisabled: string;
  developmentWarning: string;
  publishers: string;
  authors: string;
  series: string;
};

export function ConfigOverviewCard({
  config,
  openLibrarySubmissionConfigured,
  totpEnabled,
  dict,
}: {
  config: {
    publishers: boolean;
    authors: boolean;
    series: boolean;
    developmentMode: boolean;
  };
  openLibrarySubmissionConfigured: boolean;
  totpEnabled: boolean;
  dict: Dict;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(totpEnabled);
  const router = useRouter();
  const badge = (active: boolean) => (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[11px] text-muted-foreground">
      {active ? dict.enabled : dict.disabled}
    </span>
  );

  function disableTotp() {
    if (!window.confirm(dict.disableTotpConfirm)) return;
    startTransition(async () => {
      const result = await disableOwnAdminTotpInDevelopment();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEnabled(false);
      toast.success(dict.totpDisabled);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3">
        <Code2 className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <h2 className="font-[var(--font-serif)] text-sm font-semibold">{dict.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{dict.desc}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[10px] border border-[var(--border)] p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Database className="size-4" />
            {dict.metadataSources}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>Open Library</li>
            <li>
              Open Library submission {openLibrarySubmissionConfigured ? `· ${dict.enabled}` : `· ${dict.disabled}`}
            </li>
            <li>Leipzig University Library</li>
            <li>Tel Aviv University Libraries</li>
            <li>Rice University Library</li>
            <li>Internet Archive</li>
          </ul>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] p-3">
          <p className="text-sm font-medium">{dict.smartShelves}</p>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>{dict.publishers}</span>
              {badge(config.publishers)}
            </div>
            <div className="flex items-center justify-between">
              <span>{dict.authors}</span>
              {badge(config.authors)}
            </div>
            <div className="flex items-center justify-between">
              <span>{dict.series}</span>
              {badge(config.series)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[10px] border border-[var(--border)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{dict.developmentMode}</p>
          {badge(config.developmentMode)}
        </div>
        {config.developmentMode && (
          <>
            <p className="mt-2 flex items-start gap-2 text-xs text-[var(--destructive)]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {dict.developmentWarning}
            </p>
            {enabled && (
              <button
                type="button"
                onClick={disableTotp}
                disabled={pending}
                className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-[var(--destructive)] px-3 py-1.5 text-xs text-[var(--destructive)] disabled:opacity-50"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                {dict.disableTotp}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
