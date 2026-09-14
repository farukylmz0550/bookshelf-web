// SPDX-License-Identifier: GPL-3.0-only
import { requireAdminPage } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUsers } from "@/app/actions/admin";
import { getCoverStats, clearCoverCache } from "@/app/actions/covers";
import { readAppSettings } from "@/app/actions/settings-admin";
import { defaultAppSettings } from "@/lib/settings";
import { UserTable } from "./users/user-table";
import { ReadingSettingsCard } from "./reading-settings-card";
import { PageBackfillCard } from "./page-backfill-card";

export default async function AdminPage() {
  const currentUserId = await requireAdminPage();
  const dict = await getDictionary();
  const users = await getUsers();
  const coverStats = await getCoverStats();
  const appSettings = (await readAppSettings()) ?? defaultAppSettings();

  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved);
  const tableDict = { ...dict.common, ...dict.admin, ...dict.filter };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.admin.adminLabel}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {users.length} {dict.common.users}
        </p>
      </header>

      {/* §1 — User Management */}
      <section className="space-y-3">
        <h2 className="font-[var(--font-serif)] text-lg font-semibold tracking-tight text-foreground">
          {dict.admin.usersTitle}
        </h2>
        {pending.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {dict.admin.pendingApproval} ({pending.length})
            </h3>
            <UserTable users={pending} dict={tableDict} currentUserId={currentUserId} />
          </div>
        )}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {dict.admin.approvedUsers} ({approved.length})
          </h3>
          <UserTable users={approved} dict={tableDict} currentUserId={currentUserId} />
        </div>
      </section>

      {/* §2 — Cover Cache */}
      <section className="space-y-3">
        <h2 className="font-[var(--font-serif)] text-lg font-semibold tracking-tight text-foreground">
          {dict.admin.coversTitle}
        </h2>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.admin.clearNotice}</p>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-muted-foreground">
            {dict.admin.cachedCovers} {coverStats.count}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.admin.urlMetadata} {coverStats.totalUrlBytes} {dict.admin.bytes}
          </p>
          <form
            action={async () => {
              "use server";
              await clearCoverCache();
            }}
          >
            <button
              type="submit"
              className="mt-3 rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              {dict.admin.clearThem}
            </button>
          </form>
        </div>
      </section>
      {/* §3 — Reading Settings */}
      <section className="space-y-3">
        <h2 className="font-[var(--font-serif)] text-lg font-semibold tracking-tight text-foreground">
          {dict.admin.readingSettingsTitle}
        </h2>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.admin.readingSettingsDesc}</p>
        <ReadingSettingsCard
          initial={appSettings}
          dict={{
            pagesPerReadEvent: dict.admin.pagesPerReadEvent,
            xpBookAdded: dict.admin.xpBookAdded,
            xpBookFinishedBase: dict.admin.xpBookFinishedBase,
            xpPagesPer10: dict.admin.xpPagesPer10,
            xpLending: dict.admin.xpLending,
            xpPerLevelBase: dict.admin.xpPerLevelBase,
            save: dict.admin.save,
            saved: dict.admin.settingsSaved,
          }}
        />
      </section>
      {/* §4 — Page-count backfill (v2.9.6) */}
      <section className="space-y-3">
        <h2 className="font-[var(--font-serif)] text-lg font-semibold tracking-tight text-foreground">
          {dict.admin.pageBackfillTitle}
        </h2>
        <PageBackfillCard
          dict={{
            desc: dict.admin.pageBackfillDesc,
            run: dict.admin.pageBackfillRun,
            running: dict.admin.pageBackfillRunning,
            done: dict.admin.pageBackfillDone,
          }}
        />
      </section>
    </div>
  );
}
