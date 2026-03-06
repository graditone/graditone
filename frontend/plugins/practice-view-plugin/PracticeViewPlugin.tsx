/**
 * Practice View Plugin — Root Component (T026, T031–T038)
 * Feature 037: Practice View Plugin
 *
 * Subscribes to scorePlayer state, renders ScoreSelector when idle,
 * and ScoreRenderer + PracticeToolbar when a score is loaded.
 *
 * Practice engine wiring:
 *   T031 — Practice activation (START action)
 *   T032 — MIDI subscription handler (CORRECT_MIDI / WRONG_MIDI)
 *   T033 — Practice deactivation paths (DEACTIVATE, STOP, complete cleanup)
 *   T034 — Staff selection flow (staffCount > 1 picker)
 *   T035 — No-MIDI-device notice (FR-012)
 *   T036 — Seek-based initial practice position (FR-010 US3 AC-1)
 *   T037 — Seek-while-active handler (FR-010 US3 AC-2)
 *
 * Constitution compliance:
 *   Principle VI: no coordinate arithmetic — only integer tick, MIDI (0-127),
 *                 and opaque noteId strings from the Plugin API.
 *   SC-006: context.stopPlayback() and MIDI unsubscribe called on unmount.
 */

import { useState, useEffect, useCallback, useReducer, useRef, useMemo } from 'react';
import type {
  PluginContext,
  ScorePlayerState,
  PluginPlaybackStatus,
  MetronomeState,
  MetronomeSubdivision,
  PluginPracticeNoteEntry,
} from '../../src/plugin-api/index';
import { PracticeToolbar } from './practiceToolbar';
import { reduce } from './practiceEngine';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PracticeNoteResult, WrongNoteEvent } from './practiceEngine.types';
import { ChordDetector } from '../../src/plugin-api/index';
import './PracticeViewPlugin.css';

// ---------------------------------------------------------------------------
// Replay types (T002 — 038-practice-replay)
// ---------------------------------------------------------------------------

/** Frozen snapshot of a completed practice exercise for replay. */
interface PerformanceRecord {
  notes: PluginPracticeNoteEntry[];
  noteResults: PracticeNoteResult[];
  wrongNoteEvents: WrongNoteEvent[];
  bpmAtCompletion: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function midiToLabel(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge practice note entries from multiple staves into a single sorted list.
 *
 * Notes at the same tick are fused into one entry whose `midiPitches` is the
 * union of all per-staff pitches (duplicates removed) and whose `noteIds`
 * concatenates all ids. Used for "Both Clefs" practice mode so the
 * ChordDetector requires every pitch across all staves to be pressed.
 *
 * Principle VI: only integer tick / MIDI values — no coordinates.
 */
function mergePracticeNotesByTick(
  allNotes: PluginPracticeNoteEntry[],
): PluginPracticeNoteEntry[] {
  if (allNotes.length === 0) return [];
  const byTick = new Map<number, { pitches: number[]; noteIds: string[] }>();
  for (const entry of allNotes) {
    const group = byTick.get(entry.tick);
    if (group) {
      for (const p of entry.midiPitches) {
        if (!group.pitches.includes(p)) group.pitches.push(p);
      }
      group.noteIds.push(...entry.noteIds);
    } else {
      byTick.set(entry.tick, {
        pitches: [...(entry.midiPitches as number[])],
        noteIds: [...entry.noteIds],
      });
    }
  }
  return Array.from(byTick.entries())
    .sort(([a], [b]) => a - b)
    .map(([tick, { pitches, noteIds }]) => ({ tick, midiPitches: pitches, noteIds }));
}

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

  // ─── Replay state (038-practice-replay) ────────────────────────────────────
  const [performanceRecord, setPerformanceRecord] = useState<PerformanceRecord | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayHighlightedNoteIds, setReplayHighlightedNoteIds] = useState<ReadonlySet<string>>(new Set());
  const replayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ─── Multi-loop practice state ─────────────────────────────────────────────
  const [loopCount, setLoopCount] = useState(1);
  const remainingLoopsRef = useRef(0);
  /** Completed loop iterations so far (0 = first loop). Used to offset expectedTimeMs. */
  const loopIterationRef = useRef(0);
  /**
   * Wall-clock timestamp (relative to practiceStartTime) when the phantom restarts
   * each loop. Recorded at each LOOP_RESTART so the next iteration can compute
   * the real loop period for expectedTimeMs offset. Index 0 = loop 0 start = 0.
   */
  const loopStartTimesRef = useRef<number[]>([0]);

