/**
 * Practice View Plugin — Practice Engine Tests (T029)
 * Feature 037: Practice View Plugin
 *
 * ⚠️  PRINCIPLE V GATE: These tests were written BEFORE practiceEngine.ts exists.
 *     All tests MUST be RED (failing) on first commit of this file.
 *
 * Covers all state machine transitions for the pure practice engine reducer
 * and the isCorrect() predicate. No side effects, no coordinates.
 */

import { describe, it, expect } from 'vitest';
import { reduce, isCorrect, LATE_THRESHOLD_MS } from './practiceEngine';
import type { PracticeState, PracticeNoteEntry } from './practiceEngine.types';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeNote(midiPitches: number[], noteIds?: string[]): PracticeNoteEntry {
  return {
    midiPitches,
    noteIds: noteIds ?? midiPitches.map((p) => `note-${p}`),
    tick: 0,
  };
}

function makeNoteAtTick(
  tick: number,
  midiPitches: number[],
  noteIds?: string[],
): PracticeNoteEntry {
  return {
    midiPitches,
    noteIds: noteIds ?? midiPitches.map((p) => `note-${p}-t${tick}`),
    tick,
  };
}

const NOTE_C4 = makeNote([60]);   // middle C
const NOTE_D4 = makeNote([62]);
const NOTE_E4 = makeNote([64]);
const CHORD_CEG = makeNote([60, 64, 67]); // C major chord

const THREE_NOTES: PracticeNoteEntry[] = [NOTE_C4, NOTE_D4, NOTE_E4];

function activeState(
  notes: PracticeNoteEntry[],
  currentIndex = 0,
  selectedStaffIndex = 0,
): PracticeState {
  return { mode: 'active', notes, currentIndex, selectedStaffIndex, noteResults: [], currentWrongAttempts: 0, wrongNoteEvents: [] };
}

function waitingState(
  notes: PracticeNoteEntry[],
  currentIndex = 0,
  selectedStaffIndex = 0,
): PracticeState {
  return { mode: 'waiting', notes, currentIndex, selectedStaffIndex, noteResults: [], currentWrongAttempts: 0, wrongNoteEvents: [] };
}

// ---------------------------------------------------------------------------
// isCorrect() — MIDI matching predicate
// ---------------------------------------------------------------------------

describe('isCorrect()', () => {
  it('returns true when midiNote matches the single pitch in entry', () => {
    expect(isCorrect(60, NOTE_C4)).toBe(true);
  });

  it('returns false when midiNote does not match the single pitch', () => {
    expect(isCorrect(61, NOTE_C4)).toBe(false);
  });

  it('returns true when midiNote matches ANY pitch in a chord entry', () => {
    expect(isCorrect(60, CHORD_CEG)).toBe(true);
    expect(isCorrect(64, CHORD_CEG)).toBe(true);
    expect(isCorrect(67, CHORD_CEG)).toBe(true);
  });

  it('returns false when midiNote is not in chord midiPitches', () => {
    expect(isCorrect(61, CHORD_CEG)).toBe(false);
  });

  it('wrong octave: C3 (48) does not match C4 (60)', () => {
    expect(isCorrect(48, NOTE_C4)).toBe(false);
  });

  it('wrong octave: C5 (72) does not match C4 (60)', () => {
    expect(isCorrect(72, NOTE_C4)).toBe(false);
  });

  it('boundary: midiNote 0 matches entry with pitch 0', () => {
    const note = makeNote([0]);
    expect(isCorrect(0, note)).toBe(true);
  });

  it('boundary: midiNote 127 matches entry with pitch 127', () => {
    const note = makeNote([127]);
    expect(isCorrect(127, note)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// reduce() — state machine transitions
// ---------------------------------------------------------------------------

describe('reduce() — START action', () => {
  it('transitions from inactive to waiting mode (deferred start)', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes: THREE_NOTES,
      staffIndex: 0,
      startIndex: 0,
    });
    expect(next.mode).toBe('waiting');
  });

  it('sets currentIndex to startIndex (0 by default)', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes: THREE_NOTES,
      staffIndex: 0,
      startIndex: 0,
    });
    expect(next.currentIndex).toBe(0);
  });

  it('supports non-zero startIndex for seek-based start', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes: THREE_NOTES,
      staffIndex: 0,
      startIndex: 2,
    });
    expect(next.currentIndex).toBe(2);
  });

  it('stores the notes array reference', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes: THREE_NOTES,
      staffIndex: 0,
      startIndex: 0,
    });
    expect(next.notes).toBe(THREE_NOTES);
  });

  it('stores selectedStaffIndex', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes: THREE_NOTES,
      staffIndex: 1,
      startIndex: 0,
    });
    expect(next.selectedStaffIndex).toBe(1);
  });
});

