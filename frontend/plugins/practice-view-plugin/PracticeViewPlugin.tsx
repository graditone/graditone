/**
 * Practice View Plugin — Orchestrator
 * Feature 037: Practice View Plugin
 *
 * Thin orchestrator that wires together extracted hooks and components:
 *   - useHoldProgress         — rAF hold-timer loop (feature 042)
 *   - usePracticeLoop         — Loop pin state, loop region, multi-loop counters
 *   - usePhantomTempo         — Phantom tempo cursor advancing at configured BPM
 *   - usePracticeMidi         — Chord detection, MIDI subscription, held-key tracking
 *   - usePracticeHighlights   — Target/confirmed/pressed note-ID computation
 *   - ResultsOverlay          — Complete/partial results display, replay controls
 *   - useFreePractice         — Feature 092: free (score-less) practice domain (Feature 092)
 *   - useSavedPracticeManager — Feature 056/060/061: saved practice CRUD + task config
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
import { useFreePractice } from './useFreePractice';
import { useSavedPracticeManager } from './useSavedPracticeManager';
import './PracticeViewPlugin.css';
import { useTranslation } from '../../src/i18n';

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
  const { connected: midiConnected, supported: midiSupported } = useMidiConnectivity();

  // ─── Two-tap seek-then-play state machine (mirrors play-score) ──────────────
  const [pendingPlay, setPendingPlay] = useState(false);

  // ─── Results overlay ─────────────────────────────────────────────────────────
  const [resultsOverlayVisible, setResultsOverlayVisible] = useState(false);

  // ─── Auto-advance error flash ─────────────────────────────────────────────
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

  // ─── Feature 056: Save/error state (owned by orchestrator, shared with hooks) ─
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedScoreRefRef = useRef<import('../../src/plugin-api/index').ScoreRef | null>(null);

  // ─── Feature 092: Free Practice (extracted hook) ───────────────────────────
  const freePractice = useFreePractice({
    context,
    metronomeStateRef,
    loadedScoreRefRef,
    isReplaying,
    setIsReplaying,
    setResultsOverlayVisible,
    setIsSaved,
    setSaveError,
  });

  // ─── Feature 056/060/061: Saved Practice Manager (extracted hook) ───────────
  const savedPracticeManager = useSavedPracticeManager({
    context,
    freeMidiRecord: freePractice.freeMidiRecord,
    isFreePracticeRef: freePractice.isFreePracticeRef,
    loadedScoreRefRef,
    loopRegion: null, // supplied after usePracticeLoop is called below; see note
    selectedStaffIndex: 0, // supplied after state declarations below; see note
    tempoMultiplier,
    loopCount: 1, // supplied after usePracticeLoop; see note
    performanceRecord,
    partialPerformanceRecord,
    scoreTitle: playerState.title,
    t,
    setIsSaved,
    setSaveError,
    setSelectedStaffIndex: (i) => setSelectedStaffIndex(i),
    onFreePracticeLoad: (record, noteCount) => {
      freePractice.loadSavedFreePractice(record, noteCount);
      setIsSaved(true);
      setSaveError(null);
      setResultsOverlayVisible(!!record);
    },
  });

  // Feature 056: Apply pending saved practice once the score is ready.
  useEffect(() => {
    const saved = savedPracticeManager.pendingSavedPracticeRef.current;
    if (!saved || playerState.status !== 'ready') return;
    savedPracticeManager.pendingSavedPracticeRef.current = null;

    setSelectedStaffIndex(saved.staffIndex);
    setTempoMultiplier(saved.tempoMultiplier);
    context.scorePlayer.setTempoMultiplier(saved.tempoMultiplier);
    setLoopCount(saved.loopCount);

    // Feature 061: Restore saved loop region so Repractice honours the task region.
    if (saved.loopRegion) {
      savedPracticeManager.setPendingTaskLoopRegion(saved.loopRegion);
    }

    // Re-extract fresh notes from the newly loaded score so that noteIds
    // (opaque DOM IDs) are valid for the current rendering.
    let freshNotes: PluginPracticeNoteEntry[] = saved.performanceData.notes as PluginPracticeNoteEntry[];
    const staffIndex = saved.staffIndex;
    if (staffIndex === -1) {
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

  // Feature 061: Apply pending task config once the score is ready.
  useEffect(() => {
    const tc = savedPracticeManager.pendingTaskConfigRef.current;
    if (!tc || playerState.status !== 'ready') return;
    savedPracticeManager.pendingTaskConfigRef.current = null;

    savedPracticeManager.taskStaffIndexRef.current = tc.staffIndex;
    setSelectedStaffIndex(tc.staffIndex);
    setTempoMultiplier(tc.tempoMultiplier);
    context.scorePlayer.setTempoMultiplier(tc.tempoMultiplier);
    setLoopCount(tc.loopCount);

    if (tc.regionType === 'measures' && tc.startMeasure != null && tc.endMeasure != null) {
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
          savedPracticeManager.setPendingTaskLoopRegion({
            startTick: context.scorePlayer.rawTickToExpandedTick(result.startTick),
            endTick: context.scorePlayer.rawTickToExpandedTick(result.endTick - 1) + 1,
          });
        }
      }
    }

    savedPracticeManager.autoStartPracticeRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.status]);

  // Practice session start time (ms since epoch) for timing analysis
  const practiceStartTimeRef = useRef(0);

  // ─── Staff selector ─────────────────────────────────────────────────────────
  const [selectedStaffIndex, setSelectedStaffIndex] = useState(0);

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
    initialStartTick: savedPracticeManager.pendingTaskLoopRegion?.startTick ?? null,
    initialEndTick: savedPracticeManager.pendingTaskLoopRegion?.endTick ?? null,
    taskLocked: !!savedPracticeManager.taskIdRef.current,
    onComplete: (record) => {
      setPerformanceRecord(record);
      setIsReplaying(false);
    },
    onResultsShow: () => {
      setResultsOverlayVisible(true);
    },
  });

  const loopCountRef = useRef(loopCount);
  loopCountRef.current = loopCount;

  // Flash the auto-advanced note IDs in red for 600 ms.
  useEffect(() => {
    const results = practiceState.noteResults;
    if (results.length === 0) return;
    const last = results[results.length - 1];
    if (last.outcome !== 'auto-advanced') return;
    const skippedEntry = practiceState.notes[last.noteIndex];
    if (!skippedEntry) return;
    const ids = new Set<string>(skippedEntry.noteIds as string[]);
    setErrorNoteIds(ids);
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

  // Reset to staff 0 when a new score is loaded.
  useEffect(() => {
    if (['ready', 'playing', 'paused'].includes(playerState.status)) {
      if (savedPracticeManager.taskStaffIndexRef.current !== null) {
        setSelectedStaffIndex(savedPracticeManager.taskStaffIndexRef.current);
      }
    } else {
      if (savedPracticeManager.taskStaffIndexRef.current === null) {
        setSelectedStaffIndex(0);
      }
    }
  }, [playerState.status, savedPracticeManager.taskStaffIndexRef]);

  // Feature 084: Sync playback staff filter whenever the score becomes ready.
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

  // Feature 083 (US3): Fires once on the first MIDI note attack while the
  // metronome is armed, starting the engine.
  const onFirstNoteAttack = useCallback(() => {
    if (!metronomeArmedRef.current) return;
    metronomeArmedRef.current = false;
    setMetronomeArmed(false);
    context.metronome.toggle().catch((e) => {
      console.error('[PracticeViewPlugin] metronome deferred start failed:', e);
    });
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
      playAccompanimentAtTick(tick, playerState.bpm, 960);
    },
  });

  // ─── Teardown (SC-006) ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      context.scorePlayer.stop();
      context.stopPlayback();
      if (errorFlashTimerRef.current !== null) clearTimeout(errorFlashTimerRef.current);
      // Feature 092: Free practice timer cleanup
      freePractice.cleanupFreeTimers();
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
      loadedScoreRefRef.current = null;
      context.scorePlayer.loadScore({ kind: 'file', file });
    },
    [context.scorePlayer],
  );

  // Cancel the score selector (close plugin)
  const handleSelectorCancel = useCallback(() => {
    context.close();
  }, [context]);

  // Playback controls
  const handlePlay = useCallback(() => {
    const lr = loopRegionRef.current;
    if (lr) {
      const tick = playerStateRef.current.currentTick;
      if (tick < lr.startTick || tick >= lr.endTick) {
        context.scorePlayer.seekToTick(lr.startTick);
      }
    }
    context.scorePlayer.play();
  }, [context.scorePlayer, loopRegionRef, playerStateRef]);
  const handlePause = useCallback(() => context.scorePlayer.pause(), [context.scorePlayer]);
  const handleStop = useCallback(() => {
    if (isReplaying) {
      context.stopPlayback();
      setIsReplaying(false);
      setReplayHighlightedNoteIds(new Set());
      return;
    }
    // Feature 092: Free practice stop is handled via handlePracticeToggle.
    if (freePractice.isFreePracticeRef.current) return;
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
      metronomeArmedRef.current = true;
      setMetronomeArmed(true);
    } else if (metronomeArmedRef.current) {
      metronomeArmedRef.current = false;
      setMetronomeArmed(false);
    } else {
      context.metronome.toggle().catch((e) => {
        console.error('[PracticeViewPlugin] metronome.toggle failed:', e);
      });
    }
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
    savedPracticeManager.taskStaffIndexRef.current = null;
    if (index === -1) context.scorePlayer.setPlaybackStaffFilter(null);
    else context.scorePlayer.setPlaybackStaffFilter(index);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Practice toggle (T031, T033, T034)
  const handlePracticeToggle = useCallback(() => {
    setIsSaved(false);
    setSaveError(null);

    // Feature 092: Free practice toggle — delegate to the domain hook
    if (freePractice.isFreePracticeRef.current) {
      freePractice.handleFreeToggle();
      return;
    }

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
      dispatchPractice({ type: 'STOP' });
      metronomeArmedRef.current = false;
      setMetronomeArmed(false);
      const lr = loopRegionRef.current;
      context.scorePlayer.seekToTick(lr ? lr.startTick : 0);
      return;
    }

    if (ps.mode === 'complete') {
      dispatchPractice({ type: 'STOP' });
    }

    context.scorePlayer.stop();

    if (!savedPracticeManager.taskIdRef.current) {
      setLoopCount(1);
    }

    resetLoopTracking();

    if (savedPracticeManager.taskIdRef.current) {
      remainingLoopsRef.current = loopCountRef.current - 1;
    }

    const ps2 = playerStateRef.current;
    const staffCount = ps2.staffCount;
    const staffIndex = staffCount <= 1 ? 0 : selectedStaffIndex;

    let notes: PluginPracticeNoteEntry[];
    if (staffIndex === -1) {
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

    if (metronomeStateRef.current.active && !metronomeArmedRef.current) {
      context.metronome.toggle().catch((e) => {
        console.error('[PracticeViewPlugin] metronome stop-on-practice-start failed:', e);
      });
      metronomeArmedRef.current = true;
      setMetronomeArmed(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.scorePlayer,
    selectedStaffIndex,
  ]);

  const handlePracticeToggleRef = useRef(handlePracticeToggle);
  handlePracticeToggleRef.current = handlePracticeToggle;

  // Feature 061: Auto-start practice when entering task mode.
  useEffect(() => {
    if (!savedPracticeManager.autoStartPracticeRef.current) return;
    if (savedPracticeManager.pendingTaskLoopRegion && !loopRegion) return;
    savedPracticeManager.autoStartPracticeRef.current = false;
    const timer = setTimeout(() => handlePracticeToggleRef.current(), 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopRegion, savedPracticeManager.pendingTaskLoopRegion]);

  // Note short-tap handler (US3 / T037)
  const handleNoteShortTap = useCallback(
    (tick: number, _noteId: string) => {
      const mode = practiceStateRef.current.mode;
      if (mode === 'active' || mode === 'waiting' || mode === 'holding') {
        return;
      }

      if (playerState.status !== 'playing') {
        context.scorePlayer.seekToTick(tick);
        if (pendingPlay) {
          context.scorePlayer.play();
        } else {
          setPendingPlay(true);
        }
        return;
      }
      context.scorePlayer.seekToTick(tick);
    },
    [context.scorePlayer, playerState.status, pendingPlay],
  );

  // Return to start — respects loop start pin when set
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

  // ─── Repractice handler ─────────────────────────────────────────────────────
  const handleRepractice = useCallback(() => {
    // Feature 092: Free practice repractice — delegate to the domain hook
    if (freePractice.isFreePracticeRef.current) {
      freePractice.handleFreeRepractice();
      return;
    }
    setResultsOverlayVisible(false);
    setPartialPerformanceRecord(null);
    handlePracticeToggle();
    remainingLoopsRef.current = loopCount - 1;
    loopIterationRef.current = 0;
    loopStartTimesRef.current = [0];
    setLoopCount(loopCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePracticeToggle, loopCount]);

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

  if (!isLoaded && !freePractice.isFreePractice) {
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
          savedPractices={savedPracticeManager.savedPractices}
          onSelectSavedPractice={savedPracticeManager.handleSelectSavedPractice}
          onDeleteSavedPractice={savedPracticeManager.handleDeleteSavedPractice}
          protectedPracticeIds={savedPracticeManager.protectedPracticeIds}
          protectedPracticeMap={savedPracticeManager.protectedPracticeMap}
          onViewSessions={(sessionId, taskId) => context.openPlugin('sessions-plugin', {
            expandSessionId: sessionId,
            expandTaskId: taskId,
          })}
          onFreePractice={freePractice.handleFreePractice}
        />
      </div>
    );
  }

  return (
    <div className={`practice-plugin${practiceActive ? ' practice-plugin--phantom' : ''}${freePractice.isFreePractice && resultsOverlayVisible ? ' practice-plugin--results' : ''}${!freePractice.isFreePractice && (((practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && performanceRecord)) && resultsOverlayVisible) || (partialPerformanceRecord && resultsOverlayVisible)) ? ' practice-plugin--results' : ''}`} data-testid="practice-plugin-root">
      {/* Toolbar — top */}
      <PracticeToolbar
        scoreTitle={freePractice.isFreePractice ? t('practice.free.title') : playerState.title}
        status={freePractice.isFreePractice ? 'ready' as const : playerState.status}
        currentTick={freePractice.isFreePractice ? Math.round((freePractice.freeElapsedMs / 1000) * (freePractice.freeStaffBpm / 60) * 960) : playerState.currentTick}
        totalDurationTicks={freePractice.isFreePractice ? 0 : playerState.totalDurationTicks}
        bpm={freePractice.isFreePractice ? freePractice.freeStaffBpm : playerState.bpm}
        tempoMultiplier={tempoMultiplier}
        onBack={() => {
          // Feature 092: Exit free practice on back
          if (freePractice.isFreePractice) {
            freePractice.handleFreeBack();
            return;
          }
          handleBack();
        }}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onTempoChange={handleTempoChange}
        staffCount={freePractice.isFreePractice ? 0 : playerState.staffCount}
        selectedStaffIndex={selectedStaffIndex}
        onStaffChange={handleStaffChange}
        practiceMode={freePractice.isFreePractice ? (freePractice.freeSessionActive ? 'active' : 'inactive') : practiceState.mode}
        currentPracticeIndex={(() => {
          if (freePractice.isFreePractice) return 0;
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
          if (freePractice.isFreePractice) return 0;
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
        taskTag={savedPracticeManager.taskTag}
        isReplaying={isReplaying}
        onTaskTagClick={() => context.openPlugin('sessions-plugin', {
          expandSessionId: savedPracticeManager.sessionIdRef.current,
          expandTaskId: savedPracticeManager.taskIdRef.current,
        })}
        isFreePractice={freePractice.isFreePractice}
        freeNoteCount={freePractice.freeNoteCount}
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
      {!freePractice.isFreePractice && (practiceActive || practiceWaiting) &&
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
      {!freePractice.isFreePractice && (
        <div className="practice-plugin__score-area">
          <ScoreRenderer
            currentTick={playerState.currentTick}
            highlightedNoteIds={highlightedNoteIds}
            errorNoteIds={errorNoteIds}
            expectedNoteIds={practiceActive ? targetNoteIds : undefined}
            pinnedNoteIds={
              practiceActive
                ? confirmedNoteIds
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
      {freePractice.isFreePractice && !resultsOverlayVisible && (
        <div className="practice-plugin__score-area practice-plugin__free-canvas" aria-label={t('practice.free.title')}>
          <context.components.StaffViewer
            notes={freePractice.freeDisplayNotes}
            bpm={freePractice.freeStaffBpm}
            timestampOffset={freePractice.freeDisplayOriginMs}
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
          // Feature 092: Dismissing free practice results returns to the score selector.
          if (freePractice.isFreePracticeRef.current) {
            freePractice.handleFreeDismiss();
          }
        }}
        isReplaying={isReplaying}
        replayHighlightedNoteIds={replayHighlightedNoteIds}
        setIsReplaying={setIsReplaying}
        setReplayHighlightedNoteIds={setReplayHighlightedNoteIds}
        onSave={loadedScoreRefRef.current ? savedPracticeManager.handleSave : undefined}
        isSaved={isSaved}
        saveError={saveError}
        onReturnToSession={savedPracticeManager.sessionIdRef.current ? () => context.openPlugin('sessions-plugin', {
          expandSessionId: savedPracticeManager.sessionIdRef.current,
          expandTaskId: savedPracticeManager.taskIdRef.current,
        }) : undefined}
        loopCountLocked={!!savedPracticeManager.taskIdRef.current}
        isFreePractice={freePractice.isFreePractice}
        freeMidiRecord={freePractice.freeMidiRecord}
        onHideOverlay={() => setResultsOverlayVisible(false)}
        onFreeReplay={freePractice.handleFreeReplay}
      />
    </div>
  );
}
