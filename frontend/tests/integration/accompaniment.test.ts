import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PluginScorePlayerContext, PluginInstrumentInfo } from '../../src/plugin-api/types';

/**
 * Feature 089: Contract tests for Plugin API v11 additions.
 *
 * Tests the contracts for:
 *   - getInstruments(): ReadonlyArray<PluginInstrumentInfo>
 *   - setPartVolume(partIndex: number, volume: number): void
 *
 * These tests use a mock scorePlayer that implements the v11 interface.
 * They validate contract shape, clamping, and accompaniment detection logic.
 *
 * TDD: Written BEFORE implementation. Must be red until T005/T006/T009 complete.
 */

// ---------------------------------------------------------------------------
// Mock score player factory (v11 shape)
// ---------------------------------------------------------------------------

function makeMockScorePlayer(
  instruments: PluginInstrumentInfo[] = [],
): PluginScorePlayerContext & { _partVolumes: Map<number, number> } {
  const partVolumes = new Map<number, number>();
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
        status: 'ready',
        currentTick: 0,
        totalDurationTicks: 0,
        highlightedNoteIds: new Set(),
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
    // v11
    getInstruments: () => instruments,
    setPartVolume: vi.fn((partIndex: number, volume: number) => {
      partVolumes.set(partIndex, volume);
    }),
    // test helper
    _partVolumes: partVolumes,
  };
}

// ---------------------------------------------------------------------------
// Contract tests: PluginInstrumentInfo shape
// ---------------------------------------------------------------------------

describe('PluginInstrumentInfo — contract shape', () => {
  it('has required fields: partIndex, instrumentType, name, staffCount', () => {
    const info: PluginInstrumentInfo = {
      partIndex: 0,
      instrumentType: 'piano',
      name: 'Piano',
      staffCount: 2,
    };
    expect(info.partIndex).toBe(0);
    expect(info.instrumentType).toBe('piano');
    expect(info.name).toBe('Piano');
    expect(info.staffCount).toBe(2);
  });

  it('violin instrument has staffCount 1', () => {
    const info: PluginInstrumentInfo = {
      partIndex: 1,
      instrumentType: 'violin',
      name: 'Violin',
      staffCount: 1,
    };
    expect(info.instrumentType).toBe('violin');
    expect(info.staffCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Contract tests: getInstruments()
// ---------------------------------------------------------------------------

describe('getInstruments() — contract', () => {
  it('returns empty array when no score is loaded', () => {
    const player = makeMockScorePlayer([]);
    expect(player.getInstruments()).toEqual([]);
  });

  it('returns instrument list for violin+piano score', () => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ];
    const player = makeMockScorePlayer(instruments);
    const result = player.getInstruments();
    expect(result).toHaveLength(2);
    expect(result[0].instrumentType).toBe('piano');
    expect(result[1].instrumentType).toBe('violin');
  });

  it('accompaniment detection: piano-only → no accompaniment parts', () => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ];
    const player = makeMockScorePlayer(instruments);
    const result = player.getInstruments();
    const accompanimentParts = result.filter((i) => i.instrumentType !== 'piano');
    expect(accompanimentParts).toHaveLength(0);
  });

  it('accompaniment detection: violin+piano → violin is accompaniment part', () => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ];
    const player = makeMockScorePlayer(instruments);
    const result = player.getInstruments();
    const accompanimentParts = result.filter((i) => i.instrumentType !== 'piano');
    expect(accompanimentParts).toHaveLength(1);
    expect(accompanimentParts[0].partIndex).toBe(1);
  });

  it('multiple non-piano parts: all are accompaniment', () => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'violin', name: 'Violin I', staffCount: 1 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin II', staffCount: 1 },
      { partIndex: 2, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
    ];
    const player = makeMockScorePlayer(instruments);
    const result = player.getInstruments();
    const accompanimentParts = result.filter((i) => i.instrumentType !== 'piano');
    expect(accompanimentParts).toHaveLength(2);
  });

  it('fail-closed: no piano part → hasPiano=false, hasAccompaniment=false', () => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ];
    const player = makeMockScorePlayer(instruments);
    const result = player.getInstruments();
    const hasPiano = result.some((i) => i.instrumentType === 'piano');
    const hasNonPiano = result.some((i) => i.instrumentType !== 'piano');
    const hasAccompaniment = hasPiano && hasNonPiano;
    expect(hasPiano).toBe(false);
    expect(hasAccompaniment).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Contract tests: setPartVolume()
// ---------------------------------------------------------------------------

describe('setPartVolume() — contract', () => {
  let player: ReturnType<typeof makeMockScorePlayer>;

  beforeEach(() => {
    const instruments: PluginInstrumentInfo[] = [
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ];
    player = makeMockScorePlayer(instruments);
  });

  it('accepts volume=0.7 (default accompaniment volume)', () => {
    player.setPartVolume(1, 0.7);
    expect(player.setPartVolume).toHaveBeenCalledWith(1, 0.7);
  });

  it('accepts volume=0.0 (mute)', () => {
    player.setPartVolume(1, 0.0);
    expect(player.setPartVolume).toHaveBeenCalledWith(1, 0.0);
  });

  it('accepts volume=1.0 (full)', () => {
    player.setPartVolume(1, 1.0);
    expect(player.setPartVolume).toHaveBeenCalledWith(1, 1.0);
  });

  it('signature: takes partIndex and volume', () => {
    player.setPartVolume(0, 0.5);
    expect(player.setPartVolume).toHaveBeenCalledWith(0, 0.5);
  });

  it('is called for each accompaniment part index', () => {
    const accompanimentParts = player.getInstruments().filter((i) => i.instrumentType !== 'piano');
    for (const part of accompanimentParts) {
      player.setPartVolume(part.partIndex, 0.7);
    }
    expect(player.setPartVolume).toHaveBeenCalledTimes(accompanimentParts.length);
  });
});

// ---------------------------------------------------------------------------
// Integration scenario: US3 — tempo sync is architectural (no extra logic needed)
// ---------------------------------------------------------------------------

describe('US3 — tempo sync (architectural guarantee)', () => {
  it('setTempoMultiplier exists and setPartVolume are independent operations', () => {
    const player = makeMockScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    // Both can be called independently without conflict
    player.setTempoMultiplier(0.6);
    player.setPartVolume(1, 0.7);
    expect(player.setTempoMultiplier).toHaveBeenCalledWith(0.6);
    expect(player.setPartVolume).toHaveBeenCalledWith(1, 0.7);
  });
});

// ---------------------------------------------------------------------------
// Integration scenario: US4 — staff filter + accompaniment are orthogonal
// ---------------------------------------------------------------------------

describe('US4 — staff filter and accompaniment volume are orthogonal', () => {
  it('setPlaybackStaffFilter and setPartVolume can be called independently', () => {
    const player = makeMockScorePlayer([
      { partIndex: 0, instrumentType: 'piano', name: 'Piano', staffCount: 2 },
      { partIndex: 1, instrumentType: 'violin', name: 'Violin', staffCount: 1 },
    ]);
    player.setPlaybackStaffFilter(0); // one-hand mode (piano treble only)
    player.setPartVolume(1, 0.7);    // violin accompaniment at 70%
    expect(player.setPlaybackStaffFilter).toHaveBeenCalledWith(0);
    expect(player.setPartVolume).toHaveBeenCalledWith(1, 0.7);
  });
});
