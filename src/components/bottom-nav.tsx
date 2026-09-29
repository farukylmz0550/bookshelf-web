// SPDX-License-Identifier: GPL-3.0-only
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Handshake, BarChart3, MoreHorizontal } from "lucide-react";

interface BottomNavProps {
  dict: {
    books: string;
    lending: string;
    stats: string;
    more: string;
  };
}

const tabs = [
  { href: "/books", icon: BookOpen, key: "books" as const },
  { href: "/lending", icon: Handshake, key: "lending" as const },
  { href: "/stats", icon: BarChart3, key: "stats" as const },
  { href: "/more", icon: MoreHorizontal, key: "more" as const },
];

export function BottomNav({ dict }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card safe-bottom md:hidden">
      <div className="mx-auto flex h-14 max-w-3xl items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          // v3.7.0 — icon + label (UI_Improvement_Plan.md §11): icon-only
          // navigation was compact but hard to discover.
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={dict[tab.key]}
              className={`flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="font-[var(--font-sans)] text-[10px] leading-none font-medium">{dict[tab.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
