/**
 * exerciseGenerator.ts — Plugin-internal exercise factory
 * Feature 036: Rename Practice Plugin to Train
 *
 * Adapted from src/services/practice/exerciseGenerator.ts.
 * Imports ONLY from ./trainTypes — no src/ imports permitted (ESLint boundary).
 *
 * Exports:
 * - generateExercise(bpm?, config?, seed?) → TrainExercise
 * - generateC4ScaleExercise(bpm?, noteCount?, clef?) → TrainExercise
 * - DEFAULT_EXERCISE_CONFIG
 */

import type { ExerciseConfig, ExerciseNote, TrainExercise } from './trainTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_BPM = 80;

/** Diatonic pitches from C4 to C5 inclusive (C4=60, D4=62 ... C5=72) */
const C4_TO_C5_PITCHES: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72];

/** Diatonic pitches from C3 to C4 inclusive (C3=48, D3=50 ... C4=60) */
const C3_TO_C4_PITCHES: readonly number[] = [48, 50, 52, 53, 55, 57, 59, 60];

/**
 * Diatonic note pools keyed by "Clef-OctaveRange".
 * Treble-1: C4–C5 (60–72) · Treble-2: C3–C5 (48–72)
 * Bass-1: C3–C4 (48–60) · Bass-2: C2–C4 (36–60)
 */
const NOTE_POOLS: Record<string, readonly number[]> = {
  'Treble-1': [60, 62, 64, 65, 67, 69, 71, 72],
  'Treble-2': [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72],
  'Bass-1':   [48, 50, 52, 53, 55, 57, 59, 60],
  'Bass-2':   [36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60],
};

// ─── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
  preset: 'random',
  noteCount: 8,
  clef: 'Treble',
  octaveRange: 1,
  mode: 'flow',
  stepTimeoutMultiplier: 4,
};

// ─── PRNG ─────────────────────────────────────────────────────────────────────

/**
 * A simple, fast 32-bit seeded PRNG (mulberry32).
 * Returns a function that produces values in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a practice exercise from the given config.
 * When config.preset === 'c4scale', delegates to generateC4ScaleExercise.
 * When config.preset === 'score', delegates to generateScoreExercise using
 * the supplied scorePitches (returns an empty exercise when pitches are absent).
 *
 * @param bpm          Tempo in beats per minute (default 80)
 * @param config       Exercise configuration (default: 8 random Treble-1 notes)
 * @param seed         Optional seed for deterministic output (useful in tests)
 * @param scorePitches Pitches extracted from the loaded score (required for 'score' preset)
 */
export function generateExercise(
  bpm: number = DEFAULT_BPM,
  config: ExerciseConfig = DEFAULT_EXERCISE_CONFIG,
  seed?: number,
  scorePitches?: ReadonlyArray<{ midiPitch: number }>,
): TrainExercise {
  if (config.preset === 'c4scale') {
    return generateC4ScaleExercise(bpm, config.noteCount, config.clef);
  }
  if (config.preset === 'score') {
    if (!scorePitches || scorePitches.length === 0) {
      return { notes: [], bpm };
    }
    return generateScoreExercise(bpm, scorePitches, config.noteCount);
  }

  const poolKey = `${config.clef}-${config.octaveRange}`;
  const pool = NOTE_POOLS[poolKey] ?? NOTE_POOLS['Treble-1'];
  const rand = seed !== undefined ? mulberry32(seed) : Math.random;
  const msPerBeat = 60_000 / bpm;

  const notes: ExerciseNote[] = Array.from({ length: config.noteCount }, (_, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch: pool[Math.floor(rand() * pool.length)],
    expectedOnsetMs: i * msPerBeat,
  }));

  return { notes, bpm };
}

/**
 * Returns a fixed ascending C major scale exercise:
 *   - Treble: C4–C5 (MIDI 60–72)
 *   - Bass:   C3–C4 (MIDI 48–60)
 * Useful for debugging: expected pitches are known and predictable.
 */
export function generateC4ScaleExercise(
  bpm: number = DEFAULT_BPM,
  noteCount = 8,
  clef: 'Treble' | 'Bass' = 'Treble',
): TrainExercise {
  const pitches = clef === 'Bass' ? C3_TO_C4_PITCHES : C4_TO_C5_PITCHES;
  const msPerBeat = 60_000 / bpm;
  const num = Math.min(noteCount, pitches.length);
  const notes: ExerciseNote[] = pitches.slice(0, num).map((midiPitch, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch,
    expectedOnsetMs: i * msPerBeat,
  }));
  return { notes, bpm };
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
  pitches: ReadonlyArray<{ midiPitch: number }>,
  noteCount: number,
): TrainExercise {
  const msPerBeat = 60_000 / bpm;
  const num = Math.min(noteCount, pitches.length);
  const notes: ExerciseNote[] = pitches.slice(0, num).map((p, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch: p.midiPitch,
    expectedOnsetMs: i * msPerBeat,
  }));
  return { notes, bpm };
}
