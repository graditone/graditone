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

function computeRequiredHoldMs(durationTicks: number, bpm: number): number
  // (durationTicks / ((bpm/60) * 960)) * 1000, or 0 when bpm <= 0

function computeHoldAcceptanceMs(requiredHoldMs: number): number
  // requiredHoldMs - Math.min(requiredHoldMs * 0.1, 500); 0 when requiredHoldMs <= 0

function isHoldAccepted(requiredHoldMs: number, elapsedMs: number): boolean
  // requiredHoldMs > 0 && elapsedMs >= computeHoldAcceptanceMs(requiredHoldMs)
```

## Semantics

- `isHoldAccepted(r, e)` is `true` once the player has held for at least 90% of the
  required duration, with the early-acceptance window capped at 500 ms
  (Feature 042 rule, unchanged). Examples:
  - `required 2000 → acceptance 1800` (10% window)
  - `required 24000 → acceptance 23500` (capped 500 ms window)
  - `required 1000 → acceptance 900`
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
| `computeHoldAcceptanceMs(2000)` | 1800 |
| `computeHoldAcceptanceMs(24000)` | 23500 |
| `computeHoldAcceptanceMs(1000)` | 900 |
| `isHoldAccepted(2000, 1799)` | false |
| `isHoldAccepted(2000, 1800)` | true |
| `isHoldAccepted(2000, 4000)` | true |
| `isHoldAccepted(0, anything)` | false |

## Consumers

- `practiceEngine.ts` (reducer guard, contract: `contracts/practice-engine.md`)
- `useHoldProgress.ts` (rAF loop — behaviour unchanged, shares the helpers)
- `usePracticeMidi.ts` (release + press-during-hold handlers)