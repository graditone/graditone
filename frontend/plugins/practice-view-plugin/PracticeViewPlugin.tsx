/**
 * Practice View Plugin — Orchestrator
 * Feature 037: Practice View Plugin
 *
 * Thin orchestrator that wires together extracted hooks and components:
 *   - useHoldProgress    — rAF hold-timer loop (feature 042)
 *   - usePracticeLoop    — Loop pin state, loop region, multi-loop counters
 *   - usePhantomTempo    — Phantom tempo cursor advancing at configured BPM
 *   - usePracticeMidi    — Chord detection, MIDI subscription, held-key tracking
 *   - usePracticeHighlights — Target/confirmed/pressed note-ID computation
 *   - ResultsOverlay     — Complete/partial results display, replay controls
 *
 * Subscribes to scorePlayer state, renders ScoreSelector when idle,
 * and ScoreRenderer + PracticeToolbar when a score is loaded.
 *
 * Constitution compliance:
 *   Principle VI: no coordinate arithmetic — only integer tick, MIDI (0-127),
 *                 and opaque noteId strings from the Plugin API.
 *   SC-006: context.stopPlayback() and MIDI unsubscribe called on unmount.
 */

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type {
  PluginContext,
  ScorePlayerState,
  PluginPlaybackStatus,
  MetronomeState,
  MetronomeSubdivision,
  PluginNoteEvent,
} from '../../src/plugin-api/index';
import type { PluginPracticeNoteEntry } from '../../src/plugin-api/types';
import { PracticeToolbar } from './practiceToolbar';
import { reduce } from './practiceEngine';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PerformanceRecord, PartialPerformanceRecord } from './practiceEngine.types';
import { mergePracticeNotesByTick } from './mergePracticeNotesByTick';
import { usePracticeLoop } from './usePracticeLoop';
import { usePracticeMidi } from './usePracticeMidi';
import { usePracticeHighlights } from './usePracticeHighlights';
import { usePhantomTempo } from './usePhantomTempo';
import { useHoldProgress } from './useHoldProgress';
import { useAccompaniment } from './useAccompaniment';
import { useMidiConnectivity } from './useMidiConnectivity';
import { measureRangeToTicks } from './measureRangeToTicks';
import { ResultsOverlay } from './ResultsOverlay';
import type { ScoreRef, SavedPractice, SavedPerformanceData, SavedPracticeIndexEntry } from '../../src/plugin-api/index';
import type { FreeMidiEvent, FreeMidiRecord } from '../../src/plugin-api/index';
import { savePracticeToIndexedDB, generatePracticeName, generateFreePracticeName, loadPracticeFromIndexedDB, deletePracticeFromIndexedDB } from '../../src/plugin-api/index';
import { addSavedPracticeIndex, listSavedPractices, removeSavedPracticeIndex } from '../../src/plugin-api/index';
import { broadcastPracticeSaved, computePracticeScore } from '../../src/plugin-api/index';
import './PracticeViewPlugin.css';
import { useTranslation } from '../../src/i18n';

