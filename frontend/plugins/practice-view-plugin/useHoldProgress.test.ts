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

    // Advance a further 2 000 ms (total 23 600 ms, past the 23 500 ms threshold)
    // We overshoot by ~100 ms to ensure at least one RAF frame fires after the
    // acceptance boundary (RAF fires every ~16 ms in fake-timer mode).
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T006: US1 — no early fire at 21 600 ms, fires by 23 600 ms ─────────────
  it('T006: for requiredHoldMs = 24 000, HOLD_COMPLETE has NOT fired at 21 600 ms but HAS fired by 23 600 ms', async () => {
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

    await act(() => vi.advanceTimersByTimeAsync(21_600));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    await act(() => vi.advanceTimersByTimeAsync(2_000)); // total 23 600 ms
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T014: regression — 90% rule still binds for short notes at 120 BPM ───
  it('T014: for requiredHoldMs = 2 000 (120 BPM whole note), HOLD_COMPLETE fires between 1 800 ms and 1 850 ms', async () => {
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

    // Must NOT fire before 1 800 ms (90% of 2 000 = 1 800; acceptanceMs = 2000 - min(200,500) = 1800)
    await act(() => vi.advanceTimersByTimeAsync(1_790));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire by 1 850 ms (one RAF frame past the 1 800 ms threshold)
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });

  // ─── T015: regression — 90% rule for 1 000 ms half note ────────────────────
  it('T015: for requiredHoldMs = 1 000 (120 BPM half note), HOLD_COMPLETE fires between 900 ms and 950 ms', async () => {
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

    // acceptanceMs = 1000 - min(100, 500) = 900 ms; must NOT fire before 900 ms
    await act(() => vi.advanceTimersByTimeAsync(890));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    // Must fire by 950 ms
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HOLD_COMPLETE' }),
    );

    vi.useRealTimers();
  });
});
