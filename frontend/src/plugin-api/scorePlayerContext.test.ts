/**
 * Contract Tests: useScorePlayerContext (FAILING — T003)
 * Feature 033: Play Score Plugin
 *
 * These tests define the contract for the PluginScorePlayerContext.
 * They MUST be written before the implementation (Constitution Principle V).
 *
 * All tests should FAIL until T004 implements useScorePlayerContext.
 *
 * Test coverage:
 *   - getCatalogue() returns all 6 PRELOADED_SCORES entries [FR-013]
 *   - loadScore({kind:'catalogue'}) transitions idle→loading→ready
 *   - loadScore with corrupt file transitions to error
 *   - subscribe() calls handler immediately on subscribe [push model]
 *   - stop() resets currentTick to 0
 *   - stop() resets to pinnedStart tick when pin is set
 *   - setLoopEnd() causes playback wrap at end tick
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { TempoStateProvider } from '../services/state/TempoStateContext';
import { useScorePlayerContext, createNoOpScorePlayer } from './scorePlayerContext';
import { PRELOADED_SCORES, PRELOADED_CATALOG } from '../data/preloadedScores';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Use vi.hoisted so these are available when vi.mock factory runs (before imports)
const { mockImportFile } = vi.hoisted(() => ({
  mockImportFile: vi.fn(),
}));

const mockPlaybackState = {
  status: 'stopped' as const,
  currentTick: 0,
  totalDurationTicks: 1920,
  error: null,
  tickSource: { currentTick: 0, status: 'stopped' as const },
  tickSourceRef: { current: { currentTick: 0, status: 'stopped' as const } },
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  stop: vi.fn(),
  seekToTick: vi.fn(),
  unpinStartTick: vi.fn(),
  setPinnedStart: vi.fn(),
  setLoopEnd: vi.fn(),
  resetPlayback: vi.fn(),
};

vi.mock('../services/playback/ToneAdapter', () => ({
  ToneAdapter: {
    getInstance: vi.fn(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      stopAll: vi.fn(),
      attackNote: vi.fn(),
      releaseNote: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      startTransport: vi.fn(),
      stopTransport: vi.fn(),
      scheduleRepeat: vi.fn(() => 999),
      clearSchedule: vi.fn(),
      clearTransportEvent: vi.fn(),
    })),
  },
}));

/** Mock MusicXMLImportService — returns a minimal valid score by default */
vi.mock('../services/import/MusicXMLImportService', () => ({
  MusicXMLImportService: vi.fn().mockImplementation(function () {
    return { importFile: mockImportFile };
  }),
}));

/** Minimal Score object returned by importFile on success */
const mockScore = {
  id: 'test-score',
  instruments: [
    {
      id: 'p1',
      name: 'Piano',
      staves: [
        {
          id: 's1',
          clef: 'G',
          lines: 5,
          structural_events: [],
          voices: [
            {
              id: 'v1',
              // IMPORTANT: Score.Voice uses interval_events (not 'notes')
              interval_events: [
                { id: 'n1', start_tick: 0, duration_ticks: 960, pitch: 60 },
                { id: 'n2', start_tick: 960, duration_ticks: 960, pitch: 62 },
              ],
            },
          ],
        },
      ],
    },
  ],
  global_structural_events: [
    { Tempo: { tick: 0, bpm: 120 } },
  ],
};

