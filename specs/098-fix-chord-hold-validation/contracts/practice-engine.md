# Contract: Practice Engine State Machine

**Feature**: 098-fix-chord-hold-validation
**Date**: 2026-09-02
**Module**: `frontend/plugins/practice-view-plugin/practiceEngine.ts` (+ `practiceEngine.types.ts`)

This contract governs the pure reducer that owns practice-session state. It is the
domain boundary (Constitution I/II): hooks dispatch facts; the reducer decides.

## State

`PracticeState` (see `practiceEngine.types.ts`). Relevant to this feature:
`mode`, `currentIndex`, `noteResults`, `currentWrongAttempts`,
`holdStartTimeMs`, `requiredHoldMs`, `holdMidiNote`, `holdResponseTimeMs`,
`holdExpectedTimeMs`, `holdEndIndex`, `currentLoopResultOffset`.

## Actions

| Action | Payload | Effect (this feature) |
|--------|---------|-----------------------|
| `CORRECT_MIDI` | `{ midiNote, responseTimeMs, expectedTimeMs, endIndex?, pressTimeMs?, requiredHoldMs? }` | `requiredHoldMs > 0` ⇒ `holding` (unchanged); `requiredHoldMs 0|absent` ⇒ record & advance (unchanged) |
| `HOLD_COMPLETE` | `{ holdDurationMs }` | Complete the hold: record `correct`/`correct-late`, clear hold fields, advance index or `complete` (unchanged) |
| `EARLY_RELEASE` | `{ holdDurationMs }` | **CHANGED**: if `isHoldAccepted(state.requiredHoldMs, holdDurationMs)` ⇒ behave as `HOLD_COMPLETE`; else current behaviour (`early-release`, stay on same index) |
| `WRONG_MIDI` | `{ midiNote, responseTimeMs }` | Unchanged |

## Transition Rules (holding exit)

1. `HOLD_COMPLETE` outside `holding` → no-op (same state reference).
2. `EARLY_RELEASE` outside `holding` → no-op (same state reference).
3. `EARLY_RELEASE(holdDurationMs)` inside `holding`:
   - (`requiredHoldMs ≤ 0` is unreachable — no hold requested) ;
   - if `holdDurationMs ≥ computeHoldAcceptanceMs(requiredHoldMs)` →
     identical result to `HOLD_COMPLETE(holdDurationMs)`;
   - else → `early-release` result, mode `active`, same `currentIndex`, hold fields cleared.
4. Double-completion safety: whichever of rAF / release arrives first wins;
   the second is a no-op because mode is no longer `holding`.

## Invariants

- `early-release` is recorded **iff** `holdDurationMs < computeHoldAcceptanceMs(requiredHoldMs)`.
- `holdDurationMs ≥ requiredHoldMs` is never `early-release`.
- Exact boundary `elapsed == acceptanceMs` is accepted.
- Completion never double-records a result (guarded by `mode === 'holding'`).

## Contract Tests (test-first)

- `EARLY_RELEASE(1900)` with `requiredHoldMs=2000` (acceptance 1800) → outcome
  `correct`, index advances — mirrors `HOLD_COMPLETE(1900)`.
- `EARLY_RELEASE(1700)` with `requiredHoldMs=2000` → outcome `early-release`,
  index unchanged.
- `EARLY_RELEASE(1800)` (exact boundary) → accepted.
- No-op cases unchanged (outside `holding`).