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
import { reduce, isCorrect, LATE_THRESHOLD_MS, MAX_CONSECUTIVE_WRONG } from './practiceEngine';
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
    durationTicks: 0,
  };
}

/** Make a whole-note entry that requires a duration hold (feature 042). */
function makeHoldNote(midiPitches: number[], durationTicks = 3840): PracticeNoteEntry {
  return {
    midiPitches,
    noteIds: midiPitches.map((p) => `note-${p}`),
    tick: 0,
    durationTicks,
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
    durationTicks: 0,
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
  return { mode: 'active', notes, currentIndex, selectedStaffIndex, noteResults: [], currentWrongAttempts: 0, wrongNoteEvents: [], holdStartTimeMs: 0, requiredHoldMs: 0 };
}

function waitingState(
  notes: PracticeNoteEntry[],
  currentIndex = 0,
  selectedStaffIndex = 0,
): PracticeState {
  return { mode: 'waiting', notes, currentIndex, selectedStaffIndex, noteResults: [], currentWrongAttempts: 0, wrongNoteEvents: [], holdStartTimeMs: 0, requiredHoldMs: 0 };
}

function holdingState(
  notes: PracticeNoteEntry[],
  currentIndex = 0,
  holdStartTimeMs = 1000,
  requiredHoldMs = 2000,
): PracticeState {
  return {
    mode: 'holding',
    notes,
    currentIndex,
    selectedStaffIndex: 0,
    noteResults: [],
    currentWrongAttempts: 0,
    wrongNoteEvents: [],
    holdStartTimeMs,
    requiredHoldMs,
    holdMidiNote: notes[currentIndex]?.midiPitches[0] ?? 60,
    holdResponseTimeMs: 1000,
    holdExpectedTimeMs: 1000,
    holdEndIndex: -1,
  };
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
      wrongNoteEvents: [],
      holdStartTimeMs: 0,
      requiredHoldMs: 0,
      holdMidiNote: 0,
      holdResponseTimeMs: 0,
      holdExpectedTimeMs: 0,
      holdEndIndex: -1,
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
      relativeDeltaMs: 0,
      wrongAttempts: 0,
      holdDurationMs: 0,
      requiredHoldMs: 0,
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

  it('marks note as correct-late when relative interval delta exceeds LATE_THRESHOLD_MS (late)', () => {
    let s = activeState(THREE_NOTES, 0);
    // Note 0 on time
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    // Note 1: expected interval = 1000ms, actual interval = 1000 + LATE_THRESHOLD_MS + 1
    const lateResponse = 2000 + LATE_THRESHOLD_MS + 1;
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: lateResponse, expectedTimeMs: 2000 });
    expect(s.noteResults[1].outcome).toBe('correct-late');
    expect(s.noteResults[1].relativeDeltaMs).toBe(LATE_THRESHOLD_MS + 1);
  });

  it('marks note as correct-late when relative interval delta exceeds LATE_THRESHOLD_MS (early)', () => {
    let s = activeState(THREE_NOTES, 0);
    // Note 0 on time
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    // Note 1: expected interval = 1000ms, actual interval = 1000 - LATE_THRESHOLD_MS - 1
    const earlyResponse = 2000 - LATE_THRESHOLD_MS - 1;
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: earlyResponse, expectedTimeMs: 2000 });
    expect(s.noteResults[1].outcome).toBe('correct-late');
    expect(s.noteResults[1].relativeDeltaMs).toBe(-(LATE_THRESHOLD_MS + 1));
  });

  it('marks note as correct when relative interval delta is exactly at LATE_THRESHOLD_MS', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1000, expectedTimeMs: 1000 });
    const onTimeResponse = 2000 + LATE_THRESHOLD_MS; // exactly at threshold
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: onTimeResponse, expectedTimeMs: 2000 });
    expect(s.noteResults[1].outcome).toBe('correct');
    expect(s.noteResults[1].relativeDeltaMs).toBe(LATE_THRESHOLD_MS);
  });

  it('first note always has relativeDeltaMs 0 and outcome correct', () => {
    const state = activeState(THREE_NOTES, 0);
    // Even with wildly different response vs expected, first note has no reference
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 5000, expectedTimeMs: 1000 });
    expect(next.noteResults[0].relativeDeltaMs).toBe(0);
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

  it('handles zero expectedTimeMs gracefully (first note always correct)', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 99999, expectedTimeMs: 0 });
    expect(next.noteResults[0].outcome).toBe('correct'); // first note: relativeDeltaMs = 0
    expect(next.noteResults[0].relativeDeltaMs).toBe(0);
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

// ---------------------------------------------------------------------------
// reduce() — LOOP_RESTART action
// ---------------------------------------------------------------------------

