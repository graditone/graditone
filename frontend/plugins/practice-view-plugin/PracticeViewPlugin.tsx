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
import { ResultsOverlay } from './ResultsOverlay';
import type { ScoreRef, SavedPractice, SavedPerformanceData, SavedPracticeIndexEntry } from '../../src/plugin-api/index';
import { savePracticeToIndexedDB, generatePracticeName, loadPracticeFromIndexedDB, deletePracticeFromIndexedDB } from '../../src/plugin-api/index';
import { addSavedPracticeIndex, listSavedPractices, removeSavedPracticeIndex } from '../../src/plugin-api/index';
import './PracticeViewPlugin.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_METRONOME_STATE: MetronomeState = {
  active: false,
  beatIndex: -1,
  isDownbeat: false,
  subdivision: 1,
  bpm: 0,
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

  // ─── Metronome state ───────────────────────────────────────────────────────
  const [metronomeState, setMetronomeState] = useState<MetronomeState>(INITIAL_METRONOME_STATE);
  const [metronomeSubdivision, setMetronomeSubdivision] = useState<MetronomeSubdivision>(1);

  useEffect(() => {
    return context.metronome.subscribe((state) => {
      setMetronomeState(state);
      if (state.subdivision !== undefined) setMetronomeSubdivision(state.subdivision);
    });
  }, [context.metronome]);

  // ─── MIDI connectivity tracking ────────────────────────────────────────────
  // Use Web MIDI API for real-time connect/disconnect detection.
  // IMPORTANT: Uses addEventListener('statechange', ...) instead of assigning
  // access.onstatechange — the browser returns the SAME MIDIAccess singleton
  // from every requestMIDIAccess() call, so assigning onstatechange would
  // overwrite the host's useMidiInput handler and vice-versa, causing MIDI
  // to stop working until browser restart.
  // null = check pending; false = checked, no devices; true = device present.
  const [midiConnected, setMidiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return;
    let midiAccess: MIDIAccess | null = null;
    const nav = navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> };
    const handleStateChange = () => {
      if (midiAccess) setMidiConnected(midiAccess.inputs.size > 0);
    };
    nav.requestMIDIAccess().then((access) => {
      midiAccess = access;
      // Reflect current state immediately
      setMidiConnected(access.inputs.size > 0);
      // Use addEventListener so multiple listeners can coexist on the singleton
      access.addEventListener('statechange', handleStateChange);
    }).catch(() => { /* MIDI permission denied or unavailable */ });
    return () => {
      if (midiAccess) {
        midiAccess.removeEventListener('statechange', handleStateChange);
      }
    };
  }, []);

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
  const [savedPractices, setSavedPractices] = useState<SavedPracticeIndexEntry[]>(() => listSavedPractices());
  // Pending saved practice to restore once the score finishes loading
  const pendingSavedPracticeRef = useRef<SavedPractice | null>(null);

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
    const notesWithFreshIds = saved.performanceData.notes.map((savedNote, i) =>
      i < freshNotes.length ? freshNotes[i] : savedNote,
    );

    if (saved.completionStatus === 'complete') {
      setPerformanceRecord({
        notes: notesWithFreshIds,
        noteResults: saved.performanceData.noteResults,
        wrongNoteEvents: saved.performanceData.wrongNoteEvents,
        bpmAtCompletion: saved.performanceData.bpmAtCompletion,
      });
      setPartialPerformanceRecord(null);
    } else {
      setPartialPerformanceRecord({
        notes: notesWithFreshIds,
        noteResults: saved.performanceData.noteResults,
        wrongNoteEvents: saved.performanceData.wrongNoteEvents,
        bpmAtCompletion: saved.performanceData.bpmAtCompletion,
        stoppedAtIndex: saved.performanceData.stoppedAtIndex ?? 0,
        totalNoteCount: saved.performanceData.totalNoteCount ?? saved.performanceData.notes.length,
      });
      setPerformanceRecord(null);
    }
    setResultsOverlayVisible(true);
    setIsSaved(true);
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
    onComplete: (record) => {
      setPerformanceRecord(record);
      setIsReplaying(false);
    },
    onResultsShow: () => {
      setResultsOverlayVisible(true);
    },
  });

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
    if (!['ready', 'playing', 'paused'].includes(playerState.status)) {
      setSelectedStaffIndex(0);
    }
  }, [playerState.status]);

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
  });

  // ─── Teardown (SC-006) ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      context.scorePlayer.stop();
      context.stopPlayback();
      // Error flash cleanup
      if (errorFlashTimerRef.current !== null) clearTimeout(errorFlashTimerRef.current);
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

  // Playback controls
  const handlePlay = useCallback(() => context.scorePlayer.play(), [context.scorePlayer]);
  const handlePause = useCallback(() => context.scorePlayer.pause(), [context.scorePlayer]);
  const handleStop = useCallback(() => {
    // If a replay is in progress, stop audio and reset replay state
    if (isReplaying) {
      context.stopPlayback();
      setIsReplaying(false);
      setReplayHighlightedNoteIds(new Set());
      return;
    }
    // US7: Snapshot partial results before STOP clears engine state
    const ps = practiceStateRef.current;
    if (ps.mode === 'active' || ps.mode === 'waiting' || ps.mode === 'holding') {
      setPartialPerformanceRecord({
        notes: [...ps.notes],
        noteResults: [...ps.noteResults],
        wrongNoteEvents: [...ps.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
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
    context.metronome.toggle().catch((e) => {
      console.error('[PracticeViewPlugin] metronome.toggle failed:', e);
    });
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
  }, []);

  // Practice toggle (T031, T033, T034)
  const handlePracticeToggle = useCallback(() => {
    setIsSaved(false); // Reset save state for new practice session
    setSaveError(null);
    const ps = practiceStateRef.current;

    if (ps.mode === 'active' || ps.mode === 'waiting' || ps.mode === 'holding') {
      // US7: Snapshot partial results before STOP clears engine state
      setPartialPerformanceRecord({
        notes: [...ps.notes],
        noteResults: [...ps.noteResults],
        wrongNoteEvents: [...ps.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
        stoppedAtIndex: ps.currentIndex,
        totalNoteCount: ps.notes.length,
      });
      setResultsOverlayVisible(true);
      // Stop practice — full reset so restarting begins from the beginning.
      dispatchPractice({ type: 'STOP' });
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
    setLoopCount(1);

    // Reset loop iteration tracking so the progress counter starts from 1/N.
    resetLoopTracking();

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
    // practiceStartTimeRef is set later — when the first correct note is played
    // (deferred start: the clock doesn't start until the user hits the first note).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.scorePlayer,
    selectedStaffIndex,
  ]);

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
  }, [handlePracticeToggle, loopCount]);

  // ─── Feature 056: Save practice handler ──────────────────────────────────────
  const handleSave = useCallback(async () => {
    const scoreRef = loadedScoreRefRef.current;
    if (!scoreRef) return;

    const isComplete = practiceState.mode === 'complete' && !!performanceRecord;
    const isPartial = !!partialPerformanceRecord;
    if (!isComplete && !isPartial) return;

    const now = new Date();
    const id = crypto.randomUUID();
    const scoreTitle = playerState.title ?? 'Untitled';
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
    } catch (e) {
      console.error('[PracticeViewPlugin] Failed to save practice:', e);
      const isQuota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      setSaveError(isQuota ? 'Storage full — delete some saved practices and try again.' : 'Failed to save practice.');
    }
  }, [
    practiceState.mode, performanceRecord, partialPerformanceRecord,
    playerState.title, loopRegion, selectedStaffIndex,
    tempoMultiplier, loopCount,
  ]);

  // ─── Feature 056: Delete saved practice handler ─────────────────────────────
  const handleDeleteSavedPractice = useCallback(async (practiceId: string) => {
    removeSavedPracticeIndex(practiceId);
    await deletePracticeFromIndexedDB(practiceId);
    setSavedPractices(listSavedPractices());
  }, []);

  // ─── Feature 056: Load saved practice handler ──────────────────────────────
  const handleSelectSavedPractice = useCallback(async (entry: SavedPracticeIndexEntry) => {
    const saved = await loadPracticeFromIndexedDB(entry.id);
    if (!saved) {
      console.warn('[PracticeViewPlugin] Saved practice not found in IndexedDB:', entry.id);
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

  if (!isLoaded) {
    // Score selector screen
    return (
      <div className="practice-plugin practice-plugin--selection">
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
        />
      </div>
    );
  }

  return (
    <div className={`practice-plugin${practiceActive ? ' practice-plugin--phantom' : ''}${((practiceState.mode === 'complete' || (practiceState.mode === 'inactive' && performanceRecord)) && resultsOverlayVisible) || (partialPerformanceRecord && resultsOverlayVisible) ? ' practice-plugin--results' : ''}`}>
      {/* Toolbar — top */}
      <PracticeToolbar
        scoreTitle={playerState.title}
        status={playerState.status}
        // showStaffPicker removed — toolbar dropdown is always the selector
        currentTick={playerState.currentTick}
        totalDurationTicks={playerState.totalDurationTicks}
        bpm={playerState.bpm}
        tempoMultiplier={tempoMultiplier}
        onBack={handleBack}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onTempoChange={handleTempoChange}
        staffCount={playerState.staffCount}
        selectedStaffIndex={selectedStaffIndex}
        onStaffChange={handleStaffChange}
        practiceMode={practiceState.mode}
        currentPracticeIndex={(() => {
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
        metronomeActive={metronomeState.active}
        metronomeBeatIndex={metronomeState.beatIndex}
        metronomeIsDownbeat={metronomeState.isDownbeat}
        onMetronomeToggle={handleMetronomeToggle}
        metronomeSubdivision={metronomeSubdivision}
        onMetronomeSubdivisionChange={handleMetronomeSubdivisionChange}
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
      {(practiceActive || practiceWaiting) &&
        practiceState.currentWrongAttempts > 0 && (
        <div className="practice-plugin__note-display" aria-live="polite">
          <span className="practice-plugin__note-display-label">Expected:</span>
          <span className="practice-plugin__note-display-notes practice-plugin__note-display-notes--expected">
            {expectedPitchLabels.join(', ')}
          </span>
          <span className="practice-plugin__note-display-sep">|</span>
          <span className="practice-plugin__note-display-label">Playing:</span>
          <span className="practice-plugin__note-display-notes practice-plugin__note-display-notes--wrong">
            {pressedPitchLabels.join(', ')}
          </span>
        </div>
      )}

      {/* Score */}
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
        onDismiss={() => { setResultsOverlayVisible(false); setPartialPerformanceRecord(null); }}
        isReplaying={isReplaying}
        replayHighlightedNoteIds={replayHighlightedNoteIds}
        setIsReplaying={setIsReplaying}
        setReplayHighlightedNoteIds={setReplayHighlightedNoteIds}
        onSave={loadedScoreRefRef.current ? handleSave : undefined}
        isSaved={isSaved}
        saveError={saveError}
      />
    </div>
  );
}
