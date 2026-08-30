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
  it('T002a: setFreeTempo(1.25) with base 80 yields freeEffectiveBpm = 100', () => {
    const params = makeMockParams(80);
    const { result } = renderHook(() => useFreePractice(params));

    // Enter free practice from the selector — seeds base BPM from the metronome.
    act(() => result.current.handleFreePractice());
    expect(result.current.freeStaffBpm).toBe(80);

    act(() => result.current.setFreeTempo(1.25));
    expect(result.current.freeEffectiveBpm).toBe(100);
  });

  it('T002b: effective BPM is floored at ABSOLUTE_BPM_FLOOR (10) at very slow speeds', () => {
    const params = makeMockParams(40);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    expect(result.current.freeStaffBpm).toBe(40);

    // base 40 × 0.25 = 10 — exactly the floor; a lower value must never appear.
    act(() => result.current.setFreeTempo(0.25));
    expect(result.current.freeEffectiveBpm).toBe(10);

    act(() => result.current.setFreeTempo(0.1));
    expect(result.current.freeEffectiveBpm).toBe(10);
  });

  it('T002c: stopping a free session persists the EFFECTIVE BPM, not the base', () => {
    const params = makeMockParams(80);
    const { result } = renderHook(() => useFreePractice(params));

    act(() => result.current.handleFreePractice());
    // Start the live recording session.
    act(() => result.current.handleFreeToggle());

    // User drags the tempo slider mid-session: 80 × 1.25 = 100.
    act(() => result.current.setFreeTempo(1.25));
    expect(result.current.freeEffectiveBpm).toBe(100);

    // User stops the session — the saved record must carry the effective tempo.
    act(() => result.current.handleFreeToggle());
    expect(result.current.freeMidiRecord?.bpm).toBe(100);
    expect(result.current.freeMidiRecord?.bpm).not.toBe(80);
  });
});