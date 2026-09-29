// SPDX-License-Identifier: GPL-3.0-only
"use client";

import Link from "next/link";
import { Scale, ChevronRight } from "lucide-react";
import type { Theme } from "@/lib/theme";
import type { Locale } from "@/i18n/get-dictionary";
import type { UserSettingsData } from "@/app/actions/settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { PageBackfillCard } from "@/components/settings/page-backfill-card";
import { KoboSyncCard } from "@/components/settings/kobo-sync-card";

interface SettingsFormProps {
  settings: UserSettingsData;
  currentTheme: Theme;
  currentLocale: Locale;
  themeLabels: { light: string; dark: string; system: string };
  koboSyncUrl: string | null;
  koboOpdsUrl: string | null;
  koboFileSource: string | null;
  dict?: {
    settings?: {
      goalReminders?: string;
      aboutTitle?: string;
      licensesLink?: string;
      notifEnable?: string;
      notifStreak?: string;
      notifWeekly?: string;
      notifGoal?: string;
      notifTestPush?: string;
      notifTestOk?: string;
      notifTestFail?: string;
    };
    backfill?: {
      title: string;
      desc: string;
      run: string;
      running: string;
      done: string;
    };
    kobo?: {
      title: string;
      desc: string;
      noUrl: string;
      createUrl: string;
      urlLabel: string;
      opdsLabel: string;
      confTitle: string;
      confDesc: string;
      created: string;
      fileSource: string;
      fileSourcePlaceholder: string;
      fileSourceHint: string;
      saved: string;
      save: string;
    };
  };
}

export function SettingsForm({
  settings,
  currentTheme,
  currentLocale,
  themeLabels,
  koboSyncUrl,
  koboOpdsUrl,
  koboFileSource,
  dict,
}: SettingsFormProps) {
  return (
    <div className="space-y-6">
      <NotificationSettings
        settings={settings}
        dict={{
          goalReminders: dict?.settings?.goalReminders,
          notifEnable: dict?.settings?.notifEnable,
          notifStreak: dict?.settings?.notifStreak,
          notifWeekly: dict?.settings?.notifWeekly,
          notifGoal: dict?.settings?.notifGoal,
          notifTestPush: dict?.settings?.notifTestPush,
          notifTestOk: dict?.settings?.notifTestOk,
          notifTestFail: dict?.settings?.notifTestFail,
        }}
      />
      <AppearanceSettings currentTheme={currentTheme} currentLocale={currentLocale} themeLabels={themeLabels} />

      {/* Book data — v3.0.0: page-count backfill moved here from Admin */}
      <section>
        <h2 className="mb-2 px-1 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {dict?.backfill?.title}
        </h2>
        <PageBackfillCard
          dict={{
            desc: dict?.backfill?.desc ?? "",
            run: dict?.backfill?.run ?? "",
            running: dict?.backfill?.running ?? "",
            done: dict?.backfill?.done ?? "",
          }}
        />
      </section>

      <KoboSyncCard
        initialUrl={koboSyncUrl}
        initialFileSource={koboFileSource}
        initialOpdsUrl={koboOpdsUrl}
        dict={dict?.kobo ?? null}
      />

      {/* Licenses — link to /licenses */}
      <section>
        <h2 className="mb-2 px-1 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {dict?.settings?.aboutTitle ?? "About"}
        </h2>
        <Link
          href="/licenses"
          className="flex w-full items-center justify-between rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <div className="flex items-center gap-3">
            <Scale size={16} className="text-muted-foreground" />
            <span className="font-[var(--font-sans)] text-sm text-foreground">
              {dict?.settings?.licensesLink ?? "Licenses"}
            </span>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}
