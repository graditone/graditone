/**
 * Practice View Plugin — Practice Engine (T030)
 * Feature 037: Practice View Plugin
 *
 * Pure state machine — no side effects, no API calls, no coordinates (Principle VI).
 * All logic operates on integer MIDI note numbers (0–127), opaque noteId strings,
 * and integer tick values. No pixel arithmetic.
 *
 * Exports:
 *   isCorrect(midiNote, entry)  — predicate: is this MIDI note the right answer?
 *   reduce(state, action)       — reducer: returns next PracticeState
 */

import type { PracticeNoteEntry, PracticeState, PracticeAction, PracticeNoteResult, WrongNoteEvent } from './practiceEngine.types';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import { isHoldAccepted } from './holdDuration';
import { evaluateStrictOnset, STRICT_FAILURE_LIMIT } from './strictTempo';
import type { StrictAnchor } from './strictTempo';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Timing tolerance in ms — if the user plays a correct note more than this
 * many ms away from the expected time (ahead OR behind), it's marked 'correct-late'.
 */
const LATE_THRESHOLD_MS = 500;

/**
 * Number of consecutive wrong MIDI presses on a single beat before the
 * practice engine auto-advances past it (FR-003a).
 */
const MAX_CONSECUTIVE_WRONG = 3;

/** Zero-value hold-context fields shared by states that are not in 'holding' mode. */
const CLEAR_HOLD = {
  holdStartTimeMs: 0,
  requiredHoldMs: 0,
  holdMidiNote: 0,
  holdResponseTimeMs: 0,
  holdExpectedTimeMs: 0,
  holdEndIndex: -1,
} as const;

/** Zero-value strict-tempo fields (feature 101) for reset/new sessions. */
const CLEAR_STRICT = {
  strictMode: false,
  strictFailureCount: 0,
  strictAnchor: null,
  strictReanchorPending: false,
} as const;

// ---------------------------------------------------------------------------
// Strict-tempo helpers (feature 101)
// ---------------------------------------------------------------------------

/**
 * Judge one accepted note onset against the strict tempo grid.
 *
 * Uses `evaluateStrictOnset` for all timing math. The returned fields carry
 * the per-note strict result extras and the post-note strict state
 * (count / anchor / pending). `strictReanchorPending` is false after every
 * non-holding note; a pending hold is cleared by the HOLD_COMPLETE branch.
 */
function judgeStrictOnset(
  state: PracticeState,
  responseTimeMs: number,
  expectedTimeMs: number,
  prevResult: PracticeNoteResult | null,
): {
  readonly outcome: 'correct' | 'correct-late';
  readonly beatDeltaMs: number;
  readonly strictFailure: boolean;
  readonly strictFailureCount: number;
  readonly strictAnchor: StrictAnchor;
} {
  const expectedGapMs = prevResult
    ? Math.max(0, Math.round(expectedTimeMs - prevResult.expectedTimeMs))
    : 0;
  const evaluation = evaluateStrictOnset({
    anchor: state.strictAnchor ?? null,
    responseTimeMs,
    expectedTimeMs,
    expectedGapMs,
  });

  let strictFailureCount = state.strictFailureCount;
  if (!evaluation.isGrace && !evaluation.onBeat) {
    strictFailureCount += 1;
  } else if (!evaluation.isGrace) {
    // A judged in-time note resets the consecutive failure count.
    strictFailureCount = 0;
  }
  // A grace note never changes the count.

  return {
    outcome: evaluation.onBeat ? 'correct' : 'correct-late',
    beatDeltaMs: evaluation.isGrace ? 0 : evaluation.deltaMs,
    strictFailure: !evaluation.isGrace && !evaluation.onBeat,
    strictFailureCount,
    strictAnchor: evaluation.anchor,
  };
}

/** Strict-count reached the stop limit (feature 101). */
function strictStopReached(strictMode: boolean, count: number): boolean {
  return strictMode && count >= STRICT_FAILURE_LIMIT;
}

// ---------------------------------------------------------------------------
// Predicate
// ---------------------------------------------------------------------------

