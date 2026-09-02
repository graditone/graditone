# Research: Fix Chord Hold Validation at the Measure Boundary

**Feature**: 098-fix-chord-hold-validation
**Date**: 2026-09-02
**Phase**: 0 (Outline & Research)

## Scope of Research

The feature spec (FR-001..FR-008) requires that a chord held for its full
notated duration and released at the next downbeat is always validated as
correct, that the accept/reject decision depends on elapsed hold time versus
the required hold time (never on event-processing order), and that genuine
early releases remain detected. This document consolidates the in-repo
investigation of the practice-view chord-hold pipeline to pin down root causes
and validate the fix design.

## Code Under Review

- `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` — MIDI attack/release
  handling; computes `requiredHoldMs`, dispatches `CORRECT_MIDI`, `EARLY_RELEASE`,
  `WRONG_MIDI`.
- `frontend/plugins/practice-view-plugin/useHoldProgress.ts` — rAF loop that
  dispatches `HOLD_COMPLETE` at the acceptance threshold.
- `frontend/plugins/practice-view-plugin/practiceEngine.ts` — pure reducer for the
  practice state machine (`HOLD_COMPLETE`, `EARLY_RELEASE`, `CORRECT_MIDI`).
- `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` — `PracticeState`,
  `PracticeAction`, `PracticeNoteResult` contracts.
- `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`,
  `useHoldProgress.test.ts`, `practiceEngine.test.ts` — existing test harness.
- `frontend/src/plugin-api/scorePlayerContext.ts` — `extractPracticeNotes` build of
  note entries (grouping, `durationTicks`, gap-clipping, staccato).
- `frontend/src/utils/chordDetector.ts` — pitch-group detection (`ChordDetector`,
  80 ms simultaneous-press window). Not implicated in this defect.

## How a Hold Is Validated Today

1. **Press** (attack): `ChordDetector` accumulates all required pitches within the
   80 ms window. On completion, `CORRECT_MIDI` is dispatched with
   `requiredHoldMs = computeRequiredHoldMs(effectiveDurTicks, bpm)` (capped to the
   gap before the next entry; `0` when ≤ `HOLD_FLOOR_MS` 500 ms, i.e. quarters and
   shorter at normal tempos need no hold). When `requiredHoldMs > 0`, the reducer
   transitions `active/waiting → holding` and stores `holdStartTimeMs = Date.now()`.
2. **Hold**: `useHoldProgress` runs a `requestAnimationFrame` loop. Each frame it
   computes `acceptanceMs = requiredHoldMs − min(requiredHoldMs × 0.1, 500)` and
   dispatches `HOLD_COMPLETE` when the elapsed time ≥ `acceptanceMs`.
3. **Release**: the MIDI release handler, when `mode === 'holding'`, computes
   `holdDurationMs = Date.now() − holdStartTimeMs` and **unconditionally** dispatches
   `EARLY_RELEASE`, without any comparison against `requiredHoldMs` or the acceptance
   threshold.

## Root Causes Identified

### Defect A — unconditional early-release on release (primary)

`usePracticeMidi.ts` release branch (lines ~193–203):

```ts
if (holdPs.mode === 'holding') {
  const holdEntry = holdPs.notes[holdPs.currentIndex];
  if (holdEntry && (pitches.includes(note) || sustained.includes(note))) {
    const holdDurationMs = Date.now() - holdPs.holdStartTimeMs;
    dispatchPractice({ type: 'EARLY_RELEASE', holdDurationMs });
  }
}
```

