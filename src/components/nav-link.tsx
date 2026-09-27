// SPDX-License-Identifier: GPL-3.0-only
"use client";

import Link from "next/link";
import type { NavItem } from "@/lib/nav";

export function NavLink({
  item,
  dict,
  pathname,
  collapsed,
}: {
  item: NavItem;
  dict: Record<string, string>;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const label = dict[item.label] ?? item.label;

  return (
    <Link
      href={item.href}
      title={collapsed ? label : undefined}
      // v3.7.0 — quieter active state (UI_Improvement_Plan.md §7): soft
      // accent background + accent text/icon instead of a filled pill.
      className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        isActive
          ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon size={18} strokeWidth={isActive ? 2 : 1.6} className="shrink-0" />
      {!collapsed && <span className="font-[var(--font-sans)] text-sm truncate">{label}</span>}
    </Link>
  );
}
