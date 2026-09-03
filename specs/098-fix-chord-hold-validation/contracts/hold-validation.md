# Contract: Hold Duration Validation Helpers

**Feature**: 098-fix-chord-hold-validation
**Date**: 2026-09-02
**Module**: `frontend/plugins/practice-view-plugin/holdDuration.ts`

Pure, side-effect-free functions (no React). Single source of truth for the
hold-acceptance decision used by the reducer, the rAF loop, and the MIDI handlers.
`computeRequiredHoldMs`/`HOLD_FLOOR_MS` are migrated here from `usePracticeMidi.ts`
and re-exported there for backwards-compatible imports.

## API

```
HOLD_FLOOR_MS = 500

EARLY_ACCEPTANCE_RATIO = 0.15     // must hold ≥ 85% of the required duration
EARLY_ACCEPTANCE_CAP_MS = 750    // early margin never exceeds this (ms)

function computeRequiredHoldMs(durationTicks: number, bpm: number): number
  // (durationTicks / ((bpm/60) * 960)) * 1000, or 0 when bpm <= 0

function computeHoldAcceptanceMs(requiredHoldMs: number): number
  // requiredHoldMs - Math.min(requiredHoldMs * EARLY_ACCEPTANCE_RATIO, EARLY_ACCEPTANCE_CAP_MS)
  // 0 when requiredHoldMs <= 0

function isHoldAccepted(requiredHoldMs: number, elapsedMs: number): boolean
  // requiredHoldMs > 0 && elapsedMs >= computeHoldAcceptanceMs(requiredHoldMs)
```

## Semantics

- `isHoldAccepted(r, e)` is `true` once the player has held for at least 85% of the
  required duration, with the early-acceptance margin capped at 750 ms
  (feature 099: tuned down from 25%/1500 ms for greater accuracy). Grants a modest
  release margin (~half a beat for a whole-measure chord) while requiring the bulk
  of the duration to be held.
  - `required 2000 → acceptance 1700` (15% margin)
  - `required 24000 → acceptance 23250` (750 ms cap applies)
  - `required 1000 → acceptance 850`
  - Whole-note chord at 60 BPM → `required 4000`, `acceptance 3400` (~3.4 of 4 beats).
- A note does not enter `holding` when `requiredHoldMs ≤ HOLD_FLOOR_MS` (quarters and
  shorter at normal tempos); the helpers are only consulted for notes that
  requested a hold.
- Boundary: `elapsed == acceptanceMs` ⇒ accepted.

## Contract Tests (holdDuration.test.ts)

| Input | Expected |
|-------|----------|
| `computeRequiredHoldMs(3840, 10)` | 24000 |
| `computeRequiredHoldMs(960, 120)` | 500 |
| `computeRequiredHoldMs(3840, 0)` | 0 |
| `computeHoldAcceptanceMs(2000)` | 1700 |
| `computeHoldAcceptanceMs(24000)` | 23250 |
| `computeHoldAcceptanceMs(1000)` | 850 |
| `isHoldAccepted(2000, 1699)` | false |
| `isHoldAccepted(2000, 1700)` | true |
| `isHoldAccepted(2000, 4000)` | true |
| `isHoldAccepted(0, anything)` | false |

## Consumers

- `practiceEngine.ts` (reducer guard, contract: `contracts/practice-engine.md`)
- `useHoldProgress.ts` (rAF loop — drives the same acceptance threshold via the helpers)
- `usePracticeMidi.ts` (release + press-during-hold handlers)