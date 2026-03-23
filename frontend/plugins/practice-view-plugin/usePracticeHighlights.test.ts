import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePracticeHighlights } from './usePracticeHighlights';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { ScorePlayerState } from '../../src/plugin-api/index';

function makeMockParams() {
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

  return {
    practiceState: { ...INITIAL_PRACTICE_STATE },
    playerState,
    midiPressedNoteIds: new Set<string>(),
    midiEventTick: 0,
    heldMidiKeysRef: { current: new Set<number>() },
    phantomIndex: -1,
    isReplaying: false,
    replayHighlightedNoteIds: new Set<string>(),
  };
}

describe('usePracticeHighlights', () => {
  it('returns expected shape', () => {
    const params = makeMockParams();
    const { result } = renderHook(() => usePracticeHighlights(params));
    const r = result.current;

    expect(r.targetNoteIds).toBeInstanceOf(Set);
    expect(r.confirmedNoteIds).toBeInstanceOf(Set);
    expect(Array.isArray(r.pressedPitchLabels)).toBe(true);
    expect(Array.isArray(r.expectedPitchLabels)).toBe(true);
    expect(r.highlightedNoteIds).toBeDefined();
    expect(typeof r.practiceActive).toBe('boolean');
    expect(typeof r.practiceWaiting).toBe('boolean');
  });
});
