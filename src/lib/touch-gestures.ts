// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useRef, useCallback } from "react";
import { hapticFeedback } from "./haptic";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 }: SwipeHandlers) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < threshold) return;

      if (absDx > absDy) {
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      } else {
        if (dy > 0) onSwipeDown?.();
        else onSwipeUp?.();
      }

      touchStart.current = null;
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold],
  );

  return { onTouchStart, onTouchEnd };
}

interface LongPressHandlers {
  onLongPress: () => void;
  /** v2.9.6 — visual press feedback: fires when the hold starts/cancels. */
  onPressStart?: () => void;
  onPressEnd?: () => void;
  delay?: number;
}

export function useLongPress({ onLongPress, onPressStart, onPressEnd, delay = 500 }: LongPressHandlers) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    onPressStart?.();
    timerRef.current = setTimeout(() => {
      onLongPress();
      hapticFeedback("medium");
    }, delay);
  }, [onLongPress, onPressStart, delay]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      onPressEnd?.();
    }
  }, [onPressEnd]);

  return {
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: stop,
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
  };
}