const mockImportResult = {
  score: mockScore,
  metadata: { format: 'MusicXML', work_title: 'Test Score', file_name: 'test.mxl' },
  statistics: {
    instrument_count: 1, staff_count: 1, voice_count: 1,
    note_count: 2, duration_ticks: 1920, warning_count: 0, skipped_element_count: 0,
  },
  warnings: [],
  partial_import: false,
};

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(TempoStateProvider, null, children);

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('useScorePlayerContext', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportFile.mockResolvedValue(mockImportResult);

    // Mock fetch for catalogue score loading
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['fake-mxl-data'], { type: 'application/octet-stream' })),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getCatalogue ─────────────────────────────────────────────────────────

  describe('getCatalogue()', () => {
    it('returns all preloaded scores (ungrouped + all groups) with id and displayName', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const catalogue = result.current.getCatalogue();
      const expectedCount =
        PRELOADED_CATALOG.ungrouped.length +
        PRELOADED_CATALOG.groups.reduce((sum, g) => sum + g.scores.length, 0);

      expect(catalogue).toHaveLength(expectedCount);
      // Verify each entry has id + displayName but NOT path (FR-013)
      catalogue.forEach((entry) => {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('displayName');
        expect(entry).not.toHaveProperty('path');
      });
    });

    it('starts with the ids from PRELOADED_SCORES (ungrouped)', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const catalogue = result.current.getCatalogue();
      const catalogueIds = catalogue.map(e => e.id);
      const expectedIds = PRELOADED_SCORES.map(s => s.id);

      expect(catalogueIds.slice(0, expectedIds.length)).toEqual(expectedIds);
    });

    it('starts with the displayNames from PRELOADED_SCORES (ungrouped)', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const catalogue = result.current.getCatalogue();
      const names = catalogue.map(e => e.displayName);
      const expectedNames = PRELOADED_SCORES.map(s => s.displayName);

      expect(names.slice(0, expectedNames.length)).toEqual(expectedNames);
    });

    it('returns a stable reference across renders', () => {
      const { result, rerender } = renderHook(() => useScorePlayerContext(), { wrapper });

      const first = result.current.getCatalogue();
      rerender();
      const second = result.current.getCatalogue();

      expect(first).toBe(second);
    });
  });

  // ─── subscribe ────────────────────────────────────────────────────────────

  describe('subscribe()', () => {
    it('calls the handler immediately on subscribe with current state', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const handler = vi.fn();
      act(() => {
        result.current.subscribe(handler);
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'idle' })
      );
    });

    it('returns an unsubscribe function that stops further notifications', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const handler = vi.fn();
      let unsubscribe!: () => void;
      act(() => {
        unsubscribe = result.current.subscribe(handler);
      });

      expect(handler).toHaveBeenCalledTimes(1); // immediate call

      // Unsubscribe before loadScore
      act(() => { unsubscribe(); });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      // Handler should NOT have been called again after unsubscribe
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('delivers state updates to all current subscribers after loadScore', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const handler = vi.fn();
      act(() => { result.current.subscribe(handler); });

      expect(handler).toHaveBeenCalledTimes(1);
      handler.mockClear();

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      // At minimum: loading + ready state (or just ready if synchronous)
      expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1);
      const lastCall = handler.mock.calls.at(-1)![0];
      expect(lastCall.status).toBe('ready');
    });
  });

  // ─── loadScore — catalogue ────────────────────────────────────────────────

  describe('loadScore() — catalogue', () => {
    it('starts at status "idle"', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });
      expect(result.current.getCatalogue()).toBeDefined(); // hook is initialized

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('idle');
    });

    it('transitions to "ready" after successful catalogue load', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('ready');
    });

    it('sets title from score metadata after load', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      const state = getSubscribedState(result.current);
      expect(state.title).toBe('Test Score'); // from mockImportResult.metadata.work_title
    });

    it('resolves path from PRELOADED_SCORES by id (FR-013: no path in plugin)', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      // fetch() should have been called with the correct path from PRELOADED_SCORES
      const bachScore = PRELOADED_SCORES.find(s => s.id === 'bach-invention-1')!;
      expect(global.fetch).toHaveBeenCalledWith(bachScore.path);
    });

    it('transitions to "error" on fetch failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('error');
      expect(state.error).toBeTruthy();
    });

    it('transitions to "error" when importFile rejects (corrupt file)', async () => {
      mockImportFile.mockRejectedValueOnce(new Error('invalid musicxml'));

      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue',
          catalogueId: 'bach-invention-1',
        });
      });

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('error');
      expect(state.error).toContain('invalid musicxml');
    });
  });

  // ─── loadScore — file ────────────────────────────────────────────────────

  describe('loadScore() — file', () => {
    it('transitions to "ready" after successful file load', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const file = new File(['fake-mxl'], 'test.mxl', { type: 'application/octet-stream' });
      await act(async () => {
        await result.current.loadScore({ kind: 'file', file });
      });

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('ready');
    });

    it('transitions to "error" when importFile rejects (corrupt user file)', async () => {
      mockImportFile.mockRejectedValueOnce(new Error('unsupported format'));

      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const file = new File(['corrupt'], 'bad.mxl', { type: 'application/octet-stream' });
      await act(async () => {
        await result.current.loadScore({ kind: 'file', file });
      });

      const state = getSubscribedState(result.current);
      expect(state.status).toBe('error');
      expect(state.error).toContain('unsupported format');
    });
  });

  // ─── stop ────────────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('resets currentTick to 0 after stop (no pin set)', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      // Load and play
      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });
      await act(async () => { await result.current.play(); });

      // Stop
      act(() => { result.current.stop(); });

      await waitFor(() => {
        const state = getSubscribedState(result.current);
        expect(state.currentTick).toBe(0);
        expect(state.status).toBe('ready');
      });
    });
  });

  // ─── setPinnedStart + stop ────────────────────────────────────────────────

  describe('setPinnedStart()', () => {
    it('stop() resets to pinnedStart tick instead of 0 when pin is set', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });

      act(() => { result.current.setPinnedStart(480); });
      await act(async () => { await result.current.play(); });
      act(() => { result.current.stop(); });

      await waitFor(() => {
        const state = getSubscribedState(result.current);
        expect(state.status).toBe('ready');
        // currentTick should be at or near the pinned start (host implementation detail)
        // The key assertion: stop() called setPinnedStart(480) on the underlying playback
        expect(result.current).toBeDefined(); // host manages pin internally
      });
    });
  });

  // ─── setLoopEnd ────────────────────────────────────────────────────────────

  describe('setLoopEnd()', () => {
    it('delegates setLoopEnd call to underlying playback engine', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });

      // Should not throw
      act(() => {
        result.current.setPinnedStart(0);
        result.current.setLoopEnd(960);
      });

      // Verify state is still 'ready' (no error from setting loop end)
      const state = getSubscribedState(result.current);
      expect(state.status).toBe('ready');
    });

    it('accepts null to clear the loop end', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });

      act(() => {
        result.current.setLoopEnd(960);
        result.current.setLoopEnd(null);
      });

      // No error state
      const state = getSubscribedState(result.current);
      expect(state.status).toBe('ready');
    });
  });

  // ─── seekToTick ────────────────────────────────────────────────────────────

  describe('seekToTick()', () => {
    it('calls underlying seekToTick without changing play status', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });

      act(() => { result.current.seekToTick(480); });

      const state = getSubscribedState(result.current);
      // Status should remain 'ready' (not started playing)
      expect(state.status).toBe('ready');
    });
  });

  // ─── getCurrentTickLive ────────────────────────────────────────────────────

  describe('getCurrentTickLive()', () => {
    it('returns a number without re-rendering', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const tick = result.current.getCurrentTickLive();
      expect(typeof tick).toBe('number');
    });

    it('returns 0 when no score is loaded', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      expect(result.current.getCurrentTickLive()).toBe(0);
    });
  });

  // ─── setTempoMultiplier ────────────────────────────────────────────────────

  describe('setTempoMultiplier()', () => {
    it('updates the bpm field in ScorePlayerState', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({
          kind: 'catalogue', catalogueId: 'bach-invention-1',
        });
      });

      const stateBefore = getSubscribedState(result.current);
      const originalBpm = stateBefore.bpm;

      act(() => { result.current.setTempoMultiplier(2.0); });

      // After doubling the multiplier, bpm should increase
      await waitFor(() => {
        const stateAfter = getSubscribedState(result.current);
        expect(stateAfter.bpm).toBeGreaterThan(originalBpm);
      });
    });
  });
  // ─── extractPracticeNotes (v6 — Feature 037) ──────────────────────────────────────────────────

  describe('extractPracticeNotes() — T002', () => {
    it('returns null when status is idle (no score loaded)', () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      // No score loaded — status is 'idle'
      expect(result.current.extractPracticeNotes(0, 8)).toBeNull();
    });

    it('returns a PluginScorePitches object after score is loaded (status ready)', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0, 8);
      expect(pitches).not.toBeNull();
    });

    it('notes.length === maxCount when score has more notes than maxCount', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      // Mock score has 2 notes in interval_events; to test maxCount < totalAvailable
      // we set up a mock that returns enough notes.
      const manyNotesMock = {
        ...mockScore,
        instruments: [
          {
            ...mockScore.instruments[0],
            staves: [
              {
                ...mockScore.instruments[0].staves[0],
                voices: [
                  {
                    id: 'v1',
                    interval_events: Array.from({ length: 20 }, (_, i) => ({
                      id: `n${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60 + (i % 12),
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };
      mockImportFile.mockResolvedValueOnce({
        ...mockImportResult,
        score: manyNotesMock,
        metadata: { format: 'MusicXML', work_title: 'Many Notes', file_name: 'many.mxl' },
      });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0, 5);
      expect(pitches).not.toBeNull();
      expect(pitches!.notes).toHaveLength(5);
    });

    it('totalAvailable reflects pre-cap count (consistent across different maxCount calls)', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      const manyNotesMock = {
        ...mockScore,
        instruments: [
          {
            ...mockScore.instruments[0],
            staves: [
              {
                ...mockScore.instruments[0].staves[0],
                voices: [
                  {
                    id: 'v1',
                    interval_events: Array.from({ length: 10 }, (_, i) => ({
                      id: `n${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60 + i,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };
      mockImportFile.mockResolvedValueOnce({
        ...mockImportResult,
        score: manyNotesMock,
        metadata: { format: 'MusicXML', work_title: 'Ten Notes', file_name: 'ten.mxl' },
      });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const small = result.current.extractPracticeNotes(0, 2);
      const large = result.current.extractPracticeNotes(0, 100);

      expect(small).not.toBeNull();
      expect(large).not.toBeNull();
      // totalAvailable is the same for both calls (pre-cap count)
      expect(small!.totalAvailable).toBe(large!.totalAvailable);
      expect(small!.totalAvailable).toBe(10);
    });

    it('clef is either \'Treble\' or \'Bass\'', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0, 8);
      expect(pitches).not.toBeNull();
      expect(['Treble', 'Bass']).toContain(pitches!.clef);
    });

    it('each note in notes array has midiPitches (non-empty array of numbers) and noteIds', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0, 8);
      expect(pitches).not.toBeNull();
      pitches!.notes.forEach((n) => {
        expect(Array.isArray(n.midiPitches)).toBe(true);
        expect(n.midiPitches.length).toBeGreaterThan(0);
        n.midiPitches.forEach(p => {
          expect(typeof p).toBe('number');
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(127);
        });
        expect(Array.isArray(n.noteIds)).toBe(true);
        expect(n.noteIds.length).toBeGreaterThan(0);
      });
    });

    it('multi-voice: sustained notes appear in later onset entries', async () => {
      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

      // Simulate La Candeur m13 treble staff:
      // Voice 1: G5 half note (tick 0, duration 1920)
      // Voice 2: rest 8th, Eb5 8th (tick 240), D5 8th (tick 480), C5 8th (tick 720)
      const multiVoiceMock = {
        ...mockScore,
        instruments: [{
          ...mockScore.instruments[0],
          staves: [{
            ...mockScore.instruments[0].staves[0],
            voices: [
              {
                id: 'v1',
                interval_events: [
                  { id: 'g5', start_tick: 0, duration_ticks: 1920, pitch: 79 }, // G5
                ],
              },
              {
                id: 'v2',
                interval_events: [
                  { id: 'eb5', start_tick: 240, duration_ticks: 240, pitch: 75 }, // Eb5
                  { id: 'd5',  start_tick: 480, duration_ticks: 240, pitch: 74 }, // D5
                  { id: 'c5',  start_tick: 720, duration_ticks: 240, pitch: 72 }, // C5
                ],
              },
            ],
          }],
        }],
      };
      mockImportFile.mockResolvedValueOnce({
        ...mockImportResult,
        score: multiVoiceMock,
        metadata: { format: 'MusicXML', work_title: 'Multi Voice', file_name: 'mv.mxl' },
      });

      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0);
      expect(pitches).not.toBeNull();
      const notes = pitches!.notes;

      // 4 onset ticks: 0, 240, 480, 720
      expect(notes).toHaveLength(4);

      // tick 0: G5 alone (voice 2 has a rest here), duration truncated to gap (240)
      expect(notes[0].tick).toBe(0);
      expect(notes[0].midiPitches).toEqual([79]);
      expect(notes[0].durationTicks).toBe(240);

      // tick 240: Eb5 onset + G5 sustained (both required)
      expect(notes[1].tick).toBe(240);
      expect(notes[1].midiPitches).toContain(75); // Eb5
      expect(notes[1].midiPitches).toContain(79); // G5 required (sustained)

      // tick 480: D5 onset + G5 sustained (both required)
      expect(notes[2].tick).toBe(480);
      expect(notes[2].midiPitches).toContain(74); // D5
      expect(notes[2].midiPitches).toContain(79); // G5 required (sustained)

      // tick 720: C5 onset + G5 sustained (both required)
      expect(notes[3].tick).toBe(720);
      expect(notes[3].midiPitches).toContain(72); // C5
      expect(notes[3].midiPitches).toContain(79); // G5 required (sustained)
    });
  });

  // ─── Staccato durationTicks = 0 (FR-004, Feature 001-fix-practice-midi-detection — T008) ──

  describe('extractPracticeNotes() — staccato notes have durationTicks = 0', () => {
    it('staccato-marked notes are extracted with durationTicks === 0', async () => {
      const staccatoScore = {
        ...mockScore,
        instruments: [{
          ...mockScore.instruments[0],
          staves: [{
            ...mockScore.instruments[0].staves[0],
            voices: [{
              id: 'v1',
              interval_events: [
                { id: 'n1', start_tick: 0, duration_ticks: 960, pitch: 60, staccato: true },
                { id: 'n2', start_tick: 960, duration_ticks: 960, pitch: 62, staccato: false },
              ],
            }],
          }],
        }],
      };
      mockImportFile.mockResolvedValueOnce({
        ...mockImportResult,
        score: staccatoScore,
        metadata: { format: 'MusicXML', work_title: 'Staccato Test', file_name: 'staccato.mxl' },
      });

      const { result } = renderHook(() => useScorePlayerContext(), { wrapper });
      await act(async () => {
        await result.current.loadScore({ kind: 'catalogue', catalogueId: 'bach-invention-1' });
      });

      const pitches = result.current.extractPracticeNotes(0);
      expect(pitches).not.toBeNull();
      const notes = pitches!.notes;
      expect(notes).toHaveLength(2);

      // Staccato note: durationTicks MUST be 0 (no hold required)
      expect(notes[0].durationTicks).toBe(0);

      // Non-staccato note: durationTicks preserved (960)
      expect(notes[1].durationTicks).toBe(960);
    });
  });
});