describe('reduce() — LOOP_RESTART action', () => {
  it('resets currentIndex to startIndex and sets mode to active', () => {
    // Complete a 3-note session with endIndex=2
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000, endIndex: 2 });
    expect(s.mode).toBe('complete');
    const restarted = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });
    expect(restarted.mode).toBe('active');
    expect(restarted.currentIndex).toBe(0);
  });

  it('preserves noteResults across loop restart', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000, endIndex: 2 });
    expect(s.noteResults).toHaveLength(3);
    const restarted = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });
    expect(restarted.noteResults).toHaveLength(3);
  });

  it('preserves wrongNoteEvents across loop restart', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 100 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000, endIndex: 2 });
    expect(s.wrongNoteEvents).toHaveLength(1);
    const restarted = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });
    expect(restarted.wrongNoteEvents).toHaveLength(1);
  });

  it('resets currentWrongAttempts to 0', () => {
    let s = activeState(THREE_NOTES, 0);
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 0 });
    expect(s.mode).toBe('complete');
    const restarted = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });
    expect(restarted.currentWrongAttempts).toBe(0);
  });

  it('does nothing when mode is not complete', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'LOOP_RESTART', startIndex: 0 });
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// reduce() — loop boundary relative delta
// ---------------------------------------------------------------------------

describe('reduce() — loop boundary relative delta', () => {
  it('sets relativeDeltaMs to 0 at loop boundary (expectedTimeMs goes backwards)', () => {
    let s = activeState(THREE_NOTES, 0);
    // First loop: complete all 3 notes
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000, endIndex: 2 });
    // Restart loop
    s = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });
    // First note of second loop — if caller doesn't offset, expectedTimeMs goes backwards
    // Engine treats backwards expectedTimeMs as loop boundary → delta = 0
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1500, expectedTimeMs: 0 });
    const loopBoundaryResult = s.noteResults[3]; // 4th result (index 3)
    expect(loopBoundaryResult.relativeDeltaMs).toBe(0);
    expect(loopBoundaryResult.outcome).toBe('correct');
  });

  it('computes correct delta for single-note loop when caller offsets expectedTimeMs', () => {
    // Single note at tick 19200 → baseExpectedTimeMs = 10000 at 120 BPM
    // Loop region duration = 10000ms (e.g. ticks [0, 19200])
    const SINGLE_NOTE = [makeNoteAtTick(19200, [36])];
    let s = activeState(SINGLE_NOTE, 0);

    // Loop 0: first note, delta = 0
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 36, responseTimeMs: 0, expectedTimeMs: 10000, endIndex: 0 });
    expect(s.mode).toBe('complete');
    expect(s.noteResults[0].relativeDeltaMs).toBe(0);

    // LOOP_RESTART
    s = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });

    // Loop 1: caller offsets expectedTimeMs by loopDuration (10000)
    // User plays ~10s after first note → on time
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 36, responseTimeMs: 10000, expectedTimeMs: 20000, endIndex: 0 });
    expect(s.noteResults[1].relativeDeltaMs).toBe(0);
    expect(s.noteResults[1].outcome).toBe('correct');

    // LOOP_RESTART
    s = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });

    // Loop 2: user is 300ms late
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 36, responseTimeMs: 20300, expectedTimeMs: 30000, endIndex: 0 });
    expect(s.noteResults[2].relativeDeltaMs).toBe(300);
    expect(s.noteResults[2].outcome).toBe('correct');
  });

  it('computes correct delta for multi-note loop when caller offsets expectedTimeMs', () => {
    // 3 notes at ticks 0, 960, 1920 → expectedTimeMs 0, 500, 1000 at 120 BPM
    // Loop region [0, 3840] → loopDurationMs = 2000
    let s = activeState(THREE_NOTES, 0);

    // --- Loop 0 ---
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 0, expectedTimeMs: 0, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 500, expectedTimeMs: 500, endIndex: 2 });
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 1000, expectedTimeMs: 1000, endIndex: 2 });
    expect(s.mode).toBe('complete');

    s = reduce(s, { type: 'LOOP_RESTART', startIndex: 0 });

    // --- Loop 1: offset all expectedTimeMs by +2000 ---
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 2000, expectedTimeMs: 2000, endIndex: 2 });
    // expectedInterval = 2000 - 1000 = 1000, actualInterval = 2000 - 1000 = 1000 → delta = 0
    expect(s.noteResults[3].relativeDeltaMs).toBe(0);

    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 62, responseTimeMs: 2500, expectedTimeMs: 2500, endIndex: 2 });
    expect(s.noteResults[4].relativeDeltaMs).toBe(0);

    // Third note: user is 200ms late
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 64, responseTimeMs: 3200, expectedTimeMs: 3000, endIndex: 2 });
    expect(s.noteResults[5].relativeDeltaMs).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// T007–T012 — Feature 042: Hold duration enforcement
