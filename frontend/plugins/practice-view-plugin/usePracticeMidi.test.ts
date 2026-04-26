import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePracticeMidi, computeRequiredHoldMs } from './usePracticeMidi';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PluginContext, ScorePlayerState } from '../../src/plugin-api/index';

type MidiEvent = { type: string; midiNote: number; timestamp: number };
type MidiCallback = (event: MidiEvent) => void;

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

/** Capture the MIDI subscribe callback by rendering the hook. */
function captureMidiCallback(params: ReturnType<typeof makeMockParams>): MidiCallback {
  let midiCallback: MidiCallback | null = null;
  (params.context.midi as { subscribe: ReturnType<typeof vi.fn> }).subscribe.mockImplementation(
    (cb: MidiCallback) => {
      midiCallback = cb;
      return vi.fn();
    },
  );
  renderHook(() => usePracticeMidi(params));
  if (!midiCallback) throw new Error('MIDI callback not captured');
  return midiCallback;
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

  // ─── T003: RED gate — tick-based gate skips hold for ≤ 1 quarter-note ──────
  it('T003: at 10 BPM, quarter note (960 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 6 000', () => {
    const params = makeMockParams();

    const quarterNote = {
      tick: 0,
      durationTicks: 960,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [quarterNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 10, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const correctCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI');
    expect(correctCalls).toHaveLength(1);
    expect(correctCalls[0][0].requiredHoldMs).toBe(6_000);
  });

  // ─── T004: US1 — whole note at 10 BPM (currently green, must stay green) ───
  it('T004: at 10 BPM, whole note (3 840 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 24 000', () => {
    const params = makeMockParams();

    const wholeNote = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [wholeNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 10, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    expect(correctCalls[0][0].requiredHoldMs).toBe(24_000);
  });

  // ─── T005: US1 — half note at measure end, 15 BPM ───────────────────────────
  it('T005: at 15 BPM, half note at measure end (1 920 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 8 000', () => {
    const params = makeMockParams();

    const halfNote = {
      tick: 0,
      durationTicks: 1_920,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [halfNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 15, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    expect(correctCalls[0][0].requiredHoldMs).toBe(8_000);
  });

  // ─── T009: US2 — eighth note at 10 BPM now requires a hold ────────────────
  it('T009: at 10 BPM, eighth note (480 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 3 000', () => {
    const params = makeMockParams();

    const eighthNote = {
      tick: 0,
      durationTicks: 480,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [eighthNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 10, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    // 480 / ((10/60)*960) * 1000 = 480 / 160 * 1000 = 3 000 ms
    expect(correctCalls[0][0].requiredHoldMs).toBe(3_000);
  });

  // ─── T010: US2 — quarter note at 10 BPM, gap == duration (no clipping) ─────
  it('T010: at 10 BPM, quarter note with gap == duration (960 ticks) is not clipped → requiredHoldMs = 6 000', () => {
    const params = makeMockParams();

    const quarterNote = {
      tick: 0,
      durationTicks: 960,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    // nextEntry.tick - currentEntry.tick = 960 = durationTicks → no clipping
    const nextNote = {
      tick: 960,
      durationTicks: 960,
      midiPitches: [62] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n2'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [quarterNote, nextNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 10, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    expect(correctCalls[0][0].requiredHoldMs).toBe(6_000);
  });

  // ─── T012: regression — 120 BPM quarter note has no hold ──────────────────
  it('T012: at 120 BPM, quarter note (960 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 0', () => {
    const params = makeMockParams();

    const quarterNote = {
      tick: 0,
      durationTicks: 960,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [quarterNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 120, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    // 960 / ((120/60)*960) * 1000 = 500 ms; 500 is NOT > HOLD_FLOOR_MS (500) → 0
    expect(correctCalls[0][0].requiredHoldMs).toBe(0);
  });

  // ─── T013: regression — 120 BPM half note still requires a hold ─────────────
  it('T013: at 120 BPM, half note (1 920 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 1 000', () => {
    const params = makeMockParams();

    const halfNote = {
      tick: 0,
      durationTicks: 1_920,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [halfNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 120, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    // 1920 / ((120/60)*960) * 1000 = 1 000 ms; 1 000 > 500 → hold required
    expect(correctCalls[0][0].requiredHoldMs).toBe(1_000);
  });

  // ─── T016: edge case — computeRequiredHoldMs guards against BPM ≤ 0 ────────
  it('T016: computeRequiredHoldMs(3_840, 0) returns 0 (BPM ≤ 0 guard)', () => {
    expect(computeRequiredHoldMs(3_840, 0)).toBe(0);
    expect(computeRequiredHoldMs(3_840, -1)).toBe(0);
  });

  // ─── T017: spec boundary — 20 BPM quarter note requires a hold ──────────────
  it('T017: at exactly 20 BPM, quarter note (960 ticks) dispatches CORRECT_MIDI with requiredHoldMs = 3 000', () => {
    const params = makeMockParams();

    const quarterNote = {
      tick: 0,
      durationTicks: 960,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [quarterNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 20, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    // 960 / ((20/60)*960) * 1000 = 3 000 ms; 3 000 > 500 → hold required
    expect(correctCalls[0][0].requiredHoldMs).toBe(3_000);
  });

  // ─── T018: gap-clipping still works after T008 ────────────────────────────
  it('T018: at 10 BPM, note with gap < duration is clipped (durationTicks=3840, gap=1920) → requiredHoldMs = 12 000', () => {
    const params = makeMockParams();

    const longNote = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    // gap = 1920 < 3840 → effectiveDurTicks = 1920
    const nextNote = {
      tick: 1_920,
      durationTicks: 960,
      midiPitches: [62] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n2'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [longNote, nextNote],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 10, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'attack', midiNote: 60, timestamp: Date.now() });

    const correctCalls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI',
    );
    expect(correctCalls).toHaveLength(1);
    // effectiveDurTicks = 1920; 1920 / ((10/60)*960) * 1000 = 12 000 ms
    expect(correctCalls[0][0].requiredHoldMs).toBe(12_000);
  });
});
