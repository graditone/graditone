# Quickstart: Validate the Chord-Hold Fix

**Feature**: 098-fix-chord-hold-validation
**Date**: 2026-09-02
**Phase**: 1 (Design & Contracts)

This guide validates the fix end-to-end. It references (without duplicating) the
contracts — `contracts/hold-validation.md` and `contracts/practice-engine.md` —
plus `data-model.md`.

## Prerequisites

- `frontend/` dependencies installed (`npm install` at `frontend/`).
- A built/available development server (`npm run dev` in `frontend/`) or the
  deployed app at https://graditone.com/.
- A MIDI keyboard, or the built-in Virtual Keyboard plugin for pitch input.
- A score containing consecutive whole-measure chords (e.g. two whole-note chords
  back-to-back in 4/4). Any imported MusicXML with whole-note chords works.

## 1. Automated Validation (test-first)

Run the targeted suites from `frontend/`:

```bash
npx vitest run plugins/practice-view-plugin/useHoldProgress.test.ts \
  plugins/practice-view-plugin/usePracticeMidi.test.ts \
  plugins/practice-view-plugin/practiceEngine.test.ts \
  plugins/practice-view-plugin/holdDuration.test.ts
```

Expected: all tests pass, including the new red-regression tests:

| Test | Verifies |
|------|----------|
| `holdDuration.test.ts` | Threshold/acceptance maths (see contract table) |
| `practiceEngine.test.ts` — `EARLY_RELEASE` with full hold | Release at/above the threshold behaves like `HOLD_COMPLETE`; sub-threshold stays `early-release`; exact boundary accepted |
| `usePracticeMidi.test.ts` — full-measure chord released at the downbeat | Dispatches `HOLD_COMPLETE`, never `EARLY_RELEASE`; chord roll to the next chord while holding past acceptance does not dispatch `WRONG_MIDI` |
| Existing Feature 042 tests | No regression (short notes immediate, normal-tempo holds unchanged) |

Full suite as a sanity check:

```bash
npm run typecheck && npm run lint && npm test -- --run
```

## 2. Manual Validation in the App

1. Open a score with consecutive whole-note chords; go to the **Practice** view,
   select the staff, and start practice in step-by-step mode.
2. Set the metronome to quarter notes (1/4 subdivision) and a comfortable tempo
   (40–120 BPM).
3. **Scenario A — change at the downbeat (the reported bug):** press chord 1 on
   the first tick, hold it for exactly 4 ticks, release it on the 5th tick
   (downbeat) while pressing chord 2.
   - Expected: chord 1 is marked correct, no "released too early", the session
     advances to chord 2, and chord 2's presses are accepted in turn.
4. **Scenario B — genuine early release:** press a whole-note chord and release it
   after ~2 beats.
   - Expected: recorded as held-too-short / early-release; the session stays on the
     chord and the score reflects the penalty.
5. **Scenario C — over-hold:** hold chord 1 past the downbeat (into beat 1 of the
   next measure).
   - Expected: chord 1 completes at ~90% of its duration and is never penalised for
     releasing late.
6. **Scenario D — short notes at normal tempo:** play quarter notes at 120 BPM.
   - Expected: immediate advancement, no hold indicator (unchanged, Feature 042).

### Data/model references

- Hold thresholds and examples: `contracts/hold-validation.md`
- State transitions and invariants: `contracts/practice-engine.md`, `data-model.md`
  (mode transitions out of `holding`, invariants 1–4)

## Out of Scope for This Guide

Implementation details (chord-detector reset ordering, exact validation signatures)
belong to `tasks.md` and the implementation phase.