/**
 * TrainPlugin.tsx — Feature 036: Rename Practice Plugin to Train
 *
 * Main component for the Train plugin. Uses ONLY context.* API — no imports
 * from src/services/, src/components/, or src/wasm/ are permitted (ESLint boundary).
 *
 * Layout: header + tips banner + collapsible sidebar config + main (staves, controls, results)
 * Matches the visual design of the original PracticeView component.
 *
 * Phase state machine: ready → countdown → playing → results
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PluginContext, PluginPitchEvent, PluginNoteEvent, PluginScorePitches, ScorePlayerState, MetronomeState, MetronomeSubdivision } from '../../src/plugin-api/index';
import type {
  TrainPhase,
  TrainExercise,
  ExerciseConfig,
  ExerciseResult,
  ExerciseNote,
  ResponseNote,
  NoteComparisonStatus,
  ActiveComplexityLevel,
  ComplexityLevel,
} from './trainTypes';
import { COMPLEXITY_PRESETS, COMPLEXITY_LEVEL_STORAGE_KEY } from './trainTypes';
import { generateExercise, generateScoreExercise, generateScaleExercise, DEFAULT_EXERCISE_CONFIG, SCALE_OPTIONS } from './exerciseGenerator';
import { scoreCapture } from './exerciseScorer';
import './TrainPlugin.css';
import { TrainVirtualKeyboard } from './TrainVirtualKeyboard';

// ─── Hz/MIDI helpers ──────────────────────────────────────────────────────────

/** Convert a frequency in Hz to the nearest integer MIDI note number. */
function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

/** Convert hz to fractional MIDI cents for scoring. */
function hzToMidiCents(hz: number): number {
  return 12 * Math.log2(hz / 440) * 100 + 6900;
}

/** MIDI note number to friendly label (C4, D#5 …) */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// ─── Pitch onset detection constants (mirrors usePracticeRecorder) ────────────

/** Consecutive identical-pitch frames required before committing a note onset */
const PITCH_STABLE_FRAMES = 3;
/** Consecutive null/silent frames required before finalising the current note */
const SILENCE_STABLE_FRAMES = 5;
/** Minimum MIDI note accepted (C2 = 36) — rejects ultrasonic artefacts */
const CAPTURE_MIDI_MIN = 36;
/** Maximum MIDI note accepted (C6 = 84) — rejects ultrasonic artefacts */
const CAPTURE_MIDI_MAX = 84;
/** Minimum confidence threshold — pitchy readings below this are treated as silence */
const MIN_CONFIDENCE = 0.8;
/** Milliseconds to ignore mic input right after playing a step note (speaker feedback guard) */
const STEP_INPUT_DELAY_MS = 700;

// ─── Countdown steps ──────────────────────────────────────────────────────────

const COUNTDOWN_STEPS = ['3', '2', '1', 'Go!'];

// ─── Component ────────────────────────────────────────────────────────────────

export interface TrainPluginProps {
  context: PluginContext;
}

