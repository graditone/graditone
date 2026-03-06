/**
 * Practice View Plugin — Practice Engine (T030)
 * Feature 037: Practice View Plugin
 *
 * Pure state machine — no side effects, no API calls, no coordinates (Principle VI).
 * All logic operates on integer MIDI note numbers (0–127), opaque noteId strings,
 * and integer tick values. No pixel arithmetic.
 *
 * Exports:
 *   isCorrect(midiNote, entry)  — predicate: is this MIDI note the right answer?
 *   reduce(state, action)       — reducer: returns next PracticeState
 */

import type { PracticeNoteEntry, PracticeState, PracticeAction, PracticeNoteResult, WrongNoteEvent } from './practiceEngine.types';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Timing tolerance in ms — if the user plays a correct note more than this
 * many ms away from the expected time (ahead OR behind), it's marked 'correct-late'.
 */
const LATE_THRESHOLD_MS = 500;

// ---------------------------------------------------------------------------
// Predicate
// ---------------------------------------------------------------------------

/**
 * Returns true if `midiNote` is a valid answer for `entry`.
 *
 * For single notes: exact integer match.
 * For chords:       ANY pitch in `entry.midiPitches` is an acceptable answer.
 *
 * Octave matters — MIDI 60 (C4) ≠ MIDI 72 (C5) ≠ MIDI 48 (C3).
 * Principle VI: only integer arithmetic, no coordinates.
 */
export function isCorrect(midiNote: number, entry: PracticeNoteEntry): boolean {
  return entry.midiPitches.includes(midiNote);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for the practice engine state machine.
 *
 * Returns the same `state` reference for no-op transitions
 * (WRONG_MIDI, actions that don't apply in current mode).
 */
export function reduce(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'START': {
      return {
        mode: 'waiting',
        notes: action.notes,
        currentIndex: clamp(action.startIndex, 0, Math.max(0, action.notes.length - 1)),
        selectedStaffIndex: action.staffIndex,
        noteResults: [],
        currentWrongAttempts: 0,
        wrongNoteEvents: [],
      };
    }

    case 'CORRECT_MIDI': {
      if (state.mode !== 'active' && state.mode !== 'waiting') return state;

      // Waiting → active transition: the first correct note starts the clock
      if (state.mode === 'waiting') {
        // Fall through to normal CORRECT_MIDI handling — the caller is
        // responsible for recording practiceStartTime when dispatching.
      }

      const entry = state.notes[state.currentIndex];

      // Compute relative timing delta: how far off was the interval
      // between this note and the previous one vs. the expected interval.
      // First note always gets relativeDeltaMs = 0 (no reference).
      // The caller is responsible for offsetting expectedTimeMs by the loop
      // duration on each iteration so the engine sees monotonically increasing
      // values. This makes the >= guard and interval math work identically
      // for single notes, chords, and multi-note loops.
      const prevResult = state.noteResults.length > 0
        ? state.noteResults[state.noteResults.length - 1]
        : null;
      let relativeDeltaMs = 0;
      if (prevResult) {
        if (action.expectedTimeMs >= prevResult.expectedTimeMs) {
          const actualInterval = action.responseTimeMs - prevResult.responseTimeMs;
          const expectedInterval = action.expectedTimeMs - prevResult.expectedTimeMs;
          relativeDeltaMs = Math.round(actualInterval - expectedInterval);
        }
      }

      const isLate = Math.abs(relativeDeltaMs) > LATE_THRESHOLD_MS;

      const result: PracticeNoteResult = {
        noteIndex: state.currentIndex,
        outcome: isLate ? 'correct-late' : 'correct',
        playedMidi: action.midiNote,
        expectedMidi: entry.midiPitches,
        responseTimeMs: action.responseTimeMs,
        expectedTimeMs: action.expectedTimeMs,
        relativeDeltaMs,
        wrongAttempts: state.currentWrongAttempts,
      };

      const newResults = [...state.noteResults, result];

      const lastIndex = action.endIndex ?? state.notes.length - 1;
      if (state.currentIndex >= lastIndex) {
        // Completed all notes (or loop-region boundary)
        return { ...state, mode: 'complete', noteResults: newResults, currentWrongAttempts: 0 };
      }
      return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, noteResults: newResults, currentWrongAttempts: 0 };
    }

    case 'WRONG_MIDI': {
      if (state.mode !== 'active' && state.mode !== 'waiting') return state;
      const wrongEvent: WrongNoteEvent = {
        midiNote: action.midiNote,
        responseTimeMs: action.responseTimeMs,
        noteIndex: state.currentIndex,
      };
      return {
        ...state,
        currentWrongAttempts: state.currentWrongAttempts + 1,
        wrongNoteEvents: [...state.wrongNoteEvents, wrongEvent],
      };
    }

    case 'STOP': {
      return {
        mode: 'inactive',
        notes: [],
        currentIndex: 0,
        selectedStaffIndex: state.selectedStaffIndex,
        noteResults: [],
        currentWrongAttempts: 0,
        wrongNoteEvents: [],
      };
    }

    case 'DEACTIVATE': {
      if (state.mode === 'inactive') return state;
      // Deactivate preserves currentIndex and notes (differs from STOP)
      return { ...state, mode: 'inactive' };
    }


    case 'SEEK': {
      if (state.mode !== 'active' && state.mode !== 'waiting') return state;
      const idx = clamp(action.index, 0, Math.max(0, state.notes.length - 1));
      if (idx === state.currentIndex) return state;
      return { ...state, currentIndex: idx };
    }

    case 'LOOP_RESTART': {
      if (state.mode !== 'complete') return state;
      const idx = clamp(action.startIndex, 0, Math.max(0, state.notes.length - 1));
      return {
        ...state,
        mode: 'active',
        currentIndex: idx,
        currentWrongAttempts: 0,
      };
    }

    default: {
      // Exhaustive check — TypeScript ensures all cases are handled.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Re-export INITIAL_PRACTICE_STATE for convenience
export { INITIAL_PRACTICE_STATE };

// Export the late threshold for tests
export { LATE_THRESHOLD_MS };
