// SPDX-License-Identifier: GPL-3.0-only
"use client";

// v3.0.0 — Settings → Kobo Sync: create/rotate the device api_endpoint URL
// and configure the per-user download URL template.
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createKoboSyncUrl, setFileSourceUrl } from "@/app/actions/kobo";

export type KoboDict = {
  title: string;
  desc: string;
  noUrl: string;
  createUrl: string;
  urlLabel: string;
  confTitle: string;
  confDesc: string;
  created: string;
  fileSource: string;
  fileSourcePlaceholder: string;
  fileSourceHint: string;
  saved: string;
  save: string;
};

const CONF_STEPS = ["1. USB: .kobo/Kobo/Kobo eReader.conf", "2. [OneStoreServices] api_endpoint=...", "3. Sync"];

export function KoboSyncCard({
  initialUrl,
  initialFileSource,
  dict,
}: {
  initialUrl: string | null;
  initialFileSource: string | null;
  dict: KoboDict | null;
}) {
  const [syncUrl, setSyncUrl] = useState(initialUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [fileSource, setFileSource] = useState<string>(initialFileSource ?? "");
  const [fileSourceMsg, setFileSourceMsg] = useState<string | null>(null);
  const [fsPending, startFsTransition] = useTransition();

  if (!dict) return null;
  const d = dict;

  function create() {
    startTransition(async () => {
      const res = await createKoboSyncUrl();
      if (res.ok && res.url) {
        setSyncUrl(res.url);
        setMsg(d.created);
      } else {
        setMsg(res.error ?? "Failed");
      }
    });
  }

  function saveFileSource() {
    startFsTransition(async () => {
      const res = await setFileSourceUrl(fileSource);
      setFileSourceMsg(res.ok ? d.saved : (res.error ?? "Failed"));
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="px-1 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {d.title}
      </h2>
      <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{d.desc}</p>

        {syncUrl ? (
          <div className="space-y-2">
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{d.urlLabel}</p>
            <code className="block break-all rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-foreground">
              api_endpoint={syncUrl}
            </code>
          </div>
        ) : (
          <div>
            <Button size="sm" onClick={create} disabled={pending}>
              {d.createUrl}
            </Button>
          </div>
        )}
        {syncUrl && (
          <Button size="sm" variant="outline" onClick={create} disabled={pending}>
            {d.createUrl}
          </Button>
        )}
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}

        <div className="rounded-[8px] bg-[var(--surface-elevated)] px-3 py-2">
          <p className="text-xs font-medium text-foreground">{d.confTitle}</p>
          {CONF_STEPS.map((step) => (
            <p key={step} className="text-xs text-muted-foreground">
              {step}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">{d.confDesc}</p>
        </div>

        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {d.fileSource}
            <input
              type="url"
              value={fileSource}
              placeholder={d.fileSourcePlaceholder}
              onChange={(e) => setFileSource(e.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <p className="text-xs text-muted-foreground">{d.fileSourceHint}</p>
          <Button size="sm" onClick={saveFileSource} disabled={fsPending}>
            {d.save}
          </Button>
          {fileSourceMsg && <span className="text-sm text-muted-foreground">{fileSourceMsg}</span>}
        </div>
      </div>
    </div>
  );
}