  // Show overlay each time practice enters 'complete' mode, capture PerformanceRecord (T005)
  useEffect(() => {
    if (practiceState.mode === 'complete') {
      // Multi-loop: if remaining loops > 0, restart at the loop start
      if (remainingLoopsRef.current > 0) {
        remainingLoopsRef.current -= 1;
        loopIterationRef.current += 1;
        // Record the wall-clock time when this new loop starts (relative to practice start)
        const loopStartMs = Date.now() - practiceStartTimeRef.current;
        loopStartTimesRef.current.push(loopStartMs);
        const range = loopPracticeRangeRef.current;
        if (range) {
          dispatchPractice({ type: 'LOOP_RESTART', startIndex: range.startIndex });
          return; // Don't show results yet
        }
      }
      setResultsOverlayVisible(true);
      setPerformanceRecord({
        notes: [...practiceState.notes],
        noteResults: [...practiceState.noteResults],
        wrongNoteEvents: [...practiceState.wrongNoteEvents],
        bpmAtCompletion: playerState.bpm,
      });
      setIsReplaying(false);
    }
  }, [practiceState.mode]);

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

  // ─── Pin / loop state (mirrors play-score) ──────────────────────────────────
  type PinState = { tick: number; noteId: string };
  const [loopStart, setLoopStart] = useState<PinState | null>(null);
  const [loopEndPin, setLoopEndPin] = useState<PinState | null>(null);