The decision ignores the measured duration entirely. A release that falls at the
acceptance boundary is classified as `early-release` whenever the release event is
processed before the next rAF frame would have fired `HOLD_COMPLETE`. At the measure
boundary (beat 5 in the user's scenario) the release and the completion instant
coincide, so a musically correct full-measure hold is routinely rejected.

The reducer `EARLY_RELEASE` case (practiceEngine.ts) is equally unconditional: it
records an `early-release` result and returns to `active` on the same index for any
`holdDurationMs`, never checking it against `state.requiredHoldMs`.

**Evidence**: useHoldProgress T002/T014/T015 document the rAF firing window
(down to ~90%/160ms). The release handler runs synchronously on the MIDI event and
preempts a pending rAF tick, so the ordering race is real and intermittent
(tempo-dependent).

### Defect B — pressing the next chord while still holding is flagged wrong (secondary)

The user changes chords by releasing old keys and pressing new ones around the
downbeat. If a new-chord press arrives while `mode === 'holding'` for the previous
chord (press-before-complete-release, common on piano):

```ts
if (ps.mode === 'holding') {
  if (!isInChord && !isSustained) {
    dispatchPractice({ type: 'WRONG_MIDI', ... });
  }
  return;
}
```

The next-chord pitch is not in the current entry, so it is dispatched as
`WRONG_MIDI`, and the subsequent releases fire `EARLY_RELEASE` (Defect A). The whole
measure-boundary change is rejected even though each chord's hold was long enough.

## Fix Design (decision)

Introduce a single pure acceptance rule — *"a hold that reached
`requiredHoldMs − min(requiredHoldMs × 0.1, 500)` is accepted"* — and apply it at
**every** acceptance/rejection decision point so the outcome depends only on
elapsed-vs-required duration (FR-002), never on which event arrives first:

1. **Shared pure module** `holdDuration.ts` (no React): export
   - `HOLD_FLOOR_MS` (moved from hook),
   - `computeRequiredHoldMs(durationTicks, bpm)` (moved from hook; re-exported for
     backwards-compatible imports),
   - `computeHoldAcceptanceMs(requiredHoldMs)` := `requiredHoldMs − Math.min(requiredHoldMs × 0.1, 500)`,
   - `isHoldAccepted(requiredHoldMs, elapsedMs)`: `elapsedMs ≥ acceptanceMs`.
   Unit tests in `holdDuration.test.ts`.

2. **Domain invariant at the reducer** (practiceEngine.ts): the `EARLY_RELEASE`
   case first evaluates `isHoldAccepted(state.requiredHoldMs, action.holdDurationMs)`.
   If accepted, route through the existing `HOLD_COMPLETE` completion logic
   (records a `correct`/`correct-late` result, clears hold fields, advances the
   index / completes). Otherwise keep the current early-release behaviour. This
   makes the engine itself order-independent regardless of hook behaviour.

3. **Release handler** (usePracticeMidi.ts): compute `elapsedMs`; if
   `isHoldAccepted(...)` dispatch `HOLD_COMPLETE` with the measured duration
   (immediate correct feedback at the downbeat, no dependence on the next rAF
   frame), else keep `EARLY_RELEASE`.

4. **Press handler while holding** (usePracticeMidi.ts): when the pressed pitch is
   not part of the current entry, first check `isHoldAccepted(...)`. If the current
   hold is already complete, dispatch `HOLD_COMPLETE`, reset the `ChordDetector`
   to the *next* entry's required pitches, and re-process this same press against
   the next entry (extract the chord-press completion routine so the standard path
   and this path share it). If not complete, keep `WRONG_MIDI` as today.

5. **rAF loop** (useHoldProgress.ts): unchanged behaviour, but uses the shared
   `computeHoldAcceptanceMs`/`isHoldAccepted` helpers so the threshold is defined
   in exactly one place.

## Why Not Alternative Approaches

| Alternative | Rejected because |
|-------------|------------------|
| Always accept the chord on release and drop duration checking | Removes intended duration accuracy (Feature 042, FR-005); genuine early releases must stay penalised. |
| Only reorder events (delay `EARLY_RELEASE` until the rAF tick) | Fragile; still racy under rAF throttling/power-saving and does not protect the reducer boundary. |
| Increase the early-acceptance window (e.g. accept 100%) | Changes the documented Feature 042 tolerance contract; FR-001/FR-006 require the existing window to remain. |
| Fix only the release handler | Misses the press-during-holding path (Defect B) and leaves the reducer able to record an `early-release` even when `holdDurationMs ≥ requiredHoldMs`. |

## Test Strategy (Test-First, Constitution V & VII)

- **Red-regression tests (written first)**:
  - `practiceEngine.test.ts`: `EARLY_RELEASE` with `holdDurationMs ≥ acceptanceMs`
    (e.g. 2000 required, 1900 held → acceptance 1800) behaves like `HOLD_COMPLETE`
    (outcome `correct`, index advances); `holdDurationMs` just below threshold stays
    `early-release`; boundary at exactly `acceptanceMs` is accepted.
  - `usePracticeMidi.test.ts`: full-measure chord (requiredHoldMs = 4000 at 60 BPM)
    released at ≥3600 ms dispatches `HOLD_COMPLETE` (not `EARLY_RELEASE`); release
    at 2000 ms still `EARLY_RELEASE`. Whole-note chord → next chord press while the
    first is held past acceptance does not dispatch `WRONG_MIDI` and advances.
  - `holdDuration.test.ts`: acceptance/threshold unit tests across the 90%-/500 ms
    cap boundary (≤5000 ms required → 10% window; >5000 ms → flat 500 ms window).
- **Green**: implement per fix design; run full suite.
- **No regression**: existing `useHoldProgress` firing-window tests, `practiceEngine`
  HOLD_COMPLETE/EARLY_RELEASE tests, `usePracticeMidi` requiredHoldMs tests stay green.

## Tempos / Timing Reference

- `PPQ = 960`. Seconds per tick = `1/((bpm/60)·960)`.
- Example target values used by existing tests: 60 BPM whole note (3840 ticks) →
  required 4000 ms, acceptance 3600 ms; 120 BPM whole note → 2000 ms, acceptance
  1800 ms; 120 BPM half → 1000 ms, acceptance 900 ms; 120 BPM quarter → 500 ms →
  no hold (≤ HOLD_FLOOR_MS).

## Unresolved / Assumed

None. All ancillary unknowns (sustained notes, staccato, loop restart, score
scoring) were reviewed and are untouched by this fix. `ChordDetector`'s 80 ms
window is unrelated to the reported defect and left unchanged.