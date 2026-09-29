// SPDX-License-Identifier: GPL-3.0-only
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { getSettings } from "@/app/actions/settings";
import { getTheme } from "@/lib/theme";
import { SecuritySettings } from "@/components/settings/security-settings";
import type { SecurityDict } from "@/components/settings/security-settings";
import { getKoboSyncState } from "@/app/actions/kobo";
import { getAppConfig } from "@/lib/app-config";
import { getMinPagesPerReadEvent } from "@/lib/reading-settings";
import { ReadingStepCard } from "@/components/settings/reading-step-card";
import { AccountCard } from "@/components/settings/account-card";

export default async function SettingsPage() {
  const dict = await getDictionary();
  const settings = await getSettings();
  const theme = await getTheme();
  const locale = await getLocale();
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true, totpEnabled: true, name: true, email: true },
      })
    : null;
  // v3.0.0 — Kobo sync card (hidden when disabled in config.yaml).
  const koboState = (await getAppConfig()).koboEnabled
    ? await getKoboSyncState()
    : { enabled: false, syncUrl: null, opdsUrl: null, fileSourceUrl: null };

  // v3.5.1 — reading step card values (admin floor + site default for hints).
  const [adminFloor, siteConfig] = await Promise.all([getMinPagesPerReadEvent(), getAppConfig()]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.nav.settings}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.nav.settings}</p>
      </header>
      <ReadingStepCard
        initialValue={settings.pagesPerReadEvent}
        adminFloor={adminFloor}
        siteDefault={siteConfig.pagesPerReadEvent}
        dict={{
          title: dict.settings.readingStepTitle,
          desc: dict.settings.readingStepDesc,
          label: dict.settings.readingStepLabel,
          floorHint: dict.settings.readingStepFloorHint,
          save: dict.facts.save,
          saved: dict.kobo.saved,
          invalid: dict.settings.readingStepInvalid,
        }}
      />
      {user && (
        <AccountCard
          userName={user.name}
          userEmail={user.email}
          dict={{
            title: dict.settings.accountTitle,
            logout: dict.nav.logout,
            logoutConfirm: dict.settings.logoutConfirm,
            loggingOut: dict.auth.signingIn,
          }}
        />
      )}
      <SettingsForm
        settings={settings}
        currentTheme={theme}
        currentLocale={locale}
        themeLabels={dict.theme}
        qrLoginDict={dict.qrLogin}
        koboSyncUrl={koboState.syncUrl}
        koboOpdsUrl={koboState.opdsUrl}
        koboFileSource={koboState.fileSourceUrl}
        dict={{
          settings: {
            goalReminders: dict.settings.goalReminders,
            aboutTitle: dict.settings.aboutTitle,
            licensesLink: dict.settings.licensesLink,
          },
          backfill: {
            title: dict.settings.pageBackfillTitle,
            desc: dict.settings.pageBackfillDesc,
            run: dict.settings.pageBackfillRun,
            running: dict.settings.pageBackfillRunning,
            done: dict.settings.pageBackfillDone,
          },
          kobo: {
            title: dict.kobo.title,
            desc: dict.kobo.desc,
            noUrl: dict.kobo.noUrl,
            createUrl: dict.kobo.createUrl,
            urlLabel: dict.kobo.urlLabel,
            opdsLabel: dict.kobo.opdsLabel,
            confTitle: dict.kobo.confTitle,
            confDesc: dict.kobo.confDesc,
            created: dict.kobo.created,
            fileSource: dict.kobo.fileSource,
            fileSourcePlaceholder: dict.kobo.fileSourcePlaceholder,
            fileSourceHint: dict.kobo.fileSourceHint,
            saved: dict.kobo.saved,
            save: dict.kobo.save,
          },
        }}
      />
      {user && (
        <SecuritySettings totpEnabled={user.totpEnabled} isAdmin={user.isAdmin} dict={dict.security as SecurityDict} />
      )}
    </div>
  );
}
