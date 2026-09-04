# Research: Root-Cause Analysis — Phrase-Repeat Onset Delay

**Feature**: `100-fix-practice-repeat-delay`

## Problem

In Score Practice, playing a repeated phrase (loop-count ≥ 2) records the first chord of each iteration ≥ 2 as **late by > 600 ms** even when the musician strikes it on the metronome tick. The first iteration's chords are recorded correctly.

## Investigation

### Data flow

1. Practice notes come from `extractPracticeNotes(staffIndex)` → `expandedNotesByStaff`, which applies `expandNotesWithRepeats` (repeat barlines) so repeat *sections* are baked in as distinct notes. For **loop-count** repetition (the reported scenario) the same notes array is reused across iterations via `LOOP_RESTART` (`usePracticeLoop.ts`).
2. `usePracticeMidi.ts` subscribes to MIDI attacks. On a correct chord it computes `expectedTimeMs` and dispatches `CORRECT_MIDI`. The pure reducer in `practiceEngine.ts` computes `relativeDeltaMs = actualInterval − expectedInterval`, where the intervals are deltas of `responseTimeMs` and `expectedTimeMs` respectively.
3. `practiceStartTimeRef` is set once, on the first chord of the first iteration, and **never reset** across iterations. So `responseTimeMs = Date.now() − practiceStartTimeRef` is anchored at the first iteration's first chord and grows monotonically — correct.

### The defect (usePracticeMidi.ts lines ~299–312)

For loop iterations (`loopRegionRef` set, `loopK = loopIterationRef.current > 0`):

```ts
const loopStartBaseMs = (lr.startTick / ((bpm / 60) * PPQ)) * 1000;
const timeWithinLoop  = baseExpectedTimeMs - loopStartBaseMs;
const loopStartMs     = loopStartTimesRef.current[loopK] ?? 0;
expectedTimeMs        = loopStartMs + timeWithinLoop;
```

`loopStartTimesRef.current[loopK]` is populated in `usePracticeLoop.ts:141-143` when the previous iteration **completes**:

```ts
loopIterationRef.current += 1;
const loopStartMs = Date.now() - practiceStartTimeRef.current;   // → completion instant
loopStartTimesRef.current.push(loopStartMs);
```

The `mode === 'complete'` transition fires on the **release** of the previous iteration's **last chord** (`HOLD_COMPLETE`), i.e. `completion wall-time = t_lastChordOnset + holdTail`. This wall-clock value is then used as the anchor for the next iteration's first note.

### Why it reads late

Let `loopPeriodMs` = musical duration of one loop iteration at the current BPM. An accurate player attacks iteration-2's first chord at wall-time `≈ practiceStart + loopPeriodMs` (one full loop after the first chord). The code instead sets `expectedTimeMs(iter2, first chord) = completionTimestamp = practiceStart + t_lastChordOnset + holdTail`, which is strictly **less than** `practiceStart + loopPeriodMs` (the hold tail + turnaround/pickup separates the release from the next downbeat).

`relativeDeltaMs = (responseTimeMs − prev.responseTimeMs) − (expectedTimeMs − prev.expectedTimeMs)`. With `responseTimeMs` correct and `expectedTimeMs` anchored too early, the interval is inflated by the hold tail + pickup → a spurious positive (late) deviation, commonly > 600 ms → `correct-late` or an "out-of-time" state. The first iteration is unaffected because `loopK = 0` uses the plain `baseExpectedTimeMs` branch.

### Why the fix is monotonic and consistent

Replace the completion-timestamp anchor with the musical loop period:

```
expectedTimeMs = baseExpectedTimeMs(tick_i) + loopK * loopPeriodMs
loopPeriodMs   = ((lr.endTick - lr.startTick) / ((bpm/60) * PPQ)) * 1000
```

- `baseExpectedTimeMs` uses the entry's *absolute* musical tick, identical to the iteration-1 branch — so iteration 1 is byte-for-byte unchanged (`loopK = 0` adds nothing).
- Adding a whole number of `loopPeriodMs` keeps `expectedTimeMs` monotonic across iterations and on the **same clock** as `responseTimeMs` (both anchored so that intervals between consecutive notes are equal when played accurately). The absolute anchor (loop start not at tick 0) cancels in every interval.

### Decision

- **Decision**: Extract a pure exported `computeExpectedTimeMs({ tick, bpm, loopRegion, loopIteration })` helper and use it at the single call site. Remove the `loopStartTimesRef[loopK]` completion-anchor logic from the timing path.
- **Rationale**: matches the existing exported-helper convention (`computeRequiredHoldMs`), gives a directly unit-testable surface for the regression, and removes reliance on a wall-clock completion timestamp that is semantically the wrong anchor.
- **Alternatives considered**:
  1. "Leave the helper inline and only patch the formula" — rejected: the timing formula deserves an isolated test; inline logic is untestable without driving the whole hook.
  2. "Offset `practiceStartTimeRef` at each iteration restart" — rejected: mutating the master clock would retroactively distort already-recorded results and is more invasive.
  3. "Force delta to 0 at every loop boundary" — rejected: masks genuine early/late errors at the boundary instead of measuring them.

### Not in scope
- The `loopStartTimesRef` write in `usePracticeLoop.ts` stays (harmless, still drives `remainingLoops`/`loopIteration` bookkeeping); its read for expected-time is removed. Optionally it can be pruned later.
- Pure repeat-barline (non-loop) counts on the same monotonic `baseExpectedTimeMs` path and is already correct; unchanged.