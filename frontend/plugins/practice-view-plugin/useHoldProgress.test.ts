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

  // ─── T002: 25% early-acceptance (1 500 ms cap) — 90% rule retired ──────────
  it('T002: HOLD_COMPLETE dispatches after ≥ 22 500 ms for requiredHoldMs = 24 000 (cap applies)', async () => {
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

    // 22 500 is the acceptance boundary (24 000 − 1 500 cap). Must NOT have fired yet.
    await act(() => vi.advanceTimersByTimeAsync(22_400));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // A further 200 ms (total 22 600) crosses the 22 500 boundary → fires.
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T006: no early fire below the boundary, fires just after ──────────────
  it('T006: for requiredHoldMs = 24 000, HOLD_COMPLETE has NOT fired at 22 400 ms but HAS fired by 22 600 ms', async () => {
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

    await act(() => vi.advanceTimersByTimeAsync(22_400));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    await act(() => vi.advanceTimersByTimeAsync(200)); // total 22 600 ms
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T014: 25% rule for short notes (1 500 ms required → accepted at 1 500) ─
  it('T014: for requiredHoldMs = 2 000, HOLD_COMPLETE fires between 1 500 ms and 1 560 ms', async () => {
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

    // acceptance = 2000 − 500 (25%) = 1 500. Must NOT fire before.
    await act(() => vi.advanceTimersByTimeAsync(1_490));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire within one rAF frame past 1 500 ms.
    await act(() => vi.advanceTimersByTimeAsync(70));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T015: 25% rule for the 1 000 ms half note (acceptance 750) ────────────
  it('T015: for requiredHoldMs = 1 000, HOLD_COMPLETE fires between 750 ms and 800 ms', async () => {
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

    // acceptance = 1000 − 250 (25%) = 750 ms; must NOT fire before.
    await act(() => vi.advanceTimersByTimeAsync(740));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire by 800 ms.
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });
});
