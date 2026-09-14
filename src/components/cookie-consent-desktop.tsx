// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { Cookie, Shield, BarChart3, Settings, X } from "lucide-react";
import { PrefRow } from "@/components/pref-row";
import type { CookieDict } from "@/components/cookie-consent";
import type { useCookieConsent } from "@/lib/use-cookie-consent";

export type ConsentState = ReturnType<typeof useCookieConsent>;

export function CookieConsentDesktop({ t, consent }: { t: CookieDict; consent: ConsentState }) {
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
    <div className="fixed inset-0 z-[100] hidden md:flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className={`${cardBase} w-full max-w-[520px] overflow-hidden`}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Cookie size={18} />
              </div>
              <div>
                <h2 className="font-[var(--font-serif)] text-[16px] font-semibold text-foreground">{t.title}</h2>
                <p className="font-[var(--font-sans)] text-xs text-muted-foreground">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="rounded-[8px] p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={t.close}
            >
              <X size={16} />
            </button>
          </div>

          {view === "banner" ? (
            <>
              <p className="mt-4 font-[var(--font-sans)] text-sm leading-relaxed text-foreground">{t.desc}</p>
              <p className="mt-2 font-[var(--font-sans)] text-xs leading-relaxed text-muted-foreground">
                {t.descMuted}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={acceptAll}
                  className="rounded-[8px] bg-[var(--accent)] px-5 py-2.5 font-[var(--font-sans)] text-sm font-medium text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.accept}
                </button>
                <button
                  onClick={rejectAll}
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-[var(--font-sans)] text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.reject}
                </button>
                <button
                  onClick={() => setView("preferences")}
                  className="rounded-[8px] border border-[var(--border)] bg-transparent px-5 py-2.5 font-[var(--font-sans)] text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.preferencesBtn}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                <PrefRow icon={<Shield size={16} />} title={t.essentialTitle} desc={t.essentialDesc} checked disabled />
                <PrefRow
                  icon={<Settings size={16} />}
                  title={t.preferencesTitle}
                  desc={t.preferencesDesc}
                  checked={preferences}
                  onChange={setPreferences}
                />
                <PrefRow
                  icon={<BarChart3 size={16} />}
                  title={t.analyticsTitle}
                  desc={t.analyticsDesc}
                  checked={analytics}
                  onChange={setAnalytics}
                />
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={savePreferences}
                  className="rounded-[8px] bg-[var(--accent)] px-5 py-2.5 font-[var(--font-sans)] text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.save}
                </button>
                <button
                  onClick={() => setView("banner")}
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-[var(--font-sans)] text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.back}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <p className="font-[var(--font-sans)] text-[11px] text-muted-foreground">
            {t.licensesLink}{" "}
            <a href="/licenses" className="underline hover:text-foreground">
              Licenses
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