describe('reduce() — CORRECT_MIDI action', () => {
  it('advances currentIndex by 1 when not on last note', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(next.currentIndex).toBe(1);
    expect(next.mode).toBe('active');
  });

  it('advances through all intermediate notes', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(s.currentIndex).toBe(1);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 2000, expectedTimeMs: 2000 });
    expect(s.currentIndex).toBe(2);
  });

  it('transitions to complete mode when last note is played', () => {
    const state = activeState(THREE_NOTES, 2); // index at last note
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 3000, expectedTimeMs: 3000 });
    expect(next.mode).toBe('complete');
  });

  it('preserves currentIndex at last position when mode becomes complete', () => {
    const state = activeState(THREE_NOTES, 2);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 3000, expectedTimeMs: 3000 });
    expect(next.currentIndex).toBe(2);
  });

  it('does nothing when mode is inactive', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(next).toStrictEqual(INITIAL_PRACTICE_STATE);
  });

  it('does nothing when mode is complete', () => {
    const state: PracticeState = {
      mode: 'complete',
      notes: THREE_NOTES,
      currentIndex: 2,
      selectedStaffIndex: 0,
      noteResults: [],
      currentWrongAttempts: 0,
    };
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 3000, expectedTimeMs: 3000 });
    expect(next).toStrictEqual(state);
  });

  it('transitions from waiting to active on first correct note', () => {
    const state = waitingState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0 });
    expect(next.mode).toBe('active');
    expect(next.currentIndex).toBe(1);
  });

  it('advances and records result when in waiting mode', () => {
    const state = waitingState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0 });
    expect(next.noteResults).toHaveLength(1);
    expect(next.noteResults[0].outcome).toBe('correct');
  });
});

describe('reduce() — WRONG_MIDI action', () => {
  it('increments currentWrongAttempts when wrong note pressed', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 });
    expect(next.currentWrongAttempts).toBe(1);
    expect(next.currentIndex).toBe(1); // index unchanged
    expect(next.mode).toBe('active');
  });

  it('accepts WRONG_MIDI in waiting mode', () => {
    const state = waitingState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 200 });
    expect(next.currentWrongAttempts).toBe(1);
    expect(next.mode).toBe('waiting');
  });

  it('accumulates wrong attempts across multiple presses', () => {
    let s = activeState(THREE_NOTES, 1);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 });
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 63, responseTimeMs: 600 });
    expect(s.currentWrongAttempts).toBe(2);
  });

  it('does NOT change state when inactive', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 100 });
    expect(next).toStrictEqual(INITIAL_PRACTICE_STATE);
  });
});

// ---------------------------------------------------------------------------
// reduce() — per-note result tracking (noteResults)
// ---------------------------------------------------------------------------

