// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PALETTE = {
  light: { surface: "#ffffff", gridline: "#ded8d2", axis: "#c4bdb5", muted: "#8a8584", bar: "#bb4f35", ink: "#2b2727" },
  dark: { surface: "#333735", gridline: "#444845", axis: "#5b605b", muted: "#8f8b84", bar: "#c17a5e", ink: "#f2eee8" },
};

export function MonthlyChart({
  data,
  label,
  dark,
}: {
  data: { month: string; count: number }[];
  label: string;
  dark: boolean;
}) {
  const colors = dark ? PALETTE.dark : PALETTE.light;

  return (
    <div className="h-64 w-full rounded-lg border border-border p-4" style={{ backgroundColor: colors.surface }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.gridline} />
          <XAxis
            dataKey="month"
            tick={{ fill: colors.muted, fontSize: 12 }}
            axisLine={{ stroke: colors.axis }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: colors.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: colors.gridline }}
            contentStyle={{ borderColor: colors.gridline, background: colors.surface, color: colors.ink, fontSize: 12 }}
            formatter={(value) => [value, label]}
          />
          <Bar dataKey="count" fill={colors.bar} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