// ---------------------------------------------------------------------------

const WHOLE_NOTE_C4 = makeHoldNote([60], 3840); // whole note at 960 PPQ
const WHOLE_NOTE_CHORD = makeHoldNote([60, 64, 67], 3840); // C major whole-note chord
// At 120 BPM: requiredHoldMs = (3840 / ((120/60)*960)) * 1000 = 2000 ms

describe('reduce() — CORRECT_MIDI with durationTicks > 0 (T007)', () => {
  it('enters holding mode instead of advancing when requiredHoldMs > 0', () => {
    const state = activeState([WHOLE_NOTE_C4, NOTE_D4], 0);
    const next = reduce(state, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1000,
      expectedTimeMs: 1000,
      pressTimeMs: 50000,
      requiredHoldMs: 2000,
    });
    expect(next.mode).toBe('holding');
    expect(next.currentIndex).toBe(0); // index does NOT advance yet
    expect(next.holdStartTimeMs).toBe(50000);
    expect(next.requiredHoldMs).toBe(2000);
  });

  it('does NOT add a noteResult while entering holding mode', () => {
    const state = activeState([WHOLE_NOTE_C4, NOTE_D4], 0);
    const next = reduce(state, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1000,
      expectedTimeMs: 1000,
      pressTimeMs: 50000,
      requiredHoldMs: 2000,
    });
    expect(next.noteResults).toHaveLength(0);
  });
});

describe('reduce() — CORRECT_MIDI with durationTicks === 0 (T008)', () => {
  it('advances immediately (unchanged v6 behaviour) when requiredHoldMs is absent', () => {
    const state = activeState(THREE_NOTES, 0); // all makeNote() → durationTicks 0
    const next = reduce(state, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1000,
      expectedTimeMs: 1000,
    });
    expect(next.mode).toBe('active');
    expect(next.currentIndex).toBe(1);
  });

  it('advances immediately when requiredHoldMs is explicitly 0', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1000,
      expectedTimeMs: 1000,
      pressTimeMs: 0,
      requiredHoldMs: 0,
    });
    expect(next.mode).toBe('active');
    expect(next.currentIndex).toBe(1);
  });
});

describe('reduce() — HOLD_COMPLETE action (T009)', () => {
  it('advances currentIndex and records a correct result', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 1900 });
    expect(next.currentIndex).toBe(1);
    expect(next.mode).toBe('active');
    expect(next.noteResults).toHaveLength(1);
    expect(next.noteResults[0].outcome).toBe('correct');
  });

  it('records holdDurationMs and requiredHoldMs in the result', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 1900 });
    expect(next.noteResults[0].holdDurationMs).toBe(1900);
    expect(next.noteResults[0].requiredHoldMs).toBe(2000);
  });

  it('clears holdStartTimeMs and requiredHoldMs after completing', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 1900 });
    expect(next.holdStartTimeMs).toBe(0);
    expect(next.requiredHoldMs).toBe(0);
  });

  it('transitions to complete when finishing the last note via HOLD_COMPLETE', () => {
    const notes = [WHOLE_NOTE_C4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 1900 });
    expect(next.mode).toBe('complete');
  });

  it('is a no-op when mode is not holding', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 1000 });
    expect(next).toBe(state); // same reference
  });
});

describe('reduce() — EARLY_RELEASE action (T010)', () => {
  it('records early-release result without advancing currentIndex', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 800 });
    expect(next.currentIndex).toBe(0); // index unchanged
    expect(next.noteResults).toHaveLength(1);
    expect(next.noteResults[0].outcome).toBe('early-release');
  });

  it('records holdDurationMs and requiredHoldMs in the result', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 800 });
    expect(next.noteResults[0].holdDurationMs).toBe(800);
    expect(next.noteResults[0].requiredHoldMs).toBe(2000);
  });

  it('clears holdStartTimeMs and requiredHoldMs', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 800 });
    expect(next.holdStartTimeMs).toBe(0);
    expect(next.requiredHoldMs).toBe(0);
  });

  it('mode returns to active (not holding) after early-release', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    const state = holdingState(notes, 0, 50000, 2000);
    const next = reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 800 });
    expect(next.mode).toBe('active');
  });

  it('is a no-op when mode is not holding', () => {
    const state = activeState(THREE_NOTES, 0);
    const next = reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 800 });
    expect(next).toBe(state); // same reference
  });
});