// Sessions plugin is optional — dynamically import so practice-view still
// works when the sessions plugin is not installed.
// The path is stored in a variable so Vite's import-analysis plugin cannot
// statically resolve it — this prevents a build error when the symlink is
// absent (e.g. in CI where plugins-external/ is not checked out).
const _sessPath = '../sessions-plugin/sessionStorage';
async function loadProtectedPracticeIds(): Promise<ReadonlySet<string>> {
  try {
    const mod = await import(/* @vite-ignore */ _sessPath);
    return mod.computeProtectedPracticeIds();
  } catch { return new Set<string>(); }
}
type ProtectedPracticeInfo = { sessionName: string; sessionId: string; taskId?: string };
async function loadProtectedPracticeMap(): Promise<ReadonlyMap<string, ProtectedPracticeInfo>> {
  try {
    const mod = await import(/* @vite-ignore */ _sessPath);
    return mod.computeProtectedPracticeMap();
  } catch { return new Map<string, ProtectedPracticeInfo>(); }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Feature 092: Measure-by-measure MIDI recording helpers
// ---------------------------------------------------------------------------

/** One note captured into the current-measure buffer during free practice. */
interface MeasureNoteEntry {
  midiNote: number;
  /** Wall-clock ms when the key was pressed. */
  attackMs: number;
  /** Wall-clock duration ms — null while the key is still held. */
  durationMs: number | null;
}

/** 4/4 in 960-PPQ: 16 sixteenth-note steps per measure. */
const FREE_STEPS_PER_MEASURE = 16;

/**
 * Quantize and cap a measure buffer into PluginNoteEvents with timestamps
 * aligned to the 16th-note grid.  `measureEndMs` is used to clamp durations
 * of notes still held at the measure boundary.
 */
function finalizeMeasureNotes(
  buffer: MeasureNoteEntry[],
  measureStartMs: number,
  bpm: number,
  measureEndMs: number,
): PluginNoteEvent[] {
  const msPerBeat = 60_000 / bpm;
  const msPerSixteenth = msPerBeat / 4;

  return buffer.map(({ midiNote, attackMs, durationMs }) => {
    const relMs = Math.max(0, attackMs - measureStartMs);
    const startStep = Math.max(
      0,
      Math.min(FREE_STEPS_PER_MEASURE - 1, Math.round(relMs / msPerSixteenth)),
    );
    const quantizedAttackMs = measureStartMs + startStep * msPerSixteenth;

    const rawDuration = durationMs ?? measureEndMs - attackMs;
    const durSteps = Math.max(1, Math.round(rawDuration / msPerSixteenth));
    const clampedDurSteps = Math.min(durSteps, FREE_STEPS_PER_MEASURE - startStep);
    const quantizedDurationMs = clampedDurSteps * msPerSixteenth;

    return {
      midiNote,
      timestamp: quantizedAttackMs,
      type: 'attack' as const,
      durationMs: quantizedDurationMs,
    };
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_METRONOME_STATE: MetronomeState = {
  active: false,
  beatIndex: -1,
  isDownbeat: false,
  subdivision: 1,
  bpm: 0,
  subBeatIndex: 0,
};

const INITIAL_PLAYER_STATE: ScorePlayerState = {
  status: 'idle' as PluginPlaybackStatus,
  currentTick: 0,
  totalDurationTicks: 0,
  highlightedNoteIds: new Set<string>(),
  bpm: 120,
  title: null,
  error: null,
  staffCount: 0,
  timeSignature: { numerator: 4, denominator: 4 },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PracticeViewPluginProps {
  context: PluginContext;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PracticeViewPlugin({ context }: PracticeViewPluginProps) {
  const { t } = useTranslation();
  // ─── scorePlayer state ─────────────────────────────────────────────────────
  const [playerState, setPlayerState] = useState<ScorePlayerState>(INITIAL_PLAYER_STATE);

  useEffect(() => {
    return context.scorePlayer.subscribe((state) => {
      setPlayerState(state);
    });
  }, [context.scorePlayer]);

  // ─── Practice engine state ──────────────────────────────────────────────────
  const [practiceState, dispatchPractice] = useReducer(reduce, INITIAL_PRACTICE_STATE);

  // ─── Hold-progress indicator (extracted hook, feature 042) ─────────────────
  const { holdProgress } = useHoldProgress({ practiceState, dispatchPractice });

  // ─── Tempo multiplier ──────────────────────────────────────────────────────
  const [tempoMultiplier, setTempoMultiplier] = useState(1.0);
  const tempoMultiplierRef = useRef(tempoMultiplier);
  tempoMultiplierRef.current = tempoMultiplier;

  // ─── Accompaniment (Feature 089) ───────────────────────────────────────────
  const { playAccompanimentAtTick } =
    useAccompaniment(context.scorePlayer);

  // ─── Metronome state ───────────────────────────────────────────────────────
  const [metronomeState, setMetronomeState] = useState<MetronomeState>(INITIAL_METRONOME_STATE);
  const metronomeStateRef = useRef<MetronomeState>(INITIAL_METRONOME_STATE);
  const [metronomeSubdivision, setMetronomeSubdivision] = useState<MetronomeSubdivision>(1);
  // Feature 083 (US3): armed = toggled while practice is in 'waiting' mode;
  // the metronome will start on the first MIDI note attack instead of immediately.
  const [metronomeArmed, setMetronomeArmed] = useState(false);
  const metronomeArmedRef = useRef(false);

  useEffect(() => {
    return context.metronome.subscribe((state) => {
      metronomeStateRef.current = state;
      setMetronomeState(state);
      if (state.subdivision !== undefined) setMetronomeSubdivision(state.subdivision);
    });
  }, [context.metronome]);

  // ─── MIDI connectivity tracking ────────────────────────────────────────────
  // Extracted to useMidiConnectivity hook (feature 081) — fixes three bugs:
  // 1. No timeout → requestMIDIAccess could wait forever on tablet
  // 2. Silent catch → permission denial left state null
  // 3. API absent → no setMidiConnected(false) call
  const { connected: midiConnected, supported: midiSupported } = useMidiConnectivity();

  // ─── Two-tap seek-then-play state machine (mirrors play-score) ──────────────
  // First tap while not playing: seek + arm pendingPlay.
  // Second tap while paused:     seek to new position + play().
  const [pendingPlay, setPendingPlay] = useState(false);

  // ─── Results overlay ─────────────────────────────────────────────────────────
  // Shown when practice completes; dismissed only via the × button.
  const [resultsOverlayVisible, setResultsOverlayVisible] = useState(false);

  // ─── Auto-advance error flash ─────────────────────────────────────────────
  // When the engine auto-advances after MAX_CONSECUTIVE_WRONG wrong presses,
  // briefly highlight the failed beat in red so the player sees which note
  // was skipped before the target jumps to the next beat.
  const [errorNoteIds, setErrorNoteIds] = useState<ReadonlySet<string>>(new Set());
  const errorFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Replay state (038-practice-replay) ────────────────────────────────────
  const [performanceRecord, setPerformanceRecord] = useState<PerformanceRecord | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayHighlightedNoteIds, setReplayHighlightedNoteIds] = useState<ReadonlySet<string>>(new Set());
  const wasReplayingRef = useRef(false);

  // Restore results overlay when replay finishes (natural end or stop)
  useEffect(() => {
    if (wasReplayingRef.current && !isReplaying) {
      setResultsOverlayVisible(true);
    }
    wasReplayingRef.current = isReplaying;
  }, [isReplaying]);

  // ─── Partial results on Stop (US7, 053-fix-lacandeur-practice) ─────────────
  const [partialPerformanceRecord, setPartialPerformanceRecord] = useState<PartialPerformanceRecord | null>(null);

  // ─── Feature 056: Saved practice state ─────────────────────────────────────
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedScoreRefRef = useRef<ScoreRef | null>(null);
  // Feature 061: Track taskId and sessionId when launched from a session task
  const taskIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Feature 061: Task tag info for toolbar display
  const [taskTag, setTaskTag] = useState<{ taskNumber: number; sessionName: string; difficulty?: 1 | 2 | 3 } | null>(null);
  // Feature 061: Pending task config to apply once score is loaded
  const pendingTaskConfigRef = useRef<{
    staffIndex: number;
    loopCount: number;
    tempoMultiplier: number;
    regionType: string;
    startMeasure: number | null;
    endMeasure: number | null;
  } | null>(null);
  // Feature 061: Persists the task-driven staffIndex through subsequent loading
  // cycles (e.g. setTempoMultiplier causing a reload) so the reset-to-0 effect
  // cannot clobber it after it was applied.
  const taskStaffIndexRef = useRef<number | null>(null);
  // Feature 061: Auto-start practice after task config + loop region are applied
  const autoStartPracticeRef = useRef(false);
  const [savedPractices, setSavedPractices] = useState<SavedPracticeIndexEntry[]>(() => listSavedPractices());
  // Feature 060: Protected practice IDs (linked to sessions, cannot be deleted)
  const [protectedPracticeIds, setProtectedPracticeIds] = useState<ReadonlySet<string>>(new Set());
  const [protectedPracticeMap, setProtectedPracticeMap] = useState<ReadonlyMap<string, ProtectedPracticeInfo>>(new Map());
  useEffect(() => {
    loadProtectedPracticeIds().then(setProtectedPracticeIds).catch(() => {});
    loadProtectedPracticeMap().then(setProtectedPracticeMap).catch(() => {});
  }, [savedPractices]);
  // Pending saved practice to restore once the score finishes loading
  const pendingSavedPracticeRef = useRef<SavedPractice | null>(null);

  // ─── Feature 092: Free Practice state ──────────────────────────────────────
  /** True while a free (score-less) practice session is active or in results. */
  const [isFreePractice, setIsFreePractice] = useState(false);
  /** Live note-attack counter shown in the toolbar during free practice. */
  const [freeNoteCount, setFreeNoteCount] = useState(0);
  /** Finalized record set when Stop is pressed — drives ResultsOverlay. */
  const [freeMidiRecord, setFreeMidiRecord] = useState<FreeMidiRecord | null>(null);
  /** All MIDI attack events captured since the free session started. */
  const freeMidiEventsRef = useRef<FreeMidiEvent[]>([]);
  /** Wall-clock start time (ms) of the current free session. */
  const freeStartMsRef = useRef(0);
  /** Current elapsed ms for toolbar display (updates every 1s during free session). */
  const [freeElapsedMs, setFreeElapsedMs] = useState(0);
  /** Interval ID for elapsed-time tracking (wall-clock 1s tick). */
  const freeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** PluginNoteEvents shown in the StaffViewer — accumulates during live recording and replay. */
  const [freeDisplayNotes, setFreeDisplayNotes] = useState<PluginNoteEvent[]>([]);
  /** Timestamp origin for StaffViewer (session start or replay start) — used as timestampOffset. */
  const [freeDisplayOriginMs, setFreeDisplayOriginMs] = useState(0);
  /** setTimeout handles for free-replay note scheduling — cleared when replay stops. */
  const freeReplayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * BPM used for StaffViewer layout during free practice.
   * Captured from the actual metronome BPM at session start so notes land
   * on the correct measures regardless of what the metronome default is.
   * Defaults to 120 to match MetronomeContext's DEFAULT_BPM (the fallback
   * when no score is loaded).
   */
  const [freeStaffBpm, setFreeStaffBpm] = useState(120);
  const freeStaffBpmRef = useRef(120);
  freeStaffBpmRef.current = freeStaffBpm;

  // Feature 092: Subscribe to raw MIDI events during free practice.
  // Feature 092: Subscribe to raw MIDI events during free practice.
  // Attacks go into the current-measure buffer; releases update the duration.
  // Notes are finalized (quantized + rests filled) when the measure clock fires.
  // Runs in addition to usePracticeMidi — the practice engine is never started
  // during free practice, so usePracticeMidi won't consume events.
  const isFreePracticeRef = useRef(false);
  isFreePracticeRef.current = isFreePractice;
  const freeSessionActiveRef = useRef(false);
  const [freeSessionActive, setFreeSessionActive] = useState(false);
  /** Notes buffered in the currently-recording measure (not yet finalized). */
  const freeMeasureBufferRef = useRef<MeasureNoteEntry[]>([]);
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (!isFreePracticeRef.current || !freeSessionActiveRef.current) return;
      const now = Date.now();

      if (event.type === 'attack') {
        freeMeasureBufferRef.current.push({ midiNote: event.midiNote, attackMs: now, durationMs: null });
        setFreeNoteCount((c) => c + 1);
        return;
      }

      if (event.type === 'release') {
        // Update durationMs for the most-recent matching attack still in the buffer.
        const buf = freeMeasureBufferRef.current;
        for (let i = buf.length - 1; i >= 0; i--) {
          if (buf[i].midiNote === event.midiNote && buf[i].durationMs === null) {
            buf[i] = { ...buf[i], durationMs: now - buf[i].attackMs };
            break;
          }
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.midi]);

  // Feature 056: Apply pending saved practice once the score is ready.
  // This runs in a useEffect so the state updates happen in the same React
  // render cycle as the playerState transition to 'ready', avoiding the race
  // where setResultsOverlayVisible(true) fires before the score view mounts.
  useEffect(() => {
    const saved = pendingSavedPracticeRef.current;
    if (!saved || playerState.status !== 'ready') return;
    pendingSavedPracticeRef.current = null;

    setSelectedStaffIndex(saved.staffIndex);
    setTempoMultiplier(saved.tempoMultiplier);
    context.scorePlayer.setTempoMultiplier(saved.tempoMultiplier);
    setLoopCount(saved.loopCount);

    // Feature 061: Restore saved loop region so Repractice honors the task region.
    if (saved.loopRegion) {
      setPendingTaskLoopRegion(saved.loopRegion);
    }

    // Re-extract fresh notes from the newly loaded score so that noteIds
    // (opaque DOM IDs) are valid for the current rendering. The saved notes
    // have stale noteIds from the original session.
    let freshNotes: PluginPracticeNoteEntry[] = saved.performanceData.notes as PluginPracticeNoteEntry[];
    const staffIndex = saved.staffIndex;
    if (staffIndex === -1) {
      // Both Clefs: merge from all staves
      const all: PluginPracticeNoteEntry[] = [];
      for (let s = 0; s < playerState.staffCount; s++) {
        const p = context.scorePlayer.extractPracticeNotes(s);
        if (p) all.push(...(p.notes as PluginPracticeNoteEntry[]));
      }
      freshNotes = mergePracticeNotesByTick(all);
    } else {
      const pitches = context.scorePlayer.extractPracticeNotes(staffIndex);
      if (pitches && pitches.notes.length > 0) {
        freshNotes = pitches.notes as PluginPracticeNoteEntry[];
      }
    }

    // Build the notes array with fresh noteIds, falling back to saved entries
    // for any index beyond what was re-extracted (shouldn't happen for same score).
    // NOTE: Do NOT filter freshNotes by loopRegion here — the saved notes array
    // and noteResult indices are absolute (cover the full score). We need the
    // full freshNotes so positional mapping preserves correct noteIds.
    const notesWithFreshIds = saved.performanceData.notes.map((savedNote, i) =>
      i < freshNotes.length ? freshNotes[i] : savedNote,
    );

    if (saved.completionStatus === 'complete') {
      setPerformanceRecord({
        notes: notesWithFreshIds,
        noteResults: saved.performanceData.noteResults,
        wrongNoteEvents: saved.performanceData.wrongNoteEvents,
        bpmAtCompletion: saved.performanceData.bpmAtCompletion,
        tempoMultiplier: saved.tempoMultiplier ?? 1.0,
      });
      setPartialPerformanceRecord(null);
    } else {
      setPartialPerformanceRecord({
        notes: notesWithFreshIds,
        noteResults: saved.performanceData.noteResults,
        wrongNoteEvents: saved.performanceData.wrongNoteEvents,
        bpmAtCompletion: saved.performanceData.bpmAtCompletion,
        tempoMultiplier: saved.tempoMultiplier ?? 1.0,
        stoppedAtIndex: saved.performanceData.stoppedAtIndex ?? 0,
        totalNoteCount: saved.performanceData.totalNoteCount ?? saved.performanceData.notes.length,
      });
      setPerformanceRecord(null);
    }
    setResultsOverlayVisible(true);
    setIsSaved(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.status]);

  // Feature 061: State for loop region ticks computed from task config.
  // Using state (not ref) so that updating it triggers a re-render,
  // ensuring usePracticeLoop receives the values even when other setState
  // calls in the same effect are no-ops (e.g. defaults match).
  const [pendingTaskLoopRegion, setPendingTaskLoopRegion] = useState<{ startTick: number; endTick: number } | null>(null);

  // Feature 061: Apply pending task config once the score is ready.
  useEffect(() => {
    const tc = pendingTaskConfigRef.current;
    if (!tc || playerState.status !== 'ready') return;
    pendingTaskConfigRef.current = null;

    taskStaffIndexRef.current = tc.staffIndex;
    setSelectedStaffIndex(tc.staffIndex);
    setTempoMultiplier(tc.tempoMultiplier);
    context.scorePlayer.setTempoMultiplier(tc.tempoMultiplier);
    setLoopCount(tc.loopCount);

    // Compute loop region from measures if applicable
    if (tc.regionType === 'measures' && tc.startMeasure != null && tc.endMeasure != null) {
      // Legacy migration: goalEngine pre-067 fix stored 0-based measures.
      // 1-based measures never have startMeasure < 1, so this is safe.
      let startM = tc.startMeasure;
      let endM = tc.endMeasure;
      if (startM < 1) {
        startM += 1;
        endM += 1;
      }
      const measureEndTicks = context.scorePlayer.getMeasureEndTicks();
      if (measureEndTicks && measureEndTicks.length > 0) {
        const result = measureRangeToTicks(startM, endM, measureEndTicks);
        if (result) {
          // measureRangeToTicks returns raw (layout) ticks, but the practice
          // engine and playback engine operate in expanded (repeat-unrolled)
          // tick space. Convert so loopPracticeRange, setPinnedStart, and
          // setLoopEnd all receive the correct tick values.
          //
          // endTick is an exclusive upper bound (first tick of the NEXT measure).
          // When it falls exactly on a repeat-section boundary (e.g. m10 end =
          // m11 start in Arabesque), rawTickToExpandedTick's <= binary search
          // picks up the next section's offset, producing a much larger tick
          // that spans both repeat passes. Subtract 1 to stay in the current
          // section, convert, then add 1 back to preserve exclusive semantics.
          setPendingTaskLoopRegion({
            startTick: context.scorePlayer.rawTickToExpandedTick(result.startTick),
            endTick: context.scorePlayer.rawTickToExpandedTick(result.endTick - 1) + 1,
          });
        }
      }
    }

    // Feature 061: Schedule auto-start of practice mode
    autoStartPracticeRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.status]);

  // Practice session start time (ms since epoch) for timing analysis
  const practiceStartTimeRef = useRef(0);

  // ─── Loop logic (extracted hook) ───────────────────────────────────────────
  const {
    loopStart, loopEndPin: _loopEndPin, loopCount, setLoopCount,
    pinnedNoteIds, loopRegion, loopPracticeRange,
    loopRegionRef, loopPracticeRangeRef, loopIterationRef,
    loopStartTimesRef, remainingLoopsRef, handleNoteLongPress,
    resetLoopTracking,
  } = usePracticeLoop({
    practiceState,
    dispatchPractice,
    playerState,
    practiceStartTimeRef,
    context,
    tempoMultiplierRef,
    initialStartTick: pendingTaskLoopRegion?.startTick ?? null,
    initialEndTick: pendingTaskLoopRegion?.endTick ?? null,
    taskLocked: !!taskIdRef.current,
    onComplete: (record) => {
      setPerformanceRecord(record);
      setIsReplaying(false);
    },
    onResultsShow: () => {
      setResultsOverlayVisible(true);
    },
  });

  // Keep a ref to loopCount so callbacks can read the latest value without
  // being listed in dependency arrays (avoids stale closure in handlePracticeToggle).
  const loopCountRef = useRef(loopCount);
  loopCountRef.current = loopCount;

  // Flash the auto-advanced note IDs in red for 600 ms when the engine skips a beat.
  useEffect(() => {
    const results = practiceState.noteResults;
    if (results.length === 0) return;
    const last = results[results.length - 1];
    if (last.outcome !== 'auto-advanced') return;
    // Determine the note IDs of the skipped beat from the notes array.
    const skippedEntry = practiceState.notes[last.noteIndex];
    if (!skippedEntry) return;
    const ids = new Set<string>(skippedEntry.noteIds as string[]);
    setErrorNoteIds(ids);
    // Clear any previous flash timer.
    if (errorFlashTimerRef.current !== null) clearTimeout(errorFlashTimerRef.current);
    errorFlashTimerRef.current = setTimeout(() => {
      setErrorNoteIds(new Set());
      errorFlashTimerRef.current = null;
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceState.noteResults]);

  useEffect(() => {
    if (playerState.status !== 'paused') setPendingPlay(false);
  }, [playerState.status]);

  // ─── Staff selector ─────────────────────────────────────────────────────────
  // The toolbar always shows the staff dropdown when staffCount > 1, so
  // selectedStaffIndex is always a confirmed choice — no inline picker needed.
  const [selectedStaffIndex, setSelectedStaffIndex] = useState(0);

  // Reset to staff 0 when a new score is loaded.
  useEffect(() => {
    if (['ready', 'playing', 'paused'].includes(playerState.status)) {
      // Re-apply the task's locked staff if one is pending (survives loading cycles)
      if (taskStaffIndexRef.current !== null) {
        setSelectedStaffIndex(taskStaffIndexRef.current);
      }
    } else {
      if (taskStaffIndexRef.current === null) {
        setSelectedStaffIndex(0);
      }
    }
  }, [playerState.status]);

  // Feature 084: Sync playback staff filter whenever the score becomes ready.
  // This ensures the initial selectedStaffIndex (default 0 = Right hand) is
  // applied immediately on first load, not only after the user changes the dropdown.
  useEffect(() => {
    if (['ready', 'playing', 'paused'].includes(playerState.status)) {
      const idx = selectedStaffIndex;
      if (idx === -1) context.scorePlayer.setPlaybackStaffFilter(null);
      else context.scorePlayer.setPlaybackStaffFilter(idx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.status, selectedStaffIndex]);

  // Feature 084: Clear playback filter on unmount.
  useEffect(() => {
    return () => { context.scorePlayer.setPlaybackStaffFilter(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to practiceState so MIDI handler always sees latest state
  // without needing to re-subscribe.
  const practiceStateRef = useRef(practiceState);
  practiceStateRef.current = practiceState;

  const playerStateRef = useRef<ScorePlayerState>(playerState);
  playerStateRef.current = playerState;

  // ─── Phantom tempo highlight (extracted hook) ──────────────────────────────
  const { phantomIndex } = usePhantomTempo({
    practiceState,
    practiceStateRef,
    playerBpm: playerState.bpm,
    playerStateRef,
  });

  // Feature 083 (US3): Callback passed to usePracticeMidi — fires once on the
  // first MIDI note attack while the metronome is armed, starting the engine.
  // Defined before usePracticeMidi to avoid temporal dead zone.
  const onFirstNoteAttack = useCallback(() => {
    if (!metronomeArmedRef.current) return;
    metronomeArmedRef.current = false;
    setMetronomeArmed(false);
    context.metronome.toggle().catch((e) => {
      console.error('[PracticeViewPlugin] metronome deferred start failed:', e);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.metronome]);

  // ─── MIDI logic (extracted hook) ───────────────────────────────────────────
  const {
    midiPressedNoteIds, midiEventTick, heldMidiKeysRef, chordDetectorRef: _chordDetectorRef,
  } = usePracticeMidi({
    context,
    practiceState,
    practiceStateRef,
    playerState,
    playerStateRef,
    dispatchPractice,
    loopRegionRef,
    loopPracticeRangeRef,
    loopIterationRef,
    loopStartTimesRef,
    practiceStartTimeRef,
    selectedStaffIndex,
    onFirstNoteAttack,
    onCorrectNote: (tick) => {
      // Feature 089: trigger accompaniment (violin etc.) notes aligned with
      // this practice step. PPQ=960 matches the usePracticeMidi constant.
      playAccompanimentAtTick(tick, playerState.bpm, 960);
    },
  });

  // ─── Teardown (SC-006) ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      context.scorePlayer.stop();
      context.stopPlayback();
      // Error flash cleanup
      if (errorFlashTimerRef.current !== null) clearTimeout(errorFlashTimerRef.current);
      // Feature 092: Free practice timer cleanup
      if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
      if (freeMeasureIntervalRef.current !== null) clearInterval(freeMeasureIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When staff count drops to 1, auto-reset selectedStaffIndex to 0
  useEffect(() => {
    if (playerState.staffCount <= 1) {
      setSelectedStaffIndex(0);
    }
  }, [playerState.staffCount]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  // Back / close
  const handleBack = useCallback(() => {
    context.close();
  }, [context]);

  // Select a catalogue score
  const handleSelectScore = useCallback(
    (catalogueId: string) => {
      loadedScoreRefRef.current = { type: 'preloaded', id: catalogueId };
      context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId });
    },
    [context.scorePlayer],
  );

  // Load a file
  const handleLoadFile = useCallback(
    (file: File) => {
      loadedScoreRefRef.current = null; // File loads can't be reliably reloaded
      context.scorePlayer.loadScore({ kind: 'file', file });
    },
    [context.scorePlayer],
  );

  // Cancel the score selector (close plugin)
  const handleSelectorCancel = useCallback(() => {
    context.close();
  }, [context]);

  /**
   * Feature 092: Start (or restart) the per-measure clock for free practice.
   * Fires every `msPerMeasure = 4 * 60000/bpm` ms.  On each tick it
   * finalizes the measure buffer (quantizes + caps durations), appends the
   * quantized notes to freeDisplayNotes, records them in freeMidiEventsRef,
   * and resets the buffer for the next measure.
   */
  const startMeasureClock = useCallback(() => {
    if (freeMeasureIntervalRef.current !== null) clearInterval(freeMeasureIntervalRef.current);
    const bpm = freeStaffBpmRef.current;
    const msPerMeasure = (4 * 60_000) / bpm;
    freeMeasureIntervalRef.current = setInterval(() => {
      const measureEnd = Date.now();
      const measureStart = freeMeasureStartMsRef.current;
      const buffer = freeMeasureBufferRef.current.slice();
      freeMeasureBufferRef.current = [];
      freeMeasureStartMsRef.current = measureEnd;

      if (buffer.length === 0) return; // empty measure — rests added by toConvertedScore gap-fill

      const quantized = finalizeMeasureNotes(buffer, measureStart, bpm, measureEnd);
      setFreeDisplayNotes((prev) => [...prev, ...quantized]);
      const sessionStart = freeStartMsRef.current;
      for (const note of quantized) {
        freeMidiEventsRef.current.push({
          midiNote: note.midiNote,
          timestampMs: note.timestamp - sessionStart,
          durationMs: note.durationMs,
        });
      }
    }, msPerMeasure);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feature 092: Launch a free (score-less) practice session
  const handleFreePractice = useCallback(() => {
    freeMidiEventsRef.current = [];
    const now = Date.now();
    freeStartMsRef.current = now;
    const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
    setFreeStaffBpm(activeBpm);
    freeStaffBpmRef.current = activeBpm;
    setFreeNoteCount(0);
    setFreeMidiRecord(null);
    setResultsOverlayVisible(false);
    setIsSaved(false);
    setSaveError(null);
    setFreeElapsedMs(0);
    setFreeDisplayNotes([]);
    setFreeDisplayOriginMs(now);
    freeMeasureBufferRef.current = [];
    freeMeasureStartMsRef.current = now;
    loadedScoreRefRef.current = { type: 'free', id: '' };
    setIsFreePractice(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feature 092: Replay a completed free practice session.
  // Lifted from ResultsOverlay so it can drive freeDisplayNotes progressively.
  const handleFreeReplay = useCallback(() => {
    if (!freeMidiRecord || isReplaying) return;
    freeReplayTimersRef.current.forEach(clearTimeout);
    freeReplayTimersRef.current = [];
    // Normalize to first-note offset so beat 1 of measure 1 is always at tick 0.
    // event.timestampMs values are relative to session start, not first note.
    const firstTs = freeMidiRecord.events.length > 0 ? freeMidiRecord.events[0].timestampMs : 0;
    const replayStart = Date.now();
    // Restore the BPM from the original recording so replay layout matches.
    setFreeStaffBpm(freeMidiRecord.bpm);
    setFreeDisplayOriginMs(replayStart);
    setFreeDisplayNotes([]);
    setResultsOverlayVisible(false);
    setIsReplaying(true);
    for (const event of freeMidiRecord.events) {
      const delay = event.timestampMs - firstTs;
      const t = setTimeout(() => {
        context.playNote({ midiNote: event.midiNote, timestamp: Date.now(), type: 'attack', durationMs: event.durationMs ?? 200 });
        setFreeDisplayNotes((prev) => [
          ...prev,
          { midiNote: event.midiNote, timestamp: replayStart + delay, type: 'attack' as const, durationMs: event.durationMs },
        ]);
      }, delay);
      freeReplayTimersRef.current.push(t);
    }
    const lastDelay = freeMidiRecord.events.length > 0
      ? freeMidiRecord.events[freeMidiRecord.events.length - 1].timestampMs - firstTs
      : 0;
    const doneTimer = setTimeout(() => {
      context.stopPlayback();
      setIsReplaying(false);
    }, lastDelay + 500);
    freeReplayTimersRef.current.push(doneTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, freeMidiRecord, isReplaying]);

  // Clean up free-replay timers whenever replay ends (stop button or natural finish).
  useEffect(() => {
    if (!isReplaying && freeReplayTimersRef.current.length > 0) {
      freeReplayTimersRef.current.forEach(clearTimeout);
      freeReplayTimersRef.current = [];
    }
  }, [isReplaying]);

  // Playback controls
  const handlePlay = useCallback(() => {
    // If a loop region is set and current position is outside the region,
    // seek to the region start so playback honours the pinned region.
    const lr = loopRegionRef.current;
    if (lr) {
      const tick = playerStateRef.current.currentTick;
      if (tick < lr.startTick || tick >= lr.endTick) {
        context.scorePlayer.seekToTick(lr.startTick);
      }
    }
    context.scorePlayer.play();
  }, [context.scorePlayer]);
  const handlePause = useCallback(() => context.scorePlayer.pause(), [context.scorePlayer]);
  const handleStop = useCallback(() => {
    // If a replay is in progress, stop audio and reset replay state
    if (isReplaying) {
      context.stopPlayback();
      setIsReplaying(false);
      setReplayHighlightedNoteIds(new Set());
      return;
    }
    // Feature 092: Free practice stop is handled via handlePracticeToggle — this
    // dedicated stop button is hidden in free practice mode, so guard defensively.
    if (isFreePracticeRef.current) return;
    // US7: Snapshot partial results before STOP clears engine state
    const ps = practiceStateRef.current;
    if (ps.mode === 'active' || ps.mode === 'waiting' || ps.mode === 'holding') {
      setPartialPerformanceRecord({
        notes: [...ps.notes],
        noteResults: [...ps.noteResults],
        wrongNoteEvents: [...ps.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
        tempoMultiplier: tempoMultiplierRef.current,
        stoppedAtIndex: ps.currentIndex,
        totalNoteCount: ps.notes.length,
      });
      setResultsOverlayVisible(true);
    }
    dispatchPractice({ type: 'STOP' });
    context.scorePlayer.stop();
    const lr = loopRegionRef.current;
    context.scorePlayer.seekToTick(lr ? lr.startTick : 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context.scorePlayer, playerState.bpm, isReplaying]);

  const handleTempoChange = useCallback(
    (m: number) => {
      setTempoMultiplier(m);
      context.scorePlayer.setTempoMultiplier(m);
    },
    [context.scorePlayer],
  );

  const handleMetronomeToggle = useCallback(() => {
    const ps = practiceStateRef.current;
    const practiceRunning = ps.mode === 'waiting' || ps.mode === 'active' || ps.mode === 'holding';

    if (practiceRunning && !metronomeStateRef.current.active && !metronomeArmedRef.current) {
      // Practice is running but metronome is inactive — arm it (deferred start).
      metronomeArmedRef.current = true;
      setMetronomeArmed(true);
    } else if (metronomeArmedRef.current) {
      // Disarm without starting.
      metronomeArmedRef.current = false;
      setMetronomeArmed(false);
    } else {
      // Normal toggle: outside practice, or stopping an already-active metronome.
      context.metronome.toggle().catch((e) => {
        console.error('[PracticeViewPlugin] metronome.toggle failed:', e);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.metronome]);

  const handleMetronomeSubdivisionChange = useCallback(
    (s: MetronomeSubdivision) => {
      setMetronomeSubdivision(s);
      context.metronome.setSubdivision(s).catch((e) => {
        console.error('[PracticeViewPlugin] metronome.setSubdivision failed:', e);
      });
    },
    [context.metronome],
  );

  const handleStaffChange = useCallback((index: number) => {
    setSelectedStaffIndex(index);
    taskStaffIndexRef.current = null; // user made an explicit choice — release the lock
    // Feature 084: Sync playback audio filter with staff selection.
    if (index === -1) context.scorePlayer.setPlaybackStaffFilter(null);
    else context.scorePlayer.setPlaybackStaffFilter(index);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Practice toggle (T031, T033, T034)
  const handlePracticeToggle = useCallback(() => {
    setIsSaved(false); // Reset save state for new practice session
    setSaveError(null);

    // ─── Feature 092: Free practice toggle ─────────────────────────────────
    if (isFreePracticeRef.current) {
      if (freeSessionActiveRef.current) {
        // ── Stop free session ─────────────────────────────────────────────
        freeSessionActiveRef.current = false;
        setFreeSessionActive(false);
        if (freeIntervalRef.current !== null) {
          clearInterval(freeIntervalRef.current);
          freeIntervalRef.current = null;
        }
        // Stop the measure clock.
        if (freeMeasureIntervalRef.current !== null) {
          clearInterval(freeMeasureIntervalRef.current);
          freeMeasureIntervalRef.current = null;
        }
        // Finalize any notes still in the current (partial) measure.
        const stopTime = Date.now();
        const partialBuffer = freeMeasureBufferRef.current.slice();
        freeMeasureBufferRef.current = [];
        if (partialBuffer.length > 0) {
          const bpm = freeStaffBpmRef.current;
          const quantized = finalizeMeasureNotes(partialBuffer, freeMeasureStartMsRef.current, bpm, stopTime);
          setFreeDisplayNotes((prev) => [...prev, ...quantized]);
          const sessionStart = freeStartMsRef.current;
          for (const note of quantized) {
            freeMidiEventsRef.current.push({
              midiNote: note.midiNote,
              timestampMs: note.timestamp - sessionStart,
              durationMs: note.durationMs,
            });
          }
        }
        const elapsedMs = stopTime - freeStartMsRef.current;
        const events = [...freeMidiEventsRef.current];
        const record: FreeMidiRecord = {
          events,
          elapsedMs,
          noteCount: events.length,
          bpm: freeStaffBpmRef.current,
        };
        setFreeMidiRecord(record);
        setResultsOverlayVisible(true);
      } else {
        // ── Start free session ────────────────────────────────────────────
        freeMidiEventsRef.current = [];
        const now = Date.now();
        freeStartMsRef.current = now;
        const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
        setFreeStaffBpm(activeBpm);
        freeStaffBpmRef.current = activeBpm;
        setFreeNoteCount(0);
        setFreeElapsedMs(0);
        setFreeMidiRecord(null);
        setResultsOverlayVisible(false);
        setFreeDisplayNotes([]);
        setFreeDisplayOriginMs(now);
        freeMeasureBufferRef.current = [];
        freeMeasureStartMsRef.current = now;
        freeSessionActiveRef.current = true;
        setFreeSessionActive(true);
        // Start wall-clock elapsed timer and measure clock.
        if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
        freeIntervalRef.current = setInterval(() => {
          setFreeElapsedMs(Date.now() - freeStartMsRef.current);
        }, 1000);
        startMeasureClock();
      }
      return;
    }

    const ps = practiceStateRef.current;

    if (ps.mode === 'active' || ps.mode === 'waiting' || ps.mode === 'holding') {
      // US7: Snapshot partial results before STOP clears engine state
      setPartialPerformanceRecord({
        notes: [...ps.notes],
        noteResults: [...ps.noteResults],
        wrongNoteEvents: [...ps.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
        tempoMultiplier: tempoMultiplierRef.current,
        stoppedAtIndex: ps.currentIndex,
        totalNoteCount: ps.notes.length,
      });
      setResultsOverlayVisible(true);
      // Stop practice — full reset so restarting begins from the beginning.
      dispatchPractice({ type: 'STOP' });
      // Disarm metronome if it was armed (user stopped before first note).
      metronomeArmedRef.current = false;
      setMetronomeArmed(false);
      const lr = loopRegionRef.current;
      context.scorePlayer.seekToTick(lr ? lr.startTick : 0);
      return;
    }

    // When restarting from 'complete' mode, reset the engine first so any
    // stale notes/index are cleared before computing the new practice set.
    if (ps.mode === 'complete') {
      dispatchPractice({ type: 'STOP' });
    }

    // After natural practice completion the score player may be in 'playing'
    // or 'paused' state. Reset it to 'stopped' (→ 'ready') so that
    // extractPracticeNotes returns valid data instead of null.
    context.scorePlayer.stop();

    // Reset loop count to 1 for a fresh practice start (repractice preserves
    // the slider value, but a brand-new practice always starts with 1 loop).
    // Feature 061: When launched from a task, preserve the task's loopCount.
    if (!taskIdRef.current) {
      setLoopCount(1);
    }

    // Reset loop iteration tracking so the progress counter starts from 1/N.
    resetLoopTracking();

    // Feature 061: When task-driven, restore remaining loops after reset.
    if (taskIdRef.current) {
      remainingLoopsRef.current = loopCountRef.current - 1;
    }

    // Start practice — staff is always already selected via the toolbar dropdown
    const ps2 = playerStateRef.current;
    const staffCount = ps2.staffCount;
    const staffIndex = staffCount <= 1 ? 0 : selectedStaffIndex;

    // Collect notes: single staff or merged from all staves ("Both Clefs").
    let notes: PluginPracticeNoteEntry[];
    if (staffIndex === -1) {
      // Both Clefs: extract from every staff, merge by tick so ChordDetector
      // requires all simultaneous cross-staff pitches to be pressed together.
      const all: PluginPracticeNoteEntry[] = [];
      for (let s = 0; s < staffCount; s++) {
        const p = context.scorePlayer.extractPracticeNotes(s);
        if (p) all.push(...(p.notes as PluginPracticeNoteEntry[]));
      }
      notes = mergePracticeNotesByTick(all);
    } else {
      const pitches = context.scorePlayer.extractPracticeNotes(staffIndex);
      if (!pitches || pitches.notes.length === 0) return;
      notes = pitches.notes as PluginPracticeNoteEntry[];
    }
    if (notes.length === 0) return;

    // If a loop region is pinned, start from the first note inside it;
    // otherwise always start from the beginning of the score.
    const lr = loopRegionRef.current;
    let startIndex = 0;
    if (lr) {
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].tick >= lr.startTick) {
          startIndex = i;
          break;
        }
      }
    }

    dispatchPractice({
      type: 'START',
      notes,
      staffIndex,
      startIndex,
    });

    // Feature 083 (US3): If the metronome is already active when practice starts,
    // stop it and arm it — it will restart on the first MIDI note attack.
    if (metronomeStateRef.current.active && !metronomeArmedRef.current) {
      context.metronome.toggle().catch((e) => {
        console.error('[PracticeViewPlugin] metronome stop-on-practice-start failed:', e);
      });
      metronomeArmedRef.current = true;
      setMetronomeArmed(true);
    }

    // practiceStartTimeRef is set later — when the first correct note is played
    // (deferred start: the clock doesn't start until the user hits the first note).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.scorePlayer,
    selectedStaffIndex,
    startMeasureClock,
  ]);

  // Ref to handlePracticeToggle so the auto-start effect can call it without
  // depending on the callback identity (avoids cleanup-cancels-timeout race).
  const handlePracticeToggleRef = useRef(handlePracticeToggle);
  handlePracticeToggleRef.current = handlePracticeToggle;

  // Feature 061: Auto-start practice when entering task mode.
  // Waits until the loop region is fully applied (for region tasks) or
  // fires immediately (for whole-score tasks) once the flag is set.
  useEffect(() => {
    if (!autoStartPracticeRef.current) return;
    // For region tasks, wait until loopRegion is established
    if (pendingTaskLoopRegion && !loopRegion) return;
    autoStartPracticeRef.current = false;
    // Delay slightly so the UI renders the score before practice begins
    const t = setTimeout(() => handlePracticeToggleRef.current(), 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopRegion, pendingTaskLoopRegion]);

  // Note short-tap handler (US3 / T037)
  // Mirrors play-score two-tap seek-then-play state machine:
  //   • Practice running → blocked entirely (Feature 053, Bug 6 — position lock)
  //   • Not playing      → seekToTick; second tap while paused → also play()
  //   • Playing          → seekToTick (mid-playback navigation)
  const handleNoteShortTap = useCallback(
    (tick: number, _noteId: string) => {
      const mode = practiceStateRef.current.mode;
      // Feature 053 (Bug 6): Block all position navigation during active practice.
      if (mode === 'active' || mode === 'waiting' || mode === 'holding') {
        return;
      }

      if (playerState.status !== 'playing') {
        context.scorePlayer.seekToTick(tick);
        if (pendingPlay) {
          // Second tap: resume from newly seeked position.
          context.scorePlayer.play();
          // pendingPlay cleared by useEffect when status → 'playing'.
        } else {
          // First tap: arm play trigger.
          setPendingPlay(true);
        }
        return;
      }
      // Playing: seek without interrupting playback.
      context.scorePlayer.seekToTick(tick);
    },
    [context.scorePlayer, playerState.status, pendingPlay],
  );

  // Return to start — respects loop start pin when set
  // Feature 053 (Bug 6): Blocked during active practice (position lock).
  const handleReturnToStart = useCallback(() => {
    const mode = practiceStateRef.current.mode;
    if (mode === 'active' || mode === 'waiting' || mode === 'holding') return;
    context.scorePlayer.seekToTick(loopStart?.tick ?? 0);
  }, [context.scorePlayer, loopStart]);

  // Canvas tap (toggles play/pause)
  const handleCanvasTap = useCallback(() => {
    if (playerState.status === 'playing') {
      context.scorePlayer.pause();
    } else {
      context.scorePlayer.play();
    }
  }, [context.scorePlayer, playerState.status]);

  // ─── Repractice handler (called from ResultsOverlay after replay cleanup) ──
  const handleRepractice = useCallback(() => {
    // Feature 092: Free practice repractice — start a fresh free session
    if (isFreePracticeRef.current) {
      freeMidiEventsRef.current = [];
      const now = Date.now();
      freeStartMsRef.current = now;
      const activeBpm = metronomeStateRef.current.bpm > 0 ? metronomeStateRef.current.bpm : 120;
      setFreeStaffBpm(activeBpm);
      freeStaffBpmRef.current = activeBpm;
      setFreeNoteCount(0);
      setFreeElapsedMs(0);
      setFreeMidiRecord(null);
      setResultsOverlayVisible(false);
      setIsSaved(false);
      setSaveError(null);
      setFreeDisplayNotes([]);
      setFreeDisplayOriginMs(now);
      freeMeasureBufferRef.current = [];
      freeMeasureStartMsRef.current = now;
      freeSessionActiveRef.current = true;
      setFreeSessionActive(true);
      if (freeIntervalRef.current !== null) clearInterval(freeIntervalRef.current);
      freeIntervalRef.current = setInterval(() => {
        setFreeElapsedMs(Date.now() - freeStartMsRef.current);
      }, 1000);
      startMeasureClock();
      return;
    }
    setResultsOverlayVisible(false);
    setPartialPerformanceRecord(null);
    handlePracticeToggle();
    // Override the loop refs AFTER handlePracticeToggle (which resets them to
    // single-loop defaults). Repractice preserves the user's slider loopCount.
    remainingLoopsRef.current = loopCount - 1;
    loopIterationRef.current = 0;
    loopStartTimesRef.current = [0];
    // Also restore loopCount since handlePracticeToggle sets it to 1.
    setLoopCount(loopCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePracticeToggle, loopCount, startMeasureClock]);

  // ─── Feature 056 + 092: Save practice handler ─────────────────────────────────
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
        console.error('[PracticeViewPlugin] Failed to save free practice:', e);
        const isQuota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
        setSaveError(isQuota ? t('practice.plugin.storage_full') : t('practice.plugin.save_failed'));
      }
      return;
    }

    const isComplete = practiceState.mode === 'complete' && !!performanceRecord;
    const isPartial = !!partialPerformanceRecord;
    if (!isComplete && !isPartial) return;

    const now = new Date();
    const id = crypto.randomUUID();
    const scoreTitle = playerState.title ?? t('practice.plugin.untitled');
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
      name: generatePracticeName(scoreTitle, selectedStaffIndex, lr, now),
      savedAt: now.toISOString(),
      scoreRef,
      scoreTitle,
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
        scoreTitle,
      });
      // Clean up evicted entries from IndexedDB
      for (const evictedId of evictedIds) {
        await deletePracticeFromIndexedDB(evictedId);
      }
      setIsSaved(true);
      setSaveError(null);
      setSavedPractices(listSavedPractices());
      // Feature 060: Notify subscribers (e.g. sessions plugin) that a practice was saved
      const breakdown = computePracticeScore(performanceData.noteResults, tempoMultiplier);
      const lastNr = performanceData.noteResults[performanceData.noteResults.length - 1];
      broadcastPracticeSaved({
        savedPracticeId: id,
        practiceName: practice.name,
        scoreTitle,
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
      console.error('[PracticeViewPlugin] Failed to save practice:', e);
      const isQuota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      setSaveError(isQuota ? t('practice.plugin.storage_full') : t('practice.plugin.save_failed'));
    }
  }, [
    practiceState.mode, performanceRecord, partialPerformanceRecord,
    playerState.title, loopRegion, selectedStaffIndex,
    tempoMultiplier, loopCount, freeMidiRecord,
  ]);

  // ─── Feature 056: Delete saved practice handler ─────────────────────────────
  const handleDeleteSavedPractice = useCallback(async (practiceId: string) => {
    removeSavedPracticeIndex(practiceId);
    await deletePracticeFromIndexedDB(practiceId);
    setSavedPractices(listSavedPractices());
  }, []);

  // ─── Feature 056: Load saved practice handler ──────────────────────────────
  // Feature 060: Auto-load saved practice when navigated from sessions plugin.
  useEffect(() => {
    const navData = context.getNavigationData();
    if (navData && typeof navData.savedPracticeId === 'string') {
      const id = navData.savedPracticeId;
      // Feature 061: Set task tag if navigated from a task-linked activity
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
        // Feature 092: Free practice — restore directly, no score player needed
        if (saved.scoreRef.type === 'free') {
          freeMidiEventsRef.current = [];
          freeSessionActiveRef.current = false;
          setFreeNoteCount(saved.freeMidiRecord?.noteCount ?? 0);
          setFreeMidiRecord(saved.freeMidiRecord ?? null);
          setIsSaved(true);
          setSaveError(null);
          setIsFreePractice(true);
          setResultsOverlayVisible(!!saved.freeMidiRecord);
          return;
        }
        pendingSavedPracticeRef.current = saved;
        if (saved.scoreRef.type === 'preloaded') {
          context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: saved.scoreRef.id });
        } else {
          context.scorePlayer.loadScore({ kind: 'userScore', scoreId: saved.scoreRef.id });
        }
      }).catch((err) => console.error('[PracticeViewPlugin] nav data load failed:', err));
    } else if (navData && navData.taskConfig && typeof navData.taskConfig === 'object') {
      // Feature 061: Launch from a session task — load score and stash config
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
        // Apply staffIndex immediately: if the same score is already loaded,
        // playerState.status stays 'ready' and the task-config effect never
        // re-fires (its dependency doesn't change). Setting it here ensures
        // the correct staff is selected even when no score reload happens.
        taskStaffIndexRef.current = staffIndex;
        setSelectedStaffIndex(staffIndex);
        if (scoreRef.type === 'preloaded') {
          context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: scoreRef.id });
        } else {
          context.scorePlayer.loadScore({ kind: 'userScore', scoreId: scoreRef.id });
        }
      }
    }
  // Run once on mount — navData is one-shot (cleared after read).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSavedPractice = useCallback(async (entry: SavedPracticeIndexEntry) => {
    const saved = await loadPracticeFromIndexedDB(entry.id);
    if (!saved) {
      console.warn('[PracticeViewPlugin] Saved practice not found in IndexedDB:', entry.id);
      return;
    }

    // Feature 092: Restore a saved free practice — no score loading needed
    if (saved.scoreRef.type === 'free') {
      loadedScoreRefRef.current = saved.scoreRef;
      freeMidiEventsRef.current = [];
      freeSessionActiveRef.current = false;
      setFreeNoteCount(saved.freeMidiRecord?.noteCount ?? 0);
      setFreeMidiRecord(saved.freeMidiRecord ?? null);
      setIsSaved(true);
      setSaveError(null);
      setIsFreePractice(true);
      setResultsOverlayVisible(!!saved.freeMidiRecord);
      return;
    }

    // Track score ref for potential re-save
    loadedScoreRefRef.current = saved.scoreRef;

    // Store the saved practice for the useEffect to apply once the score is ready
    pendingSavedPracticeRef.current = saved;

    // Load the referenced score — the useEffect watching playerState.status
    // will restore settings and show the results overlay when status becomes 'ready'.
    if (saved.scoreRef.type === 'preloaded') {
      context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId: saved.scoreRef.id });
    } else {
      context.scorePlayer.loadScore({ kind: 'userScore', scoreId: saved.scoreRef.id });
    }
  }, [context.scorePlayer]);

  // ─── Highlight computation (extracted hook) ─────────────────────────────────
  const {
    targetNoteIds, confirmedNoteIds,
    pressedPitchLabels, expectedPitchLabels,
    highlightedNoteIds, practiceActive, practiceWaiting,
  } = usePracticeHighlights({
    practiceState,
    playerState,
    midiPressedNoteIds,
    midiEventTick,
    heldMidiKeysRef,
    phantomIndex,
    isReplaying,
    replayHighlightedNoteIds,
  });

  const isLoaded = ['ready', 'playing', 'paused'].includes(playerState.status);

  // ─── Render ────────────────────────────────────────────────────────────────

  const { ScoreSelector, ScoreRenderer } = context.components;

  if (!isLoaded && !isFreePractice) {
    // Score selector screen
    return (
      <div className="practice-plugin practice-plugin--selection" data-testid="practice-plugin-root">
        <ScoreSelector
          catalogue={context.scorePlayer.getCatalogue()}
          isLoading={playerState.status === 'loading'}
          error={playerState.error}
          onSelectScore={handleSelectScore}
          onLoadFile={handleLoadFile}
          onCancel={handleSelectorCancel}
          onSelectUserScore={(scoreId) => {
            loadedScoreRefRef.current = { type: 'user', id: scoreId };
            context.scorePlayer.loadScore({ kind: 'userScore', scoreId });
          }}
          savedPractices={savedPractices}
          onSelectSavedPractice={handleSelectSavedPractice}
          onDeleteSavedPractice={handleDeleteSavedPractice}
          protectedPracticeIds={protectedPracticeIds}
          protectedPracticeMap={protectedPracticeMap}
          onViewSessions={(sessionId, taskId) => context.openPlugin('sessions-plugin', {
            expandSessionId: sessionId,
            expandTaskId: taskId,
          })}
          onFreePractice={handleFreePractice}
        />
      </div>
    );
  }

  return (
    <div className={`practice-plugin${practiceActive ? ' practice-plugin--phantom' : ''}${isFreePractice && resultsOverlayVisible ? ' practice-plugin--results' : ''}${!isFreePractice && (((practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && performanceRecord)) && resultsOverlayVisible) || (partialPerformanceRecord && resultsOverlayVisible)) ? ' practice-plugin--results' : ''}`} data-testid="practice-plugin-root">
      {/* Toolbar — top */}
      <PracticeToolbar
        scoreTitle={isFreePractice ? t('practice.free.title') : playerState.title}
        status={isFreePractice ? 'ready' as const : playerState.status}
        // showStaffPicker removed — toolbar dropdown is always the selector
        currentTick={isFreePractice ? Math.round((freeElapsedMs / 1000) * (freeStaffBpm / 60) * 960) : playerState.currentTick}
        totalDurationTicks={isFreePractice ? 0 : playerState.totalDurationTicks}
        bpm={isFreePractice ? freeStaffBpm : playerState.bpm}
        tempoMultiplier={tempoMultiplier}
        onBack={() => {
          // Feature 092: Exit free practice on back
          if (isFreePractice) {
            freeSessionActiveRef.current = false;
            setFreeSessionActive(false);
            setIsFreePractice(false);
            setFreeMidiRecord(null);
            setResultsOverlayVisible(false);
            if (freeIntervalRef.current !== null) {
              clearInterval(freeIntervalRef.current);
              freeIntervalRef.current = null;
            }
            if (freeMeasureIntervalRef.current !== null) {
              clearInterval(freeMeasureIntervalRef.current);
              freeMeasureIntervalRef.current = null;
            }
            return;
          }
          handleBack();
        }}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onTempoChange={handleTempoChange}
        staffCount={isFreePractice ? 0 : playerState.staffCount}
        selectedStaffIndex={selectedStaffIndex}
        onStaffChange={handleStaffChange}
        practiceMode={isFreePractice ? (freeSessionActive ? 'active' : 'inactive') : practiceState.mode}
        currentPracticeIndex={(() => {
          if (isFreePractice) return 0;
          const range = loopPracticeRange;
          const mode = practiceState.mode;
          if (range && (mode === 'active' || mode === 'holding' || mode === 'waiting')) {
            const notesInLoop = range.endIndex - range.startIndex + 1;
            const completedLoops = Math.max(0, (loopCount - 1) - remainingLoopsRef.current);
            return completedLoops * notesInLoop + (practiceState.currentIndex - range.startIndex);
          }
          return practiceState.currentIndex;
        })()}
        totalPracticeNotes={(() => {
          if (isFreePractice) return 0;
          const range = loopPracticeRange;
          const mode = practiceState.mode;
          if (range && (mode === 'active' || mode === 'holding' || mode === 'waiting')) {
            const notesInLoop = range.endIndex - range.startIndex + 1;
            return notesInLoop * loopCount;
          }
          return practiceState.notes.length;
        })()}
        onPracticeToggle={handlePracticeToggle}
        showStaffPicker={false}
        midiConnected={midiConnected}
        midiSupported={midiSupported}
        metronomeActive={metronomeState.active}
        metronomeBeatIndex={metronomeState.beatIndex}
        metronomeIsDownbeat={metronomeState.isDownbeat}
        onMetronomeToggle={handleMetronomeToggle}
        metronomeSubdivision={metronomeSubdivision}
        onMetronomeSubdivisionChange={handleMetronomeSubdivisionChange}
        metronomeArmed={metronomeArmed}
        taskTag={taskTag}
        isReplaying={isReplaying}
        onTaskTagClick={() => context.openPlugin('sessions-plugin', {
          expandSessionId: sessionIdRef.current,
          expandTaskId: taskIdRef.current,
        })}
        isFreePractice={isFreePractice}
        freeNoteCount={freeNoteCount}
      />

      {/* Hold indicator — visible while player holds a note longer than a quarter note */}
      {holdProgress > 0 && practiceState.requiredHoldMs > (60_000 / (playerState.bpm || 120)) && (
        <div
          data-testid="hold-indicator"
          className="practice-plugin__hold-indicator"
          role="progressbar"
          aria-valuenow={Math.round(holdProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="practice-plugin__hold-indicator-bar"
            style={{ width: `${Math.min(holdProgress * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Real-time note display — pressed vs expected (only on wrong note) */}
      {!isFreePractice && (practiceActive || practiceWaiting) &&
        practiceState.currentWrongAttempts > 0 && (
        <div className="practice-plugin__note-display" aria-live="polite">
          <span className="practice-plugin__note-display-label">{t('practice.plugin.expected')}</span>
          <span className="practice-plugin__note-display-notes practice-plugin__note-display-notes--expected">
            {expectedPitchLabels.join(', ')}
          </span>
          <span className="practice-plugin__note-display-sep">|</span>
          <span className="practice-plugin__note-display-label">{t('practice.plugin.playing')}</span>
          <span className="practice-plugin__note-display-notes practice-plugin__note-display-notes--wrong">
            {pressedPitchLabels.join(', ')}
          </span>
        </div>
      )}

      {/* Score — not shown during free practice */}
      {!isFreePractice && (
        <div className="practice-plugin__score-area">
          <ScoreRenderer
            currentTick={playerState.currentTick}
            highlightedNoteIds={highlightedNoteIds}
            errorNoteIds={errorNoteIds}
            expectedNoteIds={practiceActive ? targetNoteIds : undefined}
            pinnedNoteIds={
              practiceActive
                ? confirmedNoteIds  // full green = keys the user is pressing correctly
                : (practiceState.mode === 'waiting' ? new Set<string>() : pinnedNoteIds)
            }
            scrollTargetNoteIds={practiceActive ? targetNoteIds : undefined}
            loopRegion={loopRegion}
            onNoteShortTap={handleNoteShortTap}
            onNoteLongPress={handleNoteLongPress}
            onCanvasTap={handleCanvasTap}
            onReturnToStart={handleReturnToStart}
          />
        </div>
      )}

      {/* Feature 092: Free practice canvas — shows notes as the user plays or during replay */}
      {isFreePractice && !resultsOverlayVisible && (
        <div className="practice-plugin__score-area practice-plugin__free-canvas" aria-label={t('practice.free.title')}>
          <context.components.StaffViewer
            notes={freeDisplayNotes}
            bpm={freeStaffBpm}
            timestampOffset={freeDisplayOriginMs}
            autoScroll
          />
        </div>
      )}

      {/* Results overlay — shown when practice finishes or on mid-session stop */}
      <ResultsOverlay
        practiceState={practiceState}
        playerState={playerState}
        performanceRecord={performanceRecord}
        partialPerformanceRecord={partialPerformanceRecord}
        resultsOverlayVisible={resultsOverlayVisible}
        loopRegion={loopRegion}
        loopCount={loopCount}
        setLoopCount={setLoopCount}
        context={context}
        onRepractice={handleRepractice}
        onDismiss={() => {
          setResultsOverlayVisible(false);
          setPartialPerformanceRecord(null);
          // Feature 092: Dismissing free practice results returns to the score
          // selector so the user can immediately see and load their saved practice.
          if (isFreePracticeRef.current) {
            if (freeIntervalRef.current !== null) {
              clearInterval(freeIntervalRef.current);
              freeIntervalRef.current = null;
            }
            if (freeMeasureIntervalRef.current !== null) {
              clearInterval(freeMeasureIntervalRef.current);
              freeMeasureIntervalRef.current = null;
            }
            freeSessionActiveRef.current = false;
            setFreeSessionActive(false);
            setIsFreePractice(false);
            setFreeMidiRecord(null);
          }
        }}
        isReplaying={isReplaying}
        replayHighlightedNoteIds={replayHighlightedNoteIds}
        setIsReplaying={setIsReplaying}
        setReplayHighlightedNoteIds={setReplayHighlightedNoteIds}
        onSave={loadedScoreRefRef.current ? handleSave : undefined}
        isSaved={isSaved}
        saveError={saveError}
        onReturnToSession={sessionIdRef.current ? () => context.openPlugin('sessions-plugin', {
          expandSessionId: sessionIdRef.current,
          expandTaskId: taskIdRef.current,
        }) : undefined}
        loopCountLocked={!!taskIdRef.current}
        isFreePractice={isFreePractice}
        freeMidiRecord={freeMidiRecord}
        onHideOverlay={() => setResultsOverlayVisible(false)}
        onFreeReplay={handleFreeReplay}
      />
    </div>
  );
}
