// SPDX-License-Identifier: GPL-3.0-only
"use client";

import type { ReactNode } from "react";

interface ActivityHeatmapProps {
  activities: { date: string; count: number; pagesRead: number; minutesRead?: number }[];
  dict: { yearlyActivity: string; activities: string; less: string; more: string };
}

const WEEK_DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-muted/50";
  if (count === 1) return "bg-[var(--success)]/30";
  if (count === 2) return "bg-[var(--success)]/50";
  if (count <= 4) return "bg-[var(--success)]/75";
  return "bg-[var(--success)]";
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildGrid(activities: { date: string; count: number; pagesRead?: number; minutesRead?: number }[]) {
  const activityMap = new Map(activities.map((a) => [a.date, a]));

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 52 * 7);

  const dayOfWeek = startDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startDate.setDate(startDate.getDate() - daysToMonday);

  const weeks: { date: Date; count: number; pagesRead: number; minutesRead: number }[][] = [];
  let currentWeek: { date: Date; count: number; pagesRead: number; minutesRead: number }[] = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatDate(current);
    const activity = activityMap.get(dateStr);
    const count = activity?.count ?? 0;
    currentWeek.push({
      date: new Date(current),
      count,
      pagesRead: activity?.pagesRead ?? 0,
      minutesRead: activity?.minutesRead ?? 0,
    });

    if (current.getDay() === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    current.setDate(current.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return weeks;
}

function getMonthLabels(weeks: { date: Date }[][]) {
  const labels: { month: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, i) => {
    const firstDay = week[0]?.date;
    if (!firstDay) return;
    const month = firstDay.getMonth();
    if (month !== lastMonth) {
      labels.push({ month: MONTHS[month], weekIndex: i });
      lastMonth = month;
    }
  });

  return labels;
}

export function ActivityHeatmap({ activities, dict }: ActivityHeatmapProps) {
  const weeks = buildGrid(activities);
  const monthLabels = getMonthLabels(weeks);
  const totalActivities = activities.reduce((sum, a) => sum + a.count, 0);

  // v2.9.5 — month labels + week grid share one horizontally scrollable area so
  // the fixed-width (53 weeks × 10px) grid never forces page-level horizontal
  // scroll on narrow screens (React #31 follow-up UX fix for mobile).
  const scrollArea = (children: ReactNode) => <div className="overflow-x-auto pb-1">{children}</div>;

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-foreground">{dict.yearlyActivity}</p>
        <p className="text-xs text-muted-foreground">
          {totalActivities} {dict.activities}
        </p>
      </div>

      {scrollArea(
        <div className="w-max min-w-full">
          <div className="mb-1 flex pl-8">
            {monthLabels.map((label, i) => (
              <div
                key={`${label.month}-${i}`}
                className="text-[9px] text-muted-foreground"
                style={{
                  position: "relative",
                  left: `${(label.weekIndex / weeks.length) * 100}%`,
                  width: 0,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            <div className="flex flex-col gap-0.5 pr-1">
              {WEEK_DAYS.map((day, i) => (
                <div key={i} className="h-[10px] w-6 text-[9px] leading-[10px] text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            <div className="flex gap-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`h-[10px] w-[10px] rounded-sm ${getIntensityClass(day.count)} transition-colors`}
                      title={`${formatDate(day.date)} — ${day.count} activities${day.pagesRead > 0 ? ` · ${day.pagesRead}p` : ""}${day.minutesRead > 0 ? ` · ${day.minutesRead} min` : ""}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>,
      )}

      <div className="mt-2 flex items-center justify-end gap-1">
        <span className="text-[9px] text-muted-foreground">{dict.less}</span>
        {[0, 1, 2, 3, 5].map((n) => (
          <div key={n} className={`h-[10px] w-[10px] rounded-sm ${getIntensityClass(n)}`} />
        ))}
        <span className="text-[9px] text-muted-foreground">{dict.more}</span>
      </div>
    </div>
  );
}
