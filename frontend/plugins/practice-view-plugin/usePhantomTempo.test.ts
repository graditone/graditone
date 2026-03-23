import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePhantomTempo } from './usePhantomTempo';
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
    practiceStateRef: { current: { ...INITIAL_PRACTICE_STATE } },
    playerBpm: playerState.bpm,
    playerStateRef: { current: playerState },
  };
}

describe('usePhantomTempo', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => usePhantomTempo(makeMockParams()));
    expect(result.current).toHaveProperty('phantomIndex');
    expect(typeof result.current.phantomIndex).toBe('number');
  });
});
