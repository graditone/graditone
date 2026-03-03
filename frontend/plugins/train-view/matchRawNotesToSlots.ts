/**
 * matchRawNotesToSlots.ts — Plugin-internal slot alignment
 * Feature 036: Rename Practice Plugin to Train
 *
 * Adapted from src/services/practice/usePracticeRecorder.ts:matchRawNotesToSlots.
 * Imports ONLY from ./trainTypes — no src/ imports permitted (ESLint boundary).
 *
 * For each slot, the closest unmatched raw note within one full beat period is
 * chosen. Response notes outside every slot window are returned as extraneous.
 */

import type { TrainExercise, ResponseNote } from './trainTypes';

/**
 * matchRawNotesToSlots — pairs recorded notes to exercise slots by nearest timing.
 *
 * For each exercise slot, searches rawNotes for the closest note (by onset time)
 * that falls within one full beat period. This window catches detection latency
 * on the first beat while respecting genuine gaps.
 *
 * @param exercise  The target exercise (provides slot count and timing)
 * @param rawNotes  All ResponseNotes collected in temporal order
 * @returns         Per-slot responses (null = missed) + unmatched extraneous notes
 */
export function matchRawNotesToSlots(
  exercise: TrainExercise,
  rawNotes: ResponseNote[],
): { responses: (ResponseNote | null)[]; extraneousNotes: ResponseNote[] } {
  const msPerBeat = 60_000 / exercise.bpm;
  const window = msPerBeat; // full-beat tolerance
  const responses: (ResponseNote | null)[] = new Array(exercise.notes.length).fill(null);
  const usedIndices = new Set<number>();

  for (const exNote of exercise.notes) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < rawNotes.length; i++) {
      if (usedIndices.has(i)) continue;
      const dist = Math.abs(rawNotes[i].onsetMs - exNote.expectedOnsetMs);
      if (dist < window && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      usedIndices.add(bestIdx);
      responses[exNote.slotIndex] = rawNotes[bestIdx];
    }
  }

  const extraneousNotes = rawNotes.filter((_, i) => !usedIndices.has(i));
  return { responses, extraneousNotes };
}
