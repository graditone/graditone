/**
 * Practice View Plugin — Type Definitions (T023)
 * Feature 037: Practice View Plugin
 *
 * Defines the pure data types used by the practice engine state machine.
 * No side effects, no coordinate calculations (Principle VI).
 */

import type { PluginPracticeNoteEntry } from '../../src/plugin-api/index';

// ---------------------------------------------------------------------------
// Re-export — PracticeNoteEntry is a direct alias for the v6 plugin API type
// ---------------------------------------------------------------------------

export type PracticeNoteEntry = PluginPracticeNoteEntry;

// ---------------------------------------------------------------------------
// Per-note result tracking
// ---------------------------------------------------------------------------

/** Outcome of a single note during practice. */
export type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'pending' | 'early-release' | 'auto-advanced';

/** Recorded result for one note entry in the practice session. */
export interface PracticeNoteResult {
  /** Index into the notes array. */
  readonly noteIndex: number;
  /** Outcome of the attempt. */
  readonly outcome: NoteOutcome;
  /** MIDI note played by the user (0 for pending). */
  readonly playedMidi: number;
  /** Expected MIDI pitches from the score. */
  readonly expectedMidi: ReadonlyArray<number>;
  /**
   * Time in ms from practice start when the user played this note.
   * 0 for pending notes.
   */
  readonly responseTimeMs: number;
  /**
   * Expected time in ms based on tick position and BPM.
   * 0 if unknown.
   */
  readonly expectedTimeMs: number;
  /**
   * Relative timing delta in ms — how far off the interval between
   * this note and the previous one was compared to the expected interval.
   * 0 for the first note (no reference point).
   */
  readonly relativeDeltaMs: number;
  /** Number of wrong attempts before getting this note correct. */
  readonly wrongAttempts: number;
  /**
   * How long the user actually held the note in ms (feature 042).
   * 0 for notes that do not require a hold (durationTicks === 0).
   */
  readonly holdDurationMs: number;
  /**
   * Required hold duration in ms at the current BPM (feature 042).
   * 0 for notes that do not require a hold.
   */
  readonly requiredHoldMs: number;
}

/** A single wrong-note event captured during practice (038-practice-replay Phase B). */
export interface WrongNoteEvent {
  /** MIDI note the user played (wrong pitch). */
  readonly midiNote: number;
  /** Time in ms from practice start when the wrong note was played. */
  readonly responseTimeMs: number;
  /** Index into the notes array — which target note was active when the mistake happened. */
  readonly noteIndex: number;
}

// ---------------------------------------------------------------------------
// Practice State Machine Types
// ---------------------------------------------------------------------------

/** Current state of the practice session. */
export type PracticeMode = 'inactive' | 'waiting' | 'active' | 'holding' | 'complete';
// 'holding' (feature 042): the user pressed the correct pitch(es) but must
// sustain them for ≥90% of the note's written duration before the session advances.

/** Full state of the practice engine — produced by `reduce()`. */
export interface PracticeState {
  /** Current practice session mode. */
  readonly mode: PracticeMode;
  /**
   * The ordered list of note entries to practice through.
   * Empty when mode is 'inactive' and no session has been started yet.
   */
  readonly notes: ReadonlyArray<PracticeNoteEntry>;
  /**
   * Index into `notes` pointing at the current target note.
   * 0 when mode is 'inactive' or 'complete'.
   * Advance on each CORRECT_MIDI event.
   */
  readonly currentIndex: number;
  /** Which staff the notes were extracted from (0-based). */
  readonly selectedStaffIndex: number;
  /** Per-note results recorded during the session. */
  readonly noteResults: ReadonlyArray<PracticeNoteResult>;
  /** Running count of wrong MIDI presses for the current note. */
  readonly currentWrongAttempts: number;
  /** All wrong-note events captured during this session (038-practice-replay Phase B). */
  readonly wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  /**
   * Wall-clock ms at which the current hold began (feature 042).
   * Set when entering 'holding' mode; cleared (set to 0) when exiting.
   * The component owns wall-clock time — the reducer receives this value
   * from the CORRECT_MIDI action and stores it here.
   */
  readonly holdStartTimeMs: number;
  /**
   * Required hold duration in ms for the current note at the session BPM (feature 042).
   * Computed by the component from entry.durationTicks and stored here for the rAF loop.
   * 0 when not in 'holding' mode.
   */
  readonly requiredHoldMs: number;
  /**
   * The MIDI note pressed when entering 'holding' mode (feature 042).
   * Used by HOLD_COMPLETE to reconstruct the PracticeNoteResult. 0 when not holding.
   */
  readonly holdMidiNote: number;
  /**
   * The responseTimeMs from the CORRECT_MIDI action that started the hold (feature 042).
   * Used by HOLD_COMPLETE for timing result. 0 when not holding.
   */
  readonly holdResponseTimeMs: number;
  /**
   * The expectedTimeMs from the CORRECT_MIDI action that started the hold (feature 042).
   * Used by HOLD_COMPLETE for relativeDeltaMs computation. 0 when not holding.
   */
  readonly holdExpectedTimeMs: number;
  /**
   * The endIndex from the CORRECT_MIDI action that started the hold (feature 042).
   * -1 means "use notes.length - 1". -1 when not holding.
   */
  readonly holdEndIndex: number;
  /**
   * Index into noteResults[] where the current loop's results begin.
   * Set to noteResults.length on each LOOP_RESTART so that early-release
   * retry detection is scoped to the current loop only (prevents stale results
   * from previous loops being mistaken for the current loop's results).
   */
  readonly currentLoopResultOffset: number;
}

