// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { uploadExtension, removeExtension, toggleMyExtension } from "@/app/actions/extensions";
import { toast } from "sonner";

type ExtensionRow = {
  id: string;
  slug: string;
  name: string;
  version: string;
  type: string;
  manifest: unknown;
  userEnabled: boolean;
};

export function ExtensionsManager({ extensions, dict }: { extensions: ExtensionRow[]; dict: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await uploadExtension(formData);
      toast.success(dict.installed ?? "Extension installed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (dict.installFailed ?? "Install failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
              {dict.installTitle ?? "Install extension"}
            </h2>
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground">
              {dict.installHelp ?? "Upload a .zip package."}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-[10px] border border-[var(--border)] px-3.5 py-1.5 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-elevated)]">
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={uploading || pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? (dict.uploading ?? "Uploading...") : (dict.upload ?? "Upload ZIP")}
          </label>
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)] overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 sm:px-5">
          <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
            {dict.installedTitle ?? "Installed"}
          </h2>
        </header>
        <div className="divide-y divide-[var(--border)]">
          {extensions.length === 0 ? (
            <p className="px-4 py-6 text-center font-[var(--font-sans)] text-sm text-muted-foreground sm:px-5">
              {dict.none ?? "No extensions installed."}
            </p>
          ) : (
            extensions.map((ext) => (
              <div key={ext.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">
                    {ext.name} <span className="text-muted-foreground">v{ext.version}</span>
                  </p>
                  <p className="font-[var(--font-sans)] text-xs text-muted-foreground">
                    {ext.slug} • {ext.type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ext.type !== "server" && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await toggleMyExtension(ext.slug, !ext.userEnabled);
                          toast.success(dict.updated ?? "Updated");
                        })
                      }
                      className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      {ext.userEnabled ? (dict.disable ?? "Disable") : (dict.enable ?? "Enable")}
                    </button>
                  )}
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeExtension(ext.slug);
                        toast.success(dict.removed ?? "Removed");
                      })
                    }
                    className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-[var(--error-text)] transition-colors hover:bg-[var(--error-soft)]"
                  >
                    {dict.remove ?? "Remove"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
