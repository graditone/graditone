/**
 * freePractice.helpers.ts
 * Feature 092: Free Practice Option
 *
 * Pure types and functions for measure-by-measure MIDI recording during
 * free (score-less) practice sessions. No React imports needed.
 */

import type { PluginNoteEvent } from '../../src/plugin-api/types';

/** One note captured into the current-measure buffer during free practice. */
export interface MeasureNoteEntry {
  midiNote: number;
  /** Wall-clock ms when the key was pressed. */
  attackMs: number;
  /** Wall-clock duration ms — null while the key is still held. */
  durationMs: number | null;
}

/** 4/4 in 960-PPQ: 16 sixteenth-note steps per measure. */
export const FREE_STEPS_PER_MEASURE = 16;

/**
 * Quantize and cap a measure buffer into PluginNoteEvents with timestamps
 * aligned to the 16th-note grid.  `measureEndMs` is used to clamp durations
 * of notes still held at the measure boundary.
 */
export function finalizeMeasureNotes(
  buffer: MeasureNoteEntry[],
  measureStartMs: number,
  bpm: number,
  measureEndMs: number,
): PluginNoteEvent[] {
  const msPerBeat = 60_000 / bpm;
  const msPerSixteenth = msPerBeat / 4;

  return buffer.map(({ midiNote, attackMs, durationMs }) => {
    const relMs = Math.max(0, attackMs - measureStartMs);
    const startStep = Math.max(
      0,
      Math.min(FREE_STEPS_PER_MEASURE - 1, Math.round(relMs / msPerSixteenth)),
    );
    const quantizedAttackMs = measureStartMs + startStep * msPerSixteenth;

    const rawDuration = durationMs ?? measureEndMs - attackMs;
    const durSteps = Math.max(1, Math.round(rawDuration / msPerSixteenth));
    const clampedDurSteps = Math.min(durSteps, FREE_STEPS_PER_MEASURE - startStep);
    const quantizedDurationMs = clampedDurSteps * msPerSixteenth;

    return {
      midiNote,
      timestamp: quantizedAttackMs,
      type: 'attack' as const,
      durationMs: quantizedDurationMs,
    };
  });
}
