// SPDX-License-Identifier: GPL-3.0-only
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { awardPreviousMonthlyLeaderboard, getCurrentMonthlyLeaderboard } from "@/lib/services/leaderboard";
import { LeaderboardTable } from "./leaderboard-table";

export default async function LeaderboardPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  await awardPreviousMonthlyLeaderboard();
  const { periodKey, users } = await getCurrentMonthlyLeaderboard();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.leaderboard.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {(dict.leaderboard as Record<string, string>).monthlyDescription ?? dict.leaderboard.rank}
        </p>
      </header>
      <LeaderboardTable periodKey={periodKey} users={users} currentUserId={userId} dict={dict.leaderboard} />
    </div>
  );
}
