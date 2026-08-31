/**
 * useFreePractice — Effective Tempo Contract Tests (Feature 093)
 *
 * Verifies the new effective-BPM contract:
 *   - setFreeTempo(multiplier) recomputes freeEffectiveBpm = round(base × multiplier)
 *   - effective BPM never drops below ABSOLUTE_BPM_FLOOR (10)
 *   - stopping a session persists the EFFECTIVE BPM (base × multiplier at stop),
 *     not the session-boundary base — this is the Feature 093 regression guard
 *     for FreeMidiRecord.bpm going stale when the tempo slider is moved.
 *
 * Written RED against the pre-fix useFreePractice.ts (T002 — foundational).
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useFreePractice } from './useFreePractice';
import type { PluginContext, MetronomeState } from '../../src/plugin-api/index';

type MidiHandler = (event: { type: 'attack' | 'release'; midiNote: number }) => void;
type StateHandler = (s: unknown) => void;

function makeMockParams(metronomeBpm = 80) {
  const midiSubscribers = new Set<MidiHandler>();
  const stateSubscribers = new Set<StateHandler>();

  const metronomeStateRef = { current: {
    active: false,
    beatIndex: -1,
    isDownbeat: false,
    bpm: metronomeBpm,
    subdivision: 1,
    subBeatIndex: 0,
  } } as React.MutableRefObject<MetronomeState>;

  const context = {
    midi: {
      subscribe: vi.fn((handler: MidiHandler) => {
        midiSubscribers.add(handler);
        return () => midiSubscribers.delete(handler);
      }),
    },
    playNote: vi.fn(),
    stopPlayback: vi.fn(),
  } as unknown as PluginContext;

  return {
    context,
    metronomeStateRef,
    loadedScoreRefRef: { current: null } as React.MutableRefObject<null>,
    isReplaying: false,
    setIsReplaying: vi.fn(),
    setResultsOverlayVisible: vi.fn(),
    setIsSaved: vi.fn(),
    setSaveError: vi.fn(),
  };
}

describe('useFreePractice — effective tempo contract (Feature 093)', () => {
  it('T002a: entering free practice adopts the live metronome tempo; the slider scales from the nominal 120', () => {
    const params = makeMockParams(80);
    const { result } = renderHook(() => useFreePractice(params));

    // Metronome reports 80 (effective). The free base stays the nominal 120 and
    // the tempo is expressed via the multiplier so label == audible metronome.
    act(() => result.current.handleFreePractice());
    expect(result.current.freeStaffBpm).toBe(120);
    expect(result.current.freeEffectiveBpm).toBe(80);

    act(() => result.current.setFreeTempo(1.25));
    expect(result.current.freeEffectiveBpm).toBe(150);
  });

  it('T002b: effective BPM is floored at ABSOLUTE_BPM_FLOOR (10) at very slow speeds', () => {
    const params = makeMockParams(40);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    expect(result.current.freeStaffBpm).toBe(120);
    expect(result.current.freeEffectiveBpm).toBe(40);

    // 120 × 0.05 = 6 → floored to 10; a lower value must never appear.
    act(() => result.current.setFreeTempo(0.05));
    expect(result.current.freeEffectiveBpm).toBe(10);
  });

  it('T002c: stopping a free session persists the EFFECTIVE BPM, not the base', () => {
    const params = makeMockParams(80);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    // Start the live recording session (metronome at 80 → multiplier 2/3).
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeEffectiveBpm).toBe(80);

    // User drags the tempo slider mid-session: 120 × 1.25 = 150.
    act(() => result.current.setFreeTempo(1.25));
    expect(result.current.freeEffectiveBpm).toBe(150);

    // User stops the session — the saved record must carry the effective tempo.
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(150);
    expect(result.current.freeMidiRecord?.bpm).not.toBe(120); // the nominal base
  });
});

describe('useFreePractice — Feature 094 onset-derived recording', () => {
  type MidiHandler094 = (event: { type: 'attack' | 'release'; midiNote: number }) => void;

  function makeMockParamsWithMidi(metronomeBpm = 80) {
    const midiSubscribers = new Set<MidiHandler094>();
    const metronomeStateRef = { current: {
      active: false,
      beatIndex: -1,
      isDownbeat: false,
      bpm: metronomeBpm,
      subdivision: 1,
      subBeatIndex: 0,
    } } as React.MutableRefObject<MetronomeState>;
    const context = {
      midi: {
        subscribe: vi.fn((handler: MidiHandler094) => {
          midiSubscribers.add(handler);
          return () => midiSubscribers.delete(handler);
        }),
      },
      playNote: vi.fn(),
      stopPlayback: vi.fn(),
    } as unknown as PluginContext;
    return {
      params: {
        context,
        metronomeStateRef,
        loadedScoreRefRef: { current: null } as React.MutableRefObject<null>,
        isReplaying: false,
        setIsReplaying: vi.fn(),
        setResultsOverlayVisible: vi.fn(),
        setIsSaved: vi.fn(),
        setSaveError: vi.fn(),
      },
      emitAttack: (note = 60) => {
        midiSubscribers.forEach((h) => h({ type: 'attack', midiNote: note }));
      },
      emitRelease: (note = 60) => {
        midiSubscribers.forEach((h) => h({ type: 'release', midiNote: note }));
      },
    };
  }

  it('T016: eight beat-aligned quarter notes recorded via MIDI yield noteCount 8 on Stop', () => {
    vi.useFakeTimers();
    try {
      const { params, emitAttack, emitRelease } = makeMockParamsWithMidi(80);
      const { result } = renderHook(() => useFreePractice(params));

      act(() => result.current.handleFreePractice());
      act(() => result.current.handleFreeToggle());

      // Simulate 8 quarter notes: attack (may complete) then release each.
      for (let i = 0; i < 8; i++) {
        act(() => emitAttack(60));
        act(() => {
          vi.advanceTimersByTime(750);
          emitRelease(60);
        });
      }
      act(() => result.current.handleFreeToggle());

      expect(result.current.freeMidiRecord?.noteCount).toBe(8);
      expect(result.current.freeMidiRecord?.events).toHaveLength(8);
      // Every recorded event carries a resolved duration.
      expect(result.current.freeMidiRecord?.events.every((e) => e.durationMs != null)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useFreePractice — replay note highlighting (Feature 094c)', () => {
  type MidiHandlerC = (event: { type: 'attack' | 'release'; midiNote: number }) => void;

  function makeMidiCtx(metronomeBpm = 120) {
    const midiSubscribers = new Set<MidiHandlerC>();
    const metronomeStateRef = { current: {
      active: false, beatIndex: -1, isDownbeat: false, bpm: metronomeBpm, subdivision: 1, subBeatIndex: 0,
    } } as React.MutableRefObject<MetronomeState>;
    const context = {
      midi: {
        subscribe: vi.fn((handler: MidiHandlerC) => {
          midiSubscribers.add(handler);
          return () => midiSubscribers.delete(handler);
        }),
      },
      playNote: vi.fn(),
      stopPlayback: vi.fn(),
    } as unknown as PluginContext;
    return {
      params: {
        context,
        metronomeStateRef,
        loadedScoreRefRef: { current: null } as React.MutableRefObject<null>,
        isReplaying: false,
        setIsReplaying: vi.fn(),
        setResultsOverlayVisible: vi.fn(),
        setIsSaved: vi.fn(),
        setSaveError: vi.fn(),
      },
      emitAttack: (note = 60) => midiSubscribers.forEach((h) => h({ type: 'attack', midiNote: note })),
      emitRelease: (note = 60) => midiSubscribers.forEach((h) => h({ type: 'release', midiNote: note })),
    };
  }

  it('T-NEW-15: during replay, the staff highlights the note currently playing and clears when replay ends', () => {
    vi.useFakeTimers();
    try {
      const { params, emitAttack, emitRelease } = makeMidiCtx(120);
      const { result } = renderHook(() => useFreePractice(params));

      act(() => result.current.handleFreePractice());
      act(() => result.current.handleFreeToggle());

      // Two quarter notes at 120 BPM (beat = 500 ms).
      emitAttack(60);
      act(() => vi.advanceTimersByTime(500));
      emitRelease(60);
      emitAttack(62);
      act(() => vi.advanceTimersByTime(500));
      emitRelease(62);

      act(() => result.current.handleFreeToggle());
      expect(result.current.freeMidiRecord?.noteCount).toBe(2);
      expect(result.current.freeReplayNoteIndexes).toEqual([]);

      // Start replay.
      act(() => result.current.handleFreeReplay());
      expect(result.current.freeReplayNoteIndexes).toEqual([]);

      // First note plays → index 0 highlighted.
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.freeReplayNoteIndexes).toEqual([0]);

      // Second note plays → index 1 highlighted.
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.freeReplayNoteIndexes).toEqual([1]);

      // Replay finishes → highlight cleared.
      act(() => vi.advanceTimersByTime(600));
      expect(result.current.freeReplayNoteIndexes).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('T-NEW-16: a chord during replay highlights all its notes together (same onset)', () => {
    vi.useFakeTimers();
    try {
      const { params, emitAttack, emitRelease } = makeMidiCtx(120);
      const { result } = renderHook(() => useFreePractice(params));

      act(() => result.current.handleFreePractice());
      act(() => result.current.handleFreeToggle());

      // A 3-note chord at t=0 then a single note at t=500 (two quarter slots).
      emitAttack(60); emitAttack(64); emitAttack(67);
      act(() => vi.advanceTimersByTime(500));
      emitRelease(60); emitRelease(64); emitRelease(67);
      emitAttack(62);
      act(() => vi.advanceTimersByTime(500));
      emitRelease(62);

      act(() => result.current.handleFreeToggle());
      expect(result.current.freeMidiRecord?.noteCount).toBe(4);

      act(() => result.current.handleFreeReplay());
      act(() => vi.advanceTimersByTime(1));
      // Chord = staff indexes 0..2 highlighted together; next note at index 3.
      expect(result.current.freeReplayNoteIndexes).toEqual([0, 1, 2]);

      act(() => vi.advanceTimersByTime(500));
      expect(result.current.freeReplayNoteIndexes).toEqual([3]);

      act(() => vi.advanceTimersByTime(600));
      expect(result.current.freeReplayNoteIndexes).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useFreePractice — session-start tempo seeding (Issue #2: non-default BPM mismatch)', () => {
  /**
   * Reproduces the reported free-practice failure when the tempo slider is
   * changed before starting a session:
   *   - metronome seeded at 120 (base)
   *   - slider → multiplier 0.25 (readout 30). The real metronome FOLLOWS the
   *     scorePlayer effective BPM, so its reported bpm is ALSO 30 (already
   *     includes the ×0.25).
   *   - pressing ▶ re-seeds from the metronome bpm while preserving the
   *     multiplier, double-applying it (30 × 0.25 → 7.5 → floored to 10).
   *   - Detection then uses 10 BPM while the user plays 2000ms (30 BPM) notes
   *     → 8 notes collapse into 1/16 fragments in one incomplete measure.
   *
   * Written RED: the assertions below (effective === metronome bpm) FAIL on the
   * current code. Permanent regression guard (Constitution Principle VII).
   */
  it('T-NEW-1: effective BPM stays the metronome (30) at session start after a slider change to 0.25', () => {
    const params = makeMockParams(120);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    // Slider → readout 30. Metronome follows the effective BPM (30).
    act(() => result.current.setFreeTempo(0.25));
    expect(result.current.freeEffectiveBpm).toBe(30);

    // Real metronome now reports 30 (already includes the multiplier).
    params.metronomeStateRef.current = {
      ...params.metronomeStateRef.current,
      bpm: 30,
      active: true,
    };

    // Press ▶ to redo — must keep effective 30, not double-scale to 10.
    act(() => result.current.handleFreeToggle());

    expect(result.current.freeEffectiveBpm).toBe(30);

    // Stop — the persisted record must also carry 30 (the true tempo).
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(30);
  });

  it('T-NEW-2: session start at multiplier 1.5 keeps effective 180 (metronome 180)', () => {
    const params = makeMockParams(120);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    act(() => result.current.setFreeTempo(1.5));
    expect(result.current.freeEffectiveBpm).toBe(180);

    params.metronomeStateRef.current = {
      ...params.metronomeStateRef.current,
      bpm: 180,
      active: true,
    };

    act(() => result.current.handleFreeToggle());
    expect(result.current.freeEffectiveBpm).toBe(180);

    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(180);
  });

  it('T-NEW-3: with the metronome off (bpm 0), session start preserves the slider effective tempo', () => {
    const params = makeMockParams(0);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    act(() => result.current.setFreeTempo(0.25)); // readout 30
    expect(result.current.freeEffectiveBpm).toBe(30);

    // Metronome off → no bpm to re-seed from; effective must not be clobbered.
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeEffectiveBpm).toBe(30);

    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(30);
  });

  it('T-NEW-4: Repractice preserves the finished session tempo (30) instead of re-deriving from the metronome', () => {
    const params = makeMockParams(120);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    act(() => result.current.setFreeTempo(0.25)); // readout 30
    expect(result.current.freeEffectiveBpm).toBe(30);

    // Metronome follows the effective tempo → 30, active.
    params.metronomeStateRef.current = { ...params.metronomeStateRef.current, bpm: 30, active: true };

    act(() => result.current.handleFreeToggle()); // start
    expect(result.current.freeEffectiveBpm).toBe(30);
    act(() => result.current.handleFreeToggle()); // stop
    expect(result.current.freeMidiRecord?.bpm).toBe(30);

    // Common post-session state: the metronome is no longer live (bpm 0).
    // Repractice must keep the tempo the user just practiced at — NOT fall back
    // to 120 (which previously desynced the label from the actual metronome).
    params.metronomeStateRef.current = { ...params.metronomeStateRef.current, bpm: 0, active: false };
    act(() => result.current.handleFreeRepractice());

    expect(result.current.freeEffectiveBpm).toBe(30);

    // A fresh Stop after repractice persists the same tempo.
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(30);
  });

  it('T-NEW-6: re-entering free practice with a live metronome keeps the nominal base 120 and adopts the tempo via the multiplier', () => {
    const params = makeMockParams(120);
    const { result } = renderHook(() => useFreePractice(params));

    // First session at 30 (slider 0.25).
    act(() => result.current.handleFreePractice());
    act(() => result.current.setFreeTempo(0.25));
    expect(result.current.freeEffectiveBpm).toBe(30);

    // Metronome is live at 30 (it follows the effective tempo).
    params.metronomeStateRef.current = { ...params.metronomeStateRef.current, bpm: 30, active: true };

    // Exit free practice, then re-enter.
    act(() => result.current.handleFreeBack());
    act(() => result.current.handleFreePractice());

    // The nominal base MUST stay 120 (the scorePlayer/metronome nominal); the
    // live metronome's 30 is realized through the multiplier so the label and
    // the audible metronome agree. Pre-fix the base was re-captured as 30,
    // desyncing it from the 120-based metronome on slider moves.
    expect(result.current.freeStaffBpm).toBe(120);
    expect(result.current.freeEffectiveBpm).toBe(30);

    // A slider move now scales from the nominal consistently (120 × 1.5 = 180,
    // same scaling the scorePlayer-driven metronome applies).
    act(() => result.current.setFreeTempo(1.5));
    expect(result.current.freeEffectiveBpm).toBe(180);
  });
});