/**
 * Returns true if `midiNote` is a valid answer for `entry`.
 *
 * For single notes: exact integer match.
 * For chords:       ANY pitch in `entry.midiPitches` is an acceptable answer.
 *
 * Octave matters — MIDI 60 (C4) ≠ MIDI 72 (C5) ≠ MIDI 48 (C3).
 * Principle VI: only integer arithmetic, no coordinates.
 */
export function isCorrect(midiNote: number, entry: PracticeNoteEntry): boolean {
  return entry.midiPitches.includes(midiNote);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for the practice engine state machine.
 *
 * Returns the same `state` reference for no-op transitions
 * (WRONG_MIDI, actions that don't apply in current mode).
 */
export function reduce(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'START': {
      return {
        mode: 'waiting',
        notes: action.notes,
        currentIndex: clamp(action.startIndex, 0, Math.max(0, action.notes.length - 1)),
        selectedStaffIndex: action.staffIndex,
        noteResults: [],
        currentWrongAttempts: 0,
        currentLoopResultOffset: 0,
        wrongNoteEvents: [],
        ...CLEAR_HOLD,
        ...CLEAR_STRICT,
        // Feature 101: strict tempo evaluation is opt-in per session
        strictMode: action.strictTempo === true,
      };
    }

    case 'HOLD_COMPLETE': {
      // No-op outside holding mode
      if (state.mode !== 'holding') return state;

      // Feature 101: strict tempo evaluation is active only with strictMode
      const isStrict = state.strictMode === true;
      const entry = state.notes[state.currentIndex];

      const lastIndex = state.holdEndIndex >= 0 ? state.holdEndIndex : state.notes.length - 1;

      // Check if there's already a finalised result for this note in the CURRENT loop
      // (e.g. early-release). Scoped to currentLoopResultOffset so that results from
      // previous loops don't shadow the current loop's notes.
      const existingResult = state.noteResults
        .slice(state.currentLoopResultOffset)
        .find((r) => r.noteIndex === state.currentIndex);

      let newResults = state.noteResults;
      if (!existingResult) {
        // Compute relative timing delta using the stored CORRECT_MIDI context
        const prevResult = state.noteResults.length > 0
          ? state.noteResults[state.noteResults.length - 1]
          : null;
        let relativeDeltaMs = 0;
        if (prevResult) {
          if (state.holdExpectedTimeMs >= prevResult.expectedTimeMs) {
            const actualInterval = state.holdResponseTimeMs - prevResult.responseTimeMs;
            const expectedInterval = state.holdExpectedTimeMs - prevResult.expectedTimeMs;
            relativeDeltaMs = Math.round(actualInterval - expectedInterval);
          }
        }
        const isLate = Math.abs(relativeDeltaMs) > LATE_THRESHOLD_MS;

        // Feature 101: judge the hold's onset on the strict grid
        const strictJudge = isStrict
          ? judgeStrictOnset(state, state.holdResponseTimeMs, state.holdExpectedTimeMs, prevResult)
          : null;

        const result: PracticeNoteResult = {
          noteIndex: state.currentIndex,
          outcome: strictJudge ? strictJudge.outcome : (isLate ? 'correct-late' : 'correct'),
          playedMidi: state.holdMidiNote,
          expectedMidi: [...(entry.midiPitches as number[]), ...((entry.sustainedPitches ?? []) as number[])],
          responseTimeMs: state.holdResponseTimeMs,
          expectedTimeMs: state.holdExpectedTimeMs,
          relativeDeltaMs,
          wrongAttempts: state.currentWrongAttempts,
          holdDurationMs: action.holdDurationMs,
          requiredHoldMs: state.requiredHoldMs,
          ...(strictJudge
            ? {
                beatDeltaMs: strictJudge.beatDeltaMs,
                strictFailure: strictJudge.strictFailure,
              }
            : {}),
        };
        newResults = [...state.noteResults, result];

        // Feature 101: a pending re-anchor ends here — clear the anchor and the
        // pending flag after evaluating so the next note is judged as graceful.
        const pendingStrict = isStrict && state.strictReanchorPending;

        const strictFailureCount = strictJudge ? strictJudge.strictFailureCount : state.strictFailureCount;
        const stopNow = strictStopReached(isStrict, strictFailureCount);
        if (stopNow) {
          // Feature 101: tempo-stopped even on the last index — the orchestrator
          // decides complete vs partial.
          return {
            ...state,
            mode: 'tempo-stopped',
            noteResults: newResults,
            strictFailureCount,
            strictAnchor: pendingStrict ? null : (strictJudge ? strictJudge.strictAnchor : state.strictAnchor),
            strictReanchorPending: false,
            ...CLEAR_HOLD,
          };
        }
        const strictAnchor = pendingStrict ? null : (strictJudge ? strictJudge.strictAnchor : state.strictAnchor);
        if (state.currentIndex >= lastIndex) {
          return { ...state, mode: 'complete', noteResults: newResults, currentWrongAttempts: 0, strictFailureCount, strictAnchor, strictReanchorPending: false, ...CLEAR_HOLD };
        }
        return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, noteResults: newResults, currentWrongAttempts: 0, strictFailureCount, strictAnchor, strictReanchorPending: false, ...CLEAR_HOLD };
      }

      // Existing result (retry after early-release): do not append a duplicate.
      // Feature 101: the retry's onset is grace when the anchor is null — it
      // re-establishes the grid without changing the failure count. A pending
      // re-anchor instead leaves the anchor null so the NEXT note is grace.
      if (isStrict) {
        let strictAnchor = state.strictAnchor ?? null;
        let strictReanchorPending = state.strictReanchorPending;
        if (strictReanchorPending) {
          strictAnchor = null;
          strictReanchorPending = false;
        } else if (strictAnchor === null) {
          strictAnchor = { expectedTimeMs: state.holdExpectedTimeMs, responseTimeMs: state.holdResponseTimeMs };
        }
        if (state.currentIndex >= lastIndex) {
          return { ...state, mode: 'complete', noteResults: newResults, currentWrongAttempts: 0, strictAnchor, strictReanchorPending, ...CLEAR_HOLD };
        }
        return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, noteResults: newResults, currentWrongAttempts: 0, strictAnchor, strictReanchorPending, ...CLEAR_HOLD };
      }

      if (state.currentIndex >= lastIndex) {
        return { ...state, mode: 'complete', noteResults: newResults, currentWrongAttempts: 0, ...CLEAR_HOLD };
      }
      return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, noteResults: newResults, currentWrongAttempts: 0, ...CLEAR_HOLD };
    }

    case 'EARLY_RELEASE': {
      // No-op outside holding mode
      if (state.mode !== 'holding') return state;

      // Feature 101: strict tempo evaluation is active only with strictMode
      const isStrictRelease = state.strictMode === true;

      // Feature 098: the accept/reject decision depends ONLY on how long the
      // note was held versus the required duration. A release that has already
      // reached the acceptance threshold is NOT an early release — treat it
      // exactly like a HOLD_COMPLETE (records a correct result and advances).
      if (isHoldAccepted(state.requiredHoldMs, action.holdDurationMs)) {
        return reduce(state, { type: 'HOLD_COMPLETE', holdDurationMs: action.holdDurationMs });
      }

      const entry = state.notes[state.currentIndex];
      const prevResultRelease = state.noteResults.length > 0
        ? state.noteResults[state.noteResults.length - 1]
        : null;
      const result: PracticeNoteResult = {
        noteIndex: state.currentIndex,
        outcome: 'early-release',
        playedMidi: state.holdMidiNote,
        expectedMidi: [...(entry.midiPitches as number[]), ...((entry.sustainedPitches ?? []) as number[])],
        responseTimeMs: state.holdResponseTimeMs,
        expectedTimeMs: state.holdExpectedTimeMs,
        relativeDeltaMs: (() => {
          if (!prevResultRelease) return 0;
          if (state.holdExpectedTimeMs < prevResultRelease.expectedTimeMs) return 0;
          const actualInterval = state.holdResponseTimeMs - prevResultRelease.responseTimeMs;
          const expectedInterval = state.holdExpectedTimeMs - prevResultRelease.expectedTimeMs;
          return Math.round(actualInterval - expectedInterval);
        })(),
        wrongAttempts: state.currentWrongAttempts,
        holdDurationMs: action.holdDurationMs,
        requiredHoldMs: state.requiredHoldMs,
      };

      if (isStrictRelease) {
        // Feature 101: beatDeltaMs is the onset deviation from the current
        // anchor (0 when the anchor is null — the retry will be grace).
        const onsetEvaluation = state.strictAnchor
          ? evaluateStrictOnset({
              anchor: state.strictAnchor,
              responseTimeMs: state.holdResponseTimeMs,
              expectedTimeMs: state.holdExpectedTimeMs,
              expectedGapMs: 0,
            })
          : null;
        const strictFailureRelease = {
          ...result,
          strictFailure: true,
          beatDeltaMs: onsetEvaluation ? onsetEvaluation.deltaMs : 0,
        };
        const strictFailureCount = state.strictFailureCount + 1;
        if (strictStopReached(true, strictFailureCount)) {
          // Feature 101: third consecutive failure stops the session.
          return {
            ...state,
            mode: 'tempo-stopped',
            noteResults: [...state.noteResults, strictFailureRelease],
            strictFailureCount,
            strictAnchor: null,
            strictReanchorPending: false,
            ...CLEAR_HOLD,
          };
        }
        // Stay on the same note (currentIndex unchanged); mode back to active for retry.
        // The retry onset is grace: null the anchor.
        return {
          ...state,
          mode: 'active',
          noteResults: [...state.noteResults, strictFailureRelease],
          strictFailureCount,
          strictAnchor: null,
          strictReanchorPending: false,
          ...CLEAR_HOLD,
        };
      }

      // Stay on the same note (currentIndex unchanged); mode back to active for retry.
      return { ...state, mode: 'active', noteResults: [...state.noteResults, result], ...CLEAR_HOLD };
    }

    case 'CORRECT_MIDI': {
      if (state.mode !== 'active' && state.mode !== 'waiting' && state.mode !== 'holding') return state;

      // When the user presses again after an early-release (mode='active', same index)
      // we're back on the same note. Check if requiredHoldMs > 0 for hold enforcement.
      // When re-entering hold after early-release, we enter 'holding' without adding
      // a new noteResult (the early-release result is final).
      if (state.mode === 'active' || state.mode === 'waiting') {
        // Check if this is a retry after early-release for the same note in the CURRENT loop.
        // Scoped to currentLoopResultOffset so previous-loop results don't interfere.
        const hasEarlyRelease = state.noteResults
          .slice(state.currentLoopResultOffset)
          .some((r) => r.noteIndex === state.currentIndex && r.outcome === 'early-release');

        // When entering holding mode (requiredHoldMs > 0):
        if ((action.requiredHoldMs ?? 0) > 0) {
          return {
            ...state,
            mode: 'holding',
            holdStartTimeMs: action.pressTimeMs ?? 0,
            requiredHoldMs: action.requiredHoldMs ?? 0,
            holdMidiNote: action.midiNote,
            holdResponseTimeMs: action.responseTimeMs,
            holdExpectedTimeMs: action.expectedTimeMs,
            holdEndIndex: action.endIndex ?? -1,
            // Do NOT add a noteResult on entry to holding — wait for HOLD_COMPLETE/EARLY_RELEASE
          };
        }

        // ── No hold required path (durationTicks === 0) ──────────────────────

        // Waiting → active transition: the first correct note starts the clock
        if (state.mode === 'waiting') {
          // Fall through to normal CORRECT_MIDI handling
        }

        // If this was a retry after early-release, use the same note index context
        // (but this path is only reached when requiredHoldMs === 0, which is unusual)
        if (hasEarlyRelease) {
          // Advance without adding a duplicate result
          const lastIndex = action.endIndex ?? state.notes.length - 1;
          if (state.currentIndex >= lastIndex) {
            return { ...state, mode: 'complete', currentWrongAttempts: 0, ...CLEAR_HOLD };
          }
          return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, currentWrongAttempts: 0, ...CLEAR_HOLD };
        }
      }

      // ── Standard CORRECT_MIDI path ──────────────────────────────────────────
      // (also reached when mode was 'holding' — but HOLD_COMPLETE is the preferred
      //  path; this branch handles any edge cases)
      if (state.mode === 'holding') return state; // already handled above

      const entry = state.notes[state.currentIndex];

      // Feature 101: strict tempo evaluation is active only with strictMode
      const isStrict = state.strictMode === true;

      // Compute relative timing delta: how far off was the interval
      // between this note and the previous one vs. the expected interval.
      // First note always gets relativeDeltaMs = 0 (no reference).
      // The caller is responsible for offsetting expectedTimeMs by the loop
      // duration on each iteration so the engine sees monotonically increasing
      // values. This makes the >= guard and interval math work identically
      // for single notes, chords, and multi-note loops.
      const prevResult = state.noteResults.length > 0
        ? state.noteResults[state.noteResults.length - 1]
        : null;
      let relativeDeltaMs = 0;
      if (prevResult) {
        if (action.expectedTimeMs >= prevResult.expectedTimeMs) {
          const actualInterval = action.responseTimeMs - prevResult.responseTimeMs;
          const expectedInterval = action.expectedTimeMs - prevResult.expectedTimeMs;
          relativeDeltaMs = Math.round(actualInterval - expectedInterval);
        }
      }

      const isLate = Math.abs(relativeDeltaMs) > LATE_THRESHOLD_MS;

      // Feature 101: judge the onset on the strict grid when strict mode is on.
      // A strict onset failure is 'correct-late' regardless of the legacy
      // 500 ms threshold; status is carried by strictFailure/beatDeltaMs.
      const strictJudge = isStrict
        ? judgeStrictOnset(state, action.responseTimeMs, action.expectedTimeMs, prevResult)
        : null;

      const result: PracticeNoteResult = {
        noteIndex: state.currentIndex,
        outcome: strictJudge ? strictJudge.outcome : (isLate ? 'correct-late' : 'correct'),
        playedMidi: action.midiNote,
        expectedMidi: [...(entry.midiPitches as number[]), ...((entry.sustainedPitches ?? []) as number[])],
        responseTimeMs: action.responseTimeMs,
        expectedTimeMs: action.expectedTimeMs,
        relativeDeltaMs,
        wrongAttempts: state.currentWrongAttempts,
        holdDurationMs: 0,
        requiredHoldMs: 0,
        ...(strictJudge
          ? {
              beatDeltaMs: strictJudge.beatDeltaMs,
              strictFailure: strictJudge.strictFailure,
            }
          : {}),
      };

      const newResults = [...state.noteResults, result];

      const strictFailureCount = strictJudge ? strictJudge.strictFailureCount : state.strictFailureCount;
      const strictAnchor = strictJudge ? strictJudge.strictAnchor : state.strictAnchor;

      // Feature 101: the third consecutive failure stops the session before
      // completing or advancing — tempo-stopped is terminal for the reducer.
      if (strictStopReached(isStrict, strictFailureCount)) {
        return { ...state, mode: 'tempo-stopped', noteResults: newResults, currentWrongAttempts: 0, strictFailureCount, strictAnchor, strictReanchorPending: false, ...CLEAR_HOLD };
      }

      const lastIndex = action.endIndex ?? state.notes.length - 1;
      if (state.currentIndex >= lastIndex) {
        return { ...state, mode: 'complete', noteResults: newResults, currentWrongAttempts: 0, strictFailureCount, strictAnchor, strictReanchorPending: false, ...CLEAR_HOLD };
      }
      return { ...state, mode: 'active', currentIndex: state.currentIndex + 1, noteResults: newResults, currentWrongAttempts: 0, strictFailureCount, strictAnchor, strictReanchorPending: false, ...CLEAR_HOLD };
    }

    case 'WRONG_MIDI': {
      if (state.mode !== 'active' && state.mode !== 'waiting' && state.mode !== 'holding') return state;
      const wrongEvent: WrongNoteEvent = {
        midiNote: action.midiNote,
        responseTimeMs: action.responseTimeMs,
        noteIndex: state.currentIndex,
      };
      const newWrongAttempts = state.currentWrongAttempts + 1;

      // FR-003a (disabled): auto-advance after MAX_CONSECUTIVE_WRONG was removed whilst
      // score detection is being hardened. Re-enable by restoring the branch here once
      // the MIDI-detection pipeline is reliable enough that false positives are rare.

      return {
        ...state,
        currentWrongAttempts: newWrongAttempts,
        wrongNoteEvents: [...state.wrongNoteEvents, wrongEvent],
      };
    }

    case 'STOP': {
      return {
        mode: 'inactive',
        notes: [],
        currentIndex: 0,
        selectedStaffIndex: state.selectedStaffIndex,
        noteResults: [],
        currentWrongAttempts: 0,
        currentLoopResultOffset: 0,
        wrongNoteEvents: [],
        ...CLEAR_HOLD,
        ...CLEAR_STRICT,
      };
    }

    case 'DEACTIVATE': {
      if (state.mode === 'inactive') return state;
      // Deactivate preserves currentIndex and notes (differs from STOP)
      return { ...state, mode: 'inactive' };
    }


    case 'SEEK': {
      if (state.mode !== 'active' && state.mode !== 'waiting') return state;
      const idx = clamp(action.index, 0, Math.max(0, state.notes.length - 1));
      if (idx === state.currentIndex) return state;
      // Feature 101: the next note after a seek is grace; the count is preserved.
      return { ...state, currentIndex: idx, strictAnchor: null, strictReanchorPending: false };
    }

    case 'LOOP_RESTART': {
      if (state.mode !== 'complete') return state;
      const idx = clamp(action.startIndex, 0, Math.max(0, state.notes.length - 1));
      return {
        ...state,
        mode: 'active',
        currentIndex: idx,
        currentWrongAttempts: 0,
        // Advance the result-window boundary so early-release detection in the next
        // loop only looks at that loop's results, not those from previous loops.
        currentLoopResultOffset: state.noteResults.length,
        ...CLEAR_HOLD,
        // Feature 101: the first note of the loop is grace; the count is preserved.
        strictAnchor: null,
        strictReanchorPending: false,
      };
    }

    // Feature 101: strict tempo session actions
    case 'STRICT_ENABLE': {
      if (state.mode !== 'waiting' && state.mode !== 'active' && state.mode !== 'holding') return state;
      return {
        ...state,
        strictMode: true,
        strictFailureCount: 0,
        strictAnchor: null,
        strictReanchorPending: false,
      };
    }

    case 'STRICT_DISABLE': {
      if (state.mode !== 'waiting' && state.mode !== 'active' && state.mode !== 'holding') return state;
      // Results already recorded keep their strict flags; only the state resets.
      return {
        ...state,
        strictMode: false,
        strictFailureCount: 0,
        strictAnchor: null,
        strictReanchorPending: false,
      };
    }

    case 'REANCHOR': {
      const running = state.mode === 'waiting' || state.mode === 'active' || state.mode === 'holding';
      if (!running || state.strictMode !== true) return state;
      if (state.mode === 'holding') {
        // A tempo change during a hold: judge the in-progress hold on the old
        // grid, then the following note is grace.
        return { ...state, strictReanchorPending: true };
      }
      // The next note (still waiting or active) is grace: drop the grid.
      return { ...state, strictAnchor: null, strictReanchorPending: false };
    }

    default: {
      // Exhaustive check — TypeScript ensures all cases are handled.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Re-export INITIAL_PRACTICE_STATE for convenience
export { INITIAL_PRACTICE_STATE };

// Export the late threshold and auto-advance threshold for tests
export { LATE_THRESHOLD_MS, MAX_CONSECUTIVE_WRONG };