describe('reduce() — noteResults tracking', () => {
  it('records a correct result with timing data on CORRECT_MIDI', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(next.noteResults).toHaveLength(1);
    expect(next.noteResults[0]).toEqual({
      noteIndex: 0,
      outcome: 'correct',
      playedMidi: 60,
      expectedMidi: [60],
      responseTimeMs: 1000,
      expectedTimeMs: 1000,
      wrongAttempts: 0,
    });
  });

  it('accumulates results across multiple correct notes', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 2000, expectedTimeMs: 2000 });
    expect(s.noteResults).toHaveLength(2);
    expect(s.noteResults[0].noteIndex).toBe(0);
    expect(s.noteResults[1].noteIndex).toBe(1);
  });

  it('marks note as correct-late when response exceeds expected by LATE_THRESHOLD_MS', () => {
    const state = activeState(THREE_NOTES, 0);
    const lateMs = 1000 + LATE_THRESHOLD_MS + 1; // just over threshold (late)
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: lateMs, expectedTimeMs: 1000 });
    expect(next.noteResults[0].outcome).toBe('correct-late');
  });

  it('marks note as correct-late when response is MORE THAN LATE_THRESHOLD_MS early', () => {
    const state = activeState(THREE_NOTES, 0);
    const earlyMs = 1000 - LATE_THRESHOLD_MS - 1; // just over threshold (early)
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: earlyMs, expectedTimeMs: 1000 });
    expect(next.noteResults[0].outcome).toBe('correct-late');
  });

  it('marks note as correct when response is exactly at LATE_THRESHOLD_MS', () => {
    const state = activeState(THREE_NOTES, 0);
    const onTimeMs = 1000 + LATE_THRESHOLD_MS; // exactly at threshold
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: onTimeMs, expectedTimeMs: 1000 });
    expect(next.noteResults[0].outcome).toBe('correct');
  });

  it('records wrongAttempts count from currentWrongAttempts', () => {
    let s = activeState(THREE_NOTES, 0);
    // Two wrong attempts before correct
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 800 });
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 63, responseTimeMs: 900 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(s.noteResults[0].wrongAttempts).toBe(2);
  });

  it('resets currentWrongAttempts to 0 after CORRECT_MIDI', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(s.currentWrongAttempts).toBe(0);
    // Next correct note should have 0 wrong attempts
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 2000, expectedTimeMs: 2000 });
    expect(s.noteResults[1].wrongAttempts).toBe(0);
  });

  it('preserves noteResults in complete state', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 2000, expectedTimeMs: 2000 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 3000, expectedTimeMs: 3000 });
    expect(s.mode).toBe('complete');
    expect(s.noteResults).toHaveLength(3);
  });

  it('clears noteResults on START', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(s.noteResults).toHaveLength(1);
    const restarted = reduce(s, { type: 'START', notes: THREE_NOTES, staffIndex: 0, startIndex: 0 });
    expect(restarted.noteResults).toHaveLength(0);
  });

  it('clears noteResults on STOP', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    const stopped = reduce(s, { type: 'STOP' });
    expect(stopped.noteResults).toHaveLength(0);
  });

  it('handles zero expectedTimeMs gracefully (no late detection)', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 99999, expectedTimeMs: 0 });
    expect(next.noteResults[0].outcome).toBe('correct'); // can't determine lateness
  });
});

describe('reduce() — STOP action', () => {
  it('resets to inactive mode', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'STOP' });
    expect(next.mode).toBe('inactive');
  });

  it('resets currentIndex to 0', () => {
    const state = activeState(THREE_NOTES, 2);
    const next = reduce(state, { type: 'STOP' });
    expect(next.currentIndex).toBe(0);
  });

  it('clears notes array', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'STOP' });
    expect(next.notes).toHaveLength(0);
  });
});

describe('reduce() — DEACTIVATE action', () => {
  it('sets mode to inactive', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'DEACTIVATE' });
    expect(next.mode).toBe('inactive');
  });

  it('preserves currentIndex (does NOT reset to 0)', () => {
    const state = activeState(THREE_NOTES, 2);
    const next = reduce(state, { type: 'DEACTIVATE' });
    expect(next.currentIndex).toBe(2);
  });

  it('preserves notes array reference', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'DEACTIVATE' });
    expect(next.notes).toBe(THREE_NOTES);
  });
});

describe('reduce() — SEEK action', () => {
  it('repositions currentIndex in active mode', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'SEEK', index: 2 });
    expect(next.currentIndex).toBe(2);
    expect(next.mode).toBe('active');
  });

  it('does not change mode when seeking during active practice', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'SEEK', index: 0 });
    expect(next.mode).toBe('active');
  });

  it('does nothing when mode is inactive', () => {
    const next = reduce(INITIAL_PRACTICE_STATE, { type: 'SEEK', index: 2 });
    expect(next).toStrictEqual(INITIAL_PRACTICE_STATE);
  });

  it('clamps seek index to valid bounds (0 to notes.length - 1)', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'SEEK', index: 99 });
    // Should not exceed last index
    expect(next.currentIndex).toBeLessThanOrEqual(THREE_NOTES.length - 1);
  });
});