  const pinnedNoteIds = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    if (loopStart) ids.add(loopStart.noteId);
    if (loopEndPin) ids.add(loopEndPin.noteId);
    return ids;
  }, [loopStart, loopEndPin]);

  const loopRegion = useMemo(() => {
    if (!loopStart || !loopEndPin || loopStart.tick === loopEndPin.tick) return null;
    return {
      startTick: Math.min(loopStart.tick, loopEndPin.tick),
      endTick: Math.max(loopStart.tick, loopEndPin.tick),
    };
  }, [loopStart, loopEndPin]);

  // Keep a ref so the MIDI handler (closed over once) always sees the current
  // loop region without needing to re-subscribe.
  const loopRegionRef = useRef(loopRegion);
  loopRegionRef.current = loopRegion;

  // ─── Practice loop index range ──────────────────────────────────────────────
  // When a loop region is pinned and practice is active, wrap at the last note
  // inside the region instead of advancing past it.
  // Indices into practiceState.notes[], recomputed whenever loop or notes change.
  type LoopRange = { startIndex: number; endIndex: number };
  const loopPracticeRangeRef = useRef<LoopRange | null>(null);

  useEffect(() => {
    const notes = practiceState.notes;
    if (!loopRegion || notes.length === 0) {
      loopPracticeRangeRef.current = null;
      return;
    }
    const startIndex = notes.findIndex((n) => n.tick >= loopRegion.startTick);
    if (startIndex === -1) { loopPracticeRangeRef.current = null; return; }
    let endIndex = startIndex;
    for (let i = startIndex; i < notes.length; i++) {
      if (notes[i].tick <= loopRegion.endTick) endIndex = i;
      else break;
    }
    loopPracticeRangeRef.current = { startIndex, endIndex };
  }, [loopRegion, practiceState.notes]);

  // Keep a ref to practiceState so MIDI handler always sees latest state
  // without needing to re-subscribe.
  const practiceStateRef = useRef(practiceState);
  practiceStateRef.current = practiceState;

  // Practice session start time (ms since epoch) for timing analysis
  const practiceStartTimeRef = useRef(0);
  // PPQ constant for tick→ms conversion
  const PPQ = 960;

  // ─── Phantom tempo highlight ───────────────────────────────────────────────
  // Advances through practice notes at the configured tempo to show the user
  // where they *should* be. Uses the existing highlighted-note pipeline at 50%
  // opacity (CSS class on root), while the target note uses the green pinned
  // pipeline.
  const [phantomIndex, setPhantomIndex] = useState(-1);
  const phantomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phantomStartTimeRef = useRef(0);
  const phantomNotesRef = useRef<readonly PluginPracticeNoteEntry[]>([]);
  const phantomBpmRef = useRef(0);
  const phantomBaseTickRef = useRef(0);

  // Start/stop phantom timer when practice mode transitions.
  // The timer starts on the first correct note (waiting→active).
  useEffect(() => {
    if (practiceState.mode === 'active' && phantomTimerRef.current === null) {
      // Phantom starts from the note the user just matched.
      const notes = practiceState.notes;
      const startIdx = practiceState.currentIndex;
      phantomNotesRef.current = notes;
      // playerState.bpm already includes tempoMultiplier (scoreTempo × multiplier)
      phantomBpmRef.current = playerState.bpm;
      phantomBaseTickRef.current = notes[startIdx]?.tick ?? notes[0].tick;
      phantomStartTimeRef.current = Date.now();
      setPhantomIndex(startIdx);

      // Advance phantom every ~50 ms by comparing elapsed time
      // against each note's expected tick-based time.
      phantomTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - phantomStartTimeRef.current;
        const bpm = phantomBpmRef.current;
        if (bpm <= 0) return;
        const ticksPerMs = (bpm / 60) * PPQ / 1000;
        const pNotes = phantomNotesRef.current;
        if (pNotes.length === 0) return;
        const currentTick = phantomBaseTickRef.current + elapsed * ticksPerMs;
        // Find the last note whose tick ≤ currentTick
        let idx = 0;
        for (let i = pNotes.length - 1; i >= 0; i--) {
          if (pNotes[i].tick <= currentTick) { idx = i; break; }
        }
        setPhantomIndex(idx);
      }, 50); // ~20 Hz — smooth enough for visual guide
    }

    // Stop phantom timer when practice ends or deactivates
    if (practiceState.mode !== 'active' && phantomTimerRef.current !== null) {
      clearInterval(phantomTimerRef.current);
      phantomTimerRef.current = null;
      setPhantomIndex(-1);
    }
  }, [practiceState.mode, practiceState.notes, practiceState.currentIndex, playerState.bpm]);

  // Cleanup phantom timer on unmount
  useEffect(() => {
    return () => {
      if (phantomTimerRef.current !== null) {
        clearInterval(phantomTimerRef.current);
        phantomTimerRef.current = null;
      }
    };
  }, []);

  // ─── Chord detector ─────────────────────────────────────────────────────────
  // A single instance that accumulates MIDI attack events within an 80 ms
  // rolling window. Reset each time the target note entry changes (either
  // by advancing on CORRECT_MIDI or by SEEK / STOP / DEACTIVATE).
  const chordDetectorRef = useRef(new ChordDetector());

  useEffect(() => {
    const ps = practiceStateRef.current;
    if (ps.mode === 'active' || ps.mode === 'waiting') {
      const entry = ps.notes[ps.currentIndex];
      chordDetectorRef.current.reset(entry ? (entry.midiPitches as number[]) : []);
    } else {
      chordDetectorRef.current.reset([]);
    }
  // practiceState.currentIndex and practiceState.mode are the triggers:
  // mode change covers START / STOP / DEACTIVATE; currentIndex covers CORRECT / SEEK.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceState.currentIndex, practiceState.mode]);

  // ─── All-notes lookup for MIDI visual highlight ────────────────────────────
  // Rebuilt whenever a new score is loaded (status → ready/playing/paused).
  // allNotesRef is a flat list of PracticeNoteEntries from all staves so the
  // MIDI handler can match (tick ≈ currentTick, midiPitch) → noteId.
  const allNotesRef = useRef<PluginPracticeNoteEntry[]>([]);
  const playerStateRef = useRef<ScorePlayerState>(playerState);
  playerStateRef.current = playerState;

  const prevLoadKeyRef = useRef('');
  useEffect(() => {
    const { status, staffCount, title } = playerState;
    const loadKey = `${status}:${staffCount}:${title ?? ''}`;
    if (!['ready', 'playing', 'paused'].includes(status) || staffCount === 0) {
      allNotesRef.current = [];
      prevLoadKeyRef.current = '';
      return;
    }
    if (loadKey === prevLoadKeyRef.current) return;
    prevLoadKeyRef.current = loadKey;
    const all: PluginPracticeNoteEntry[] = [];
    for (let s = 0; s < staffCount; s++) {
      const pitches = context.scorePlayer.extractPracticeNotes(s);
      if (pitches) all.push(...(pitches.notes as PluginPracticeNoteEntry[]));
    }
    allNotesRef.current = all;
  }, [playerState.status, playerState.staffCount, playerState.title, context.scorePlayer]);

  // MIDI-pressed note IDs — cleared on key release, merged into highlightedNoteIds
  const [midiPressedNoteIds, setMidiPressedNoteIds] = useState<ReadonlySet<string>>(new Set());

  // ─── Teardown (SC-006) ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      context.scorePlayer.stop();
      context.stopPlayback();
      // Replay cleanup (038-practice-replay, T017)
      replayTimersRef.current.forEach(clearTimeout);
      replayTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── MIDI subscription (T032) ──────────────────────────────────────────────
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (event.type === 'release') {
        // Relay release for natural key-up audio and clear visual highlight
        context.playNote({ midiNote: event.midiNote, timestamp: event.timestamp, type: 'release' });
        setMidiPressedNoteIds(new Set());
        return;
      }
      if (event.type !== 'attack') return;

      // Play the note through the host audio engine
      context.playNote({
        midiNote: event.midiNote,
        timestamp: event.timestamp,
        type: 'attack',
        durationMs: event.durationMs ?? 500,
      });

      // Visual highlight: find notes at/near the current playhead tick
      // that match the pressed MIDI pitch and show them in the score.
      const TICK_WINDOW = 240; // ½ beat at 480 ppq — generous tolerance
      const currentTick = playerStateRef.current.currentTick;
      const matching = allNotesRef.current.filter(
        (e) =>
          Math.abs(e.tick - currentTick) <= TICK_WINDOW &&
          (e.midiPitches as number[]).includes(event.midiNote),
      );
      if (matching.length > 0) {
        const ids: string[] = [];
        for (const e of matching) {
          const idx = (e.midiPitches as number[]).indexOf(event.midiNote);
          if (idx >= 0 && idx < e.noteIds.length) ids.push(e.noteIds[idx]);
        }
        if (ids.length > 0) setMidiPressedNoteIds(new Set(ids));
      }

      const ps = practiceStateRef.current;
      if (ps.mode !== 'active' && ps.mode !== 'waiting') return;

      const currentEntry = ps.notes[ps.currentIndex];
      if (!currentEntry) return;

      // Chord detection: accumulate this press in the rolling window.
      // Only dispatch CORRECT_MIDI once ALL required pitches have been
      // pressed within the 80 ms window. A press of a pitch outside the
      // required set is still a WRONG_MIDI (no advance).
      const chordResult = chordDetectorRef.current.press(event.midiNote, event.timestamp);
      const isInChord = (currentEntry.midiPitches as number[]).includes(event.midiNote);
      if (chordResult.complete) {
        // All chord notes collected — advance.
        // Deferred start: if in 'waiting' mode, set the start time NOW
        // (first correct note begins the clock).
        if (ps.mode === 'waiting') {
          practiceStartTimeRef.current = Date.now();
        }
        // Compute timing data for the result
        // playerState.bpm already includes tempoMultiplier (scoreTempo × multiplier)
        const bpm = playerStateRef.current.bpm;
        const baseExpectedTimeMs = bpm > 0
          ? (currentEntry.tick / ((bpm / 60) * PPQ)) * 1000
          : 0;
        // In multi-loop practice, compute expectedTimeMs relative to the real
        // wall-clock time when the phantom restarted this loop iteration.
        // This accounts for the last-note duration that MusicTimeline adds
        // before wrapping, which is not reflected in loopRegion tick span.
        const lr = loopRegionRef.current;
        const loopK = loopIterationRef.current;
        let expectedTimeMs: number;
        if (lr && loopK > 0 && bpm > 0) {
          // Time from loop start tick to this note's tick within the loop
          const loopStartBaseMs = (lr.startTick / ((bpm / 60) * PPQ)) * 1000;
          const timeWithinLoop = baseExpectedTimeMs - loopStartBaseMs;
          // Wall-clock time when this loop iteration started
          const loopStartMs = loopStartTimesRef.current[loopK] ?? 0;
          expectedTimeMs = loopStartMs + timeWithinLoop;
        } else {
          expectedTimeMs = baseExpectedTimeMs;
        }
        const responseTimeMs = ps.mode === 'waiting' ? 0 : Date.now() - practiceStartTimeRef.current;
        const range = loopPracticeRangeRef.current;
        dispatchPractice({
          type: 'CORRECT_MIDI',
          midiNote: event.midiNote,
          responseTimeMs,
          expectedTimeMs,
          endIndex: range?.endIndex,
        });
      } else if (!isInChord) {
        // Pitch outside the required chord — treat as wrong note.
        const wrongResponseTimeMs = ps.mode === 'waiting' ? 0 : Date.now() - practiceStartTimeRef.current;
        dispatchPractice({ type: 'WRONG_MIDI', midiNote: event.midiNote, responseTimeMs: wrongResponseTimeMs });
      }
      // If isInChord but not yet complete: partial chord press — stay silent
      // (don't penalise the user, just wait for remaining notes).
    });
  }, [context.midi, context]);

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
      context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId });
    },
    [context.scorePlayer],
  );

  // Load a file
  const handleLoadFile = useCallback(
    (file: File) => {
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
    dispatchPractice({ type: 'STOP' });
    context.scorePlayer.stop();
  }, [context.scorePlayer]);

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
    const ps = practiceStateRef.current;

    if (ps.mode === 'active' || ps.mode === 'waiting') {
      // Re-press while active/waiting → deactivate (T033)
      dispatchPractice({ type: 'DEACTIVATE' });
      return;
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
    // otherwise fall back to the current seek position (T036: FR-010).
    const lr = loopRegionRef.current;
    const currentTick = lr ? lr.startTick : ps2.currentTick;
    let startIndex = 0;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].tick >= currentTick) {
        startIndex = i;
        break;
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
  }, [
    context.scorePlayer,
    selectedStaffIndex,
  ]);

  // Note short-tap handler (US3 / T037)
  // Mirrors play-score two-tap seek-then-play state machine:
  //   • Practice active  → SEEK to nearest note entry
  //   • Not playing      → seekToTick; second tap while paused → also play()
  //   • Playing          → seekToTick (mid-playback navigation)
  const handleNoteShortTap = useCallback(
    (tick: number, _noteId: string) => {
      if (practiceStateRef.current.mode === 'active' || practiceStateRef.current.mode === 'waiting') {
        // Find nearest note entry by tick
        const notes = practiceStateRef.current.notes;
        let bestIndex = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < notes.length; i++) {
          const diff = Math.abs(notes[i].tick - tick);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = i;
          }
        }
        dispatchPractice({ type: 'SEEK', index: bestIndex });
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

  // Long press — pin/loop state machine (mirrors play-score)
  const handleNoteLongPress = useCallback(
    (tick: number, noteId: string | null) => {
      const isPlaying = playerState.status === 'playing';

      // Tap inside active loop region → clear all pins
      if (loopRegion && tick >= loopRegion.startTick && tick <= loopRegion.endTick) {
        setLoopStart(null);
        setLoopEndPin(null);
        context.scorePlayer.setPinnedStart(null);
        context.scorePlayer.setLoopEnd(null);
        return;
      }

      if (loopStart === null) {
        // First long-press: pin the start
        const id = noteId ?? '';
        setLoopStart({ tick, noteId: id });
        if (!isPlaying) context.scorePlayer.setPinnedStart(tick);
      } else if (loopStart.noteId === noteId || loopStart.tick === tick) {
        // Same note / same tick: unpin
        setLoopStart(null);
        setLoopEndPin(null);
        context.scorePlayer.setPinnedStart(null);
        context.scorePlayer.setLoopEnd(null);
      } else {
        // Second long-press on a different note: create loop end
        const id = noteId ?? '';
        setLoopEndPin({ tick, noteId: id });
        if (!isPlaying) context.scorePlayer.setLoopEnd(tick);
      }
    },
    [context.scorePlayer, loopStart, loopRegion, playerState.status],
  );

  // Return to start — respects loop start pin when set
  const handleReturnToStart = useCallback(() => {
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

  // ─── Replay handlers (038-practice-replay, T015–T016) ─────────────────────

  const handleReplayStop = useCallback(() => {
    context.stopPlayback();
    replayTimersRef.current.forEach(clearTimeout);
    replayTimersRef.current = [];
    setReplayHighlightedNoteIds(new Set());
    setIsReplaying(false);
  }, [context]);

  const handleReplay = useCallback(() => {
    if (!performanceRecord || isReplaying) return;
    setIsReplaying(true);

    const msPerBeat = 60_000 / performanceRecord.bpmAtCompletion;
    const msPerNote = msPerBeat * 0.85;

    // Build a merged timeline: correct notes + wrong notes, sorted by responseTimeMs
    type ReplayEvent = { responseTimeMs: number; midiNote: number; isCorrect: boolean; noteIndex: number };
    const timeline: ReplayEvent[] = [];

    for (const result of performanceRecord.noteResults) {
      timeline.push({
        responseTimeMs: result.responseTimeMs,
        midiNote: result.playedMidi,
        isCorrect: true,
        noteIndex: result.noteIndex,
      });
    }
    for (const wrong of performanceRecord.wrongNoteEvents) {
      timeline.push({
        responseTimeMs: wrong.responseTimeMs,
        midiNote: wrong.midiNote,
        isCorrect: false,
        noteIndex: wrong.noteIndex,
      });
    }
    timeline.sort((a, b) => a.responseTimeMs - b.responseTimeMs);

    // Schedule all audio events at once — offsetMs staggers them
    for (const event of timeline) {
      context.playNote({
        midiNote: event.midiNote,
        timestamp: Date.now(),
        type: 'attack',
        offsetMs: event.responseTimeMs,
        durationMs: msPerNote,
      });
    }

    // Schedule per-note staff highlights (correct notes only)
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const event of timeline) {
      if (!event.isCorrect) continue;
      const noteIds = performanceRecord.notes[event.noteIndex]?.noteIds ?? [];
      const t = setTimeout(() => {
        setReplayHighlightedNoteIds(new Set(noteIds));
      }, event.responseTimeMs);
      timers.push(t);
    }

    // Finish timer — auto-stop after last event + note duration + buffer
    const lastMs = timeline.length > 0 ? timeline[timeline.length - 1].responseTimeMs : 0;
    const totalMs = lastMs + msPerNote + 300;
    const finishTimer = setTimeout(() => {
      context.stopPlayback();
      timers.forEach(clearTimeout);
      setReplayHighlightedNoteIds(new Set());
      setIsReplaying(false);
    }, totalMs);
    timers.push(finishTimer);

    replayTimersRef.current = timers;
  }, [context, performanceRecord, isReplaying]);

  const handleRepractice = useCallback(() => {
    if (isReplaying) handleReplayStop();
    remainingLoopsRef.current = loopCount - 1;
    loopIterationRef.current = 0;
    loopStartTimesRef.current = [0];
    setResultsOverlayVisible(false);
    handlePracticeToggle();
  }, [isReplaying, handleReplayStop, handlePracticeToggle, loopCount]);

  // ─── Derived values ────────────────────────────────────────────────────────

  // During active practice:
  //   highlightedNoteIds = phantom tempo position (amber, 50% opacity via CSS)
  //   pinnedNoteIds      = current target note (green = "play this")
  // During waiting:
  //   highlightedNoteIds = target note (amber, full — no phantom yet)
  // Otherwise:
  //   highlightedNoteIds = playback engine highlight / MIDI visual highlight
  const practiceActive = practiceState.mode === 'active' && practiceState.notes.length > 0;
  const practiceWaiting = practiceState.mode === 'waiting' && practiceState.notes.length > 0;

  const highlightedNoteIds = isReplaying && replayHighlightedNoteIds.size > 0
    ? replayHighlightedNoteIds
    : practiceActive && phantomIndex >= 0 && phantomIndex < practiceState.notes.length
    ? new Set<string>(practiceState.notes[phantomIndex].noteIds)
    : practiceWaiting
      ? new Set<string>(practiceState.notes[practiceState.currentIndex].noteIds)
      : midiPressedNoteIds.size > 0
        ? new Set<string>([...playerState.highlightedNoteIds, ...midiPressedNoteIds])
        : playerState.highlightedNoteIds;

  // Target note IDs (green pinned) — shown only during active practice.
  const targetNoteIds = useMemo<ReadonlySet<string>>(() => {
    if (practiceActive) {
      return new Set<string>(practiceState.notes[practiceState.currentIndex].noteIds);
    }
    return new Set<string>();
  }, [practiceActive, practiceState.notes, practiceState.currentIndex]);

  const isLoaded = ['ready', 'playing', 'paused'].includes(playerState.status);

  // ─── Results computation ───────────────────────────────────────────────────
  const practiceReport = useMemo(() => {
    const results = practiceState.noteResults;
    if (results.length === 0) return null;

    const totalNotes = results.length;
    const correctCount = results.filter((r) => r.outcome === 'correct').length;
    const lateCount = results.filter((r) => r.outcome === 'correct-late').length;
    const totalWrongAttempts = results.reduce((sum, r) => sum + r.wrongAttempts, 0);

    // Score: penalise late notes (half credit) and wrong attempts
    const rawScore =
      totalNotes > 0
        ? Math.round(
            ((correctCount + lateCount * 0.5) / totalNotes) * 100 -
              Math.min(totalWrongAttempts * 2, 30),
          )
        : 0;
    const score = Math.max(0, Math.min(100, rawScore));

    // Timing: last note response time vs expected time of last note
    const lastResult = results[results.length - 1];
    const practiceTimeMs = lastResult.responseTimeMs;
    const scoreTimeMs = lastResult.expectedTimeMs;

    return {
      totalNotes,
      correctCount,
      lateCount,
      totalWrongAttempts,
      score,
      practiceTimeMs,
      scoreTimeMs,
      results,
    };
  }, [practiceState.noteResults]);

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
        />
      </div>
    );
  }

  return (
    <div className={`practice-plugin${practiceActive ? ' practice-plugin--phantom' : ''}${practiceState.mode === 'complete' && resultsOverlayVisible ? ' practice-plugin--results' : ''}`}>
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
          const range = loopPracticeRangeRef.current;
          if (range && practiceState.mode === 'active') {
            const notesInLoop = range.endIndex - range.startIndex + 1;
            const completedLoops = Math.max(0, (loopCount - 1) - remainingLoopsRef.current);
            return completedLoops * notesInLoop + (practiceState.currentIndex - range.startIndex);
          }
          return practiceState.currentIndex;
        })()}
        totalPracticeNotes={(() => {
          const range = loopPracticeRangeRef.current;
          if (range && practiceState.mode === 'active') {
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

      {/* Score */}
      <div className="practice-plugin__score-area">
        <ScoreRenderer
          currentTick={playerState.currentTick}
          highlightedNoteIds={highlightedNoteIds}
          pinnedNoteIds={
            practiceActive
              ? targetNoteIds    // green = "play this note" during practice
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

      {/* Results overlay — shown when practice finishes */}
      {practiceState.mode === 'complete' && resultsOverlayVisible && practiceReport && (
        <>
          <div
            className="practice-results__backdrop"
          />
          <div
            className="practice-results"
            role="region"
            aria-label="Practice results"
          >
            <button
              className="practice-results__close"
              aria-label="Close results"
              onClick={() => setResultsOverlayVisible(false)}
            >
              ×
            </button>

            {/* Score headline */}
            <div className="practice-results__score-block">
              <div className="practice-results__score-ring">
                <span
                  className="practice-results__score-number"
                  style={{
                    color:
                      practiceReport.score >= 90 ? '#2e7d32'
                      : practiceReport.score >= 60 ? '#f57f17'
                      : '#c62828',
                  }}
                >
                  {practiceReport.score}
                </span>
                <span className="practice-results__score-label">/ 100</span>
              </div>
              <div
                className="practice-results__score-grade"
                style={{
                  color:
                    practiceReport.score >= 90 ? '#2e7d32'
                    : practiceReport.score >= 60 ? '#f57f17'
                    : '#c62828',
                }}
              >
                {practiceReport.score === 100 ? '🏆 Perfect!'
                  : practiceReport.score >= 90 ? '🌟 Excellent!'
                  : practiceReport.score >= 70 ? '👍 Good job!'
                  : practiceReport.score >= 50 ? '💪 Keep going!'
                  : '🎯 Keep practicing!'}
              </div>
            </div>

            {/* Summary stats */}
            <div className="practice-results__stats">
              <div className="practice-results__stat">
                <span className="practice-results__stat-value">{practiceReport.totalNotes}</span>
                <span className="practice-results__stat-label">Notes</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value">{practiceReport.correctCount}</span>
                <span className="practice-results__stat-label">Correct</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value practice-results__stat-value--warn">
                  {practiceReport.lateCount}
                </span>
                <span className="practice-results__stat-label">Off-beat</span>
              </div>
              <div className="practice-results__stat">
                <span className="practice-results__stat-value practice-results__stat-value--error">
                  {practiceReport.totalWrongAttempts}
                </span>
                <span className="practice-results__stat-label">Wrong</span>
              </div>
            </div>

            {/* Time comparison */}
            <div className="practice-results__time-comparison">
              <span>Your time: <strong>{formatTimeMs(practiceReport.practiceTimeMs)}</strong></span>
              <span className="practice-results__time-separator">vs</span>
              <span>Score time: <strong>{formatTimeMs(practiceReport.scoreTimeMs)}</strong></span>
            </div>

            {/* Collapsible per-note details */}
            <details className="practice-results__details">
              <summary className="practice-results__details-summary">
                Note-by-note details
              </summary>
              <div className="practice-results__table-wrapper">
                <table className="practice-results__table" aria-label="Per-note results">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Expected</th>
                      <th>Played</th>
                      <th>Status</th>
                      <th>Wrong tries</th>
                      <th>Timing Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practiceReport.results.map((r: PracticeNoteResult, i: number) => (
                      <tr
                        key={i}
                        className={`practice-results__row practice-results__row--${r.outcome}`}
                      >
                        <td>{i + 1}</td>
                        <td>{r.expectedMidi.map(midiToLabel).join('+')}</td>
                        <td>{r.playedMidi > 0 ? midiToLabel(r.playedMidi) : '—'}</td>
                        <td>
                          <span className="practice-results__status-icon">
                            {r.outcome === 'correct' ? '✅'
                              : r.outcome === 'correct-late' ? '⏱️'
                              : '❌'}
                          </span>{' '}
                          {r.outcome === 'correct' ? 'Correct'
                            : r.outcome === 'correct-late' ? 'Off-beat'
                            : 'Wrong'}
                        </td>
                        <td>{r.wrongAttempts > 0 ? r.wrongAttempts : '—'}</td>
                        <td>
                          {r.relativeDeltaMs !== 0
                            ? `${r.relativeDeltaMs > 0 ? '+' : ''}${r.relativeDeltaMs} ms`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {/* Delay evolution graph — SVG line chart of timing deviation per note (incremental, X=real time) */}
            {(() => {
              const delayData = practiceReport.results
                .map((r: PracticeNoteResult, i: number) => ({
                  index: i, delay: r.relativeDeltaMs, timeMs: r.responseTimeMs,
                }));

              if (delayData.length < 2) return null;

              const totalMs = Math.max(delayData[delayData.length - 1].timeMs, 1);

              const W = 320;    // SVG width
              const H = 140;    // SVG height
              const PAD_L = 40; // left padding for Y labels
              const PAD_R = 10;
              const PAD_T = 16;
              const PAD_B = 24; // bottom padding for X labels

              const chartW = W - PAD_L - PAD_R;
              const chartH = H - PAD_T - PAD_B;

              const delays = delayData.map((d) => d.delay);
              const yMax = Math.max(Math.max(...delays), 50);
              const yMin = Math.min(Math.min(...delays), -50);

              const xScale = (ms: number) => PAD_L + (ms / totalMs) * chartW;
              const yScale = (v: number) => PAD_T + ((yMax - v) / (yMax - yMin)) * chartH;

              const polyline = delayData
                .map((d) => `${xScale(d.timeMs).toFixed(1)},${yScale(d.delay).toFixed(1)}`)
                .join(' ');

              const zeroY = yScale(0);

              // Pick a "nice" tick interval in seconds
              const totalSec = totalMs / 1000;
              const rawStep = totalSec / 6;
              const niceSteps = [0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120];
              const tickStepSec = niceSteps.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 10) * 10;
              const xTicks: number[] = [];
              for (let s = 0; s <= totalSec + tickStepSec * 0.01; s += tickStepSec) {
                xTicks.push(Math.min(s, totalSec));
                if (s >= totalSec) break;
              }

              return (
                <details className="practice-results__details" style={{ marginTop: '8px' }}>
                  <summary className="practice-results__details-summary">
                    Timing deviation per note
                  </summary>
                  <div className="practice-results__graph-wrapper">
                    <svg
                      viewBox={`0 0 ${W} ${H}`}
                      width="100%"
                      height={H}
                      aria-label="Delay evolution graph"
                      role="img"
                      style={{ display: 'block', maxWidth: `${W}px`, margin: '8px auto 0' }}
                    >
                      {/* Zero line */}
                      <line
                        x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY}
                        stroke="#bbb" strokeWidth="1" strokeDasharray="4 2"
                      />
                      {/* Y axis labels */}
                      <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" fontSize="9" fill="#888">
                        +{yMax}ms
                      </text>
                      <text x={PAD_L - 4} y={zeroY + 3} textAnchor="end" fontSize="9" fill="#888">
                        0
                      </text>
                      <text x={PAD_L - 4} y={PAD_T + chartH - 2} textAnchor="end" fontSize="9" fill="#888">
                        {yMin}ms
                      </text>
                      {/* X axis time ticks */}
                      {xTicks.map((sec) => {
                        const x = xScale(sec * 1000);
                        const label = Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`;
                        return (
                          <g key={sec}>
                            <line x1={x} y1={PAD_T + chartH} x2={x} y2={PAD_T + chartH + 3} stroke="#ccc" strokeWidth="1" />
                            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#888">
                              {label}
                            </text>
                          </g>
                        );
                      })}
                      {/* Area fill */}
                      <polygon
                        points={`${xScale(delayData[0].timeMs).toFixed(1)},${zeroY} ${polyline} ${xScale(totalMs).toFixed(1)},${zeroY}`}
                        fill="rgba(245, 163, 64, 0.15)"
                      />
                      {/* Line */}
                      <polyline
                        points={polyline}
                        fill="none"
                        stroke="#F5A340"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      {/* Dots for off-beat notes */}
                      {delayData.map((d, i) => {
                        const r = practiceReport.results[d.index];
                        if (r.outcome !== 'correct-late') return null;
                        return (
                          <circle
                            key={i}
                            cx={xScale(d.timeMs)}
                            cy={yScale(d.delay)}
                            r="3"
                            fill="#f57f17"
                          />
                        );
                      })}
                    </svg>
                  </div>
                </details>
              );
            })()}

            {/* Replay / Stop button (038-practice-replay, T018) */}
            {performanceRecord && (
              <div className="practice-results__replay-row">
                <button
                  className="practice-results__repractice-btn"
                  onClick={handleRepractice}
                  aria-label="Repractice"
                >
                  ↺ Repractice
                </button>
                {!isReplaying ? (
                  <button
                    className="practice-results__replay-btn"
                    onClick={handleReplay}
                    aria-label="Replay your performance"
                  >
                    ▶ Replay
                  </button>
                ) : (
                  <button
                    className="practice-results__replay-btn practice-results__replay-btn--stop"
                    onClick={handleReplayStop}
                    aria-label="Stop replay"
                  >
                    ■ Stop
                  </button>
                )}
              </div>
            )}

            {/* Loop count slider — only shown when a loop region is active */}
            {loopRegion && (
              <div className="practice-results__loop-slider-row" aria-label="Loop count">
                <label className="practice-results__loop-label">
                  Loops: <strong>{loopCount}</strong>
                </label>
                <input
                  type="range"
                  className="practice-results__loop-slider"
                  min={1}
                  max={10}
                  step={1}
                  value={loopCount}
                  onChange={(e) => setLoopCount(Number(e.target.value))}
                  aria-label="Number of loops to practice"
                />
              </div>
            )}

            <p className="practice-results__hint">
              Press <strong>♩ Practice</strong> to try again
            </p>
          </div>
        </>
      )}
    </div>
  );
}