export function TrainPlugin({ context }: TrainPluginProps) {
  // ── Complexity level state ──────────────────────────────────────────────────
  const [complexityLevel, setComplexityLevel] = useState<ActiveComplexityLevel>('low');

  // ── Config & BPM state ─────────────────────────────────────────────────────
  const [config, setConfig] = useState<ExerciseConfig>({ ...DEFAULT_EXERCISE_CONFIG });
  const [bpmValue, setBpmValue] = useState(80);

  // ── Exercise state ──────────────────────────────────────────────────────────
  const [exercise, setExercise] = useState<TrainExercise>(
    () => generateExercise(80, DEFAULT_EXERCISE_CONFIG),
  );

  // ── Phase state ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<TrainPhase>('ready');
  const [countdownStep, setCountdownStep] = useState<string>('');
  const [result, setResult] = useState<ExerciseResult | null>(null);
  // Current exercise slot being highlighted on the exercise staff (null = none)
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(null);
  // Step mode wrong-note hint
  const [stepHint, setStepHint] = useState<{ text: string; color: string } | null>(null);

  // ── Input source ──────────────────────────────────────────────────────────────
  // 'midi' when MIDI keyboard is detected, 'mic' when microphone provides input,
  // 'virtual-keyboard' when the on-screen keyboard panel is open (Feature 001).
  // MIDI takes priority: once a MIDI note is received, mic events are ignored for scoring.
  const [inputSource, setInputSource] = useState<'midi' | 'mic' | 'virtual-keyboard' | null>(null);
  const inputSourceRef = useRef<'midi' | 'mic' | 'virtual-keyboard' | null>(null);

  // ── Virtual keyboard panel state (Feature 001) ────────────────────────────────
  // virtualKeyboardOpen tracks panel visibility; closing it restores the previous
  // physical source. No persistence — resets to false on every plugin mount (FR-009).
  const [virtualKeyboardOpen, setVirtualKeyboardOpen] = useState(false);
  /** Saves the physical input source in use before the virtual keyboard was opened. */
  const prevPhysicalSourceRef = useRef<'midi' | 'mic' | null>(null);

  // ── Mic state ────────────────────────────────────────────────────────────────
  const [micActive, setMicActive] = useState<boolean | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // ── Score preset state ────────────────────────────────────────────────────────
  const [scorePitches, setScorePitches] = useState<PluginScorePitches | null>(null);
  const [showScoreSelector, setShowScoreSelector] = useState(false);
  const [scorePlayerState, setScorePlayerState] = useState<ScorePlayerState>({
    status: 'idle', currentTick: 0, totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(), bpm: 0, title: null, error: null,
    timeSignature: { numerator: 4, denominator: 4 }, staffCount: 0,
  });
  const scorePitchesRef = useRef<PluginScorePitches | null>(null);
  const savedCustomRef = useRef<{ config: ExerciseConfig; bpm: number } | null>(null);

  // Feature 035: Metronome state
  const [metronomeState, setMetronomeState] = useState<MetronomeState>({
    active: false, beatIndex: -1, isDownbeat: false, bpm: 0, subdivision: 1,
  });

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showTips, setShowTips] = useState(
    () => sessionStorage.getItem('train-tips-v1-dismissed') !== 'yes',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  // Controls whether the results overlay is visible on mobile landscape.
  // Resets to true each time results phase is entered; can be dismissed by
  // tapping the backdrop so the user can see the staff underneath.
  const [resultsOverlayVisible, setResultsOverlayVisible] = useState(true);

  // Sound toggle — muting silences guide notes without affecting user MIDI feedback
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);

  // Live response notes for display
  const [responseNoteEvents, setResponseNoteEvents] = useState<PluginNoteEvent[]>([]);
  // Absolute timestamp of when the current exercise playback started (for WASM layout)
  const [playStartMs, setPlayStartMs] = useState(0);

  // ── Computed: exercise note events for the staff ────────────────────────────
  const exerciseNoteEvents = useMemo<PluginNoteEvent[]>(() =>
    exercise.notes.map((n) => ({
      midiNote: n.midiPitch,
      timestamp: n.expectedOnsetMs,
      type: 'attack' as const,
      durationMs: (60_000 / exercise.bpm) * 0.85,
    })),
    [exercise],
  );

  // ── Refs ─────────────────────────────────────────────────────────────────────
  /** Ref on the exercise staff block — used for step-mode autoscroll. */
  const exerciseStaffRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<ResponseNote[]>([]);
  const playStartMsRef = useRef<number>(0);
  const phaseRef = useRef<TrainPhase>('ready');
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exerciseRef = useRef<TrainExercise>(exercise);

  // ── Onset detection state (mirrors usePracticeRecorder) ──────────────────────
  // These refs track the debounced pitch stream so we emit one ResponseNote per
  // discrete note onset rather than one entry per raw AudioWorklet frame.
  const pitchStableCountRef = useRef(0);
  const silenceStableCountRef = useRef(0);
  const lastCommittedMidiRef = useRef<number | null>(null);
  /** Pending note — pitch confirmed stable but not yet finalised (waiting for silence / pitch change) */
  const pendingNoteRef = useRef<ResponseNote | null>(null);

  // ── Step mode refs ──────────────────────────────────────────────────────────
  /** Current slot index in step mode */
  const stepIndexRef = useRef(0);
  /** Last MIDI note acted on — debounce to prevent re-triggering same note */
  const lastStepMidiRef = useRef<number | null>(null);
  /** Timestamp of last note played in step mode (speaker feedback guard) */
  const stepLastPlayTimeRef = useRef<number>(0);
  /** Slots penalised at least once (wrong note or timeout) */
  const stepPenalizedSlotsRef = useRef<Set<number>>(new Set());
  /** Maps slot index → wrong MIDI played (step mode) — used for pitch deviation in results */
  const stepWrongMidiMapRef = useRef<Map<number, number>>(new Map());
  /** setTimeout id for the current slot's deadline timer */
  const stepSlotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** setTimeout id for the debounce reset after advancing a slot */
  const stepDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** setTimeout ids for flow-mode per-slot highlight timers */
  const highlightTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Prevents auto-start from firing more than once per ready phase */
  const autoStartedRef = useRef(false);
  /** Stable ref to the current handleStepInput function */
  const handleStepInputRef = useRef<(midi: number) => void>(() => {});
  /** Stable ref to the current handleStartStep function */
  const handleStartStepRef = useRef<() => void>(() => {});
  // Stable config/bpm refs for use in callbacks (avoids stale closures)
  const configRef = useRef<ExerciseConfig>({ ...DEFAULT_EXERCISE_CONFIG });
  const bpmRef = useRef(80);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { bpmRef.current = bpmValue; }, [bpmValue]);

  // Stable ref to handlePlay — lets MIDI subscription auto-start without stale closure
  const handlePlayRef = useRef<() => void>(() => {});

  /**
   * Shared MIDI-attack scoring handler (Feature 001).
   *
   * Encapsulates the auto-start + scoring pipeline so both the physical
   * context.midi.subscribe handler AND the virtual keyboard onKeyDown route
   * call identical logic (R-003).  Audio playback is NOT performed here:
   * - Physical MIDI handler adds its own context.playNote call after this ref.
   * - Virtual keyboard component calls context.playNote directly (always-audible,
   *   FR-006) before propagating up to this ref via the parent's onKeyDown prop.
   */
  const handleMidiAttackRef = useRef<(midiNote: number, timestamp: number) => void>(() => {});
  useEffect(() => {
    handleMidiAttackRef.current = (midiNote: number, timestamp: number) => {
      // Auto-start: first note in ready phase triggers exercise start
      if (phaseRef.current === 'ready') {
        if (!autoStartedRef.current) {
          if (configRef.current.mode === 'step') {
            handleStartStepRef.current();
          } else {
            handlePlayRef.current();
          }
        }
        return;
      }
      if (phaseRef.current !== 'playing') return;
      if (configRef.current.mode === 'step') {
        handleStepInputRef.current(midiNote);
      } else {
        const onsetMs = Date.now() - playStartMsRef.current;
        captureRef.current.push({
          hz: 0,
          midiCents: midiNote * 100,
          onsetMs,
          confidence: 1,
        });
        setResponseNoteEvents(prev => [...prev, {
          midiNote,
          timestamp,
          type: 'attack' as const,
        }]);
      }
    };
  // All dependencies are stable refs or stable React state setters — no stale
  // closure risk.  The empty dep array is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ScorePlayer subscription ──────────────────────────────────────────────────
  // Delivers state snapshots into React state so downstream effects can react.
  useEffect(() => {
    return context.scorePlayer.subscribe((state: ScorePlayerState) => {
      setScorePlayerState(state);
    });
  }, [context.scorePlayer]);

  // Feature 035: Subscribe to metronome state changes
  useEffect(() => {
    const unsubscribe = context.metronome.subscribe(setMetronomeState);
    return unsubscribe;
  }, [context.metronome]);

  // When scorePlayerState transitions to 'ready' while the Score preset is active,
  // extract the practice notes.  This effect runs AFTER the host has committed its
  // own state (pluginStatus, score), so extractPracticeNotes returns valid data.
  useEffect(() => {
    if (scorePlayerState.status === 'ready' && configRef.current.preset === 'score') {
      const pitches = context.scorePlayer.extractPracticeNotes(0, configRef.current.noteCount);
      if (pitches) {
        scorePitchesRef.current = pitches;
        setScorePitches(pitches);
        // Apply the clef from the score so the staff matches the imported notes
        const nextConfig = { ...configRef.current, clef: pitches.clef };
        configRef.current = nextConfig;
        setConfig(nextConfig);
        setShowScoreSelector(false);
        setExercise(generateScoreExercise(bpmRef.current, pitches.notes, nextConfig.noteCount));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorePlayerState.status, context.scorePlayer]);

  // ── Web MIDI device presence watcher ─────────────────────────────────────────
  // Uses navigator.requestMIDIAccess (browser API, not a host import) to detect
  // connect/disconnect events in real time, independently of note events.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return;

    let midiAccess: MIDIAccess | null = null;

    function countInputs(access: MIDIAccess): number {
      let n = 0;
      access.inputs.forEach(() => { n++; });
      return n;
    }

    function applyMidiPresence(access: MIDIAccess) {
      const hasMidi = countInputs(access) > 0;
      setInputSource(prev => {
        // Feature 001: do NOT override virtual-keyboard — the VKB toggle owns
        // that transition.  Keep prevPhysicalSourceRef up-to-date so closing VKB
        // restores correctly even if MIDI devices change while VKB is open.
        if (prev === 'virtual-keyboard') {
          prevPhysicalSourceRef.current = hasMidi ? 'midi' : null;
          return prev;
        }
        const next = hasMidi ? 'midi' : (prev === 'midi' ? null : prev);
        inputSourceRef.current = next;
        return next;
      });
    }

    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access;
      // Check devices that are already connected on mount
      applyMidiPresence(access);
      // Listen for connect / disconnect
      access.onstatechange = () => applyMidiPresence(access);
    }).catch(() => {
      // MIDI access denied or unsupported — silently fall back to mic only
    });

    return () => {
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
    };
  }, []);

  // ── Microphone subscription ─────────────────────────────────────────────────
  // Onset detection mirrors usePracticeRecorder:
  //  - Requires PITCH_STABLE_FRAMES consecutive identical-MIDI readings before committing
  //  - Requires SILENCE_STABLE_FRAMES consecutive silent/low-confidence frames before
  //    finalising the pending note and resetting the state machine
  //  - Filters pitches outside CAPTURE_MIDI_MIN..CAPTURE_MIDI_MAX (ultrasonic artefacts)
  //  - Ignores frames with confidence < MIN_CONFIDENCE
  //  - Mic stream is stopped entirely while MIDI is the active input source;
  //    it restarts automatically when MIDI disconnects.
  useEffect(() => {
    // MIDI or virtual keyboard active → release the microphone hardware immediately.
    // The effect re-runs when inputSource changes, so the stream restarts
    // automatically when neither MIDI nor the virtual keyboard is active.
    if (inputSource === 'midi' || inputSource === 'virtual-keyboard') {
      context.recording.stop();
      setMicActive(null);
      setMicError(null);
      return;
    }

    const unsubError = context.recording.onError((err) => {
      setMicError(err);
      setMicActive(false);
    });

    const unsubPitch = context.recording.subscribe((event: PluginPitchEvent) => {
      setMicActive(true);
      setMicError(null);

      // Virtual keyboard suspends mic entirely (Feature 001 — T008)
      if (inputSourceRef.current === 'virtual-keyboard') return;

      // Determine if this frame carries a valid in-range pitch
      const midi = hzToMidi(event.hz);
      const isValid =
        event.confidence >= MIN_CONFIDENCE &&
        midi >= CAPTURE_MIDI_MIN &&
        midi <= CAPTURE_MIDI_MAX;

      if (isValid) {
        // Promote to mic source on first confirmed pitch
        if (inputSourceRef.current === null) {
          setInputSource('mic');
          inputSourceRef.current = 'mic';
          // Auto-mute guide notes when microphone is the input source
          setSoundEnabled(false);
          soundEnabledRef.current = false;
        }

        silenceStableCountRef.current = 0; // reset silence run

        // AUTO-START: first valid mic pitch while in ready phase
        if (phaseRef.current === 'ready' && !autoStartedRef.current) {
          if (configRef.current.mode === 'step') {
            handleStartStepRef.current();
          } else {
            handlePlayRef.current();
          }
          return;
        }

        // STEP MODE: dispatch every distinct valid pitch directly (bypass flow debounce)
        if (configRef.current.mode === 'step' && phaseRef.current === 'playing') {
          handleStepInputRef.current(midi);
          return;
        }

        if (midi === lastCommittedMidiRef.current) {
          // Same pitch as current pending note — just keep counting
          pitchStableCountRef.current++;
        } else {
          // Pitch changed: finalise the previous pending note immediately (pitch-change offset)
          if (pendingNoteRef.current !== null) {
            const finalisedNote = pendingNoteRef.current;
            pendingNoteRef.current = null;
            if (phaseRef.current === 'playing') {
              captureRef.current.push(finalisedNote);
              setResponseNoteEvents(prev => [...prev, {
                midiNote: Math.round(finalisedNote.midiCents / 100),
                timestamp: event.timestamp,
                type: 'attack' as const,
              }]);
            }
          }
          // Start counting frames for the new pitch
          lastCommittedMidiRef.current = midi;
          pitchStableCountRef.current = 1;
        }

        // Once we've seen PITCH_STABLE_FRAMES in a row, record the onset
        if (
          pitchStableCountRef.current === PITCH_STABLE_FRAMES &&
          pendingNoteRef.current === null
        ) {
          pendingNoteRef.current = {
            hz: event.hz,
            midiCents: hzToMidiCents(event.hz),
            onsetMs: Date.now() - playStartMsRef.current,
            confidence: event.confidence,
          };
        }
      } else {
        // Silent / invalid frame
        pitchStableCountRef.current = 0;
        silenceStableCountRef.current++;

        if (
          silenceStableCountRef.current >= SILENCE_STABLE_FRAMES &&
          pendingNoteRef.current !== null
        ) {
          // Silence confirmed: finalise the pending note
          const finalisedNote = pendingNoteRef.current;
          pendingNoteRef.current = null;
          lastCommittedMidiRef.current = null;
          if (phaseRef.current === 'playing') {
            captureRef.current.push(finalisedNote);
            setResponseNoteEvents(prev => [...prev, {
              midiNote: Math.round(finalisedNote.midiCents / 100),
              timestamp: event.timestamp,
              type: 'attack' as const,
            }]);
          }
        }
      }
    });

    return () => {
      unsubPitch();
      unsubError();
    };
  }, [context, inputSource]);

  // ── MIDI subscription — detect source, capture, and auto-start ──────────────
  useEffect(() => {
    const unsub = context.midi.subscribe((event: PluginNoteEvent) => {
      // Suspended when virtual keyboard is active (Feature 001 — T009)
      if (inputSourceRef.current === 'virtual-keyboard') return;

      // Relay release events for audio feedback in MIDI flow mode
      if (event.type === 'release') {
        if (phaseRef.current === 'playing' && configRef.current.mode !== 'step') {
          context.playNote({ midiNote: event.midiNote, timestamp: event.timestamp, type: 'release' });
        }
        return;
      }
      if (event.type !== 'attack') return;
      // Promote to MIDI source on first attack (MIDI takes priority over mic)
      if (inputSourceRef.current !== 'midi') {
        setInputSource('midi');
        inputSourceRef.current = 'midi';
      }
      // Shared scoring + auto-start handler (also used by virtual keyboard — T002)
      handleMidiAttackRef.current(event.midiNote, event.timestamp);
      // Audio: MIDI keyboards produce no acoustic sound, so relay through the host.
      // (Virtual keyboard handles its own audio unconditionally in the component.)
      if (phaseRef.current === 'playing') {
        context.playNote({
          midiNote: event.midiNote,
          timestamp: event.timestamp,
          type: 'attack',
          durationMs: event.durationMs ?? 500,
        });
      }
    });
    return unsub;
  }, [context]);

  // ── Unmount cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        clearTimeout(finishTimerRef.current);
      }
      context.stopPlayback();
      // Force-close the microphone stream so the browser releases the device
      // indicator immediately when leaving the Train view.
      context.recording.stop();
    };
  }, [context]);

  // ── Onset detection reset helper ───────────────────────────────────────────
  const resetOnsetDetection = useCallback(() => {
    pitchStableCountRef.current = 0;
    silenceStableCountRef.current = 0;
    lastCommittedMidiRef.current = null;
    pendingNoteRef.current = null;
  }, []);

  // ── Step timeout helpers ────────────────────────────────────────────────────
  const clearStepTimeout = useCallback(() => {
    if (stepSlotTimeoutRef.current !== null) {
      clearTimeout(stepSlotTimeoutRef.current);
      stepSlotTimeoutRef.current = null;
    }
  }, []);

  const scheduleStepSlotTimeout = useCallback((stepIdx: number) => {
    clearStepTimeout();
    const noteDurationMs = 60_000 / bpmRef.current;
    const timeoutMs = noteDurationMs * configRef.current.stepTimeoutMultiplier;
    stepSlotTimeoutRef.current = setTimeout(() => {
      stepSlotTimeoutRef.current = null;
      stepPenalizedSlotsRef.current.add(stepIdx);
      const targetPitch = exerciseRef.current.notes[stepIdx]?.midiPitch;
      if (targetPitch != null) {
        setStepHint({ text: `Expected: ${midiToLabel(targetPitch)}`, color: '#e65100' });
      }
    }, timeoutMs);
  }, [clearStepTimeout]);

  // ── Step input handler (shared by mic + MIDI) ────────────────────────────────
  // Reads all state from refs so it can be stored in handleStepInputRef without
  // becoming stale inside the subscription closures.
  const handleStepInput = useCallback((detectedMidi: number) => {
    if (configRef.current.mode !== 'step') return;
    if (phaseRef.current !== 'playing') return;
    if (Date.now() - stepLastPlayTimeRef.current < STEP_INPUT_DELAY_MS) return;
    if (detectedMidi === lastStepMidiRef.current) return; // debounce

    lastStepMidiRef.current = detectedMidi;
    const stepIdx = stepIndexRef.current;
    const ex = exerciseRef.current;
    const targetNote = ex.notes[stepIdx];
    if (!targetNote) return;

    // Track played note for live response staff using slot-relative onset so
    // the layout engine sees timestamps consistent with exerciseNoteEvents.
    setResponseNoteEvents(prev => [...prev, {
      midiNote: detectedMidi,
      timestamp: targetNote.expectedOnsetMs,
      type: 'attack' as const,
      durationMs: (60_000 / ex.bpm) * 0.85,
    }]);

    if (detectedMidi === targetNote.midiPitch) {
      // ✓ Correct note — advance slot
      clearStepTimeout();
      setStepHint(null);
      const nextIdx = stepIdx + 1;

      if (nextIdx >= ex.notes.length) {
        // All slots done — build result from penalised set
        const penalized = stepPenalizedSlotsRef.current;
        const msPerBeat = 60_000 / ex.bpm;
        const exerciseResult: ExerciseResult = {
          comparisons: ex.notes.map((n: ExerciseNote, i: number) => {
            const wrongMidi = penalized.has(i) ? (stepWrongMidiMapRef.current.get(i) ?? n.midiPitch) : n.midiPitch;
            return {
              target: n,
              response: {
                hz: 440 * Math.pow(2, (wrongMidi - 69) / 12),
                midiCents: wrongMidi * 100,
                onsetMs: n.slotIndex * msPerBeat,
                confidence: 1,
              },
              status: (penalized.has(i) ? 'wrong-pitch' : 'correct') as NoteComparisonStatus,
              pitchDeviationCents: penalized.has(i) ? (wrongMidi - n.midiPitch) * 100 : 0,
              timingDeviationMs: 0,
            };
          }),
          extraneousNotes: [],
          score: Math.max(0, Math.round(100 - penalized.size * (100 / ex.notes.length))),
          correctPitchCount: ex.notes.length - penalized.size,
          correctTimingCount: ex.notes.length,
        };
        setResult(exerciseResult);
        setHighlightedSlotIndex(null);
        setResultsOverlayVisible(true);
        setPhase('results');
        phaseRef.current = 'results';
      } else {
        stepIndexRef.current = nextIdx;
        // Briefly block carry-over of the just-played pitch into the new slot
        if (stepDebounceTimeoutRef.current !== null) clearTimeout(stepDebounceTimeoutRef.current);
        lastStepMidiRef.current = detectedMidi;
        stepDebounceTimeoutRef.current = setTimeout(() => {
          lastStepMidiRef.current = null;
          stepDebounceTimeoutRef.current = null;
        }, STEP_INPUT_DELAY_MS);
        setHighlightedSlotIndex(nextIdx);
        stepLastPlayTimeRef.current = Date.now();
        if (soundEnabledRef.current || inputSourceRef.current === 'midi') {
          context.playNote({
            midiNote: ex.notes[nextIdx].midiPitch,
            timestamp: Date.now(),
            type: 'attack',
            durationMs: 600,
          });
        }
        scheduleStepSlotTimeout(nextIdx);
      }
    } else {
      // ✗ Wrong note — penalise and show hint
      stepPenalizedSlotsRef.current.add(stepIdx);
      stepWrongMidiMapRef.current.set(stepIdx, detectedMidi);
      setStepHint({
        text: `Expected: ${midiToLabel(targetNote.midiPitch)} · You played: ${midiToLabel(detectedMidi)}`,
        color: '#c62828',
      });
    }
  }, [context, clearStepTimeout, scheduleStepSlotTimeout]);

  useEffect(() => { handleStepInputRef.current = handleStepInput; }, [handleStepInput]);

  // ── Step mode autoscroll — keep highlighted note visible as the slot advances
  useEffect(() => {
    if (config.mode !== 'step' || phase !== 'playing' || highlightedSlotIndex == null) return;
    // .layout-glyph.highlighted is applied by LayoutRenderer.updateHighlights().
    // scrollIntoView traverses up to find the nearest overflow-x:auto ancestor
    // (the plugin-staff-viewer div) and scrolls it horizontally.
    const el = exerciseStaffRef.current?.querySelector('.layout-glyph.highlighted') as Element | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [highlightedSlotIndex, config.mode, phase]);

  // ── Step mode start ──────────────────────────────────────────────────────────
  const handleStartStep = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    setPhase('playing');
    phaseRef.current = 'playing';
    captureRef.current = [];
    resetOnsetDetection();
    setResponseNoteEvents([]);
    setResult(null);
    setStepHint(null);
    stepIndexRef.current = 0;
    lastStepMidiRef.current = null;
    stepPenalizedSlotsRef.current = new Set();
    stepWrongMidiMapRef.current = new Map();
    stepLastPlayTimeRef.current = Date.now();
    setHighlightedSlotIndex(0);
    const firstNote = exerciseRef.current.notes[0];
    if (firstNote) {
      if (soundEnabledRef.current || inputSourceRef.current === 'midi') {
        context.playNote({ midiNote: firstNote.midiPitch, timestamp: Date.now(), type: 'attack', durationMs: 600 });
      }
      scheduleStepSlotTimeout(0);
    }
  }, [context, resetOnsetDetection, scheduleStepSlotTimeout]);

  useEffect(() => { handleStartStepRef.current = handleStartStep; }, [handleStartStep]);

  // ── Play handler (flow mode) ─────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    autoStartedRef.current = true;

    const currentExercise = exerciseRef.current;
    const msPerBeat = 60_000 / currentExercise.bpm;
    const lastNoteMs = currentExercise.notes.length > 0
      ? currentExercise.notes[currentExercise.notes.length - 1].expectedOnsetMs
      : 0;

    setPhase('countdown');
    phaseRef.current = 'countdown';
    captureRef.current = [];
    resetOnsetDetection();
    setResponseNoteEvents([]);
    setResult(null);

    const startExercise = () => {
      setCountdownStep('');
      setPhase('playing');
      phaseRef.current = 'playing';
      const now = Date.now();
      playStartMsRef.current = now;
      setPlayStartMs(now);

      // Schedule per-slot highlight timers
      highlightTimersRef.current.forEach(clearTimeout);
      highlightTimersRef.current = [];
      currentExercise.notes.forEach((note, i) => {
        const t = setTimeout(() => setHighlightedSlotIndex(i), note.expectedOnsetMs);
        highlightTimersRef.current.push(t);
      });

      // Play exercise guide notes only for MIDI (keyboard produces no sound of
      // its own) and unknown source (manual Play button before first input).
      // In mic mode the real acoustic instrument provides the sound — skip audio.
      // Respects soundEnabledRef — muted = no guide notes.
      if (inputSourceRef.current !== 'mic' && soundEnabledRef.current) {
        currentExercise.notes.forEach((note) => {
          context.playNote({
            midiNote: note.midiPitch,
            timestamp: Date.now(),
            type: 'attack',
            offsetMs: note.expectedOnsetMs,
            durationMs: msPerBeat * 0.85,
          });
        });
      }

      const finishMs = lastNoteMs + msPerBeat + 300;
      finishTimerRef.current = setTimeout(() => {
        finishTimerRef.current = null;
        context.stopPlayback();
        // Cancel any remaining highlight timers
        highlightTimersRef.current.forEach(clearTimeout);
        highlightTimersRef.current = [];
        setHighlightedSlotIndex(null);
        // Finalise any in-flight pending note before scoring
        if (pendingNoteRef.current !== null) {
          captureRef.current.push(pendingNoteRef.current);
          pendingNoteRef.current = null;
        }
        resetOnsetDetection();
        const exerciseResult = scoreCapture(
          exerciseRef.current,
          captureRef.current,
          { includeTimingScore: inputSourceRef.current === 'midi' },
        );
        setResult(exerciseResult);
        setResultsOverlayVisible(true);
        setPhase('results');
        phaseRef.current = 'results';
      }, finishMs);
    };

    let step = 0;
    function countdownTick() {
      if (step < COUNTDOWN_STEPS.length) {
        const label = COUNTDOWN_STEPS[step];
        setCountdownStep(label);
        step++;
        if (label === 'Go!') {
          setTimeout(startExercise, 500);
        } else {
          setTimeout(countdownTick, 1000);
        }
      }
    }
    countdownTick();
  }, [context, resetOnsetDetection]);
  useEffect(() => { handlePlayRef.current = handlePlay; }, [handlePlay]);

  // ── Stop handler ──────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    // Cancel highlight timers
    highlightTimersRef.current.forEach(clearTimeout);
    highlightTimersRef.current = [];
    setHighlightedSlotIndex(null);
    // Cancel step-mode timers
    clearStepTimeout();
    if (stepDebounceTimeoutRef.current !== null) {
      clearTimeout(stepDebounceTimeoutRef.current);
      stepDebounceTimeoutRef.current = null;
    }
    setStepHint(null);
    context.stopPlayback();
    // Finalise any in-flight pending note before scoring
    if (pendingNoteRef.current !== null) {
      captureRef.current.push(pendingNoteRef.current);
      pendingNoteRef.current = null;
    }
    resetOnsetDetection();
    const exerciseResult = scoreCapture(
      exerciseRef.current,
      captureRef.current,
      { includeTimingScore: inputSourceRef.current === 'midi' },
    );
    setResult(exerciseResult);
    setResultsOverlayVisible(true);
    setPhase('results');
    phaseRef.current = 'results';
  }, [context, resetOnsetDetection, clearStepTimeout]);

  // ── Try Again ──────────────────────────────────────────────────────────────────
  const handleTryAgain = useCallback(() => {
    captureRef.current = [];
    resetOnsetDetection();
    setResponseNoteEvents([]);
    setResult(null);
    // Reset highlight / step state
    highlightTimersRef.current.forEach(clearTimeout);
    highlightTimersRef.current = [];
    setHighlightedSlotIndex(null);
    setStepHint(null);
    stepIndexRef.current = 0;
    lastStepMidiRef.current = null;
    stepPenalizedSlotsRef.current = new Set();
    stepWrongMidiMapRef.current = new Map();
    autoStartedRef.current = false;
    if (stepSlotTimeoutRef.current !== null) { clearTimeout(stepSlotTimeoutRef.current); stepSlotTimeoutRef.current = null; }
    if (stepDebounceTimeoutRef.current !== null) { clearTimeout(stepDebounceTimeoutRef.current); stepDebounceTimeoutRef.current = null; }
    setPhase('ready');
    phaseRef.current = 'ready';
  }, [resetOnsetDetection]);

  // ── New Exercise ───────────────────────────────────────────────────────────────
  const handleNewExercise = useCallback(() => {
    captureRef.current = [];
    resetOnsetDetection();
    setResponseNoteEvents([]);
    setResult(null);
    // Reset highlight / step state
    highlightTimersRef.current.forEach(clearTimeout);
    highlightTimersRef.current = [];
    setHighlightedSlotIndex(null);
    setStepHint(null);
    stepIndexRef.current = 0;
    lastStepMidiRef.current = null;
    stepPenalizedSlotsRef.current = new Set();
    stepWrongMidiMapRef.current = new Map();
    autoStartedRef.current = false;
    if (stepSlotTimeoutRef.current !== null) { clearTimeout(stepSlotTimeoutRef.current); stepSlotTimeoutRef.current = null; }
    if (stepDebounceTimeoutRef.current !== null) { clearTimeout(stepDebounceTimeoutRef.current); stepDebounceTimeoutRef.current = null; }
    setExercise(
      configRef.current.preset === 'score' && scorePitchesRef.current
        ? generateScoreExercise(bpmRef.current, scorePitchesRef.current.notes, configRef.current.noteCount)
        : configRef.current.preset !== 'score'
          ? generateExercise(bpmRef.current, configRef.current)
          : { notes: [], bpm: bpmRef.current },
    );
    setPhase('ready');
    phaseRef.current = 'ready';
  }, [resetOnsetDetection]);

  // ── Config helpers — use refs to avoid stale closures ──────────────────────
  const updateConfig = useCallback((patch: Partial<ExerciseConfig>) => {
    // Compute next BEFORE calling setConfig so the ref and side-effects both
    // see the same value — avoids a race where the outer scope reads a stale ref.
    const next = { ...configRef.current, ...patch };
    configRef.current = next;
    setConfig(next);
    if (phaseRef.current === 'ready') {
      if (next.preset === 'score') {
        // Open selector when switching to score with no cached pitches
        if (!scorePitchesRef.current && patch.preset === 'score') {
          setShowScoreSelector(true);
        }
        // Regenerate from cached pitches if available
        if (scorePitchesRef.current) {
          setExercise(generateScoreExercise(bpmRef.current, scorePitchesRef.current.notes, next.noteCount));
        } else {
          setExercise({ notes: [], bpm: bpmRef.current });
        }
      } else if (next.preset === 'scales') {
        setExercise(generateScaleExercise(bpmRef.current, next.scaleId, next.octaveRange));
      } else {
        setExercise(generateExercise(bpmRef.current, next));
      }
    }
  }, []);

  const handleBpmChange = useCallback((v: number) => {
    setBpmValue(v);
    bpmRef.current = v;
    if (phaseRef.current === 'ready') {
      if (configRef.current.preset === 'score' && scorePitchesRef.current) {
        setExercise(generateScoreExercise(v, scorePitchesRef.current.notes, configRef.current.noteCount));
      } else if (configRef.current.preset === 'scales') {
        setExercise(generateScaleExercise(v, configRef.current.scaleId, configRef.current.octaveRange));
      } else if (configRef.current.preset !== 'score') {
        setExercise(generateExercise(v, configRef.current));
      }
    }
  }, []);

  // ── Complexity level helper ────────────────────────────────────────────────
  const applyComplexityLevel = useCallback((level: ComplexityLevel) => {
    const preset = COMPLEXITY_PRESETS[level];

    // Apply config + BPM directly via refs so the reset below can use them
    const nextConfig = { ...configRef.current, ...(preset.config as Partial<ExerciseConfig>) };
    configRef.current = nextConfig;
    setConfig(nextConfig);
    const nextBpm = preset.bpm;
    bpmRef.current = nextBpm;
    setBpmValue(nextBpm);

    // Full session reset — stop any running playback and clear all transient state
    context.stopPlayback();
    captureRef.current = [];
    pendingNoteRef.current = null;
    resetOnsetDetection();
    if (finishTimerRef.current !== null) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    highlightTimersRef.current.forEach(clearTimeout);
    highlightTimersRef.current = [];
    clearStepTimeout();
    if (stepDebounceTimeoutRef.current !== null) { clearTimeout(stepDebounceTimeoutRef.current); stepDebounceTimeoutRef.current = null; }
    setHighlightedSlotIndex(null);
    setStepHint(null);
    setResponseNoteEvents([]);
    setResult(null);
    setCountdownStep('');
    stepIndexRef.current = 0;
    lastStepMidiRef.current = null;
    stepPenalizedSlotsRef.current = new Set();
    stepWrongMidiMapRef.current = new Map();
    autoStartedRef.current = false;

    // Generate a fresh exercise with the new preset
    setExercise(
      nextConfig.preset === 'score' && scorePitchesRef.current
        ? generateScoreExercise(nextBpm, scorePitchesRef.current.notes, nextConfig.noteCount)
        : nextConfig.preset !== 'score'
          ? generateExercise(nextBpm, nextConfig)
          : { notes: [], bpm: nextBpm },
    );

    setPhase('ready');
    phaseRef.current = 'ready';
    setComplexityLevel(level);
    localStorage.setItem(COMPLEXITY_LEVEL_STORAGE_KEY, level);
  }, [context, resetOnsetDetection, clearStepTimeout]);

  // ── Restore complexity level from localStorage on mount ───────────────────
  useEffect(() => {
    const stored = localStorage.getItem(COMPLEXITY_LEVEL_STORAGE_KEY);
    const validLevels: ComplexityLevel[] = ['low', 'mid', 'high'];
    const level: ComplexityLevel = stored && validLevels.includes(stored as ComplexityLevel)
      ? (stored as ComplexityLevel)
      : 'low';
    applyComplexityLevel(level);
  }, [applyComplexityLevel]);

  // ── Sidebar: only visible in Custom mode, hidden during exercise ──────────
  useEffect(() => {
    if (complexityLevel === null) {
      // Custom: collapse while playing/countdown; open when ready; leave alone on results
      // (results phase: the user may have explicitly opened it via the level selector,
      //  so don't auto-close — Retry/New already advance to the next state)
      if (phase === 'playing' || phase === 'countdown') setSidebarCollapsed(true);
      else if (phase === 'ready') setSidebarCollapsed(false);
      // phase === 'results': no change — preserve manual open/close state
    } else {
      // Preset level: always hidden
      setSidebarCollapsed(true);
    }
  }, [complexityLevel, phase]);

  // ── Mute staff speaker whenever mic is actively recording ───────────────
  useEffect(() => {
    if (micActive === true) {
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    }
  }, [micActive]);

  // ── Tips dismiss ─────────────────────────────────────────────────────────────
  const handleDismissTips = useCallback(() => {
    sessionStorage.setItem('train-tips-v1-dismissed', 'yes');
    setShowTips(false);
  }, []);

  // ── Sound toggle ──────────────────────────────────────────────────────────────
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      soundEnabledRef.current = next;
      return next;
    });
  }, []);

  // ── Virtual keyboard toggle + note routing (Feature 001 — T007, T018) ────────

  /**
   * Toggle the virtual keyboard panel open/closed.
   *
   * Invariant (T021 / T022): this callback touches ONLY virtualKeyboardOpen,
   * inputSource, and inputSourceRef.  It deliberately does NOT touch:
   *   - preset state, score state, noteCount, BPM, or clef (SC-004)
   *   - captureRef  — accumulated notes are preserved across mid-exercise toggles (US3-S4)
   *   - handleStepInputRef — step handler continues operating after toggle (US3-S4)
   * This guarantees seamless continuation when toggling mid-exercise (R-003).
   */
  const handleVirtualKeyboardToggle = useCallback(() => {
    // NOTE: ref mutations and sibling setState calls must NOT happen inside a
    // setState updater — React StrictMode calls updaters twice (probe + commit),
    // which would overwrite prevPhysicalSourceRef with 'virtual-keyboard' on the
    // second probe invocation, permanently breaking the restore-on-close path.
    const opening = !virtualKeyboardOpen;
    if (opening) {
      // Opening: save current physical source, switch to virtual-keyboard
      prevPhysicalSourceRef.current = inputSourceRef.current as 'midi' | 'mic' | null;
      setInputSource('virtual-keyboard');
      inputSourceRef.current = 'virtual-keyboard';
    } else {
      // Closing: restore the physical source that was active before VKB opened
      const restored = prevPhysicalSourceRef.current;
      setInputSource(restored);
      inputSourceRef.current = restored;
    }
    setVirtualKeyboardOpen(opening);
  }, [virtualKeyboardOpen]);

  // Feature 035: Metronome toggle
  const handleMetronomeToggle = useCallback(() => {
    context.metronome.toggle().catch((e) => {
      console.error('[TrainPlugin] metronome.toggle failed:', e);
    });
  }, [context.metronome]);

  // Feature 039: Metronome subdivision dropdown
  const [metroMenuOpen, setMetroMenuOpen] = useState(false);
  const metroGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!metroMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (metroGroupRef.current && !metroGroupRef.current.contains(e.target as Node)) {
        setMetroMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [metroMenuOpen]);

  const handleMetronomeSubdivisionChange = useCallback((s: MetronomeSubdivision) => {
    context.metronome.setSubdivision(s).catch((e) => {
      console.error('[TrainPlugin] metronome.setSubdivision failed:', e);
    });
  }, [context.metronome]);

  // Feature 035: Build metronome button CSS class (beat-pulse animation)
  const metronomeBtnClass = [
    'train-plugin__metro-btn',
    ...(metronomeState.active ? ['train-plugin__metro-btn--active'] : []),
    ...(metronomeState.active && metronomeState.isDownbeat ? ['train-plugin__metro-btn--downbeat'] : []),
  ].join(' ');
  const SUBDIV_ICONS: Record<MetronomeSubdivision, string> = { 1: '♩', 2: '♪', 4: '♬' };
  const SUBDIV_LABELS: Record<MetronomeSubdivision, string> = { 1: '♩ 1/4', 2: '♪ 1/8', 4: '♬ 1/16' };
  // Change key each beat to restart the CSS animation (same pattern as PlaybackToolbar)
  const metronomeAnimKey = metronomeState.active
    ? `metro-${metronomeState.beatIndex}`
    : 'metro-off';

  /**
   * Virtual keyboard key-down handler.
   *
   * Audio is handled unconditionally by TrainVirtualKeyboard (FR-006 — always audible).
   * This parent handler routes to the shared scoring pipeline (handleMidiAttackRef).
   *
   * Intentional invariant: captureRef and handleStepInputRef are NOT cleared here —
   * mid-exercise toggle continues seamlessly (US3-S4 / R-003).
   */
  const handleVirtualKeyDown = useCallback((midi: number, timestamp: number) => {
    handleMidiAttackRef.current(midi, timestamp);
  }, []);

  /**
   * Virtual keyboard key-up handler.
   *
   * Release audio is handled by TrainVirtualKeyboard. The parent only needs
   * to relay the release event so flow-mode exercises receive a release event
   * consistent with physical MIDI behaviour.
   */
  const handleVirtualKeyUp = useCallback((_midi: number, _attackedAt: number) => {
    // Flow-mode capture uses onset-only; release data is not needed for scoring.
    // Audio release is already handled inside TrainVirtualKeyboard.
  }, []);

  // ── Highlighted notes ─────────────────────────────────────────────────────────

  // Response staff: most-recently played note
  const responseHighlightedNotes = useMemo(() => {
    if (phase !== 'playing' || responseNoteEvents.length === 0) return [];
    return [responseNoteEvents[responseNoteEvents.length - 1].midiNote];
  }, [phase, responseNoteEvents]);

  const isDisabled = phase === 'playing' || phase === 'countdown';
  const { StaffViewer, ScoreSelector } = context.components;

  // ── Input source badge ────────────────────────────────────────────────────────
  const isVirtualKeyboardActive = inputSource === 'virtual-keyboard';
  const inputBadgeClass = [
    'train-mic-badge',
    isVirtualKeyboardActive
      ? 'train-mic-badge--suspended'
      : inputSource === 'midi'
        ? 'train-mic-badge--active train-mic-badge--midi'
        : micError
          ? 'train-mic-badge--error'
          : micActive === true ? 'train-mic-badge--active' : '',
  ].filter(Boolean).join(' ');
  const inputBadgeLabel = isVirtualKeyboardActive
    ? '🎹 Mic/MIDI suspended'
    : inputSource === 'midi'
      ? '🎹 MIDI Keyboard'
      : micError ? `🎤 Mic (error)` : '🎤 Mic';
  const inputBadgeTip = isVirtualKeyboardActive
    ? 'Virtual keyboard active — mic and MIDI suspended'
    : inputSource === 'midi'
      ? 'MIDI keyboard detected — using MIDI input'
      : micError ?? 'Listening via microphone';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={`train-plugin${phase === 'results' && resultsOverlayVisible ? ' train-plugin--results' : ''}`} data-testid="train-view">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="train-plugin__header">
        <button
          className="train-plugin__header-btn train-plugin__back-btn"
          onClick={() => context.close()}
        >
          ← Back
        </button>
        <h1 className="train-plugin__title">Train</h1>

        {/* COMPLEXITY LEVEL — next to title */}
        <label className="train-plugin__level-label" htmlFor="train-level-select">Level</label>
        <select
          id="train-level-select"
          aria-label="Complexity level"
          className="train-plugin__level-select"
          value={complexityLevel ?? 'custom'}
          disabled={isDisabled}
          onClick={(e) => {
            // Always open sidebar when clicking Custom, even if already selected
            if ((e.target as HTMLSelectElement).value === 'custom') {
              setSidebarCollapsed(false);
            }
          }}
          onChange={(e) => {
            const v = e.target.value as ComplexityLevel | 'custom';
            if (v !== 'custom') {
              // Save current custom config before overwriting with a preset
              if (complexityLevel === null) {
                savedCustomRef.current = { config: configRef.current, bpm: bpmRef.current };
              }
              applyComplexityLevel(v);
            } else {
              // Restore saved custom config if available
              if (savedCustomRef.current) {
                const { config: saved, bpm: savedBpm } = savedCustomRef.current;
                configRef.current = saved;
                setConfig(saved);
                bpmRef.current = savedBpm;
                setBpmValue(savedBpm);
                if (phaseRef.current === 'ready') {
                  if (saved.preset === 'scales') {
                    setExercise(generateScaleExercise(savedBpm, saved.scaleId, saved.octaveRange));
                  } else if (saved.preset !== 'score') {
                    setExercise(generateExercise(savedBpm, saved));
                  }
                }
              }
              setComplexityLevel(null);
              setSidebarCollapsed(false);
            }
          }}
        >
          <option value="low">Low</option>
          <option value="mid">Mid</option>
          <option value="high">High</option>
          <option value="custom">Custom</option>
        </select>

        {phase === 'playing' && (
          <button
            className="train-plugin__header-btn train-plugin__header-btn--stop"
            onClick={handleStop}
            aria-label="Stop exercise"
            data-testid="train-stop-btn"
          >
            ■ Stop
          </button>
        )}

        {phase === 'results' && (
          <>
            <button
              className="train-plugin__header-btn train-plugin__header-btn--retry"
              onClick={handleTryAgain}
              aria-label="Retry exercise"
              data-testid="train-retry-btn"
            >
              🔁 Retry
            </button>
            <button
              className="train-plugin__header-btn train-plugin__header-btn--new"
              onClick={handleNewExercise}
              aria-label="New exercise"
            >
              🎲 New
            </button>
          </>
        )}

        {/* Spacer pushes badge to the right */}
        <div className="train-plugin__header-spacer" />

        <div className="train-plugin__header-actions">
          {/* Metronome toggle + subdivision dropdown (Feature 035 / 039) */}
          <div className="train-plugin__metro-group" ref={metroGroupRef}>
            <button
              key={metronomeAnimKey}
              className={metronomeBtnClass}
              onClick={handleMetronomeToggle}
              aria-label="Toggle metronome"
              aria-pressed={metronomeState.active}
              title={metronomeState.active ? 'Stop metronome' : 'Start metronome'}
            >
              {SUBDIV_ICONS[metronomeState.subdivision as MetronomeSubdivision ?? 1]}
            </button>
            <button
              className="train-plugin__metro-chevron"
              onClick={() => setMetroMenuOpen((o) => !o)}
              aria-label="Metronome subdivision"
              aria-expanded={metroMenuOpen}
              aria-haspopup="menu"
            >
              ▾
            </button>
            {metroMenuOpen && (
              <div className="train-plugin__metro-menu" role="menu">
                {([1, 2, 4] as MetronomeSubdivision[]).map((s) => (
                  <button
                    key={s}
                    role="menuitem"
                    className={
                      'train-plugin__metro-menu-item' +
                      (metronomeState.subdivision === s ? ' train-plugin__metro-menu-item--active' : '')
                    }
                    onClick={() => {
                      handleMetronomeSubdivisionChange(s);
                      setMetroMenuOpen(false);
                    }}
                  >
                    {metronomeState.subdivision === s && (
                      <span className="train-plugin__metro-menu-check">✓</span>
                    )}
                    {SUBDIV_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Virtual keyboard toggle (Feature 001 — FR-001, FR-011) */}
          <button
            className={`train-plugin__vkb-toggle${virtualKeyboardOpen ? ' train-plugin__vkb-toggle--active' : ''}`}
            onClick={handleVirtualKeyboardToggle}
            aria-label={virtualKeyboardOpen ? 'Hide virtual keyboard' : 'Show virtual keyboard'}
            aria-pressed={virtualKeyboardOpen}
            title={virtualKeyboardOpen ? 'Hide virtual keyboard' : 'Show virtual keyboard'}
            data-testid="vkb-toggle-btn"
          >
            🎹
          </button>
          <span
            className={inputBadgeClass}
            title={inputBadgeTip}
            aria-label={inputBadgeLabel}
          >
            {inputBadgeLabel}
          </span>
        </div>
      </header>

      {/* ── Tips banner ──────────────────────────────────────────────────── */}
      {showTips && (
        <div className="train-plugin__tips" role="note">
          <ul className="train-plugin__tips-list">
            <li>🎹 Use a <strong>MIDI interface</strong> for accurate note detection.</li>
            <li>🎤 Place the <strong>microphone as close as possible</strong> to the keyboard's speakers.</li>
            <li>🤫 Practice in a <strong>quiet space</strong> — background noise reduces accuracy.</li>
            <li>⭐ An <strong>external microphone</strong> significantly improves pitch detection.</li>
          </ul>
          <button
            className="train-plugin__tips-dismiss"
            onClick={handleDismissTips}
            aria-label="Dismiss tips"
          >
            Got it!
          </button>
        </div>
      )}

      {/* ── Body: sidebar + main ─────────────────────────────────────────── */}
      <div className="train-plugin__body">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className={`train-sidebar${sidebarCollapsed ? ' train-sidebar--collapsed' : ''}${complexityLevel !== null ? ' train-sidebar--hidden' : ''}`}>
          {complexityLevel === null && (
            <button
              className="train-sidebar__toggle"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              aria-label={sidebarCollapsed ? 'Open config panel' : 'Collapse config panel'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Open config' : 'Collapse config'}
            >
              {sidebarCollapsed ? '⚙' : '‹'}
            </button>
          )}
          <div className="train-sidebar__sections">
              {/* MODE */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Mode</p>
                <select
                  aria-label="Mode"
                  className="train-sidebar__select"
                  value={config.mode}
                  disabled={isDisabled}
                  onChange={(e) => { setComplexityLevel(null); updateConfig({ mode: e.target.value as 'flow' | 'step' }); }}
                >
                  <option value="flow">Flow</option>
                  <option value="step">Step</option>
                </select>
              </div>

              {/* SCORE */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Score</p>
                {([['random', 'Random'], ['score', 'Score'], ['scales', 'Scales']] as [ExerciseConfig['preset'], string][]).map(([v, label]) => (
                  <label
                    key={v}
                    className={`train-sidebar__radio-label${isDisabled ? ' train-sidebar__radio-label--disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="train-preset"
                      value={v}
                      checked={config.preset === v}
                      disabled={isDisabled}
                      onClick={() => { if (v === 'scales') setSidebarCollapsed(false); }}
                      onChange={() => {
                        setComplexityLevel(null);
                        if (v === 'scales') {
                          updateConfig({ preset: v, noteCount: 8 * config.octaveRange, clef: 'Treble' });
                        } else {
                          updateConfig({ preset: v });
                        }
                      }}
                    />
                    {label}
                  </label>
                ))}
                {config.preset === 'scales' && (
                  <select
                    className="train-sidebar__select"
                    value={config.scaleId}
                    disabled={isDisabled}
                    aria-label="Scale"
                    onChange={(e) => { setComplexityLevel(null); updateConfig({ scaleId: e.target.value }); }}
                  >
                    {SCALE_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.displayName}</option>
                    ))}
                  </select>
                )}
                {config.preset === 'score' && scorePitches !== null && (
                  <button
                    className="train-sidebar__change-score-btn"
                    disabled={isDisabled}
                    aria-label="Change score"
                    onClick={() => setShowScoreSelector(true)}
                  >
                    Change score
                  </button>
                )}
              </div>

              {/* NOTES */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Notes</p>
                <div className="train-sidebar__slider-row">
                  <input
                    type="range"
                    min={2}
                    max={config.preset === 'score' && scorePitches ? scorePitches.totalAvailable : 20}
                    step={1}
                    value={config.noteCount}
                    disabled={isDisabled || config.preset === 'scales'}
                    aria-label="Note count"
                    onChange={(e) => { setComplexityLevel(null); updateConfig({ noteCount: Number(e.target.value) }); }}
                  />
                  <span className="train-sidebar__slider-value">{config.noteCount}</span>
                </div>
                {config.preset === 'scales' && (
                  <span className="train-score-disabled-label">Set by scale</span>
                )}
              </div>

              {/* CLEF */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Clef</p>
                {(['Treble', 'Bass'] as const).map((c) => (
                  <label
                    key={c}
                    className={`train-sidebar__radio-label${(isDisabled || config.preset === 'score' || config.preset === 'scales') ? ' train-sidebar__radio-label--disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="train-clef"
                      value={c}
                      checked={config.clef === c}
                      disabled={isDisabled || config.preset === 'score' || config.preset === 'scales'}
                      aria-disabled={config.preset === 'score' || config.preset === 'scales'}
                      onChange={() => { setComplexityLevel(null); updateConfig({ clef: c }); }}
                    />
                    {c}
                  </label>
                ))}
                {config.preset === 'score' && (
                  <span className="train-score-disabled-label">Set by score</span>
                )}
                {config.preset === 'scales' && (
                  <span className="train-score-disabled-label">Set by scale</span>
                )}
              </div>

              {/* OCTAVES */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Octaves</p>
                <select
                  className="train-sidebar__select"
                  value={config.octaveRange}
                  disabled={isDisabled || config.preset === 'score'}
                  aria-label="Octave range"
                  aria-disabled={config.preset === 'score'}
                  onChange={(e) => {
                    const o = Number(e.target.value) as 1 | 2 | 3 | 4;
                    setComplexityLevel(null);
                    if (config.preset === 'scales') {
                      updateConfig({ octaveRange: o, noteCount: 8 * o });
                    } else {
                      updateConfig({ octaveRange: o });
                    }
                  }}
                >
                  {(config.preset === 'scales' ? [1, 2, 3, 4] : [1, 2]).map((o) => (
                    <option key={o} value={o}>{o} oct.</option>
                  ))}
                </select>
                {config.preset === 'score' && (
                  <span className="train-score-disabled-label">Set by score</span>
                )}
              </div>

              {/* TEMPO */}
              <div className="train-sidebar__section">
                <p className="train-sidebar__section-title">Tempo</p>
                <div className="train-sidebar__slider-row">
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={5}
                    value={bpmValue}
                    disabled={isDisabled}
                    aria-label="Tempo BPM"
                    onChange={(e) => { setComplexityLevel(null); handleBpmChange(Number(e.target.value)); }}
                  />
                  <span className="train-sidebar__slider-value">{bpmValue}</span>
                </div>
                <p className="train-sidebar__slider-sublabel">BPM</p>
              </div>
            </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className={`train-plugin__main${phase === 'countdown' ? ' train-plugin__main--countdown' : ''}`}>

          {/* Mic error banner */}
          {micError && (
            <div className="train-plugin__mic-error" role="alert">
              🎤 {micError}
            </div>
          )}

          {/* Countdown overlay */}
          {phase === 'countdown' && countdownStep && (
            <div
              className={`train-countdown${countdownStep === 'Go!' ? ' train-countdown--go' : ''}`}
              role="status"
              aria-live="assertive"
            >
              {countdownStep}
            </div>
          )}

          {/* Exercise staff */}
          <div className="train-staff-block">
            <div className="train-staff-label">
              <span aria-hidden="true">Exercise</span>
              <button
                className={`train-staff-sound-btn${soundEnabled ? '' : ' train-staff-sound-btn--muted'}`}
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Mute exercise notes' : 'Unmute exercise notes'}
                aria-pressed={!soundEnabled}
                title={soundEnabled ? 'Exercise notes sound on — click to mute' : 'Exercise notes muted — click to unmute'}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
            </div>
            <div ref={exerciseStaffRef} className={`train-staff-wrapper${phase === 'playing' ? ' train-staff-wrapper--playing' : ''}`}>
              <StaffViewer
                notes={exerciseNoteEvents}
                clef={config.clef}
                highlightedNoteIndex={highlightedSlotIndex ?? undefined}
                bpm={exercise.bpm}
                keySignature={exercise.keySignature}
              />
            </div>
          </div>

          {/* Step mode hint */}
          {phase === 'playing' && config.mode === 'step' && stepHint && (
            <div className="train-step-hint" role="status" style={{ color: stepHint.color }}>
              {stepHint.text}
            </div>
          )}

          {/* Controls: ready phase */}
          {phase === 'ready' && (
            <div className="train-controls">
              <button
                className="train-start-prompt"
                data-testid="train-play-btn"
                aria-label="Start exercise"
                onClick={() => config.mode === 'step' ? handleStartStep() : handlePlay()}
              >
                🎹 Press any note to start
              </button>
            </div>
          )}

          {/* Response staff — flow mode playing/results; step mode playing only */}
          {(phase === 'playing' || (phase === 'results' && config.mode !== 'step')) && (
            <div className="train-staff-block">
              <div className="train-staff-label" aria-hidden="true">Your Response</div>
              <div className="train-staff-wrapper">
                <StaffViewer
                  notes={responseNoteEvents}
                  clef={config.clef}
                  highlightedNotes={responseHighlightedNotes}
                  bpm={exercise.bpm}
                  {...(config.mode !== 'step' ? { timestampOffset: playStartMs, autoScroll: true } : {})}
                />
              </div>
            </div>
          )}

          {/* Results panel */}
          {phase === 'results' && result && (
            <>
              {/* Backdrop — only visible in mobile landscape overlay mode.
                  Tap it to dismiss the overlay (returns to staff view). */}
              <div
                className="train-results__backdrop"
                role="button"
                aria-label="Close results"
                onClick={() => setResultsOverlayVisible(false)}
                onTouchEnd={(e) => { e.preventDefault(); setResultsOverlayVisible(false); }}
              />
              <div
                className="train-results"
                role="region"
                aria-label="Exercise results"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Close button — only shown in mobile landscape overlay */}
              <button
                className="train-results__close"
                aria-label="Close results"
                onClick={() => setResultsOverlayVisible(false)}
              >
                ×
              </button>
              {/* Score headline */}
              <div className="train-results__score-block">
                <div className="train-results__score-ring">
                  <span
                    className="train-results__score-number"
                    style={{
                      color:
                        result.score >= 90 ? '#2e7d32'
                        : result.score >= 60 ? '#f57f17'
                        : '#c62828',
                    }}
                  >
                    {result.score}
                  </span>
                  <span className="train-results__score-label">/ 100</span>
                </div>
                <div
                  className="train-results__score-grade"
                  style={{
                    color:
                      result.score >= 90 ? '#2e7d32'
                      : result.score >= 60 ? '#f57f17'
                      : '#c62828',
                  }}
                >
                  {result.score === 100 ? '🏆 Perfect!'
                    : result.score >= 90 ? '🌟 Excellent!'
                    : result.score >= 70 ? '👍 Good job!'
                    : result.score >= 50 ? '💪 Keep going!'
                    : '🎯 Keep practicing!'}
                </div>
              </div>

              {/* Collapsible note-by-note table */}
              <details className="train-results__details">
                <summary className="train-results__details-summary">
                  Note-by-note details
                </summary>
                <div className="train-results__table-wrapper">
                  <table
                    className="train-results__table"
                    aria-label="Per-note comparison"
                  >
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Target</th>
                        <th>Detected</th>
                        <th>Status</th>
                        <th>Pitch Δ (¢)</th>
                        <th>Timing Δ (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comparisons.map((c, i) => (
                        <tr
                          key={i}
                          className={`train-results__row train-results__row--${c.status}`}
                        >
                          <td>{i + 1}</td>
                          <td>{midiToLabel(c.target.midiPitch)}</td>
                          <td>
                            {c.response
                              ? `${midiToLabel(Math.round(c.response.midiCents / 100))} (${c.response.hz.toFixed(1)} Hz)`
                              : '—'}
                          </td>
                          <td aria-label={c.status}>
                            <span className="train-results__status-icon">
                              {c.status === 'correct' ? '✅'
                                : c.status === 'wrong-pitch' ? '⚠️'
                                : c.status === 'wrong-timing' ? '⏱️'
                                : c.status === 'missed' ? '❌'
                                : '➕'}
                            </span>{' '}
                            {c.status === 'correct' ? 'Correct'
                              : c.status === 'wrong-pitch' ? 'Wrong pitch'
                              : c.status === 'wrong-timing' ? 'Wrong timing'
                              : c.status === 'missed' ? 'Missed'
                              : 'Extraneous'}
                          </td>
                          <td>
                            {c.pitchDeviationCents !== null
                              ? Math.round(c.pitchDeviationCents)
                              : '—'}
                          </td>
                          <td>
                            {c.timingDeviationMs !== null
                              ? Math.round(c.timingDeviationMs)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.extraneousNotes.length > 0 && (
                  <div className="train-results__extraneous">
                    <strong>Extraneous notes:</strong>{' '}
                    {result.extraneousNotes.length} extra note
                    {result.extraneousNotes.length !== 1 ? 's' : ''} played outside the beat windows.
                  </div>
                )}
              </details>

              {/* Retry / New actions are in the toolbar — no redundant buttons here */}
            </div>
          </>
          )}
        </main>
      </div>

      {/* ── Virtual keyboard panel (Feature 001 — FR-002, FR-007, FR-008) ─── */}
      {virtualKeyboardOpen && (
        <div className="train-plugin__vkb-panel" data-testid="vkb-panel">
          <TrainVirtualKeyboard
            context={context}
            onKeyDown={handleVirtualKeyDown}
            onKeyUp={handleVirtualKeyUp}
          />
        </div>
      )}

      {/* ── ScoreSelector overlay ─────────────────────────────────────────── */}
      {showScoreSelector && config.preset === 'score' && (
        <ScoreSelector
          catalogue={context.scorePlayer.getCatalogue()}
          isLoading={scorePlayerState.status === 'loading'}
          error={scorePlayerState.error}
          onSelectScore={(catalogueId) => {
            context.scorePlayer.loadScore({ kind: 'catalogue', catalogueId });
          }}
          onLoadFile={(file) => {
            context.scorePlayer.loadScore({ kind: 'file', file });
          }}
          onCancel={() => {
            setShowScoreSelector(false);
            if (!scorePitchesRef.current) {
              // No score loaded yet — revert to random preset
              updateConfig({ preset: 'random' });
            }
          }}
          onSelectUserScore={(scoreId) => {
            context.scorePlayer.loadScore({ kind: 'userScore', scoreId });
          }}
        />
      )}
    </div>
  );
}
