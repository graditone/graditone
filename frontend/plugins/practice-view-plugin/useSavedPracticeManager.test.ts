/**
 * useSavedPracticeManager.test.ts — Feature 101 (T016)
 *
 * Save/load regression for the strict-tempo stop reason. The leaf storage
 * modules are mocked (they are re-exported verbatim by plugin-api/index, so
 * mocking the leaves intercepts the hook's calls).
 *
 * Flow coverage:
 * - A tempo-stop partial saves `completionStatus: 'partial'` with
 *   `performanceData.stopReason: 'tempo'`.
 * - A manual partial saves `stopReason: 'manual'`.
 * - Loading a saved tempo partial retains `stopReason: 'tempo'` in
 *   `pendingSavedPracticeRef.current.performanceData`.
 * - A legacy saved partial without a stop reason stays without one.
 * - A complete save adds no stop reason.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { useSavedPracticeManager } from './useSavedPracticeManager';
import type {
  SavedPractice,
  SavedPracticeIndexEntry,
  ScoreRef,
  FreeMidiRecord,
} from '../../src/plugin-api/index';
import type { PartialPerformanceRecord, PerformanceRecord } from './practiceEngine.types';

// ─── Leaf-module mocks (intercept plugin-api re-exports) ─────────────────────

const storageMocks = vi.hoisted(() => ({
  savePracticeToIndexedDB: vi.fn(async (practice: unknown) => practice),
  loadPracticeFromIndexedDB: vi.fn(async () => null),
  deletePracticeFromIndexedDB: vi.fn(async () => {}),
  generatePracticeName: vi.fn(() => 'Test Practice'),
  generateFreePracticeName: vi.fn(() => 'Free Practice'),
}));

const indexMocks = vi.hoisted(() => ({
  listSavedPractices: vi.fn(() => [] as SavedPracticeIndexEntry[]),
  addSavedPracticeIndex: vi.fn(() => ({ evictedIds: [] as string[] })),
  removeSavedPracticeIndex: vi.fn(),
}));

vi.mock('../../src/services/savedPracticeStorage', () => storageMocks);
vi.mock('../../src/services/savedPracticeIndex', () => indexMocks);

// ─── Fixture builders ────────────────────────────────────────────────────────

function makeMinimalContext() {
  return {
    getNavigationData: () => null,
    scorePlayer: {
      loadScore: vi.fn(),
      stop: vi.fn(),
      seekToTick: vi.fn(),
      stopPlayback: vi.fn(),
      playNote: vi.fn(),
    },
  } as unknown as Parameters<typeof useSavedPracticeManager>[0]['context'];
}

interface ManagerParams {
  context: ReturnType<typeof useSavedPracticeManager> extends (p: infer P) => unknown ? P : never;
}

function makeParams(overrides?: Partial<Record<string, unknown>>) {
  return {
    freeMidiRecord: null as FreeMidiRecord | null,
    loadedScoreRefRef: { current: { type: 'preloaded', id: 'minuet' } as ScoreRef | null } as React.MutableRefObject<ScoreRef | null>,
    loopRegion: null,
    selectedStaffIndex: 0,
    tempoMultiplier: 1.0,
    loopCount: 1,
    performanceRecord: null as PerformanceRecord | null,
    partialPerformanceRecord: null as PartialPerformanceRecord | null,
    scoreTitle: 'Minuet in G',
    t: (key: string) => key,
    setIsSaved: vi.fn(),
    setSaveError: vi.fn(),
    setSelectedStaffIndex: vi.fn(),
    onFreePracticeLoad: vi.fn(),
    context: makeMinimalContext(),
    ...overrides,
  } as unknown as Parameters<typeof useSavedPracticeManager>[0];
}

/** Minimal SavedPractice fixture with a variable stop reason. */
function makeSavedPractice(performanceDataOverrides: Record<string, unknown>, overrides?: Partial<SavedPractice>): SavedPractice {
  return {
    id: 'p1',
    name: 'Test Practice',
    savedAt: new Date().toISOString(),
    scoreRef: { type: 'preloaded', id: 'minuet' },
    scoreTitle: 'Minuet in G',
    staffIndex: 0,
    loopRegion: null,
    tempoMultiplier: 1.0,
    loopCount: 1,
    completionStatus: 'partial',
    performanceData: {
      notes: [],
      noteResults: [],
      wrongNoteEvents: [],
      bpmAtCompletion: 120,
      stoppedAtIndex: 2,
      totalNoteCount: 5,
      ...performanceDataOverrides,
    },
    ...overrides,
  } as unknown as SavedPractice;
}