/** Describes a staff available for selection during practice setup. */
export interface SelectedStaff {
  /** Zero-based staff index (matches staffIndex arg of extractPracticeNotes). */
  readonly index: number;
  /** Human-readable label, e.g. "Treble Clef" or "Staff 1". */
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Practice Actions
// ---------------------------------------------------------------------------

/** Union of all actions accepted by the practice engine reducer. */
export type PracticeAction =
  | {
      /**
       * Hold timer completed ≥90% of requiredHoldMs (feature 042).
       * Dispatched by the rAF loop in PracticeViewPlugin.
       * No-op if mode !== 'holding'.
       */
      readonly type: 'HOLD_COMPLETE';
      /** Hold duration actually elapsed in ms. */
      readonly holdDurationMs: number;
    }
  | {
      /**
       * User released a required pitch before the hold threshold (feature 042).
       * Dispatched by the MIDI release handler in PracticeViewPlugin.
       * No-op if mode !== 'holding'.
       * The session stays on the same note; user may retry.
       */
      readonly type: 'EARLY_RELEASE';
      /** How long the user actually held the note in ms. */
      readonly holdDurationMs: number;
    }
  | {
      /** Start a new practice session. */
      readonly type: 'START';
      /** Pre-extracted note entries for this session. */
      readonly notes: ReadonlyArray<PracticeNoteEntry>;
      /** Staff index used when extracting notes. */
      readonly staffIndex: number;
      /**
       * Index into `notes` to begin at (supports seek-based start).
       * Defaults to 0.
       */
      readonly startIndex: number;
    }
  | {
      readonly type: 'CORRECT_MIDI';
      /** MIDI note that the user played. */
      readonly midiNote: number;
      /** Time in ms from practice start. */
      readonly responseTimeMs: number;
      /** Expected time in ms based on tick & BPM. */
      readonly expectedTimeMs: number;
      /** Optional: last index in notes[] for this session (loop-region completion). */
      readonly endIndex?: number;
      /**
       * Wall-clock ms when the key was pressed (feature 042).
       * Used to initialise holdStartTimeMs in the state when entering 'holding' mode.
       * The component is responsible for supplying Date.now() here.
       * Defaults to 0 (no-op) when not provided.
       */
      readonly pressTimeMs?: number;
      /**
       * Required hold duration in ms for this entry at the current BPM (feature 042).
       * `(entry.durationTicks / ((bpm / 60) * 960)) * 1000`
       * 0 (or absent) means no hold is required (entry.durationTicks === 0).
       */
      readonly requiredHoldMs?: number;
    }
  | {
      readonly type: 'WRONG_MIDI';
      /** MIDI note that the user played (wrong). */
      readonly midiNote: number;
      /** Time in ms from practice start (038-practice-replay Phase B). */
      readonly responseTimeMs: number;
    }
  | { readonly type: 'STOP' }
  | { readonly type: 'DEACTIVATE' }
  | {
      readonly type: 'SEEK';
      /** Target index in `notes` to jump to during active mode. */
      readonly index: number;
    }
  | {
      readonly type: 'LOOP_RESTART';
      /** Index in `notes` to restart the loop from. */
      readonly startIndex: number;
    };

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

export const INITIAL_PRACTICE_STATE: PracticeState = {
  mode: 'inactive',
  notes: [],
  currentIndex: 0,
  selectedStaffIndex: 0,
  noteResults: [],
  currentWrongAttempts: 0,
  wrongNoteEvents: [],
  holdStartTimeMs: 0,
  requiredHoldMs: 0,
  holdMidiNote: 0,
  holdResponseTimeMs: 0,
  holdExpectedTimeMs: 0,
  holdEndIndex: -1,
  currentLoopResultOffset: 0,
};
