// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth, signOut } from "@/auth";
import { getDictionary } from "@/i18n/get-dictionary";
import { needsSetup } from "@/lib/setup";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { AccountGates, type GateDict } from "@/components/account-gates";
import { NotificationPerm } from "./notification-perm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (await needsSetup()) redirect("/setup");
  const session = await auth();
  const dict = await getDictionary();

  let isAdmin = false;
  let totpEnabled = false;
  let mustChangePassword = false;
  let sessionValid = false;
  if (session?.user?.id) {
    const { db } = await import("@/lib/db");
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true, totpEnabled: true, mustChangePassword: true },
    });
    if (u) {
      // Stale JWT sessions (e.g. after a wipe) must not grant a ghost session.
      sessionValid = true;
      isAdmin = !!u.isAdmin;
      totpEnabled = !!u.totpEnabled;
      mustChangePassword = u.mustChangePassword;
    }
  }
  if (session?.user && !sessionValid) {
    const { signOut } = await import("@/auth");
    await signOut({ redirectTo: "/login" });
  }

  const sidebarCollapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";

  const sidebarDict: Record<string, string> = {
    books: dict.nav.books,
    groups: dict.nav.groups,
    lending: dict.nav.lending,
    stats: dict.nav.stats,
    series: dict.nav.series,
    authors: dict.nav.authors,
    achievements: dict.nav.achievements,
    leaderboard: dict.nav.leaderboard,
    people: dict.nav.people,
    profile: (dict as unknown as { profile: { title: string } }).profile?.title ?? "Profile",
    settings: dict.nav.settings,
    admin: dict.admin.adminLabel,
    logout: dict.nav.logout,
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Desktop Sidebar — Responsive Hybrid Shell §6 — theme/locale only via Settings */}
      <Sidebar
        dict={sidebarDict}
        isAdmin={isAdmin}
        userName={session?.user?.name ?? null}
        initialCollapsed={sidebarCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — visible only on <md, respects safe-top */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 safe-top md:hidden">
          <Link href="/books" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-6 w-6" />
            <span className="font-[var(--font-serif)] text-sm font-semibold tracking-tight text-foreground">
              Book Shelf
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-0.5">
            <NotificationPerm dict={dict.common} />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title={dict.nav.logout}
              >
                ⏻
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-6 lg:px-8">{children}</main>

        <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-3 text-center safe-bottom">
          <Link
            href="/licenses"
            className="font-[var(--font-sans)] text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {dict.licenses.nav}
          </Link>
        </footer>
      </div>

      <BottomNav
        dict={{ books: dict.nav.books, lending: dict.nav.lending, stats: dict.nav.stats, more: dict.nav.more }}
      />
      <InstallPrompt />
      <AccountGates
        mustChangePassword={mustChangePassword}
        // Dev/e2e skip the admin gate — mandatory TOTP applies to real
        // (production) self-hosted deployments only.
        requireTotp={process.env.NODE_ENV === "production" && isAdmin && !totpEnabled}
        dict={dict.security as unknown as GateDict}
      />
    </div>
  );
}
