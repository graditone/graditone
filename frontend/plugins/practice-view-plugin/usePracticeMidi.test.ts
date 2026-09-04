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

  // ─── T007-red: full-measure chord released at/above the acceptance threshold
  // ─── dispatches HOLD_COMPLETE, NOT EARLY_RELEASE (feature 098) ─────────────
  it('T007-red: release of a full-measure chord after a full hold dispatches HOLD_COMPLETE, not EARLY_RELEASE', () => {
    const params = makeMockParams();

    const wholeChord = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60, 64, 67] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1', 'n2', 'n3'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      currentIndex: 0,
      notes: [wholeChord],
      holdStartTimeMs: Date.now() - 4_000,
      requiredHoldMs: 4_000,
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 60, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'release', midiNote: 60, timestamp: Date.now() });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const completeCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'HOLD_COMPLETE');
    const earlyCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'EARLY_RELEASE');
    expect(completeCalls).toHaveLength(1);
    expect(earlyCalls).toHaveLength(0);
    // Required 4000, acceptance 3200 (20%); a full-measure 4000 ms hold is accepted.
    expect(completeCalls[0][0].holdDurationMs).toBeGreaterThanOrEqual(3_200);
  });

  // ─── T009-red: pressing the next chord while the current hold has already
  // ─── reached the acceptance threshold must NOT dispatch WRONG_MIDI — it
  // ─── completes the current hold and starts the next entry (feature 098) ────
  it('T009-red: press of next chord at the downbeat while a full hold is reached does not dispatch WRONG_MIDI', () => {
    const params = makeMockParams();

    const chord1 = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60, 64, 67] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1', 'n2', 'n3'] as readonly string[],
    };
    const chord2 = {
      tick: 3_840,
      durationTicks: 3_840,
      midiPitches: [53, 57, 60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n4', 'n5', 'n6'] as readonly string[],
    };
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      currentIndex: 0,
      notes: [chord1, chord2],
      holdStartTimeMs: Date.now() - 4_000,
      requiredHoldMs: 4_000,
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 60, status: 'ready' as const, staffCount: 1 },
    };

