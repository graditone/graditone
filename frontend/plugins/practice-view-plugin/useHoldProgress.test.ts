import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useHoldProgress } from './useHoldProgress';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';

function makeMockParams() {
  return {
    practiceState: { ...INITIAL_PRACTICE_STATE },
    dispatchPractice: () => {},
  };
}

describe('useHoldProgress', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => useHoldProgress(makeMockParams()));
    expect(result.current).toHaveProperty('holdProgress');
    expect(typeof result.current.holdProgress).toBe('number');
  });

  // ─── T002: RED gate — 90% rule fires 2 400 ms early for a 24 000 ms note ───
  it('T002: HOLD_COMPLETE dispatches only after ≥ 23 500 ms for requiredHoldMs = 24 000 (whole note at 10 BPM)', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const startMs = Date.now();

    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      holdStartTimeMs: startMs,
      requiredHoldMs: 24_000,
    };

    renderHook(() => useHoldProgress({ practiceState, dispatchPractice: dispatch }));

    // Advance to 21 600 ms (current 90% threshold) — must NOT have fired yet
    await act(() => vi.advanceTimersByTimeAsync(21_600));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Advance a further 1 900 ms (total 23 500 ms) — must fire by this point
    await act(() => vi.advanceTimersByTimeAsync(1_900));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });
});
