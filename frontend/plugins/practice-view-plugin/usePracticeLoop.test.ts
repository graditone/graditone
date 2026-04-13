import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePracticeLoop } from './usePracticeLoop';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PluginContext, ScorePlayerState } from '../../src/plugin-api/index';

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
      seekToTick: vi.fn(),
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
    tempoMultiplierRef: { current: 1.0 },
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

  it('seeks to loop region start on loop restart, not to score repeat barline', () => {
    // Regression: when practiceState.mode transitions to 'complete' with
    // remaining loops, the score player must be seeked to the loop region
    // start tick so score-internal repeat barlines cannot redirect playback
    // outside the pinned region (e.g. Arabesque m10 → m3 instead of m7).
    const params = makeMockParams();
    const note = (tick: number) => ({
      tick,
      durationTicks: 480,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n'] as readonly string[],
    });
    params.practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active',
      notes: [note(3840), note(7680), note(11520)],
      currentIndex: 1,
    };
    params.practiceStartTimeRef = { current: 0 };

    const { result, rerender } = renderHook((p) => usePracticeLoop(p), {
      initialProps: params,
    });

    // Pin a loop region: startTick=3840, endTick=15360
    act(() => {
      result.current.handleNoteLongPress(3840, 'note-start');
    });
    act(() => {
      result.current.handleNoteLongPress(15360, 'note-end');
    });

    // Simulate remainingLoops > 0 before mode → complete
    result.current.remainingLoopsRef.current = 1;

    // Transition to complete
    const completeParams = {
      ...params,
      practiceState: {
        ...params.practiceState,
        mode: 'complete' as const,
      },
    };
    rerender(completeParams);

    // seekToTick must have been called with the loop region start tick
    expect((params.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(3840);
  });
});
