import { useState, useEffect, useRef } from 'react';
import type { PracticeState, PracticeAction } from './practiceEngine.types';

export interface UseHoldProgressParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
}

export interface UseHoldProgressReturn {
  /** Progress fraction 0..1 for the hold duration indicator. 0 when not holding. */
  holdProgress: number;
}

/**
 * Drives the rAF hold-timer loop (feature 042).
 * Starts when engine mode becomes 'holding'; each frame updates holdProgress
 * and dispatches HOLD_COMPLETE at ≥ 90%. Cancels on mode change or unmount.
 */
export function useHoldProgress({
  practiceState,
  dispatchPractice,
}: UseHoldProgressParams): UseHoldProgressReturn {
  const [holdProgress, setHoldProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // ─── rAF hold-timer loop (feature 042) ──────────────────────────────────
  // Starts when engine mode becomes 'holding'.
  // Each frame: update holdProgress; dispatch HOLD_COMPLETE at ≥90%.
  // Cancels on mode change or unmount.
  useEffect(() => {
    if (practiceState.mode === 'holding') {
      const startMs = practiceState.holdStartTimeMs;
      const required = practiceState.requiredHoldMs;

      const tick = () => {
        const elapsed = Date.now() - startMs;
        const progress = required > 0 ? Math.min(elapsed / required, 1) : 0;
        setHoldProgress(progress);

        if (progress >= 0.9) {
          dispatchPractice({ type: 'HOLD_COMPLETE', holdDurationMs: elapsed });
          setHoldProgress(0);
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Cancel any running loop when leaving holding mode
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setHoldProgress(0);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  // Re-run whenever we enter/exit holding mode or the hold parameters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceState.mode, practiceState.holdStartTimeMs, practiceState.requiredHoldMs]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { holdProgress };
}
