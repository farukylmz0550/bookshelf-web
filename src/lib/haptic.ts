// SPDX-License-Identifier: GPL-3.0-only
export type HapticStyle = "light" | "medium" | "heavy";

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [30, 50, 30],
};

/**
 * Trigger haptic feedback via Vibration API.
 * Works on Android Chrome, iOS Safari (16.4+), and most modern mobile browsers.
 */
export function hapticFeedback(style: HapticStyle = "light"): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(PATTERNS[style]);
}
