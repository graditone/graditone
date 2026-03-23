import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePracticeMidi } from './usePracticeMidi';
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
    scorePlayer: { extractPracticeNotes: vi.fn(() => null) },
    midi: { subscribe: vi.fn(() => vi.fn()) },
    playNote: vi.fn(),
  } as unknown as PluginContext;

  return {
    context,
    practiceState,
    practiceStateRef: { current: practiceState },
    playerState,
    playerStateRef: { current: playerState },
    dispatchPractice: vi.fn(),
    loopRegionRef: { current: null },
    loopPracticeRangeRef: { current: null },
    loopIterationRef: { current: 0 },
    loopStartTimesRef: { current: [] as number[] },
    practiceStartTimeRef: { current: 0 },
    selectedStaffIndex: 0,
  };
}

describe('usePracticeMidi', () => {
  it('returns expected shape', () => {
    const params = makeMockParams();
    const { result } = renderHook(() => usePracticeMidi(params));
    const r = result.current;

    expect(r.midiPressedNoteIds).toBeInstanceOf(Set);
    expect(r.midiPressedNoteIds.size).toBe(0);
    expect(typeof r.midiEventTick).toBe('number');
    expect(r.heldMidiKeysRef).toBeDefined();
    expect(r.chordDetectorRef).toBeDefined();
  });
});