describe('reduce() — CORRECT_MIDI retry after EARLY_RELEASE (T011)', () => {
  it('re-enters holding mode after early-release on the same note', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    let s = holdingState(notes, 0, 50000, 2000);
    // Early release
    s = reduce(s, { type: 'EARLY_RELEASE', holdDurationMs: 300 });
    expect(s.mode).toBe('active');
    expect(s.noteResults[0].outcome).toBe('early-release');
    // Retry correct press
    s = reduce(s, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1200,
      expectedTimeMs: 1000,
      pressTimeMs: 52000,
      requiredHoldMs: 2000,
    });
    expect(s.mode).toBe('holding');
    expect(s.holdStartTimeMs).toBe(52000);
  });

  it('does NOT add a duplicate noteResult on retry CORRECT_MIDI — only early-release result is kept', () => {
    const notes = [WHOLE_NOTE_C4, NOTE_D4];
    let s = holdingState(notes, 0, 50000, 2000);
    s = reduce(s, { type: 'EARLY_RELEASE', holdDurationMs: 300 });
    // Retry correct press — enters holding, noteResults stays at 1 (early-release)
    s = reduce(s, {
      type: 'CORRECT_MIDI',
      midiNote: 60,
      responseTimeMs: 1200,
      expectedTimeMs: 1000,
      pressTimeMs: 52000,
      requiredHoldMs: 2000,
    });
    // Still just the one early-release result until HOLD_COMPLETE fires
    expect(s.noteResults).toHaveLength(1);
    expect(s.noteResults[0].outcome).toBe('early-release');
  });
});

describe('reduce() — HOLD_COMPLETE and EARLY_RELEASE outside holding mode (T012)', () => {
  it('HOLD_COMPLETE in active mode is a no-op (same state reference)', () => {
    const state = activeState(THREE_NOTES, 1);
    expect(reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 500 })).toBe(state);
  });

  it('EARLY_RELEASE in active mode is a no-op (same state reference)', () => {
    const state = activeState(THREE_NOTES, 1);
    expect(reduce(state, { type: 'EARLY_RELEASE', holdDurationMs: 500 })).toBe(state);
  });

  it('HOLD_COMPLETE in waiting mode is a no-op', () => {
    const state = waitingState(THREE_NOTES, 0);
    expect(reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: 500 })).toBe(state);
  });

  it('EARLY_RELEASE in inactive mode is a no-op', () => {
    expect(reduce(INITIAL_PRACTICE_STATE, { type: 'EARLY_RELEASE', holdDurationMs: 500 })).toBe(INITIAL_PRACTICE_STATE);
  });
});

// ---------------------------------------------------------------------------
// reduce() — WRONG_MIDI: beat never auto-advances (FR-003a disabled)
// Feature 001-fix-practice-midi-detection — T003
// ---------------------------------------------------------------------------

describe('reduce() — WRONG_MIDI stays on current beat (FR-003a disabled)', () => {
  it('stays on the same note no matter how many wrong presses', () => {
    let s = activeState(THREE_NOTES, 0);
    for (let i = 0; i < MAX_CONSECUTIVE_WRONG * 3; i++) {
      s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 + i * 100 });
    }
    // Never advances — stays on index 0
    expect(s.currentIndex).toBe(0);
    expect(s.mode).toBe('active');
    expect(s.noteResults).toHaveLength(0);
    expect(s.currentWrongAttempts).toBe(MAX_CONSECUTIVE_WRONG * 3);
  });

  it('accumulates wrongNoteEvents without advancing', () => {
    let s = activeState(THREE_NOTES, 0);
    for (let i = 0; i < MAX_CONSECUTIVE_WRONG; i++) {
      s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 + i * 100 });
    }
    expect(s.currentIndex).toBe(0);
    expect(s.wrongNoteEvents).toHaveLength(MAX_CONSECUTIVE_WRONG);
    expect(s.noteResults).toHaveLength(0);
  });

  it('still advances correctly when the RIGHT note is pressed after wrong presses', () => {
    let s = activeState(THREE_NOTES, 0);
    for (let i = 0; i < MAX_CONSECUTIVE_WRONG * 2; i++) {
      s = reduce(s, { type: 'WRONG_MIDI', midiNote: 61, responseTimeMs: 500 + i * 100 });
    }
    // Now press the correct note
    s = reduce(s, { type: 'CORRECT_MIDI', midiNote: 60, responseTimeMs: 1200, expectedTimeMs: 0, requiredHoldMs: 0 });
    expect(s.currentIndex).toBe(1);
    expect(s.mode).toBe('active');
    expect(s.noteResults).toHaveLength(1);
    expect(s.currentWrongAttempts).toBe(0);
  });

  it('MAX_CONSECUTIVE_WRONG is exported and equals 3', () => {
    expect(MAX_CONSECUTIVE_WRONG).toBe(3);
  });
});