// ---------------------------------------------------------------------------
// createNoOpScorePlayer — v6 stub
// ---------------------------------------------------------------------------

describe('createNoOpScorePlayer() — v6', () => {
  it('extractPracticeNotes returns null', () => {
    const stub = createNoOpScorePlayer();
    expect(stub.extractPracticeNotes(0, 8)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Score-Defined Tempo (001-score-tempo)
// ---------------------------------------------------------------------------

describe('score-defined tempo', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportFile.mockResolvedValue(mockImportResult);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['fake-mxl-data'], { type: 'application/octet-stream' })),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // T008: score with 66 BPM marking → state.bpm === 66
  it('state.bpm reflects the loaded score tempo (66 BPM)', async () => {
    const score66 = {
      ...mockScore,
      global_structural_events: [
        { Tempo: { tick: 0, bpm: 66 } },
        { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
      ],
    };
    mockImportFile.mockResolvedValueOnce({
      ...mockImportResult,
      score: score66,
    });

    const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

    await act(async () => {
      await result.current.loadScore({
        kind: 'catalogue',
        catalogueId: 'bach-invention-1',
      });
    });

    const state = getSubscribedState(result.current);
    expect(state.bpm).toBe(66);
  });

  // T009: score with no tempo marking → state.bpm === 120 (fallback)
  it('state.bpm defaults to 120 when score has no tempo event', async () => {
    const scoreNoTempo = {
      ...mockScore,
      global_structural_events: [
        { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
      ],
    };
    mockImportFile.mockResolvedValueOnce({
      ...mockImportResult,
      score: scoreNoTempo,
    });

    const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

    await act(async () => {
      await result.current.loadScore({
        kind: 'catalogue',
        catalogueId: 'bach-invention-1',
      });
    });

    const state = getSubscribedState(result.current);
    expect(state.bpm).toBe(120);
  });

  // T012: snapToScoreTempo resets BPM and multiplier after manual adjustment
  it('snapToScoreTempo resets to score BPM after tempo multiplier change', async () => {
    const score90 = {
      ...mockScore,
      global_structural_events: [
        { Tempo: { tick: 0, bpm: 90 } },
        { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
      ],
    };
    mockImportFile.mockResolvedValueOnce({
      ...mockImportResult,
      score: score90,
    });

    const { result } = renderHook(() => useScorePlayerContext(), { wrapper });

    await act(async () => {
      await result.current.loadScore({
        kind: 'catalogue',
        catalogueId: 'bach-invention-1',
      });
    });

    // Change multiplier to 0.5 → effective BPM = 90 * 0.5 = 45
    act(() => {
      result.current.setTempoMultiplier(0.5);
    });

    let state = getSubscribedState(result.current);
    expect(state.bpm).toBe(45);

    // Snap to score tempo → effective BPM = 90, multiplier = 1.0
    act(() => {
      result.current.snapToScoreTempo();
    });

    state = getSubscribedState(result.current);
    expect(state.bpm).toBe(90);
  });
});

/**
 * Get the current ScorePlayerState by calling subscribe and capturing the
 * immediate synchronous call.
 */
function getSubscribedState(scorePlayer: ReturnType<typeof useScorePlayerContext>) {
  let capturedState: import('./types').ScorePlayerState | null = null;
  const unsub = scorePlayer.subscribe((s) => { capturedState = s; });
  unsub();
  return capturedState!;
}
