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
