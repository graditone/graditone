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
export type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'pending';

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
  /** Number of wrong attempts before getting this note correct. */
  readonly wrongAttempts: number;
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
export type PracticeMode = 'inactive' | 'waiting' | 'active' | 'complete';

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
};
