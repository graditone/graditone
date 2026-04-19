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

  it('dispatches CORRECT_MIDI for chord played faster than score tempo with rest gap (no false WRONG_MIDI)', () => {
    // Regression: a rest-gap/early-timing check used to reject correct chords
    // when the user played faster than the score tempo, dispatching WRONG_MIDI
    // instead of CORRECT_MIDI and resetting the chord detector.
    const params = makeMockParams();

    const chord1 = {
      tick: 0,
      durationTicks: 480,
      midiPitches: [57, 60, 64, 69] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1', 'n2', 'n3', 'n4'] as readonly string[],
    };
    // Rest gap: chord1 ends at tick 480, chord2 starts at tick 3840
    const chord2 = {
      tick: 3840,
      durationTicks: 480,
      midiPitches: [57, 60, 64, 69] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n5', 'n6', 'n7', 'n8'] as readonly string[],
    };

    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 1,
      notes: [chord1, chord2],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 120, status: 'ready' as const, staffCount: 1 },
    };
    // User has been playing for only 500ms but chord2's expected time is 2000ms
    // (tick 3840 at 120 BPM). This creates expectedTimeMs - responseTimeMs ≈ 1500ms.
    params.practiceStartTimeRef = { current: Date.now() - 500 };

    // Capture the MIDI subscribe callback
    let midiCallback: ((event: { type: string; midiNote: number; timestamp: number }) => void) | null =
      null;
    (params.context.midi as { subscribe: ReturnType<typeof vi.fn> }).subscribe.mockImplementation(
      (cb: (event: { type: string; midiNote: number; timestamp: number }) => void) => {
        midiCallback = cb;
        return vi.fn();
      },
    );

    renderHook(() => usePracticeMidi(params));
    expect(midiCallback).not.toBeNull();

    // Simulate pressing all 4 chord pitches within 20ms
    const ts = Date.now();
    midiCallback!({ type: 'attack', midiNote: 57, timestamp: ts });
    midiCallback!({ type: 'attack', midiNote: 60, timestamp: ts + 5 });
    midiCallback!({ type: 'attack', midiNote: 64, timestamp: ts + 10 });
    midiCallback!({ type: 'attack', midiNote: 69, timestamp: ts + 15 });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const correctCalls = calls.filter(
      ([action]: [{ type: string }]) => action.type === 'CORRECT_MIDI',
    );
    const wrongCalls = calls.filter(
      ([action]: [{ type: string }]) => action.type === 'WRONG_MIDI',
    );

    expect(correctCalls).toHaveLength(1);
    expect(wrongCalls).toHaveLength(0);
  });
});
