/**
 * useSavedPracticeManager.ts
 * Features 056, 060, 061: Saved Practice CRUD, navigation loading, and task config.
 *
 * Domain hook that owns:
 *   - savedPractices index + protected practice IDs (Feature 060)
 *   - pendingSavedPracticeRef for restoring results after score load (Feature 056)
 *   - taskIdRef, sessionIdRef, taskTag (Feature 061)
 *   - pendingTaskLoopRegion, autoStartPracticeRef, taskStaffIndexRef, pendingTaskConfigRef (Feature 061)
 *   - Navigation data mount effect (loads saved/task practices from nav data)
 *   - handleSave, handleDeleteSavedPractice, handleSelectSavedPractice
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import type { PluginContext } from '../../src/plugin-api/index';
import type { ScoreRef, SavedPractice, SavedPerformanceData, SavedPracticeIndexEntry, FreeMidiRecord } from '../../src/plugin-api/index';
import {
  savePracticeToIndexedDB,
  generatePracticeName,
  generateFreePracticeName,
  loadPracticeFromIndexedDB,
  deletePracticeFromIndexedDB,
} from '../../src/plugin-api/index';
import { addSavedPracticeIndex, listSavedPractices, removeSavedPracticeIndex } from '../../src/plugin-api/index';
import { broadcastPracticeSaved, computePracticeScore } from '../../src/plugin-api/index';
import type { PerformanceRecord, PartialPerformanceRecord } from './practiceEngine.types';

// ---------------------------------------------------------------------------
// Sessions plugin — optional dynamic import for protected practice IDs
// ---------------------------------------------------------------------------

const _sessPath = '../sessions-plugin/sessionStorage';

export type ProtectedPracticeInfo = { sessionName: string; sessionId: string; taskId?: string };

async function loadProtectedPracticeIds(): Promise<ReadonlySet<string>> {
  try {
    const mod = await import(/* @vite-ignore */ _sessPath);
    return mod.computeProtectedPracticeIds();
  } catch { return new Set<string>(); }
}

async function loadProtectedPracticeMap(): Promise<ReadonlyMap<string, ProtectedPracticeInfo>> {
  try {
    const mod = await import(/* @vite-ignore */ _sessPath);
    return mod.computeProtectedPracticeMap();
  } catch { return new Map<string, ProtectedPracticeInfo>(); }
}

// ---------------------------------------------------------------------------
// Task config shape (Feature 061)
// ---------------------------------------------------------------------------

type TaskConfig = {
  staffIndex: number;
  loopCount: number;
  tempoMultiplier: number;
  regionType: string;
  startMeasure: number | null;
  endMeasure: number | null;
};

// ---------------------------------------------------------------------------
// Params / Return types
// ---------------------------------------------------------------------------

export type UseSavedPracticeManagerParams = {
  context: PluginContext;
  freeMidiRecord: FreeMidiRecord | null;
  loadedScoreRefRef: React.MutableRefObject<ScoreRef | null>;
  loopRegion: { startTick: number; endTick: number } | null;
  selectedStaffIndex: number;
  tempoMultiplier: number;
  loopCount: number;
  performanceRecord: PerformanceRecord | null;
  partialPerformanceRecord: PartialPerformanceRecord | null;
  /** playerState.title — used to name the saved practice. */
  scoreTitle: string | null;
  t: (key: string) => string;
  // Setters
  setIsSaved: (v: boolean) => void;
  setSaveError: (e: string | null) => void;
  setSelectedStaffIndex: (i: number) => void;
  /**
   * Called when a saved free practice is selected or navigated to.
   * The orchestrator uses this to enter free-practice mode and update
   * isSaved / saveError / resultsOverlayVisible appropriately.
   */
  onFreePracticeLoad: (record: FreeMidiRecord | null, noteCount: number) => void;
};

