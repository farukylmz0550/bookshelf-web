// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useTransition } from "react";
import { uploadExtension, removeExtension, toggleExtension, setServerDefaultTheme } from "@/app/actions/extensions";
import { toast } from "sonner";

type ExtensionRow = {
  id: string;
  slug: string;
  name: string;
  version: string;
  type: string;
  manifest: unknown;
  enabled: boolean;
  secret?: string | null;
  settings?: Record<string, unknown>;
};

export function AdminExtensionsManager({
  extensions,
  defaultThemeSlug,
  dict,
}: {
  extensions: ExtensionRow[];
  defaultThemeSlug: string | null;
  dict: Record<string, string>;
}) {
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

  const themes = extensions.filter((e) => e.type === "THEME");

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
              {dict.installTitle ?? "Install extension"}
            </h2>
            <p className="font-[var(--font-sans)] text-xs text-muted-foreground">
              {dict.installHelp ?? "Admin can install server extensions too."}
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
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
            {dict.themes ?? "Themes"}
          </h2>
          <select
            className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 font-[var(--font-sans)] text-[11px] text-foreground"
            value={defaultThemeSlug ?? ""}
            onChange={(e) =>
              startTransition(async () => {
                await setServerDefaultTheme(e.target.value || null);
                toast.success(dict.updated ?? "Updated");
              })
            }
            disabled={pending}
          >
            <option value="">{dict.noDefault ?? "No server default"}</option>
            {themes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </header>
        <div className="divide-y divide-[var(--border)]">
          {themes.length === 0 ? (
            <p className="px-4 py-6 text-center font-[var(--font-sans)] text-sm text-muted-foreground sm:px-5">
              {dict.none ?? "No themes."}
            </p>
          ) : (
            themes.map((ext) => (
              <div key={ext.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">
                    {ext.name} <span className="text-muted-foreground">v{ext.version}</span>
                  </p>
                  <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{ext.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleExtension(ext.slug, !ext.enabled);
                        toast.success(dict.updated ?? "Updated");
                      })
                    }
                    className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    {ext.enabled ? (dict.disable ?? "Disable") : (dict.enable ?? "Enable")}
                  </button>
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

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)] overflow-hidden">
        <header className="px-4 py-3 sm:px-5">
          <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
            {dict.ui ?? "UI Extensions"}
          </h2>
        </header>
        <div className="divide-y divide-[var(--border)]">
          {extensions.filter((e) => e.type === "UI").length === 0 ? (
            <p className="px-4 py-6 text-center font-[var(--font-sans)] text-sm text-muted-foreground sm:px-5">
              {dict.none ?? "None."}
            </p>
          ) : (
            extensions
              .filter((e) => e.type === "UI")
              .map((ext) => (
                <div key={ext.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">
                      {ext.name} <span className="text-muted-foreground">v{ext.version}</span>
                    </p>
                    <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{ext.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await toggleExtension(ext.slug, !ext.enabled);
                          toast.success(dict.updated ?? "Updated");
                        })
                      }
                      className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      {ext.enabled ? (dict.disable ?? "Disable") : (dict.enable ?? "Enable")}
                    </button>
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

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,15,15,0.02)] overflow-hidden">
        <header className="px-4 py-3 sm:px-5">
          <h2 className="font-[var(--font-serif)] text-base font-semibold text-foreground">
            {dict.server ?? "Server Extensions"}
          </h2>
        </header>
        <div className="divide-y divide-[var(--border)]">
          {extensions.filter((e) => e.type === "SERVER").length === 0 ? (
            <p className="px-4 py-6 text-center font-[var(--font-sans)] text-sm text-muted-foreground sm:px-5">
              {dict.none ?? "None."}
            </p>
          ) : (
            extensions
              .filter((e) => e.type === "SERVER")
              .map((ext) => (
                <div key={ext.id} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-[var(--font-sans)] text-sm font-medium text-foreground">
                        {ext.name} <span className="text-muted-foreground">v{ext.version}</span>
                      </p>
                      <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{ext.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await toggleExtension(ext.slug, !ext.enabled);
                            toast.success(dict.updated ?? "Updated");
                          })
                        }
                        className="rounded-[10px] border border-[var(--border)] px-3 py-1 font-[var(--font-sans)] text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        {ext.enabled ? (dict.disable ?? "Disable") : (dict.enable ?? "Enable")}
                      </button>
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
                  {ext.secret ? (
                    <p className="font-[var(--font-mono)] text-[10px] text-muted-foreground break-all">
                      Secret: {ext.secret}
                    </p>
                  ) : null}
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
