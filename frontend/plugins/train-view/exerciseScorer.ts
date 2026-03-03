/**
 * exerciseScorer.ts — Plugin-internal beat-slot scoring
 * Feature 036: Rename Practice Plugin to Train
 *
 * Adapted from src/services/practice/exerciseScorer.ts.
 * Imports ONLY from ./trainTypes — no src/ imports permitted (ESLint boundary).
 *
 * Exports:
 * - scoreCapture(exercise, rawNotes, options?) → ExerciseResult
 *   Accepts ResponseNote[] directly (pre-converted from PluginPitchEvent or MIDI).
 * - scoreExercise(exercise, responses, extraneousNotes, options?) → ExerciseResult
 *   Accepts pre-slotted responses + extraneous list (used internally by scoreCapture).
 */

import type {
  TrainExercise,
  ResponseNote,
  NoteComparison,
  NoteComparisonStatus,
  ExerciseResult,
} from './trainTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Pitch match threshold in cents (FR-008) */
const PITCH_TOLERANCE_CENTS = 50;
/** Timing match window in ms (FR-006, FR-008) */
const TIMING_TOLERANCE_MS = 200;

// ─── Slot matcher ─────────────────────────────────────────────────────────────

/**
 * matchRawNotesToSlots — pairs recorded notes to exercise slots by nearest timing.
 * Imported from the companion module to avoid duplication.
 */
import { matchRawNotesToSlots } from './matchRawNotesToSlots';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * scoreCapture — the primary entry point for the plugin.
 *
 * Takes raw response notes (already converted from PluginPitchEvent or MIDI)
 * and an exercise, then matches notes to slots and computes the final score.
 *
 * @param exercise   The target exercise (immutable after generation)
 * @param rawNotes   All ResponseNotes collected during the exercise
 * @param options    includeTimingScore: true = MIDI mode (timing matters)
 */
export function scoreCapture(
  exercise: TrainExercise,
  rawNotes: ResponseNote[],
  options: { includeTimingScore?: boolean } = {},
): ExerciseResult {
  const { responses, extraneousNotes } = matchRawNotesToSlots(exercise, rawNotes);
  return scoreExercise(exercise, responses, extraneousNotes, options);
}

/**
 * scoreExercise — classify each beat slot and compute the final score.
 *
 * @param exercise          The target exercise
 * @param responses         Per-slot response array (null = missed slot)
 * @param extraneousNotes   ResponseNotes not matched to any slot
 * @param options.includeTimingScore  When true (MIDI mode), timing accuracy
 *                          contributes 50% of the score. Default false (mic mode).
 */
export function scoreExercise(
  exercise: TrainExercise,
  responses: (ResponseNote | null)[],
  extraneousNotes: ResponseNote[],
  options: { includeTimingScore?: boolean } = {},
): ExerciseResult {
  let correctPitchCount = 0;
  let correctTimingCount = 0;

  const comparisons: NoteComparison[] = exercise.notes.map((target, i) => {
    const response: ResponseNote | null = responses[i] ?? null;

    if (response === null) {
      return {
        target,
        response: null,
        status: 'missed' as NoteComparisonStatus,
        pitchDeviationCents: null,
        timingDeviationMs: null,
      };
    }

    const targetMidiCents = target.midiPitch * 100;
    const pitchDeviationCents = Math.abs(response.midiCents - targetMidiCents);
    const pitchOk = pitchDeviationCents <= PITCH_TOLERANCE_CENTS;

    const timingDeviationMs = Math.abs(response.onsetMs - target.expectedOnsetMs);
    const timingOk = timingDeviationMs <= TIMING_TOLERANCE_MS;

    let status: NoteComparisonStatus;
    if (pitchOk && timingOk) {
      status = 'correct';
      correctPitchCount++;
      correctTimingCount++;
    } else if (pitchOk && !timingOk) {
      status = 'wrong-timing';
      correctPitchCount++;
    } else if (!pitchOk && timingOk) {
      status = 'wrong-pitch';
      correctTimingCount++;
    } else {
      status = 'wrong-pitch';
    }

    return {
      target,
      response,
      status,
      pitchDeviationCents,
      timingDeviationMs,
    };
  });

  const n = exercise.notes.length;
  const score = n === 0 ? 0 : options.includeTimingScore
    ? Math.round(50 * correctPitchCount / n + 50 * correctTimingCount / n)
    : Math.round(100 * correctPitchCount / n);

  return {
    comparisons,
    extraneousNotes,
    score,
    correctPitchCount,
    correctTimingCount,
  };
}
