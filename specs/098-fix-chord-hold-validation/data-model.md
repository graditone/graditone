# Data Model: Fix Chord Hold Validation

**Feature**: 098-fix-chord-hold-validation
**Date**: 2026-09-02
**Phase**: 1 (Design & Contracts)

This feature has no persisted storage — the practice engine is an in‑memory pure
state machine. The "data model" below documents the domain entities and the state
machine held/tested by this fix. See
[contracts/practice-engine.md](contracts/practice-engine.md) and
[contracts/hold-validation.md](contracts/hold-validation.md) for the interfaces.

## Domain Entities

### PracticeNoteEntry

A single practice step derived from the score by `extractPracticeNotes`
(`frontend/src/plugin-api/scorePlayerContext.ts`). A chord is a single entry whose
`midiPitches` lists every pitch that must be pressed simultaneously.

| Field | Type | Meaning |
|-------|------|---------|
| `tick` | integer (PPQ=960) | Onset position of the entry in the score timeline |
| `durationTicks` | integer | Notated duration, capped to the gap before the next entry; `0` = no hold required (staccato, sub-threshold) |
| `midiPitches` | integer[] | All pitches that must be pressed to complete the chord (chord-roll within 80 ms) |
| `sustainedPitches` | integer[] | Pitches carried over from a previous onset that must also be held |
| `noteIds` | string[] | Score note identifiers (1:1 with `midiPitches`) |

### HoldSession (reducer-held context)

Captured on each entry into `holding` mode; is the sole basis for the
accept/reject decision.

| State field | Meaning | Invariant after this fix |
|-------------|---------|--------------------------|
| `holdStartTimeMs` | Wall-clock ms when the hold began | cleared on exit from `holding` |
| `requiredHoldMs` | Required hold in ms (`n/a` when `0`) | a hold is accepted once elapsed ≥ `computeHoldAcceptanceMs(requiredHoldMs)` |
| `holdMidiNote` | MIDI note that started the hold | used to reconstruct the result |
| `holdResponseTimeMs` / `holdExpectedTimeMs` | Timing context from the triggering `CORRECT_MIDI` | basis for `relativeDeltaMs` |
| `holdEndIndex` | Session end index for advancement | −1 ⇒ last note |

**Acceptance threshold (single source of truth):**

```
computeHoldAcceptanceMs(required)        = required − Math.min(required × 0.1, 500)
isHoldAccepted(required, elapsed)        = required > 0 && elapsed >= computeHoldAcceptanceMs(required)
computeRequiredHoldMs(durationTicks, bpm) = bpm > 0 ? (durationTicks / ((bpm/60) * 960)) * 1000 : 0
```

### PracticeNoteResult

Per-entry outcome recorded in `noteResults`; feeds the final score.

| Field | Type | Meaning |
|-------|------|---------|
| `noteIndex` | int | Index into `notes` |
| `outcome` | enum | `correct`, `correct-late`, `early-release`, `wrong`, … |
| `playedMidi` / `expectedMidi` | int / int[] | Actual vs required pitches |
| `responseTimeMs` / `expectedTimeMs` / `relativeDeltaMs` | int | Timing |
| `wrongAttempts` | int | Wrong presses before this attempt |
| `holdDurationMs` | int | Measured hold at release/completion (Feature 042) |
| `requiredHoldMs` | int | Required hold at the session BPM |

**Invariant added by this fix**: a rejected attempt is recorded `early-release`
exactly when `holdDurationMs < computeHoldAcceptanceMs(requiredHoldMs)`; a release
at or above the threshold must record `correct`/`correct-late` and never
`early-release`. A `holdDurationMs ≥ requiredHoldMs` release is never rejected.

## State Machine

`PracticeMode ∈ { inactive, waiting, active, holding, complete }`

This fix changes the **exit transitions from `holding`**. All other transitions
(per Feature 042 / 037) are unchanged.

### Transitions OUT of `holding`

| Event | Condition | Next state | Records |
|-------|-----------|------------|---------|
| `HOLD_COMPLETE(holdDurationMs)` | `isHoldAccepted(requiredHoldMs, holdDurationMs)` (or reducer guard) | `active` (next index) or `complete` (last) | `correct` / `correct-late` |
| `EARLY_RELEASE(holdDurationMs)` | **NEW**: `isHoldAccepted(...)` true | `active` (next index) or `complete` | `correct` / `correct-late` (same path as `HOLD_COMPLETE`) |
| `EARLY_RELEASE(holdDurationMs)` | `isHoldAccepted(...)` false (existing behaviour) | `active` (same index) | `early-release` (retry allowed) |
| unexpected press while holding | **NEW**: current hold accepted | `HOLD_COMPLETE` first, then this press routes to the next entry | `correct` for previous entry, next entry begins |
| unexpected press while holding | hold not yet accepted | `holding` (unchanged) | `WRONG_MIDI` |

### Invariants (must hold in all orderings)

1. A release that closes a hold which already reached the threshold is never
   `early-release`.
2. The `EARLY_RELEASE` reducer case can never produce an `early-release` result with
   `holdDurationMs ≥ computeHoldAcceptanceMs(requiredHoldMs)`.
3. Double completion is safe: `HOLD_COMPLETE`/`EARLY_RELEASE` are no-ops outside
   `holding` (guarded by `state.mode`), so a simultaneous rAF tick and
   release handler cannot double-advance.
4. Progress/over-hold: holding past the threshold completes at the threshold moment;
   releasing later is still `correct`.

## Validation Rules Derived From the Spec

| Requirement | Enforcement point |
|-------------|-------------------|
| FR-001 (never longer than notated) | `isHoldAccepted` threshold ≤`requiredHoldMs` (specified value) |
| FR-002 (duration-based, order-independent) | Reducer guard + release/press handler checks |
| FR-003 (early-release only below threshold) | Same rule at all decision points |
| FR-004 (downbeat change always satisfies) | Release-time completion covers the downbeat scenario |
| FR-005 (genuine early release still penalised) | Sub-threshold releases keep `early-release` |
| FR-006 (no change to no-hold notes) | `requiredHoldMs === 0` ⇒ no `holding` (unchanged) |
| FR-007 (10–300 BPM, other time sigs) | Rule is ratio-of-duration-based, tempo/signature-agnostic |
| FR-008 (over-hold never penalised) | Release at/above threshold accepted |