describe('reduce() — chord note matching (integration)', () => {
  it('isCorrect accepts any pitch in a chord entry', () => {
    const chord = makeNote([60, 64, 67]); // C major: C E G
    expect(isCorrect(60, chord)).toBe(true);
    expect(isCorrect(64, chord)).toBe(true);
    expect(isCorrect(67, chord)).toBe(true);
  });

  it('isCorrect rejects pitch not present in chord', () => {
    const chord = makeNote([60, 64, 67]);
    expect(isCorrect(62, chord)).toBe(false); // D not in C major
  });
});

describe('reduce() — tick-based note ordering', () => {
  it('START stores notes ordered by tick through the given array as-is', () => {
    const notes = [
      makeNoteAtTick(0, [60]),
      makeNoteAtTick(960, [62]),
      makeNoteAtTick(1920, [64]),
    ];
    const next = reduce(INITIAL_PRACTICE_STATE, {
      type: 'START',
      notes,
      staffIndex: 0,
      startIndex: 0,
    });
    // Notes are stored exactly as provided — ordering is caller's responsibility
    expect(next.notes[0].tick).toBe(0);
    expect(next.notes[1].tick).toBe(960);
    expect(next.notes[2].tick).toBe(1920);
  });
});

// ---------------------------------------------------------------------------
// reduce() — wrongNoteEvents (038-practice-replay Phase B)
// ---------------------------------------------------------------------------

describe('reduce() — wrongNoteEvents tracking', () => {
  it('records a WrongNoteEvent with midiNote, responseTimeMs, and noteIndex on WRONG_MIDI', () => {
    const state = activeState(THREE_NOTES, 1);
    const next = reduce(state, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 800 });
    expect(next.wrongNoteEvents).toHaveLength(1);
    expect(next.wrongNoteEvents[0]).toEqual({
      midiNote: 61,
      responseTimeMs: 800,
      noteIndex: 1,
    });
  });

  it('accumulates multiple wrong note events', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 300 });
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 63, responseTimeMs: 500 });
    expect(s.wrongNoteEvents).toHaveLength(2);
    expect(s.wrongNoteEvents[0].midiNote).toBe(61);
    expect(s.wrongNoteEvents[1].midiNote).toBe(63);
  });

  it('clears wrongNoteEvents on START', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 300 });
    const restarted = reduce(s, { type: 'START', notes: THREE_NOTES, staffIndex: 0, startIndex: 0 });
    expect(restarted.wrongNoteEvents).toHaveLength(0);
  });

  it('clears wrongNoteEvents on STOP', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 300 });
    const stopped = reduce(s, { type: 'STOP' });
    expect(stopped.wrongNoteEvents).toHaveLength(0);
  });

  it('preserves wrongNoteEvents across CORRECT_MIDI transitions', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 300 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 500, expectedTimeMs: 500 });
    // Wrong event should survive the correct note advance
    expect(s.wrongNoteEvents).toHaveLength(1);
    expect(s.wrongNoteEvents[0].midiNote).toBe(61);
  });
});

// ---------------------------------------------------------------------------
// reduce() — loop-region completion via CORRECT_MIDI endIndex
// ---------------------------------------------------------------------------

describe('reduce() — loop-region completion (endIndex)', () => {
  it('completes at endIndex instead of notes.length - 1 when endIndex is provided', () => {
    // 3 notes, but endIndex=1 means practice ends after note at index 1
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 1 });
    expect(s.mode).toBe('active');
    expect(s.currentIndex).toBe(1);
    // Now at index 1 which is the endIndex — completing this note should finish
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 1 });
    expect(s.mode).toBe('complete');
    expect(s.noteResults).toHaveLength(2);
  });

  it('uses notes.length - 1 when endIndex is not provided (default)', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500 });
    // At index 2 now but not yet complete since there are 3 notes
    expect(s.mode).toBe('active');
    expect(s.currentIndex).toBe(2);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000 });
    expect(s.mode).toBe('complete');
    expect(s.noteResults).toHaveLength(3);
  });
});
