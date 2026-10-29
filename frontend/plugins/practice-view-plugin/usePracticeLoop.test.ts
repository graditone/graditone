import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePracticeLoop } from './usePracticeLoop';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PluginContext, ScorePlayerState } from '../../src/plugin-api/index';
import { useRef } from 'react';

function makeMockParams() {
  const practiceState = { ...INITIAL_PRACTICE_STATE };
  const playerState: ScorePlayerState = {
    status: 'idle',
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 120,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
  };
  const context = {
    scorePlayer: {
      setPinnedStart: vi.fn(),
      setLoopEnd: vi.fn(),
    },
  } as unknown as PluginContext;

  return {
    practiceState,
    dispatchPractice: vi.fn(),
    playerState,
    practiceStartTimeRef: { current: 0 },
    context,
    onComplete: vi.fn(),
    onResultsShow: vi.fn(),
  };
}

describe('usePracticeLoop', () => {
  it('returns expected shape', () => {
    const params = makeMockParams();
    const { result } = renderHook(() => usePracticeLoop(params));
    const r = result.current;

    expect(r.loopRegion).toBeNull();
    expect(r.loopRegionRef).toBeDefined();
    expect(r.loopPracticeRange).toBeNull();
    expect(r.loopPracticeRangeRef).toBeDefined();
    expect(r.pinnedNoteIds).toBeDefined();
    expect(r.loopStart).toBeNull();
    expect(r.loopEndPin).toBeNull();
    expect(r.loopCount).toBe(1);
    expect(typeof r.setLoopCount).toBe('function');
    expect(r.loopIterationRef).toBeDefined();
    expect(r.loopStartTimesRef).toBeDefined();
    expect(r.remainingLoopsRef).toBeDefined();
    expect(typeof r.handleNoteLongPress).toBe('function');
    expect(typeof r.resetLoopTracking).toBe('function');
  });
});


// ---------------------------------------------------------------------------
// Feature 101 — tempo-stopped must not behave like complete (T027)
// ---------------------------------------------------------------------------

describe('usePracticeLoop — tempo-stopped regression (feature 101, T027)', () => {
  function buildSharedParams() {
    const params = makeMockParams() as unknown as Parameters<typeof usePracticeLoop>[0];
    params.tempoMultiplierRef = { current: 1.0 };
    // Feature 061: the task-config init effect seeds the loop region from these.
    params.initialStartTick = 0;
    params.initialEndTick = 3840;
    const practiceState = {
      ...params.practiceState,
      notes: [
        { midiPitches: [60], noteIds: ['n0'], tick: 0, durationTicks: 0 },
        { midiPitches: [62], noteIds: ['n1'], tick: 1920, durationTicks: 0 },
        { midiPitches: [64], noteIds: ['n2'], tick: 3840, durationTicks: 0 },
      ],
    } as typeof params.practiceState;
    return { params, practiceState };
  }

  function renderLoop(params: Parameters<typeof usePracticeLoop>[0], practiceState: typeof params.practiceState) {
    return renderHook(
      (p: { mode: 'active' | 'tempo-stopped' | 'complete' }) =>
        usePracticeLoop({ ...params, practiceState: { ...practiceState, mode: p.mode } } as Parameters<typeof usePracticeLoop>[0]),
      { initialProps: { mode: 'active' as const } },
    );
  }

  it('does not treat tempo-stopped as complete: no auto-restart, no results, no loop consumption', () => {
    const { params, practiceState } = buildSharedParams();
    const { result, rerender } = renderLoop(params, practiceState);
    result.current.remainingLoopsRef.current = 2;

    // Transition to tempo-stopped (strict mode stopped the session)
    rerender({ mode: 'tempo-stopped' });

    expect(params.dispatchPractice).not.toHaveBeenCalled();
    expect(params.onResultsShow).not.toHaveBeenCalled();
    expect(params.onComplete).not.toHaveBeenCalled();
    expect(result.current.remainingLoopsRef.current).toBe(2);
  });

  it('complete with loops remaining still auto-restarts the loop', () => {
    const { params, practiceState } = buildSharedParams();
    const { result, rerender } = renderLoop(params, practiceState);
    result.current.remainingLoopsRef.current = 1;

    // Completion transitions the mode → the existing restart behavior runs
    rerender({ mode: 'complete' });

    expect(params.dispatchPractice).toHaveBeenCalledWith({ type: 'LOOP_RESTART', startIndex: 0 });
    expect(params.onResultsShow).not.toHaveBeenCalled();
    expect(params.onComplete).not.toHaveBeenCalled();
    expect(result.current.remainingLoopsRef.current).toBe(0);
  });

  it('complete with no loops remaining still shows results and completes (unchanged)', () => {
    const { params, practiceState } = buildSharedParams();
    const { result, rerender } = renderLoop(params, practiceState);
    result.current.remainingLoopsRef.current = 0;

    rerender({ mode: 'complete' });

    expect(params.dispatchPractice).not.toHaveBeenCalled();
    expect(params.onResultsShow).toHaveBeenCalledTimes(1);
    expect(params.onComplete).toHaveBeenCalledTimes(1);
  });
});
