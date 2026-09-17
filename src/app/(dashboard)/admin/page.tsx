// SPDX-License-Identifier: GPL-3.0-only
import { requireAdminPage } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUsers } from "@/app/actions/admin";
import { getCoverStats, clearCoverCache } from "@/app/actions/covers";
import { UserTable } from "./users/user-table";
import { DangerZoneCard } from "./danger-zone-card";

export default async function AdminPage() {
  const currentUserId = await requireAdminPage();
  const dict = await getDictionary();
  const users = await getUsers();
  const coverStats = await getCoverStats();

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
      {/* v3.0.0 — Reading settings moved to config.yaml; page-count backfill
          moved to Settings → Book data (user-scoped, not an admin power). */}
      {/* Danger zone (v2.10.0) */}
      <DangerZoneCard dict={{ ...dict.common, ...dict.admin, ...dict.security, cancel: dict.facts.cancel }} />
    </div>
  );
}
