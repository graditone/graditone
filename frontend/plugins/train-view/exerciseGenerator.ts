/**
 * exerciseGenerator.ts — Plugin-internal exercise factory
 * Feature 036: Rename Practice Plugin to Train
 *
 * Imports ONLY from ./trainTypes and the Plugin API barrel — no other src/ imports.
 *
 * Exports:
 * - generateExercise(bpm?, config?) → TrainExercise
 * - generateScaleExercise(bpm, scaleId, octaveRange) → TrainExercise
 * - generateScoreExercise(bpm, pitches, noteCount) → TrainExercise
 * - DEFAULT_EXERCISE_CONFIG
 *
 * The scale catalog (SCALE_OPTIONS / ScaleOption) is host-owned shared data,
 * consumed through the Plugin API barrel (moved here from this file so other
 * plugins no longer import a plugin internal).
 */

import type { ExerciseConfig, ExerciseNote, TrainExercise } from './trainTypes';
import { SCALE_OPTIONS } from '../../src/plugin-api/index';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_BPM = 80;

// ─── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  preset: 'scales',
  noteCount: 8,
  clef: 'Treble',
  octaveRange: 1,
  scaleId: 'c-major',
  mode: 'flow',
  stepTimeoutMultiplier: 4,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a practice exercise from the given config.
 * Delegates to generateScaleExercise for 'scales' preset and
 * generateScoreExercise for 'score' preset.
 *
 * @param bpm          Tempo in beats per minute (default 80)
 * @param config       Exercise configuration
 */
export function generateExercise(
  bpm: number = DEFAULT_BPM,
  config: ExerciseConfig = DEFAULT_EXERCISE_CONFIG,
): TrainExercise {
  if (config.preset === 'scales') {
    return generateScaleExercise(bpm, config.scaleId, config.octaveRange);
  }
  // preset === 'score' — scorePitches handled directly by callers
  return { notes: [], bpm };
}

/**
 * Generate a scale exercise for the given scale and octave range.
 * Produces 8 ascending notes per octave (root through octave).
 * The clef is always Treble and starts at the scale's root in octave 4.
 *
 * @param bpm         Tempo in beats per minute
 * @param scaleId     Scale identifier from SCALE_OPTIONS (e.g. 'c-major')
 * @param octaveRange Number of octaves (1–4)
 */
export function generateScaleExercise(
  bpm: number = DEFAULT_BPM,
  scaleId: string = 'c-major',
  octaveRange: 1 | 2 | 3 | 4 = 1,
): TrainExercise {
  const scale = SCALE_OPTIONS.find((s) => s.id === scaleId) ?? SCALE_OPTIONS[0];
  const msPerBeat = 60_000 / bpm;

  // 8-note ascending sequence for octave N (root shifted N semitones × 12 higher)
  const ascOct = (n: number): number[] => scale.intervals.map((i) => scale.rootMidi + n * 12 + i);

  // Pattern by octaveRange:
  //   1 → [asc0]                         — 1 up
  //   2 → [asc0, desc0]                  — 1 up, 1 down
  //   3 → [asc0, asc1, desc1]            — 2 up, 1 down
  //   4 → [asc0, asc1, desc1, desc0]     — 2 up, 2 down
  const ascCount = Math.ceil(octaveRange / 2);
  const descCount = Math.floor(octaveRange / 2);

  const pitches: number[] = [];
  for (let n = 0; n < ascCount; n++) {
    pitches.push(...ascOct(n));
  }
  // Descend from the highest ascending octave back down
  for (let n = ascCount - 1; n >= ascCount - descCount; n--) {
    pitches.push(...[...ascOct(n)].reverse());
  }

  const notes: ExerciseNote[] = pitches.map((midiPitch, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch,
    chordPitches: [midiPitch],
    expectedOnsetMs: i * msPerBeat,
  }));
  return { notes, bpm, keySignature: scale.fifths };
}

/**
 * Build a training exercise from pitches extracted from a loaded score.
 * Selects up to `noteCount` pitches from the beginning of the `pitches` array.
 * If `pitches.length < noteCount` the exercise is clamped to `pitches.length`.
 *
 * @param bpm       Tempo in beats per minute
 * @param pitches   Ordered pitch list (e.g. from extractPracticeNotes)
 * @param noteCount Maximum number of notes to include in the exercise
 */
export function generateScoreExercise(
  bpm: number,
  pitches: ReadonlyArray<{ midiPitches: ReadonlyArray<number> }>,
  noteCount: number,
): TrainExercise {
  const msPerBeat = 60_000 / bpm;
  const num = Math.min(noteCount, pitches.length);
  const notes: ExerciseNote[] = pitches.slice(0, num).map((p, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch: p.midiPitches[0],
    chordPitches: [...p.midiPitches],
    expectedOnsetMs: i * msPerBeat,
  }));
  return { notes, bpm };
}
