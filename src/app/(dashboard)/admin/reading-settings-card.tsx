// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { updateAppSettings } from "@/app/actions/settings-admin";
import { Button } from "@/components/ui/button";

export type AppSettingsValues = {
  pagesPerReadEvent: number;
  xpBookAdded: number;
  xpBookFinishedBase: number;
  xpPagesPer10: number;
  xpLending: number;
  xpPerLevelBase: number;
};

export function ReadingSettingsCard({ initial, dict }: { initial: AppSettingsValues; dict: Record<string, string> }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const fields: { key: keyof AppSettingsValues; label: string }[] = [
    { key: "pagesPerReadEvent", label: dict.pagesPerReadEvent },
    { key: "xpBookAdded", label: dict.xpBookAdded },
    { key: "xpBookFinishedBase", label: dict.xpBookFinishedBase },
    { key: "xpPagesPer10", label: dict.xpPagesPer10 },
    { key: "xpLending", label: dict.xpLending },
    { key: "xpPerLevelBase", label: dict.xpPerLevelBase },
  ];

  function save() {
    startTransition(async () => {
      const res = await updateAppSettings(values);
      setMsg(res.ok ? dict.saved : (res as { ok: false; error: string }).error);
    });
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {field.label}
            <input
              type="number"
              min={1}
              value={values[field.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value === "" ? "" : Number(e.target.value) }))
              }
              className="rounded-[8px] border border-border bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {dict.save}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
