# Quickstart: Fix Delayed Chord Detection on Phrase Repeat

**Feature**: `100-fix-practice-repeat-delay`

## What changed

`usePracticeMidi.ts` now computes each practice note's expected onset time via a pure `computeExpectedTimeMs` helper. For loop iterations it anchors `expectedTimeMs` to the **musical loop period** (monotonic, session-clock-consistent) instead of the previous iteration's wall-clock completion timestamp. Accurate playing now measures `relativeDeltaMs ≈ 0` on the first chord of every repeated iteration.

## Verify

### 1. Unit tests (primary regression)

```sh
cd frontend
npx vitest run plugins/practice-view-plugin/usePracticeMidi.test.ts
npx vitest run plugins/practice-view-plugin/practiceEngine.test.ts   # unchanged, guard intact
```

Expected: all pass, including the new regression cases asserting the loop-period anchor.

### 2. Full practice plugin suite

```sh
npx vitest run plugins/practice-view-plugin/
```

### 3. Manual tablet reproduction (the reported bug)

1. Open Score Practice with the Arabesque; select the pointer/staff for the left-hand.
2. Set the practice to a **loop count of 2** on the first phrase (measures M1–M2, 4 chords).
3. Enable the metronome and start practice.
4. Play the 4-chord phrase in time, then continue into the second iteration.
5. **Expect**: the 5th chord (first chord of M1 in iteration 2), struck on the metronome tick, is recorded **correct / on-time** — not late by > 600 ms.

## Files

| File | Change |
|------|--------|
| `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` | Extract + fix `computeExpectedTimeMs`; remove completion-anchor read |
| `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts` | Regression tests for current behavior + loop anchor |
| `frontend/plugins/practice-view-plugin/practiceEngine.ts` | Unchanged (guard retained) |