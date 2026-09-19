// SPDX-License-Identifier: GPL-3.0-only
// v3.4.0 — reading timer pure helpers: rounding + anti-farm caps.
import { describe, it, expect } from "vitest";
import {
  capDailyMinutes,
  timerMinutes,
  TIMER_FLUSH_INTERVAL_SEC,
  TIMER_MAX_DAILY_MINUTES,
  TIMER_MAX_MINUTES_PER_REQUEST,
} from "./timer";

describe("timerMinutes", () => {
  it("floors seconds to whole minutes", () => {
    expect(timerMinutes(0)).toBe(0);
    expect(timerMinutes(59)).toBe(0);
    expect(timerMinutes(60)).toBe(1);
    expect(timerMinutes(300)).toBe(5);
  });

  it("caps a single flush at the per-request limit", () => {
    expect(timerMinutes(TIMER_MAX_MINUTES_PER_REQUEST * 60 + 59)).toBe(TIMER_MAX_MINUTES_PER_REQUEST);
    expect(timerMinutes(8 * 3600)).toBe(TIMER_MAX_MINUTES_PER_REQUEST);
  });

  it("never returns negatives", () => {
    expect(timerMinutes(-30)).toBe(0);
  });
});

describe("capDailyMinutes", () => {
  it("passes small batches through unchanged", () => {
    expect(capDailyMinutes(0, 20)).toBe(20);
    expect(capDailyMinutes(500, 30)).toBe(30);
  });

  it("trims batches that would exceed the daily combined total", () => {
    expect(capDailyMinutes(TIMER_MAX_DAILY_MINUTES - 10, 30)).toBe(10);
    expect(capDailyMinutes(TIMER_MAX_DAILY_MINUTES, 30)).toBe(0);
    expect(capDailyMinutes(TIMER_MAX_DAILY_MINUTES + 100, 30)).toBe(0);
  });

  it("rejects non-positive batches", () => {
    expect(capDailyMinutes(0, 0)).toBe(0);
    expect(capDailyMinutes(0, -5)).toBe(0);
  });
});

describe("flush interval constant", () => {
  it("auto-flushes every 5 minutes", () => {
    expect(TIMER_FLUSH_INTERVAL_SEC).toBe(300);
  });
});
