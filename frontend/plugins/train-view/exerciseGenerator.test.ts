/**
 * exerciseGenerator.test.ts — T009 / T002
 * Feature 034: Practice from Score
 * Feature 001: Practice Complexity Levels
 *
 * Contract tests for generateScoreExercise() and COMPLEXITY_PRESETS.
 * MUST be written FAILING before T010 / T003 implements the function.
 * Constitution Principle V: Test-First Development.
 *
 * ESLint boundary: no src/ imports.
 */

import { describe, it, expect } from 'vitest';
import { generateScoreExercise } from './exerciseGenerator';
import { COMPLEXITY_PRESETS, COMPLEXITY_LEVEL_STORAGE_KEY } from './trainTypes';

// ─── generateScoreExercise ────────────────────────────────────────────────────

describe('generateScoreExercise()', () => {
  const samplePitches = [
    { midiPitch: 60 },
    { midiPitch: 62 },
    { midiPitch: 64 },
    { midiPitch: 65 },
    { midiPitch: 67 },
  ];

  it('returns a TrainExercise with notes.length === min(noteCount, pitches.length)', () => {
    const exercise = generateScoreExercise(80, samplePitches, 3);
    expect(exercise.notes).toHaveLength(3);
  });

  it('clamps to pitches.length when noteCount > pitches.length', () => {
    const exercise = generateScoreExercise(80, samplePitches, 100);
    expect(exercise.notes).toHaveLength(samplePitches.length);
  });

  it('each exercise note carries the corresponding midiPitch from the input array', () => {
    const exercise = generateScoreExercise(80, samplePitches, 5);
    exercise.notes.forEach((n, i) => {
      expect(n.midiPitch).toBe(samplePitches[i].midiPitch);
    });
  });

  it('expectedOnsetMs uses slotIndex × (60_000 / bpm) — same formula as generateExercise', () => {
    const bpm = 100;
    const msPerBeat = 60_000 / bpm;
    const exercise = generateScoreExercise(bpm, samplePitches, 4);
    exercise.notes.forEach((n, i) => {
      expect(n.expectedOnsetMs).toBeCloseTo(i * msPerBeat, 10);
    });
  });

  it('empty pitches input returns exercise with 0 notes', () => {
    const exercise = generateScoreExercise(80, [], 8);
    expect(exercise.notes).toHaveLength(0);
  });

  it('first note has slotIndex 0 and id ex-0', () => {
    const exercise = generateScoreExercise(80, samplePitches, 3);
    expect(exercise.notes[0].slotIndex).toBe(0);
    expect(exercise.notes[0].id).toBe('ex-0');
  });

  it('last note has slotIndex equal to notes.length - 1', () => {
    const exercise = generateScoreExercise(80, samplePitches, 4);
    const last = exercise.notes[exercise.notes.length - 1];
    expect(last.slotIndex).toBe(3);
  });

  it('bpm field in returned exercise matches the input bpm', () => {
    const exercise = generateScoreExercise(120, samplePitches, 3);
    expect(exercise.bpm).toBe(120);
  });

  it('noteCount of 1 returns a single-note exercise', () => {
    const exercise = generateScoreExercise(80, samplePitches, 1);
    expect(exercise.notes).toHaveLength(1);
    expect(exercise.notes[0].midiPitch).toBe(samplePitches[0].midiPitch);
  });
});

// ─── COMPLEXITY_PRESETS ───────────────────────────────────────────────────────

describe('COMPLEXITY_PRESETS', () => {
  it('exports the three levels: low, mid, high', () => {
    expect(COMPLEXITY_PRESETS).toHaveProperty('low');
    expect(COMPLEXITY_PRESETS).toHaveProperty('mid');
    expect(COMPLEXITY_PRESETS).toHaveProperty('high');
  });

  it('low preset: preset=c4scale, noteCount=8, clef=Treble, octaveRange=1, bpm=40, mode=step', () => {
    const { bpm, config } = COMPLEXITY_PRESETS['low'];
    expect(bpm).toBe(40);
    expect(config.preset).toBe('c4scale');
    expect(config.noteCount).toBe(8);
    expect(config.clef).toBe('Treble');
    expect(config.octaveRange).toBe(1);
    expect(config.mode).toBe('step');
  });

  it('mid preset: preset=random, noteCount=16, clef=Treble, octaveRange=1, bpm=80, mode=step', () => {
    const { bpm, config } = COMPLEXITY_PRESETS['mid'];
    expect(bpm).toBe(80);
    expect(config.preset).toBe('random');
    expect(config.noteCount).toBe(16);
    expect(config.clef).toBe('Treble');
    expect(config.octaveRange).toBe(1);
    expect(config.mode).toBe('step');
  });

  it('high preset: preset=random, noteCount=20, clef=Bass, octaveRange=2, bpm=100, mode=flow', () => {
    const { bpm, config } = COMPLEXITY_PRESETS['high'];
    expect(bpm).toBe(100);
    expect(config.preset).toBe('random');
    expect(config.noteCount).toBe(20);
    expect(config.clef).toBe('Bass');
    expect(config.octaveRange).toBe(2);
    expect(config.mode).toBe('flow');
  });

  it('each preset has a description string', () => {
    for (const level of ['low', 'mid', 'high'] as const) {
      expect(typeof COMPLEXITY_PRESETS[level].description).toBe('string');
      expect(COMPLEXITY_PRESETS[level].description.length).toBeGreaterThan(0);
    }
  });
});

// ─── COMPLEXITY_LEVEL_STORAGE_KEY ─────────────────────────────────────────────

describe('COMPLEXITY_LEVEL_STORAGE_KEY', () => {
  it('equals train-complexity-level-v1', () => {
    expect(COMPLEXITY_LEVEL_STORAGE_KEY).toBe('train-complexity-level-v1');
  });
});
