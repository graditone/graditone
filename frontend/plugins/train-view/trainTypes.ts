/**
 * trainTypes.ts — Plugin-internal domain types
 * Feature 036: Rename Practice Plugin to Train (was practiceTypes.ts)
 *
 * Self-contained type definitions for the train-view plugin.
 * NO imports from src/ — all types are defined here.
 * Self-contained — intentionally not importing from src/ to respect the
 * plugin/host ESLint import boundary.
 */

// ─── Exercise configuration ───────────────────────────────────────────────────

/** Which notes to train */
export type TrainMode = 'flow' | 'step';

/** Exercise configuration for generating a training set */
export interface ExerciseConfig {
  /** Note pool selection */
  preset: 'random' | 'c4scale' | 'score';
  /** Number of notes in the exercise (1–20) */
  noteCount: number;
  /** Clef determines the note pool range */
  clef: 'Treble' | 'Bass';
  /** 1 = one octave around the clef centre; 2 = two octaves */
  octaveRange: 1 | 2;
  /** Train mode: 'flow' = timed play-through; 'step' = wait for correct note each slot */
  mode: TrainMode;
  /**
   * Step mode only. Multiplier applied to the quarter-note duration to derive
   * the per-slot timeout. E.g. 4 = the user has 4× the note's duration to press it.
   */
  stepTimeoutMultiplier: number;
}

// ─── Phase state machine ──────────────────────────────────────────────────────

/**
 * Phase state machine for the Train plugin UI:
 *   ready → countdown → playing → results
 */
export type TrainPhase = 'ready' | 'countdown' | 'playing' | 'results';

// ─── Exercise ─────────────────────────────────────────────────────────────────

/** One entry in the target exercise sequence */
export interface ExerciseNote {
  /** Stable slot identifier, e.g. "ex-0" */
  id: string;
  /** 0-based slot index */
  slotIndex: number;
  /** Target MIDI pitch */
  midiPitch: number;
  /** Expected onset time in ms from when Play is pressed */
  expectedOnsetMs: number;
}

/** The immutable sequence of target notes for one training session */
export interface TrainExercise {
  /** Ordered target notes */
  notes: ExerciseNote[];
  /** Beats per minute used to compute onset times */
  bpm: number;
}

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * A note detected during practice (from mic or MIDI).
 * Internal to the scorer — converting from PluginPitchEvent happens in scoreCapture.
 */
export interface ResponseNote {
  /** Raw detected frequency in Hz (0 for MIDI events converted to this type) */
  hz: number;
  /**
   * Fractional MIDI value ×100 for cent comparison.
   * For mic: 12 × log2(hz/440) × 100 + 6900
   * For MIDI: midiNote × 100
   */
  midiCents: number;
  /** Detected onset offset in ms from when Play was pressed */
  onsetMs: number;
  /** Raw detection confidence [0, 1] */
  confidence: number;
}

// ─── Comparison & Result ──────────────────────────────────────────────────────

/**
 * Classification of one beat slot.
 * - correct: pitch within ±50 cents AND timing within ±200 ms
 * - wrong-pitch: deviation > 50 cents
 * - wrong-timing: pitch ok but outside timing window
 * - missed: no response detected
 * - extraneous: unmatched note
 */
export type NoteComparisonStatus =
  | 'correct'
  | 'wrong-pitch'
  | 'wrong-timing'
  | 'missed'
  | 'extraneous';

/** Pairing of one target slot with its best-matching response note (if any) */
export interface NoteComparison {
  target: ExerciseNote;
  response: ResponseNote | null;
  status: NoteComparisonStatus;
  pitchDeviationCents: number | null;
  timingDeviationMs: number | null;
}

/** Complete result for one exercise attempt */
export interface ExerciseResult {
  /** Per-slot comparisons */
  comparisons: NoteComparison[];
  /** Unmatched response notes */
  extraneousNotes: ResponseNote[];
  /** Final score 0–100 */
  score: number;
  /** Slots with correct pitch */
  correctPitchCount: number;
  /** Slots with correct timing */
  correctTimingCount: number;
}

// ─── Complexity Levels ────────────────────────────────────────────────────────

/** The three user-facing complexity levels. */
export type ComplexityLevel = 'low' | 'mid' | 'high';

/**
 * Active complexity level state.
 * null means the user has customised parameters beyond a preset ("custom mode").
 */
export type ActiveComplexityLevel = ComplexityLevel | null;

/** A named preset that maps a ComplexityLevel to exercise configuration + tempo. */
export interface ComplexityPreset {
  bpm: number;
  config: Pick<ExerciseConfig, 'preset' | 'noteCount' | 'clef' | 'octaveRange' | 'mode'>;
  /** Brief parameter summary shown beneath the level button. */
  description: string;
}

/** All three complexity presets. */
export type ComplexityPresets = Record<ComplexityLevel, ComplexityPreset>;

/** localStorage key used to persist the selected complexity level across sessions. */
export const COMPLEXITY_LEVEL_STORAGE_KEY = 'train-complexity-level-v1';

/**
 * Preset definitions for Low / Mid / High complexity levels.
 * FR-002 (Low), FR-003 (Mid), FR-004 (High).
 */
export const COMPLEXITY_PRESETS: ComplexityPresets = {
  low: {
    bpm: 40,
    config: { preset: 'c4scale', noteCount: 8, clef: 'Treble', octaveRange: 1, mode: 'step' },
    description: '8 notes · Treble · 40 BPM · Step',
  },
  mid: {
    bpm: 80,
    config: { preset: 'random', noteCount: 16, clef: 'Treble', octaveRange: 1, mode: 'step' },
    description: '16 notes · Treble · 80 BPM · Step',
  },
  high: {
    bpm: 100,
    config: { preset: 'random', noteCount: 20, clef: 'Bass', octaveRange: 2, mode: 'flow' },
    description: '20 notes · Bass · 100 BPM · Flow',
  },
};
