# Data Model: Expected Onset Time Computation

**Feature**: `100-fix-practice-repeat-delay`

This feature does not persist or model new domain entities; it corrects a computation that derives each practice note's **expected onset time** in milliseconds. This document specifies the inputs, the computation, and its invariants.

## Concept: Expected Onset Time (`expectedTimeMs`)

The wall-clock time (ms, on the session clock anchored at the first chord of iteration 1) at which a practice note/chord is *supposed* to be struck. It is compared against the measured `responseTimeMs` to derive `relativeDeltaMs` (early/late).

### Inputs

| Input | Type | Meaning |
|-------|------|---------|
| `tick` | `number` | Repeat-expanded tick of the practice entry (960 PPQ). |
| `bpm` | `number` | Current metronome/effective tempo. |
| `loopRegion` | `{ startTick: number; endTick: number } \| null` | The practice loop region when repeating via loop-count; `null` otherwise. |
| `loopIteration` | `number` | Zero-based iteration index (0 = first iteration). |

### Output

`expectedTimeMs: number` — monotonic expected onset on the session clock.

## Computation

```
msPerTick(bpm) = 1000 / ((bpm / 60) * 960)
baseExpectedTimeMs = tick * msPerTick(bpm)                       // absolute musical ms
loopPeriodMs(loopRegion, bpm) = (loopRegion.endTick - loopRegion.startTick) * msPerTick(bpm)

if bpm <= 0:            return 0                                  // guard, matches existing behavior
if loopRegion == null or loopIteration <= 0:
    return baseExpectedTimeMs                                      // iteration 1 / non-loop
else:
    return baseExpectedTimeMs + loopIteration * loopPeriodMs      // iteration k ≥ 1
```

## Invariants

1. **Iteration-1 parity**: For `loopIteration = 0` the result is identical to the existing non-loop `baseExpectedTimeMs`, so iteration-1 behavior is unchanged.
2. **Monotonicity**: `expectedTimeMs` never decreases as notes progress across an iteration boundary (each iteration adds the full positive `loopPeriodMs`). The engine's existing "backwards expectedTimeMs → delta 0" guard (practiceEngine.ts) therefore stays dormant.
3. **Interval consistency**: For an accurate player, the actual interval `responseTimeMs(i+1) − responseTimeMs(i)` equals the expected interval `expectedTimeMs(i+1) − expectedTimeMs(i)`, so `relativeDeltaMs = 0` on every iteration. Any absolute anchor offset (loop region not at tick 0) cancels in the interval, so no extra normalization is needed.
4. **No shared mutable state**: `expectedTimeMs` is a pure function of the four inputs — no dependence on wall-clock completion timestamps.

## State transition impact

No domain state transitions change. The pure state machine in `practiceEngine.ts` (`reduce`, `CORRECT_MIDI`, `HOLD_COMPLETE`) is unchanged; only the `expectedTimeMs` value it receives differs. The `LOOP_RESTART` action's `currentLoopResultOffset` bookkeeping is untouched.