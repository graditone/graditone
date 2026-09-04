# Contract: `computeExpectedTimeMs`

**Feature**: `100-fix-practice-repeat-delay`
**Module**: `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`

Pure, exported helper that computes the expected onset time (ms, session clock) for a practice note in Score Practice, correctly handling repeated phrase iterations.

## Signature

```ts
export interface LoopRegion { startTick: number; endTick: number; }

export function computeExpectedTimeMs(params: {
  tick: number;
  bpm: number;
  loopRegion: LoopRegion | null;
  loopIteration: number;
}): number;
```

## Behavioral Contract

1. **`bpm <= 0`** → returns `0` (guards division-by-zero; matches existing behavior).
2. **Non-loop or first iteration** (`loopRegion` is `null` OR `loopIteration <= 0`):
   `returns tick / ((bpm / 60) * 960) * 1000` (i.e. `baseExpectedTimeMs`).
3. **Loop iterations** (`loopRegion` non-null AND `loopIteration > 0`):
   `returns baseExpectedTimeMs + loopIteration * loopPeriodMs`,
   where `loopPeriodMs = ((endTick − startTick) / ((bpm / 60) * 960)) * 1000`.
   This anchors each iteration at the **musical loop period**, not at a wall-clock completion timestamp.
4. **Monotonicity**: For a fixed `bpm`/`loopRegion`, increasing the entry `tick` (across an iteration boundary) must never decrease the returned value.
5. **Iteration-1 parity**: `computeExpectedTimeMs({tick, bpm, loopRegion, loopIteration: 0}) === computeExpectedTimeMs({tick, bpm, loopRegion: null, loopIteration: 0})`.

## Regression Scenario (Issue #100-1)

Given a 4-chord phrase loop (`loopRegion = {startTick: T0, endTick: T1}`, period `P` ms) with `loopIteration = 1`, the first chord (`tick = T0`) must produce `expectedTimeMs = loopPeriodMs`, i.e. **one full musical loop after the first chord of iteration 1** — NOT the wall-clock completion timestamp of iteration 1's last chord. An accurate attack at that instant yields `relativeDeltaMs ≈ 0`.

## Old (buggy) behavior reference

For iteration `k`, old code returned `loopStartTimesRef.current[k] + timeWithinLoop`, where `loopStartTimesRef.current[k]` was the previous iteration's **completion** (release) timestamp — too early by the last chord's hold tail + pickup — producing a spurious late `relativeDeltaMs` (> 600 ms).

## Test vector

At `bpm = 120` (`msPerTick = 1000/1920`):
| tick | loopRegion | loopIteration | expectedTimeMs |
|------|------------|---------------|----------------|
| 0    | {0, 1920}  | 0             | 0              |
| 960  | {0, 1920}  | 0             | 500            |
| 0    | {0, 1920}  | 1             | 1000           |
| 960  | {0, 1920}  | 1             | 1500           |
| 0    | {0, 1920}  | 2             | 2000           |
| 0    | null       | 1             | 0              |
| 0    | {0, 960}   | 1             | 500            |
| 960  | {0, 1920}  | 0             | 500            | 
| 0    | {0,1920}   | 0             | 0              |