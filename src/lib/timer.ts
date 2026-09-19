// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — in-app reading timer pure helpers: minute rounding, anti-farm caps.
// Minutes recorded by the timer flow into DailyActivity.minutesRead, the same
// column Kobo device-reported minutes already use (v3.1.0). No XP derives from
// minutes (consistent with the Kobo write-back path).

/** Un-flushed seconds buffered client-side before an automatic flush. */
export const TIMER_FLUSH_INTERVAL_SEC = 300;

/** Anti-farm: a single session flush may never record more than this many minutes. */
export const TIMER_MAX_MINUTES_PER_REQUEST = 90;

/** Anti-farm: app + device minutes together may never exceed this per UTC day. */
export const TIMER_MAX_DAILY_MINUTES = 1440;

/** Convert elapsed session seconds to whole recorded minutes, capped per request. */
export function timerMinutes(seconds: number): number {
  const minutes = Math.floor(seconds / 60);
  return Math.max(0, Math.min(minutes, TIMER_MAX_MINUTES_PER_REQUEST));
}

/**
 * Trim an incoming minute batch against the day's already-recorded total so the
 * combined (device + app) daily total never exceeds TIMER_MAX_DAILY_MINUTES.
 */
export function capDailyMinutes(currentDayTotal: number, incoming: number): number {
  if (incoming <= 0) return 0;
  return Math.max(0, Math.min(incoming, TIMER_MAX_DAILY_MINUTES - Math.max(0, currentDayTotal)));
}
