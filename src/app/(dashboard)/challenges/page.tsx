// SPDX-License-Identifier: GPL-3.0-only
// v3.3.0 — Seasonal Challenges page: create free-form challenges ("Winter: 5
// books") and track progress by read events inside each window. Completion is
// exactly-once (gamification.syncChallenges) and awards config-defined XP.
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { challengeProgress } from "@/lib/challenges";
import { Flag } from "lucide-react";
import { ChallengeCard } from "./challenge-card";
import { ChallengeItem } from "./challenge-item";

export default async function ChallengesPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const [challenges, readEventDates] = await Promise.all([
    db.challenge.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.bookReadEvent.findMany({ where: { userId }, select: { readAt: true } }),
  ]);
  const dates = readEventDates.map((e) => e.readAt);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.challenges.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.challenges.subtitle}</p>
      </header>

      <ChallengeCard dict={dict.challenges} />

      {challenges.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <Flag size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="font-[var(--font-sans)] text-sm text-muted-foreground">{dict.challenges.empty}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {challenges.map((c) => {
            const p = challengeProgress(c, dates);
            return (
              <ChallengeItem
                key={c.id}
                id={c.id}
                title={c.title}
                window={`${c.startAt.toLocaleDateString()} – ${c.endAt.toLocaleDateString()}`}
                done={Math.min(p.done, p.target)}
                target={p.target}
                completed={p.completed}
                dict={{
                  completed: dict.challenges.completed,
                  delete: dict.challenges.delete,
                  deleteConfirm: dict.challenges.deleteConfirm,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
