// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { completeInventoryAudit, recordInventoryScan, startInventoryAudit } from "@/app/actions/inventory";

type Dict = {
  title: string;
  description: string;
  start: string;
  resume: string;
  allLocations: string;
  scan: string;
  barcode: string;
  found: string;
  missing: string;
  wrongLocation: string;
  complete: string;
  completed: string;
  noAudits: string;
  copyNotFound: string;
  completedError: string;
};
type Location = { id: string; name: string; archivedAt: Date | null };
type Audit = { id: string; status: string; scopeLocation: { name: string } | null; summary: Record<string, number> };

export function InventoryPanel({ locations, audits, dict }: { locations: Location[]; audits: Audit[]; dict: Dict }) {
  const [audit, setAudit] = useState<Audit | null>(audits[0] ?? null);
  const [scope, setScope] = useState("");
  const [barcode, setBarcode] = useState("");
  const [pending, startTransition] = useTransition();
  const isOpen = audit?.status === "OPEN";

  function begin() {
    startTransition(() => {
      void (async () => {
        const result = await startInventoryAudit(scope || null);
        if (!result.ok) return toast.error(result.error);
        setAudit(result.audit as Audit);
      })();
    });
  }
  function scan(value: string) {
    if (!audit) return;
    startTransition(() => {
      void (async () => {
        const result = await recordInventoryScan(audit.id, { barcode: value, source: "barcode" });
        if (!result.ok) return toast.error(result.error === "COPY_NOT_FOUND" ? dict.copyNotFound : result.error);
        setAudit((current) => (current ? { ...current, summary: result.summary } : current));
        setBarcode("");
      })();
    });
  }
  function finish() {
    if (!audit) return;
    startTransition(() => {
      void (async () => {
        const result = await completeInventoryAudit(audit.id);
        if (!result.ok) return toast.error(result.error || dict.completedError);
        setAudit(result.audit as Audit);
        toast.success(dict.completed);
      })();
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">{dict.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.description}</p>
      </header>
      {!isOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="min-w-52 flex-1 text-xs text-muted-foreground">
            {dict.allLocations}
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border)] bg-background px-2 py-2 text-sm text-foreground"
            >
              <option value="">{dict.allLocations}</option>
              {locations
                .filter((location) => !location.archivedAt)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={begin}
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            <ClipboardCheck size={15} className="mr-1 inline" />
            {audit ? dict.resume : dict.start}
          </button>
        </div>
      )}
      {audit ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{audit.scopeLocation?.name ?? dict.allLocations}</p>
              <p className="text-xs text-muted-foreground">
                {audit.status === "COMPLETED" ? dict.completed : dict.resume}
              </p>
            </div>
            {isOpen && (
              <button
                type="button"
                onClick={finish}
                disabled={pending}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                {dict.complete}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["FOUND", dict.found],
                ["MISSING", dict.missing],
                ["WRONG_LOCATION", dict.wrongLocation],
                ["EXPECTED", dict.scan],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="rounded-md bg-[var(--surface-elevated)] p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{audit.summary[key] ?? 0}</p>
              </div>
            ))}
          </div>
          {isOpen && (
            <div className="mt-4 flex gap-2">
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && barcode.trim()) scan(barcode.trim());
                }}
                placeholder={dict.barcode}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
              />
              <BarcodeScanner onDetected={scan} title={dict.scan} />
              <button
                type="button"
                onClick={() => barcode.trim() && scan(barcode.trim())}
                disabled={pending || !barcode.trim()}
                className="rounded-md bg-secondary px-3 py-2 text-sm disabled:opacity-40"
              >
                <ScanLine size={16} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-muted-foreground">
          {dict.noAudits}
        </div>
      )}
    </div>
  );
}