const midiCallback = captureMidiCallback(params);
    // First release one pitch of chord1 (hold already accepted).
    midiCallback({ type: 'release', midiNote: 60, timestamp: Date.now() });
    // Press a pitch that belongs ONLY to chord2 (53 = F3).
    midiCallback({ type: 'attack', midiNote: 53, timestamp: Date.now() });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const wrongCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'WRONG_MIDI');
    const completeCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'HOLD_COMPLETE');
    expect(wrongCalls).toHaveLength(0);
    expect(completeCalls.length).toBeGreaterThan(0);
  });

  // ─── T016-US2: a release at exactly the acceptance boundary is accepted
  // ─── regardless of rAF frame timing (order-independence, feature 098) ──────
  it('T016-US2: release at exactly the acceptance boundary dispatches HOLD_COMPLETE, not EARLY_RELEASE', () => {
    const params = makeMockParams();

    const wholeNote = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    // At 120 BPM a whole note requires 2000 ms; acceptance = 2000 − 400 (20%) = 1600.
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      currentIndex: 0,
      notes: [wholeNote],
      holdStartTimeMs: 0,
      requiredHoldMs: 2_000,
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };

    // Freeze Date.now so the measured hold is deterministic.
    const NOW = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => NOW);

    try {
      const midiCallback = captureMidiCallback(params);
      // Hold started 1600 ms before NOW → release lands exactly on acceptance.
      practiceState.holdStartTimeMs = NOW - 1_600;
      midiCallback({ type: 'release', midiNote: 60, timestamp: NOW });

      const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
      const completeCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'HOLD_COMPLETE');
      const earlyCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'EARLY_RELEASE');
      expect(completeCalls).toHaveLength(1);
      expect(earlyCalls).toHaveLength(0);
      expect(completeCalls[0][0].holdDurationMs).toBe(1_600);
    } finally {
      (Date.now as ReturnType<typeof vi.spyOn>).mockRestore?.();
      vi.restoreAllMocks();
    }
  });

  // ─── T020-US3: a true early release (half the required hold) STILL dispatches
  // ─── EARLY_RELEASE, and a subsequent full retry re-enters holding (feature 098)
  it('T020-US3: sub-threshold release dispatches EARLY_RELEASE, not HOLD_COMPLETE', () => {
    const params = makeMockParams();

    const wholeNote = {
      tick: 0,
      durationTicks: 3_840,
      midiPitches: [60] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1'] as readonly string[],
    };
    // At 60 BPM a whole note requires 4000 ms; acceptance = 3200 (20%).
    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'holding' as const,
      currentIndex: 0,
      notes: [wholeNote],
      holdStartTimeMs: Date.now() - 2_000,
      requiredHoldMs: 4_000,
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 60, status: 'ready' as const, staffCount: 1 },
    };

    const midiCallback = captureMidiCallback(params);
    midiCallback({ type: 'release', midiNote: 60, timestamp: Date.now() });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const earlyCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'EARLY_RELEASE');
    const completeCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'HOLD_COMPLETE');
    expect(earlyCalls).toHaveLength(1);
    expect(completeCalls).toHaveLength(0);
    expect(earlyCalls[0][0].holdDurationMs).toBeGreaterThanOrEqual(2_000);
  });

  it('T005-F100: first chord of loop iteration 2 is anchored at the musical loop period, not the completion timestamp', () => {
    // Regression (feature 100): on a repeated phrase, the first chord of each
    // iteration >= 2 must have expectedTimeMs anchored at the musical loop
    // period (one full loop after iteration 1's start) — NOT at the previous
    // iteration's wall-clock completion (release) timestamp. The old formula
    // used `loopStartTimesRef[loopK]` (a completion timestamp), which made an
    // accurate downbeat read spuriously late by the hold tail + pickup (>600ms).
    const params = makeMockParams();

    const chord = {
      tick: 0,
      durationTicks: 960,
      midiPitches: [57, 60, 64, 69] as readonly number[],
      sustainedPitches: [] as readonly number[],
      noteIds: ['n1', 'n2', 'n3', 'n4'] as readonly string[],
    };

    const practiceState = {
      ...INITIAL_PRACTICE_STATE,
      mode: 'active' as const,
      currentIndex: 0,
      notes: [chord],
    };
    params.practiceState = practiceState;
    params.practiceStateRef = { current: practiceState };
    params.playerStateRef = {
      current: { ...params.playerState, bpm: 120, status: 'ready' as const, staffCount: 1, currentTick: 0 },
    };
    // Loop region of one half note (1920 ticks @120bpm = 1000ms period).
    params.loopRegionRef = { current: { startTick: 0, endTick: 1920 } };
    params.loopIterationRef = { current: 1 };
    // Old code read this completion timestamp as the anchor (bug source).
    params.loopStartTimesRef = { current: [0, 1250] };
    // Session started 1000ms ago = exactly one loop period — an accurate downbeat.
    params.practiceStartTimeRef = { current: Date.now() - 1000 };

    const midiCallback = captureMidiCallback(params);
    const ts = Date.now();
    midiCallback({ type: 'attack', midiNote: 57, timestamp: ts });
    midiCallback({ type: 'attack', midiNote: 60, timestamp: ts + 5 });
    midiCallback({ type: 'attack', midiNote: 64, timestamp: ts + 10 });
    midiCallback({ type: 'attack', midiNote: 69, timestamp: ts + 15 });

    const calls = (params.dispatchPractice as ReturnType<typeof vi.fn>).mock.calls;
    const correctCalls = calls.filter(([a]: [{ type: string }]) => a.type === 'CORRECT_MIDI');
    expect(correctCalls).toHaveLength(1);

    const expectedTimeMs = correctCalls[0][0].expectedTimeMs;
    // Anchored at the one-loop-period mark (1000ms), NOT the completion timestamp (1250ms).
    expect(expectedTimeMs).toBe(1000);
    // And consistent with the measured response (1000ms) so an accurate player
    // is not measured as late.
    expect(Math.abs(expectedTimeMs - correctCalls[0][0].responseTimeMs)).toBeLessThan(50);
  });
});
