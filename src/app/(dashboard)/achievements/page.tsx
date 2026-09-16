// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function AchievementsPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const [all, unlocked] = await Promise.all([
    db.achievement.findMany({ orderBy: { key: "asc" } }),
    db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.achievements.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {all.length} · {unlocked.length} {dict.achievements.unlocked}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((achievement) => {
          const isUnlocked = unlockedIds.has(achievement.id);
          const labels = dict.achievements as Record<string, string>;
          return (
            <div
              key={achievement.id}
              className={`rounded-[12px] border p-4 transition-colors ${
                isUnlocked
                  ? "border-[var(--border-strong)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-[var(--font-serif)] text-[13px] font-medium text-foreground">
                  {labels[`${achievement.key}_title`]}
                </p>
                {isUnlocked ? (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-white">
                    {dict.achievements.unlocked}
                  </span>
                ) : (
                  achievement.recurrence === "MONTHLY" && (
                    <span className="rounded-full border border-[var(--border)] bg-[var(--info-soft)] px-2 py-0.5 font-[var(--font-sans)] text-[10px] font-medium text-[var(--info-text)]">
                      {dict.achievements.monthlyBadge}
                    </span>
                  )
                )}
              </div>
              <p className="mt-1 font-[var(--font-sans)] text-xs text-muted-foreground">
                {labels[`${achievement.key}_desc`]}
              </p>
              {achievement.recurrence === "MONTHLY" && (
                <p className="mt-1 font-[var(--font-sans)] text-[10px] text-muted-foreground/80">
                  {dict.achievements.earnsMonthly}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
