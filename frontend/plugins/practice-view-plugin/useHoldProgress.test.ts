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

  // ─── T002: 15% early-acceptance (750 ms cap) — fires at 23 250 ms ─────────
  it('T002: HOLD_COMPLETE dispatches after ≥ 23 250 ms for requiredHoldMs = 24 000 (cap applies)', async () => {
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

    // 23 250 is the acceptance boundary (24 000 − 750 cap). Must NOT have fired yet.
    await act(() => vi.advanceTimersByTimeAsync(23_150));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // A further 200 ms (total 23 350) crosses the 23 250 boundary → fires.
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T006: no early fire below the boundary, fires just after ──────────────
  it('T006: for requiredHoldMs = 24 000, HOLD_COMPLETE has NOT fired at 23 150 ms but HAS fired by 23 350 ms', async () => {
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

    await act(() => vi.advanceTimersByTimeAsync(23_150));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    await act(() => vi.advanceTimersByTimeAsync(200)); // total 23 350 ms
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T014: 15% rule for short notes (acceptance = 2000 − 300 = 1700) ───────
  it('T014: for requiredHoldMs = 2 000, HOLD_COMPLETE fires between 1 700 ms and 1 760 ms', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const startMs = Date.now();

    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      holdStartTimeMs: startMs,
      requiredHoldMs: 2_000,
    };

    renderHook(() => useHoldProgress({ practiceState, dispatchPractice: dispatch }));

    // acceptance = 2000 − 300 (15%) = 1 700. Must NOT fire before.
    await act(() => vi.advanceTimersByTimeAsync(1_690));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire within one rAF frame past 1 700 ms.
    await act(() => vi.advanceTimersByTimeAsync(70));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T015: 15% rule for the 1 000 ms half note (acceptance 850) ────────────
  it('T015: for requiredHoldMs = 1 000, HOLD_COMPLETE fires between 850 ms and 900 ms', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const startMs = Date.now();

    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      holdStartTimeMs: startMs,
      requiredHoldMs: 1_000,
    };

    renderHook(() => useHoldProgress({ practiceState, dispatchPractice: dispatch }));

    // acceptance = 1000 − 150 (15%) = 850 ms; must NOT fire before.
    await act(() => vi.advanceTimersByTimeAsync(840));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire by 900 ms.
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });
});