/** Minimal tempo-stop partial record (as built by the strict-stop orchestrator). */
function makePartialRecord(stopReason?: 'tempo' | 'manual'): PartialPerformanceRecord {
  return {
    notes: [],
    noteResults: [
      {
        noteIndex: 0,
        outcome: 'correct-late',
        playedMidi: 60,
        expectedMidi: [60],
        responseTimeMs: 720,
        expectedTimeMs: 500,
        relativeDeltaMs: 220,
        wrongAttempts: 0,
        holdDurationMs: 0,
        requiredHoldMs: 0,
        beatDeltaMs: 220,
        strictFailure: true,
      },
    ],
    wrongNoteEvents: [],
    bpmAtCompletion: 120,
    tempoMultiplier: 1.0,
    stoppedAtIndex: 2,
    totalNoteCount: 5,
    ...(stopReason ? { stopReason } : {}),
  } as unknown as PartialPerformanceRecord;
}

const INDEX_ENTRY: SavedPracticeIndexEntry = {
  id: 'p1',
  name: 'Test Practice',
  savedAt: new Date().toISOString(),
  completionStatus: 'partial',
  scoreTitle: 'Minuet in G',
} as unknown as SavedPracticeIndexEntry;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSavedPracticeManager — strict tempo stop reason persistence (feature 101, T016)', () => {
  beforeEach(() => {
    storageMocks.savePracticeToIndexedDB.mockClear();
    storageMocks.loadPracticeFromIndexedDB.mockReset();
    storageMocks.loadPracticeFromIndexedDB.mockImplementation(async () => null);
    indexMocks.addSavedPracticeIndex.mockClear();
    indexMocks.removeSavedPracticeIndex.mockClear();
  });

  it('saving a tempo-stop partial persists completionStatus partial with stopReason tempo', async () => {
    const { result } = renderHook(() => useSavedPracticeManager(makeParams({
      partialPerformanceRecord: makePartialRecord('tempo'),
    })));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(storageMocks.savePracticeToIndexedDB).toHaveBeenCalledTimes(1);
    const saved = storageMocks.savePracticeToIndexedDB.mock.calls[0][0] as SavedPractice;
    expect(saved.completionStatus).toBe('partial');
    expect(saved.performanceData.stopReason).toBe('tempo');
  });

  it('saving a manual partial persists stopReason manual', async () => {
    const { result } = renderHook(() => useSavedPracticeManager(makeParams({
      partialPerformanceRecord: makePartialRecord(),
    })));

    await act(async () => {
      await result.current.handleSave();
    });

    const saved = storageMocks.savePracticeToIndexedDB.mock.calls[0][0] as SavedPractice;
    expect(saved.completionStatus).toBe('partial');
    expect(saved.performanceData.stopReason).toBe('manual');
  });

  it('loading a saved tempo partial retains stopReason tempo in pendingSavedPracticeRef', async () => {
    storageMocks.loadPracticeFromIndexedDB.mockImplementation(async () => makeSavedPractice({ stopReason: 'tempo' }));

    const { result } = renderHook(() => useSavedPracticeManager(makeParams()));

    await act(async () => {
      await result.current.handleSelectSavedPractice(INDEX_ENTRY);
    });

    const pending = result.current.pendingSavedPracticeRef.current;
    expect(pending).not.toBeNull();
    expect(pending!.completionStatus).toBe('partial');
    expect(pending!.performanceData.stopReason).toBe('tempo');
  });

  it('loading a legacy saved partial without a stop reason keeps it undefined', async () => {
    storageMocks.loadPracticeFromIndexedDB.mockImplementation(async () => makeSavedPractice({}));

    const { result } = renderHook(() => useSavedPracticeManager(makeParams()));

    await act(async () => {
      await result.current.handleSelectSavedPractice(INDEX_ENTRY);
    });

    const pending = result.current.pendingSavedPracticeRef.current;
    expect(pending).not.toBeNull();
    expect(pending!.performanceData.stopReason).toBeUndefined();
  });

  it('saving a complete practice adds no stop reason', async () => {
    const performanceRecord: PerformanceRecord = {
      notes: [],
      noteResults: [],
      wrongNoteEvents: [],
      bpmAtCompletion: 120,
      tempoMultiplier: 1.0,
    };
    const { result } = renderHook(() => useSavedPracticeManager(makeParams({ performanceRecord })));

    await act(async () => {
      await result.current.handleSave();
    });

    const saved = storageMocks.savePracticeToIndexedDB.mock.calls[0][0] as SavedPractice;
    expect(saved.completionStatus).toBe('complete');
    expect(saved.performanceData.stopReason).toBeUndefined();
  });
});
