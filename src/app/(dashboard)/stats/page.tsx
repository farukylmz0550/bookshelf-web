// SPDX-License-Identifier: GPL-3.0-only
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getTheme } from "@/lib/theme";
import { levelProgress, levelName } from "@/lib/gamification";
import { monthlyFinishCounts, formatReadingMinutes } from "@/lib/stats";
import { finishedInMonth, finishedInYear } from "@/lib/goals";
import { getStreakInfo } from "@/lib/streak";
import { getAppConfig } from "@/lib/app-config";
import { getAnnualReadingSummary, getAvailableYears, isAnnualSummaryWindow, parseSelectedYear } from "@/lib/annual";
import { isGoalUnlocked } from "@/lib/goals";
import { MonthlyChart } from "./monthly-chart";
import { GoalProgress } from "./goal-progress";
import { GoalForms } from "./goal-forms";
import { StreakWidget } from "@/components/streak-widget";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AnnualSummary } from "./annual-summary";

export default async function StatsPage({ searchParams }: { searchParams?: Promise<{ year?: string }> }) {
  const userId = await requireUserId();
  const dict = await getDictionary();
  const theme = await getTheme();
  const locale = await getLocale();

  const currentYear = new Date().getFullYear();
  // During the Jan 1–7 window the summary features the just-completed year.
  // In development (window always open, arbitrary date) feature the current
  // year so the experience stays usable and testable year-round.
  const summaryVisible = isAnnualSummaryWindow();
  const defaultYear = !summaryVisible || process.env.NODE_ENV === "development" ? currentYear : currentYear - 1;
  const selectedYear = parseSelectedYear((await searchParams)?.year, defaultYear);
  const [availableYears, annualSummary] = await Promise.all([
    summaryVisible ? getAvailableYears(userId, currentYear - 1, currentYear) : Promise.resolve([]),
    summaryVisible ? getAnnualReadingSummary(userId, selectedYear) : Promise.resolve(null),
  ]);

  const monthLabels = Array.from({ length: 12 }, (_, i) =>
    new Date(2024, i, 1).toLocaleDateString(locale, { month: "short" }),
  );

  const [user, totalBooks, reading, finishedCount, goal, streakInfo, dailyActivities, readEventDates] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } }),
      db.book.count({ where: { userId } }),
      db.book.count({ where: { userId, status: "READING" } }),
      db.book.count({ where: { userId, status: "FINISHED" } }),
      db.goal.findUnique({ where: { userId } }),
      getStreakInfo(userId),
      db.dailyActivity.findMany({
        where: { userId },
        select: { date: true, count: true, pagesRead: true, minutesRead: true },
        orderBy: { date: "asc" },
      }),
      db.bookReadEvent.findMany({ where: { userId }, select: { readAt: true } }),
    ]);

  const yearly = goal?.yearly ?? 0;
  const monthly = goal?.monthly ?? 0;
  const now = new Date();
  // v2.7.0 "read" definition: one BookReadEvent = one read session (completions
  // and partial page-logs alike). Goal progress uses this canonical counting.
  const readDates = readEventDates.map((e) => e.readAt);
  const doneYear = finishedInYear(readDates, now.getFullYear());
  const doneMonth = finishedInMonth(readDates, now.getFullYear(), now.getMonth());

  const { level } = levelProgress(user.xp, (await getAppConfig()).xpPerLevelBase);
  const customLevelName = levelName(level, (await getAppConfig()).xpLevelNames);
  const chartData = monthlyFinishCounts(readDates);

  const booksWithDuration = await db.book.findMany({
    where: { userId, status: "FINISHED", startedAt: { not: null }, finishedAt: { not: null } },
    select: { startedAt: true, finishedAt: true },
  });
  const avgDays =
    booksWithDuration.length > 0
      ? (
          booksWithDuration.reduce((acc, b) => {
            const s = b.startedAt as Date;
            const f = b.finishedAt as Date;
            const d = (f.getTime() - s.getTime()) / 86400000;
            return acc + (d >= 0 ? d : 0);
          }, 0) / booksWithDuration.length
        ).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-[var(--font-serif)] text-2xl font-semibold tracking-tight text-foreground">
          {dict.stats.title}
        </h1>
        <p className="font-[var(--font-sans)] text-sm text-muted-foreground">
          {dict.stats.totalBooks} · {dict.stats.level} {level}
        </p>
      </header>

      {streakInfo && (
        <StreakWidget
          currentStreak={streakInfo.currentStreak}
          longestStreak={streakInfo.longestStreak}
          isTodayActive={streakInfo.isTodayActive}
          shieldCost={streakInfo.shieldCost}
          canUseShield={streakInfo.canUseShield}
        />
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: dict.stats.totalBooks, value: totalBooks, hint: undefined as string | undefined },
          { label: dict.stats.finished, value: finishedCount, hint: undefined },
          { label: dict.stats.reading, value: reading, hint: undefined },
          {
            label: dict.stats.level,
            value: level,
            // v3.1.0 — custom level name from config.yaml (optional)
            hint: customLevelName ?? undefined,
          },
          { label: dict.stats.xp, value: user.xp, hint: undefined },
          { label: dict.stats.averageDays, value: avgDays, hint: undefined },
          {
            // v3.1.0 — device-reported reading time (Kobo minutes)
            label: dict.stats.readingTime,
            value: formatReadingMinutes(dailyActivities.reduce((sum, a) => sum + (a.minutesRead ?? 0), 0)),
            hint: undefined,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center"
          >
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
            {stat.hint && <p className="text-[10px] text-muted-foreground/80">{stat.hint}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <GoalProgress
          label={dict.stats.yearlyGoal}
          target={yearly}
          done={doneYear}
          period="yearly"
          noGoalLabel={dict.stats.noGoal}
          reachedLabel={dict.stats.reached}
          progressLabel={dict.stats.progress}
        />
        <GoalProgress
          label={dict.stats.monthlyGoal}
          target={monthly}
          done={doneMonth}
          period="monthly"
          noGoalLabel={dict.stats.noGoal}
          reachedLabel={dict.stats.reached}
          progressLabel={dict.stats.progress}
        />
      </div>
      <GoalForms
        dict={{
          yearlyGoal: dict.stats.yearlyGoal,
          monthlyGoal: dict.stats.monthlyGoal,
          goalTarget: dict.stats.goalTarget,
          setGoal: dict.stats.setGoal,
          goalLocked: dict.stats.goalLocked,
          goalLockedDesc: dict.stats.goalLockedDesc,
          goalSaveError: dict.stats.goalSaveError,
          goalConfirm: dict.stats.goalConfirm,
        }}
        yearly={yearly}
        monthly={monthly}
        locked={!isGoalUnlocked(goal, currentYear)}
      />
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-[13px] font-medium text-foreground">{dict.stats.byMonth}</p>
        <MonthlyChart data={chartData} label={dict.stats.finished} dark={theme === "dark"} />
      </div>

      <ActivityHeatmap
        dict={{
          yearlyActivity: dict.stats.yearlyActivity,
          activities: dict.stats.activities,
          less: dict.stats.less,
          more: dict.stats.more,
        }}
        activities={dailyActivities.map((a) => ({
          date: a.date.toISOString().split("T")[0],
          count: a.count,
          pagesRead: a.pagesRead,
          minutesRead: a.minutesRead,
        }))}
      />

      {summaryVisible && annualSummary && (
        <AnnualSummary
          summary={annualSummary}
          availableYears={availableYears}
          selectedYear={selectedYear}
          monthLabels={monthLabels}
          dark={theme === "dark"}
          dict={dict.annual}
          yearlyTarget={goal?.confirmedAt && goal?.targetYear === currentYear ? yearly : 0}
        />
      )}
    </div>
  );
}
