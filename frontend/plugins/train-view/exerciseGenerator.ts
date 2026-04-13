/**
 * exerciseGenerator.ts — Plugin-internal exercise factory
 * Feature 036: Rename Practice Plugin to Train
 *
 * Adapted from src/services/practice/exerciseGenerator.ts.
 * Imports ONLY from ./trainTypes — no src/ imports permitted (ESLint boundary).
 *
 * Exports:
 * - generateExercise(bpm?, config?) → TrainExercise
 * - generateScaleExercise(bpm, scaleId, octaveRange) → TrainExercise
 * - SCALE_OPTIONS — ordered list for the scale dropdown
 * - DEFAULT_EXERCISE_CONFIG
 */

import type { ExerciseConfig, ExerciseNote, TrainExercise } from './trainTypes';

// ─── Scale definitions ────────────────────────────────────────────────────────

/** Semitone intervals for one ascending octave of a major scale (root → octave). */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12] as const;

/** Semitone intervals for one ascending octave of a natural minor scale. */
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12] as const;

export interface ScaleOption {
  id: string;
  displayName: string;
  /** MIDI pitch of the root in octave 4 */
  rootMidi: number;
  intervals: readonly number[];
  /** MusicXML fifths value: positive = sharps, negative = flats, 0 = C major/A minor */
  fifths: number;
}

/** All 24 scales in circle-of-fifths order (majors then minors). */
export const SCALE_OPTIONS: readonly ScaleOption[] = [
  // Major scales  (fifths: positive = sharps, negative = flats)
  { id: 'c-major',  displayName: 'C Major',       rootMidi: 60, intervals: MAJOR_INTERVALS, fifths:  0 },
  { id: 'g-major',  displayName: 'G Major',       rootMidi: 67, intervals: MAJOR_INTERVALS, fifths:  1 },
  { id: 'd-major',  displayName: 'D Major',       rootMidi: 62, intervals: MAJOR_INTERVALS, fifths:  2 },
  { id: 'a-major',  displayName: 'A Major',       rootMidi: 69, intervals: MAJOR_INTERVALS, fifths:  3 },
  { id: 'e-major',  displayName: 'E Major',       rootMidi: 64, intervals: MAJOR_INTERVALS, fifths:  4 },
  { id: 'b-major',  displayName: 'B Major',       rootMidi: 71, intervals: MAJOR_INTERVALS, fifths:  5 },
  { id: 'fs-major', displayName: 'F\u266f Major', rootMidi: 66, intervals: MAJOR_INTERVALS, fifths:  6 },
  { id: 'db-major', displayName: 'D\u266d Major', rootMidi: 61, intervals: MAJOR_INTERVALS, fifths: -5 },
  { id: 'ab-major', displayName: 'A\u266d Major', rootMidi: 68, intervals: MAJOR_INTERVALS, fifths: -4 },
  { id: 'eb-major', displayName: 'E\u266d Major', rootMidi: 63, intervals: MAJOR_INTERVALS, fifths: -3 },
  { id: 'bb-major', displayName: 'B\u266d Major', rootMidi: 70, intervals: MAJOR_INTERVALS, fifths: -2 },
  { id: 'f-major',  displayName: 'F Major',       rootMidi: 65, intervals: MAJOR_INTERVALS, fifths: -1 },
  // Natural minor scales (relative minor shares key sig with its relative major)
  { id: 'a-minor',  displayName: 'A Minor',       rootMidi: 69, intervals: MINOR_INTERVALS, fifths:  0 },
  { id: 'e-minor',  displayName: 'E Minor',       rootMidi: 64, intervals: MINOR_INTERVALS, fifths:  1 },
  { id: 'b-minor',  displayName: 'B Minor',       rootMidi: 71, intervals: MINOR_INTERVALS, fifths:  2 },
  { id: 'fs-minor', displayName: 'F\u266f Minor', rootMidi: 66, intervals: MINOR_INTERVALS, fifths:  3 },
  { id: 'cs-minor', displayName: 'C\u266f Minor', rootMidi: 61, intervals: MINOR_INTERVALS, fifths:  4 },
  { id: 'gs-minor', displayName: 'G\u266f Minor', rootMidi: 68, intervals: MINOR_INTERVALS, fifths:  5 },
  { id: 'ds-minor', displayName: 'D\u266f Minor', rootMidi: 63, intervals: MINOR_INTERVALS, fifths:  6 },
  { id: 'bb-minor', displayName: 'B\u266d Minor', rootMidi: 70, intervals: MINOR_INTERVALS, fifths: -5 },
  { id: 'f-minor',  displayName: 'F Minor',       rootMidi: 65, intervals: MINOR_INTERVALS, fifths: -4 },
  { id: 'c-minor',  displayName: 'C Minor',       rootMidi: 60, intervals: MINOR_INTERVALS, fifths: -3 },
  { id: 'g-minor',  displayName: 'G Minor',       rootMidi: 67, intervals: MINOR_INTERVALS, fifths: -2 },
  { id: 'd-minor',  displayName: 'D Minor',       rootMidi: 62, intervals: MINOR_INTERVALS, fifths: -1 },
];

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
