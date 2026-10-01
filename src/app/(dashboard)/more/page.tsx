// SPDX-License-Identifier: GPL-3.0-only
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Settings,
  Shield,
  ChevronRight,
  Library,
  Layers,
  PenLine,
  Flag,
  Users,
  User,
} from "lucide-react";
import { auth } from "@/auth";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function MorePage() {
  const session = await auth();
  const dict = await getDictionary();

  let isAdmin = false;
  if (session?.user?.id) {
    const { db } = await import("@/lib/db");
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    isAdmin = !!u?.isAdmin;
  }

  // Faz 4 (UI_Improvement_Plan §6, v3.15.0): mirror the desktop sidebar
  // hierarchy — Library / Explore / More / Account (+ Admin). People and
  // Profile are NEW here: mobile had no sidebar, so they were previously
  // unreachable from the bottom navigation.
  const sections = [
    {
      heading: dict.nav.groupLibrary,
      items: [{ href: "/groups", icon: Library, label: dict.nav.groups }],
    },
    {
      heading: dict.nav.groupExplore,
      items: [
        { href: "/series", icon: Layers, label: dict.nav.series },
        { href: "/authors", icon: PenLine, label: dict.nav.authors },
      ],
    },
    {
      heading: dict.nav.groupMore,
      items: [
        { href: "/achievements", icon: Trophy, label: dict.nav.achievements },
        { href: "/challenges", icon: Flag, label: dict.nav.challenges },
        { href: "/leaderboard", icon: TrendingUp, label: dict.nav.leaderboard },
        { href: "/people", icon: Users, label: dict.nav.people },
      ],
    },
    {
      heading: dict.nav.groupAccount,
      items: [
        {
          href: "/profile",
          icon: User,
          label: (dict as unknown as { profile: { title: string } }).profile?.title ?? "Profile",
        },
        { href: "/settings", icon: Settings, label: dict.nav.settings },
      ],
    },
  ];

  if (isAdmin) {
    sections.push({
      heading: dict.admin.adminLabel,
      items: [{ href: "/admin", icon: Shield, label: dict.admin.adminLabel }],
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.nav.more}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.nav.achievements} · {dict.nav.leaderboard}
        </p>
      </header>
      {sections.map((section, si) => (
        <div key={si} className="space-y-1">
          <p className="px-1 font-[var(--font-sans)] text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {section.heading}
          </p>
          <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex w-full items-center justify-between border-b border-[var(--border)] px-4 py-3 last:border-b-0 transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground/50" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
