// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAppConfig } from "@/lib/app-config";
import { LeaderboardTable } from "./leaderboard-table";

export default async function LeaderboardPage() {
  const userId = await requireUserId();
  const dict = await getDictionary();

  const users = await db.user.findMany({
    where: { showOnLeaderboard: true },
    select: { id: true, name: true, xp: true },
    orderBy: { xp: "desc" },
  });

  const config = await getAppConfig();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.leaderboard.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.leaderboard.rank} · {dict.leaderboard.xp}
        </p>
      </header>
      <LeaderboardTable
        users={users}
        currentUserId={userId}
        dict={dict.leaderboard}
        xpPerLevelBase={config.xpPerLevelBase}
        xpLevelNames={config.xpLevelNames}
      />
    </div>
  );
}
