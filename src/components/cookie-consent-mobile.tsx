// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { Cookie, Shield, BarChart3, Settings, X } from "lucide-react";
import { PrefRow } from "@/components/pref-row";
import type { CookieDict } from "@/components/cookie-consent";
import type { useCookieConsent } from "@/lib/use-cookie-consent";

export function CookieConsentMobile({ t, consent }: { t: CookieDict; consent: ReturnType<typeof useCookieConsent> }) {
  const {
    view,
    preferences,
    analytics,
    setView,
    setPreferences,
    setAnalytics,
    acceptAll,
    rejectAll,
    savePreferences,
    dismiss,
  } = consent;
  const cardBase = "border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg rounded-[12px]";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] md:hidden p-3 safe-bottom">
      <div className={`${cardBase} mx-auto max-w-[640px] overflow-hidden`}>
        {view === "banner" ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Cookie size={16} />
              </div>
              <div className="flex-1">
                <h2 className="font-[var(--font-serif)] text-sm font-semibold text-foreground">{t.title}</h2>
                <p className="mt-1 font-[var(--font-sans)] text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {t.mobileDesc}
                </p>
              </div>
              <button
                onClick={dismiss}
                className="rounded-[8px] p-1 text-muted-foreground hover:bg-accent"
                aria-label={t.close}
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={acceptAll}
                className="flex-1 rounded-[8px] bg-[var(--accent)] px-3 py-2.5 font-[var(--font-sans)] text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                {t.accept}
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-[var(--font-sans)] text-sm font-medium text-foreground"
              >
                {t.reject}
              </button>
              <button
                onClick={() => setView("preferences")}
                className="rounded-[8px] border border-[var(--border)] px-3 py-2.5 font-[var(--font-sans)] text-xs text-muted-foreground"
              >
                {t.preferencesBtn}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-[var(--font-sans)] text-sm font-semibold text-foreground">{t.preferencesTitle}</h3>
              <button onClick={() => setView("banner")} className="text-xs text-muted-foreground underline">
                {t.back}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <PrefRow icon={<Shield size={14} />} title={t.essentialTitle} desc={t.essentialDesc} checked disabled />
              <PrefRow
                icon={<Settings size={14} />}
                title={t.preferencesTitle}
                desc={t.preferencesDesc}
                checked={preferences}
                onChange={setPreferences}
              />
              <PrefRow
                icon={<BarChart3 size={14} />}
                title={t.analyticsTitle}
                desc={t.analyticsDesc}
                checked={analytics}
                onChange={setAnalytics}
              />
            </div>
            <button
              onClick={savePreferences}
              className="mt-4 w-full rounded-[8px] bg-[var(--accent)] py-2.5 font-[var(--font-sans)] text-sm font-medium text-white"
            >
              {t.save}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
