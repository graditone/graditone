/**
 * exerciseScorer.test.ts — Unit tests for BPM-weighted train scoring.
 * Feature 072: Tempo Impact on Practice and Train Results
 *
 * TDD: these tests are written BEFORE the implementation changes (T008).
 * They MUST fail until T009 is applied to exerciseScorer.ts.
 */

import { describe, it, expect } from 'vitest';
import { scoreExercise } from './exerciseScorer';
import type { TrainExercise, ResponseNote } from './trainTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal TrainExercise with N notes at the given BPM. */
function makeExercise(n: number, bpm: number): TrainExercise {
  const notes = Array.from({ length: n }, (_, i) => ({
    id: `ex-${i}`,
    slotIndex: i,
    midiPitch: 60 + i,
    expectedOnsetMs: i * (60_000 / bpm),
  }));
  return { notes, bpm };
}

/** Build per-slot ResponseNote array: all correct pitches, on time. */
function allCorrectResponses(exercise: TrainExercise): (ResponseNote | null)[] {
  return exercise.notes.map((note) => ({
    midiCents: note.midiPitch * 100,
    onsetMs: note.expectedOnsetMs,
  }));
}

/** Build per-slot ResponseNote array: all wrong pitches (off by 500 cents). */
function allWrongResponses(exercise: TrainExercise): (ResponseNote | null)[] {
  return exercise.notes.map((note) => ({
    midiCents: note.midiPitch * 100 + 500,
    onsetMs: note.expectedOnsetMs,
  }));
}

/** Build per-slot responses with a given fraction correct (by pitch). */
function partialCorrectResponses(exercise: TrainExercise, fraction: number): (ResponseNote | null)[] {
  const n = exercise.notes.length;
  const correctCount = Math.round(n * fraction);
  return exercise.notes.map((note, i) => ({
    midiCents: i < correctCount ? note.midiPitch * 100 : note.midiPitch * 100 + 500,
    onsetMs: note.expectedOnsetMs,
  }));
}

// ─── Reference BPM (80) — neutral factor ─────────────────────────────────────

describe('exerciseScorer — 80 BPM (reference, neutral factor)', () => {
  it('returns score of 80 for 80% pitch accuracy at 80 BPM', () => {
    const exercise = makeExercise(10, 80);
    const responses = partialCorrectResponses(exercise, 0.8);
    const result = scoreExercise(exercise, responses, []);
    // bpmFactor = 1 - log2(80/80) = 1 - 0 = 1.0; penalty = 20; adjusted = 100 - 20*1 = 80
    expect(result.score).toBe(80);
  });

  it('returns score of 100 for 100% pitch accuracy at 80 BPM', () => {
    const exercise = makeExercise(10, 80);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.score).toBe(100);
  });

  it('stores bpm = 80 in the result', () => {
    const exercise = makeExercise(10, 80);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.bpm).toBe(80);
  });
});

// ─── Low BPM (40) — penalty amplified ────────────────────────────────────────

describe('exerciseScorer — 40 BPM (low, penalty doubled)', () => {
  it('returns score of 60 for 80% pitch accuracy at 40 BPM (SC-002)', () => {
    const exercise = makeExercise(10, 40);
    const responses = partialCorrectResponses(exercise, 0.8);
    const result = scoreExercise(exercise, responses, []);
    // bpmFactor = clamp(1 - log2(40/80), 0.5, 2.0) = clamp(1 - (-1), 0.5, 2.0) = clamp(2, 0.5, 2.0) = 2.0
    // penalty = 20; adjusted = 100 - 20*2 = 60
    expect(result.score).toBe(60);
  });

  it('returns score of 100 for 100% pitch accuracy at 40 BPM (perfect always 100)', () => {
    const exercise = makeExercise(10, 40);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.score).toBe(100);
  });

  it('stores bpm = 40 in the result', () => {
    const exercise = makeExercise(10, 40);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.bpm).toBe(40);
  });
});

// ─── High BPM (100) — penalty reduced ────────────────────────────────────────

describe('exerciseScorer — 100 BPM (high, penalty reduced)', () => {
  it('returns score > 80 for 80% pitch accuracy at 100 BPM (SC-002: 100 BPM score > 40 BPM score)', () => {
    const exercise = makeExercise(10, 100);
    const responses = partialCorrectResponses(exercise, 0.8);
    const result = scoreExercise(exercise, responses, []);
    // bpmFactor = clamp(1 - log2(100/80), 0.5, 2.0) ≈ clamp(1 - 0.322, ...) ≈ 0.678
    // penalty = 20; adjusted = round(100 - 20*0.678) = round(100 - 13.56) = round(86.44) = 86
    expect(result.score).toBeGreaterThan(80);
  });

  it('100 BPM 80%-accuracy scores higher than 40 BPM 80%-accuracy (SC-002)', () => {
    const ex40 = makeExercise(10, 40);
    const ex100 = makeExercise(10, 100);
    const score40 = scoreExercise(ex40, partialCorrectResponses(ex40, 0.8), []).score;
    const score100 = scoreExercise(ex100, partialCorrectResponses(ex100, 0.8), []).score;
    expect(score100).toBeGreaterThan(score40);
    // SC-002: difference must be at least 10 points
    expect(score100 - score40).toBeGreaterThanOrEqual(10);
  });

  it('returns score of 100 for 100% pitch accuracy at 100 BPM', () => {
    const exercise = makeExercise(10, 100);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.score).toBe(100);
  });

  it('stores bpm = 100 in the result', () => {
    const exercise = makeExercise(10, 100);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.bpm).toBe(100);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('exerciseScorer — edge cases', () => {
  it('bpm = 0 fallback: score equals raw pitch accuracy (guard, FR-005)', () => {
    const exerciseZeroBpm = makeExercise(10, 0);
    const responses = partialCorrectResponses(exerciseZeroBpm, 0.8);
    const result = scoreExercise(exerciseZeroBpm, responses, []);
    // bpm=0 → guard uses reference 80 → bpmFactor = 1.0 → score = rawScore
    expect(result.score).toBe(80);
  });

  it('bpm = 0: result.bpm is 0 (stored as-is)', () => {
    const exerciseZeroBpm = makeExercise(5, 0);
    const result = scoreExercise(exerciseZeroBpm, allCorrectResponses(exerciseZeroBpm), []);
    expect(result.bpm).toBe(0);
  });

  it('score never goes below 0 even at very low BPM with 0% accuracy', () => {
    const exercise = makeExercise(10, 10);
    const result = scoreExercise(exercise, allWrongResponses(exercise), []);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('score never exceeds 100', () => {
    const exercise = makeExercise(10, 200);
    const result = scoreExercise(exercise, allCorrectResponses(exercise), []);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