export type UseSavedPracticeManagerReturn = {
  savedPractices: SavedPracticeIndexEntry[];
  protectedPracticeIds: ReadonlySet<string>;
  protectedPracticeMap: ReadonlyMap<string, ProtectedPracticeInfo>;
  pendingSavedPracticeRef: React.MutableRefObject<SavedPractice | null>;
  taskIdRef: React.MutableRefObject<string | null>;
  sessionIdRef: React.MutableRefObject<string | null>;
  taskTag: { taskNumber: number; sessionName: string; difficulty?: 1 | 2 | 3 } | null;
  pendingTaskLoopRegion: { startTick: number; endTick: number } | null;
  setPendingTaskLoopRegion: React.Dispatch<React.SetStateAction<{ startTick: number; endTick: number } | null>>;
  autoStartPracticeRef: React.MutableRefObject<boolean>;
  taskStaffIndexRef: React.MutableRefObject<number | null>;
  pendingTaskConfigRef: React.MutableRefObject<TaskConfig | null>;
  handleSave: () => Promise<void>;
  handleDeleteSavedPractice: (id: string) => Promise<void>;
  handleSelectSavedPractice: (entry: SavedPracticeIndexEntry) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSavedPracticeManager({
  context,
  freeMidiRecord,
  loadedScoreRefRef,
  loopRegion,
  selectedStaffIndex,
  tempoMultiplier,
  loopCount,
  performanceRecord,
  partialPerformanceRecord,
  scoreTitle,
  t,
  setIsSaved,
  setSaveError,
  setSelectedStaffIndex,
  onFreePracticeLoad,
}: UseSavedPracticeManagerParams): UseSavedPracticeManagerReturn {

  // ── Saved practices index ─────────────────────────────────────────────────
  const [savedPractices, setSavedPractices] = useState<SavedPracticeIndexEntry[]>(() => listSavedPractices());

  // ── Feature 060: Protected practice IDs ──────────────────────────────────
  const [protectedPracticeIds, setProtectedPracticeIds] = useState<ReadonlySet<string>>(new Set());
  const [protectedPracticeMap, setProtectedPracticeMap] = useState<ReadonlyMap<string, ProtectedPracticeInfo>>(new Map());
  useEffect(() => {
    loadProtectedPracticeIds().then(setProtectedPracticeIds).catch(() => {});
    loadProtectedPracticeMap().then(setProtectedPracticeMap).catch(() => {});
  }, [savedPractices]);

  // ── Feature 056: Pending saved practice ref ───────────────────────────────
  const pendingSavedPracticeRef = useRef<SavedPractice | null>(null);

  // ── Feature 061: Task and session refs ───────────────────────────────────
  const taskIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [taskTag, setTaskTag] = useState<{ taskNumber: number; sessionName: string; difficulty?: 1 | 2 | 3 } | null>(null);

  // ── Feature 061: Task config state ───────────────────────────────────────
  const [pendingTaskLoopRegion, setPendingTaskLoopRegion] = useState<{ startTick: number; endTick: number } | null>(null);
  const autoStartPracticeRef = useRef(false);
  const taskStaffIndexRef = useRef<number | null>(null);
  const pendingTaskConfigRef = useRef<TaskConfig | null>(null);

  // ── Feature 060/061: Navigation data mount effect ─────────────────────────
  // Runs once on mount — navData is one-shot (cleared after read).
  useEffect(() => {
    const navData = context.getNavigationData();
    if (navData && typeof navData.savedPracticeId === 'string') {
      const id = navData.savedPracticeId;
      if (typeof navData.sessionId === 'string') {
        sessionIdRef.current = navData.sessionId as string;
      }
      if (typeof navData.taskId === 'string' && typeof navData.taskNumber === 'number') {
        taskIdRef.current = navData.taskId as string;
        setTaskTag({ taskNumber: navData.taskNumber as number, sessionName: '' });
      }
      loadPracticeFromIndexedDB(id).then((saved) => {
        if (!saved) return;
        loadedScoreRefRef.current = saved.scoreRef;
        if (saved.scoreRef.type === 'free') {
          onFreePracticeLoad(saved.freeMidiRecord ?? null, saved.freeMidiRecord?.noteCount ?? 0);
          setIsSaved(true);
          setSaveError(null);
          return;
        }
        pendingSavedPracticeRef.current = saved;
        if (saved.scoreRef.type === 'preloaded') {
          context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: saved.scoreRef.id });
        } else {
          context.scorePlayer.loadScore({ kind: 'userScore', scoreId: saved.scoreRef.id });
        }
      }).catch((err) => console.error('[useSavedPracticeManager] nav data load failed:', err));
    } else if (navData && navData.taskConfig && typeof navData.taskConfig === 'object') {
      const tc = navData.taskConfig as Record<string, unknown>;
      const scoreRef = tc.scoreRef as { type: string; id: string } | undefined;
      if (scoreRef && scoreRef.id) {
        taskIdRef.current = (tc.taskId as string) ?? null;
        sessionIdRef.current = (tc.sessionId as string) ?? null;
        if (typeof tc.taskNumber === 'number' && typeof tc.sessionName === 'string') {
          setTaskTag({ taskNumber: tc.taskNumber as number, sessionName: tc.sessionName as string, difficulty: tc.difficulty as (1 | 2 | 3 | undefined) });
        }
        loadedScoreRefRef.current = scoreRef as ScoreRef;
        const staffIndex = (tc.staffIndex as number) ?? 0;
        pendingTaskConfigRef.current = {
          staffIndex,
          loopCount: (tc.loopCount as number) ?? 1,
          tempoMultiplier: (tc.tempoMultiplier as number) ?? 1.0,
          regionType: (tc.regionType as string) ?? 'all',
          startMeasure: (tc.startMeasure as number) ?? null,
          endMeasure: (tc.endMeasure as number) ?? null,
        };
        taskStaffIndexRef.current = staffIndex;
        setSelectedStaffIndex(staffIndex);
        if (scoreRef.type === 'preloaded') {
          context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: scoreRef.id });
        } else {
          context.scorePlayer.loadScore({ kind: 'userScore', scoreId: scoreRef.id });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── handleSave ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const scoreRef = loadedScoreRefRef.current;
    if (!scoreRef) return;

    // Feature 092: Free practice save path
    if (scoreRef.type === 'free') {
      if (!freeMidiRecord) return;
      const now = new Date();
      const id = crypto.randomUUID();
      const practice: SavedPractice = {
        id,
        name: generateFreePracticeName(now),
        savedAt: now.toISOString(),
        scoreRef: { type: 'free', id: '' },
        scoreTitle: t('practice.free.title'),
        staffIndex: 0,
        loopRegion: null,
        tempoMultiplier: 1.0,
        loopCount: 1,
        completionStatus: 'complete',
        performanceData: {
          notes: [],
          noteResults: [],
          wrongNoteEvents: [],
          bpmAtCompletion: freeMidiRecord.bpm,
          stoppedAtIndex: null,
          totalNoteCount: null,
        },
        freeMidiRecord,
      };
      try {
        await savePracticeToIndexedDB(practice);
        const { evictedIds } = addSavedPracticeIndex({
          id,
          name: practice.name,
          savedAt: practice.savedAt,
          completionStatus: 'complete',
          scoreTitle: practice.scoreTitle,
        });
        for (const evictedId of evictedIds) {
          await deletePracticeFromIndexedDB(evictedId);
        }
        setIsSaved(true);
        setSaveError(null);
        setSavedPractices(listSavedPractices());
        broadcastPracticeSaved({
          savedPracticeId: id,
          practiceName: practice.name,
          scoreTitle: practice.scoreTitle,
          completionStatus: 'complete',
          savedAt: practice.savedAt,
          practiceScore: 0,
          correctCount: 0,
          totalNotes: freeMidiRecord.noteCount,
          practiceTimeMs: freeMidiRecord.elapsedMs,
        });
      } catch (e) {
        console.error('[useSavedPracticeManager] Failed to save free practice:', e);
        const isQuota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
        setSaveError(isQuota ? t('practice.plugin.storage_full') : t('practice.plugin.save_failed'));
      }
      return;
    }

    // Score practice save path
    const isComplete = !!performanceRecord;
    const isPartial = !!partialPerformanceRecord;
    if (!isComplete && !isPartial) return;

    const now = new Date();
    const id = crypto.randomUUID();
    const title = scoreTitle ?? t('practice.plugin.untitled');
    const lr = loopRegion
      ? { startTick: loopRegion.startTick, endTick: loopRegion.endTick }
      : null;

    const performanceData: SavedPerformanceData = isComplete
      ? {
          notes: [...performanceRecord!.notes],
          noteResults: [...performanceRecord!.noteResults],
          wrongNoteEvents: [...performanceRecord!.wrongNoteEvents],
          bpmAtCompletion: performanceRecord!.bpmAtCompletion,
          stoppedAtIndex: null,
          totalNoteCount: null,
        }
      : {
          notes: [...partialPerformanceRecord!.notes],
          noteResults: [...partialPerformanceRecord!.noteResults],
          wrongNoteEvents: [...partialPerformanceRecord!.wrongNoteEvents],
          bpmAtCompletion: partialPerformanceRecord!.bpmAtCompletion,
          stoppedAtIndex: partialPerformanceRecord!.stoppedAtIndex,
          totalNoteCount: partialPerformanceRecord!.totalNoteCount,
        };

    const practice: SavedPractice = {
      id,
      name: generatePracticeName(title, selectedStaffIndex, lr, now),
      savedAt: now.toISOString(),
      scoreRef,
      scoreTitle: title,
      staffIndex: selectedStaffIndex,
      loopRegion: lr,
      tempoMultiplier,
      loopCount,
      completionStatus: isComplete ? 'complete' : 'partial',
      performanceData,
    };

    try {
      await savePracticeToIndexedDB(practice);
      const { evictedIds } = addSavedPracticeIndex({
        id,
        name: practice.name,
        savedAt: practice.savedAt,
        completionStatus: practice.completionStatus,
        scoreTitle: title,
      });
      for (const evictedId of evictedIds) {
        await deletePracticeFromIndexedDB(evictedId);
      }
      setIsSaved(true);
      setSaveError(null);
      setSavedPractices(listSavedPractices());
      const breakdown = computePracticeScore(performanceData.noteResults, tempoMultiplier);
      const lastNr = performanceData.noteResults[performanceData.noteResults.length - 1];
      broadcastPracticeSaved({
        savedPracticeId: id,
        practiceName: practice.name,
        scoreTitle: title,
        completionStatus: practice.completionStatus,
        savedAt: practice.savedAt,
        practiceScore: breakdown?.score ?? 0,
        correctCount: breakdown?.correctCount ?? 0,
        totalNotes: breakdown?.totalNotes ?? 0,
        practiceTimeMs: lastNr?.responseTimeMs ?? 0,
        ...(taskIdRef.current ? { taskId: taskIdRef.current } : {}),
        ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
      });
    } catch (e) {
      console.error('[useSavedPracticeManager] Failed to save practice:', e);
      const isQuota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      setSaveError(isQuota ? t('practice.plugin.storage_full') : t('practice.plugin.save_failed'));
    }
  }, [
    freeMidiRecord,
    performanceRecord,
    partialPerformanceRecord,
    scoreTitle,
    loopRegion,
    selectedStaffIndex,
    tempoMultiplier,
    loopCount,
    t,
    setIsSaved,
    setSaveError,
    loadedScoreRefRef,
  ]);

  // ── handleDeleteSavedPractice ─────────────────────────────────────────────
  const handleDeleteSavedPractice = useCallback(async (practiceId: string) => {
    removeSavedPracticeIndex(practiceId);
    await deletePracticeFromIndexedDB(practiceId);
    setSavedPractices(listSavedPractices());
  }, []);

  // ── handleSelectSavedPractice ─────────────────────────────────────────────
  const handleSelectSavedPractice = useCallback(async (entry: SavedPracticeIndexEntry) => {
    const saved = await loadPracticeFromIndexedDB(entry.id);
    if (!saved) {
      console.warn('[useSavedPracticeManager] Saved practice not found in IndexedDB:', entry.id);
      return;
    }

    // Feature 092: Restore a saved free practice — no score loading needed
    if (saved.scoreRef.type === 'free') {
      loadedScoreRefRef.current = saved.scoreRef;
      onFreePracticeLoad(saved.freeMidiRecord ?? null, saved.freeMidiRecord?.noteCount ?? 0);
      setIsSaved(true);
      setSaveError(null);
      return;
    }

    loadedScoreRefRef.current = saved.scoreRef;
    pendingSavedPracticeRef.current = saved;

    if (saved.scoreRef.type === 'preloaded') {
      context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: saved.scoreRef.id });
    } else {
      context.scorePlayer.loadScore({ kind: 'userScore', scoreId: saved.scoreRef.id });
    }
  }, [context.scorePlayer, onFreePracticeLoad, setIsSaved, setSaveError, loadedScoreRefRef, pendingSavedPracticeRef]);

  return {
    savedPractices,
    protectedPracticeIds,
    protectedPracticeMap,
    pendingSavedPracticeRef,
    taskIdRef,
    sessionIdRef,
    taskTag,
    pendingTaskLoopRegion,
    setPendingTaskLoopRegion,
    autoStartPracticeRef,
    taskStaffIndexRef,
    pendingTaskConfigRef,
    handleSave,
    handleDeleteSavedPractice,
    handleSelectSavedPractice,
  };
}
