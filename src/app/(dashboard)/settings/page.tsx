// SPDX-License-Identifier: GPL-3.0-only
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { getSettings } from "@/app/actions/settings";
import { getTheme } from "@/lib/theme";
import { SecuritySettings } from "@/components/settings/security-settings";
import type { SecurityDict } from "@/components/settings/security-settings";

export default async function SettingsPage() {
  const dict = await getDictionary();
  const settings = await getSettings();
  const theme = await getTheme();
  const locale = await getLocale();
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true, totpEnabled: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.nav.settings}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.nav.settings}</p>
      </header>
      <SettingsForm
        settings={settings}
        currentTheme={theme}
        currentLocale={locale}
        dict={{ settings: { goalReminders: dict.settings.goalReminders } }}
      />
      {user && (
        <SecuritySettings totpEnabled={user.totpEnabled} isAdmin={user.isAdmin} dict={dict.security as SecurityDict} />
      )}
    </div>
  );
}
