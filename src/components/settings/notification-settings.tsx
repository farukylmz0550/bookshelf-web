// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useTransition } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { updateSettings, sendTestPush, type UserSettingsData } from "@/app/actions/settings";
import { ToggleRow } from "@/components/settings/toggle-row";

export function NotificationSettings({
  settings,
  dict,
}: {
  settings: UserSettingsData;
  dict?: {
    goalReminders?: string;
    notifEnable?: string;
    notifStreak?: string;
    notifWeekly?: string;
    notifGoal?: string;
    notifTestPush?: string;
    notifTestOk?: string;
    notifTestFail?: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [testPushPending, startTestPush] = useTransition();

  function handleToggle(field: keyof UserSettingsData) {
    startTransition(() => {
      updateSettings({ [field]: !settings[field] });
    });
  }

  function handleTestPush() {
    startTestPush(async () => {
      const result = await sendTestPush();
      if (result.ok) {
        toast.success(dict?.notifTestOk ?? "Test push sent");
      } else {
        toast.error(result.error ?? dict?.notifTestFail ?? "Test push failed");
      }
    });
  }

  return (
    <section>
      <h2 className="mb-2 px-1 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Notifications
      </h2>
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <ToggleRow
          label={dict?.notifEnable ?? "Enable notifications"}
          checked={settings.notificationsEnabled}
          onChange={() => handleToggle("notificationsEnabled")}
          disabled={isPending}
        />
        <ToggleRow
          label={dict?.notifStreak ?? "Streak reminders"}
          checked={settings.streakReminders}
          onChange={() => handleToggle("streakReminders")}
          disabled={isPending}
        />
        <ToggleRow
          label={dict?.notifWeekly ?? "Weekly digest"}
          checked={settings.weeklyDigest}
          onChange={() => handleToggle("weeklyDigest")}
          disabled={isPending}
        />
        <ToggleRow
          label={dict?.notifGoal ?? dict?.goalReminders ?? "Goal progress reminders"}
          checked={settings.goalReminders}
          onChange={() => handleToggle("goalReminders")}
          disabled={isPending}
        />
        <button
          type="button"
          onClick={handleTestPush}
          disabled={testPushPending}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-elevated)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <div className="flex items-center gap-3">
            <BellRing size={16} className="text-muted-foreground" />
            <span className="font-[var(--font-sans)] text-sm text-foreground">
              {dict?.notifTestPush ?? "Send test push"}
            </span>
          </div>
          {testPushPending ? <span className="text-xs text-muted-foreground">…</span> : null}
        </button>
      </div>
    </section>
  );
}
