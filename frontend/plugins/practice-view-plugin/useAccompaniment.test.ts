/**
 * Feature 089: Tests for useAccompaniment hook.
 *
 * Coverage:
 *   T008 — Fundamental behavior (US1: has accompaniment detection)
 *   T011 — Regression: piano-only score
 *   T015 — playAccompanimentAtTick delegates to scorePlayer.playAccompanimentAtTick
 *   T016 — playAccompanimentAtTick is a no-op when no accompaniment parts
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PluginScorePlayerContext, PluginInstrumentInfo } from '../../src/plugin-api/types';

// ---------------------------------------------------------------------------
// useAccompaniment is a practice-plugin hook — import from the plugin dir
// ---------------------------------------------------------------------------

import { useAccompaniment } from './useAccompaniment';

// ---------------------------------------------------------------------------
// Test double factory
// ---------------------------------------------------------------------------

function makeScorePlayer(
  instruments: PluginInstrumentInfo[] = [],
): PluginScorePlayerContext {
  return {
    getCatalogue: () => [],
    loadScore: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekToTick: vi.fn(),
    setPinnedStart: vi.fn(),
    setLoopEnd: vi.fn(),
    setTempoMultiplier: vi.fn(),
    snapToScoreTempo: vi.fn(),
    subscribe: vi.fn((handler) => {
      handler({
        status: 'ready' as const,
        currentTick: 0,
        totalDurationTicks: 0,
        highlightedNoteIds: new Set<string>(),
        bpm: 120,
        exactBpm: 120,
        title: null,
        error: null,
        staffCount: 2,
        timeSignature: { numerator: 4, denominator: 4 },
        pickupTicks: 0,
      });
      return () => {};
    }),
    getCurrentTickLive: () => 0,
    extractPracticeNotes: () => null,
    getMeasureEndTicks: () => null,
    rawTickToExpandedTick: (t) => t,
    getPhrases: () => null,
    getRegionDifficulty: () => null,
    getRegionDifficultyForScore: async () => null,
    setPlaybackStaffFilter: vi.fn(),
    getInstruments: vi.fn(() => instruments),
    setPartVolume: vi.fn(),
    getAccompanimentNotesAtTick: vi.fn(() => []),
    playAccompanimentAtTick: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// T008 — Fundamental behavior: hasAccompaniment detection
// ---------------------------------------------------------------------------

describe('useAccompaniment — fundamental behavior (T008)', () => {
  it('US1: hasAccompaniment=true for violin+piano score', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    expect(result.current.hasAccompaniment).toBe(true);
  });

  it('US1: hasAccompaniment=false for piano-only score', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    expect(result.current.hasAccompaniment).toBe(false);
  });

  it('US1: hasAccompaniment=false when no score loaded (empty instruments)', () => {
    const player = makeScorePlayer([]);
    const { result } = renderHook(() => useAccompaniment(player));
    expect(result.current.hasAccompaniment).toBe(false);
  });

  it('US1: hasAccompaniment=false when no piano exists (violin-only)', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    expect(result.current.hasAccompaniment).toBe(false);
  });

  it('does NOT call setPartVolume on mount (volume is managed by InstrumentMixerOverlay)', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    renderHook(() => useAccompaniment(player));
    expect(player.setPartVolume).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T011 — Regression: piano-only score
// ---------------------------------------------------------------------------

describe('useAccompaniment — piano-only regression (T011)', () => {
  it('piano-only score: setPartVolume never called', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ]);
    renderHook(() => useAccompaniment(player));
    expect(player.setPartVolume).not.toHaveBeenCalled();
  });

  it('piano-only score: playAccompanimentAtTick does not delegate to scorePlayer', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    act(() => { result.current.playAccompanimentAtTick(0, 120, 960); });
    expect(player.playAccompanimentAtTick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T015 — playAccompanimentAtTick delegates to scorePlayer API
// ---------------------------------------------------------------------------

describe('useAccompaniment — playAccompanimentAtTick (T015)', () => {
  it('calls scorePlayer.playAccompanimentAtTick with tick, bpm, ticksPerBeat', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    act(() => { result.current.playAccompanimentAtTick(480, 120, 960); });
    expect(player.playAccompanimentAtTick).toHaveBeenCalledWith(480, 120, 960);
  });

  it('passes bpm and ticksPerBeat through unchanged', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    act(() => { result.current.playAccompanimentAtTick(1920, 80, 960); });
    expect(player.playAccompanimentAtTick).toHaveBeenCalledWith(1920, 80, 960);
  });
});

// ---------------------------------------------------------------------------
// T016 — no-op when no accompaniment parts
// ---------------------------------------------------------------------------

describe('useAccompaniment — no-op path (T016)', () => {
  it('playAccompanimentAtTick is a no-op when hasAccompaniment is false', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    act(() => { result.current.playAccompanimentAtTick(9999, 120, 960); });
    expect(player.playAccompanimentAtTick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Multiple accompaniment parts
// ---------------------------------------------------------------------------

describe('useAccompaniment — multiple accompaniment parts', () => {
  it('hasAccompaniment=true for piano + multiple accompaniment parts', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
      { partIndex: 2, instrumentType: 'cello', name: 'Cello', staffCount: 1 },
    ]);
    const { result } = renderHook(() => useAccompaniment(player));
    expect(result.current.hasAccompaniment).toBe(true);
  });

  it('does NOT call setPartVolume for any part (volume owned by mixer)', () => {
    const player = makeScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
      { partIndex: 2, instrumentType: 'cello', name: 'Cello', staffCount: 1 },
    ]);
    renderHook(() => useAccompaniment(player));
    expect(player.setPartVolume).not.toHaveBeenCalled();
  });
});
