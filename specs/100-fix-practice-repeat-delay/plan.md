# Implementation Plan: Fix Delayed Chord Detection on Phrase Repeat

**Branch**: `100-fix-practice-repeat-delay` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/100-fix-practice-repeat-delay/spec.md`

## Summary

In Score Practice, when a phrase is repeated (via the practice **loop-count** mode — e.g. a left-hand 4-chord phrase played twice), the first chord of every **iteration ≥ 2** is recorded as late by more than 600 ms even when the musician attacks it exactly on the metronome tick. The first iteration's chords are recorded correctly. The defect is a timing-alignment bug in the practice engine's caller (`usePracticeMidi.ts`): the expected onset time for a loop-iteration note is anchored to the **wall-clock completion timestamp** of the previous iteration (captured when the prior iteration's last chord is released) instead of to the correct **musical loop period**. Because the musician has not yet reached that release-plus-pickup position when they strike the downbeat, the engine measures a spurious positive (late) interval.

**Primary fix**: Replace the completion-timestamp anchor with a period-based, monotonic `expectedTimeMs` computation: for iteration `k`, `expectedTimeMs = baseExpectedTimeMs(tick) + k × loopPeriodMs`, where `loopPeriodMs` is the musical duration of the loop region at the current BPM. This keeps `expectedTimeMs` on the same clock as `responseTimeMs` (both anchored to the session start), so an accurate player measures `relativeDeltaMs ≈ 0` on every iteration. The computation is extracted into a pure, exported, unit-testable helper `computeExpectedTimeMs` (matching the existing `computeRequiredHoldMs` pattern), and covered by a regression test per Constitution Principle VII.

## Technical Context

**Language/Version**: TypeScript (React 18+), strict mode
**Primary Dependencies**: none new — Vitest (existing), `@testing-library/react` (existing, for hook tests)
**Storage**: N/A
**Testing**: Vitest — unit tests for the extracted `computeExpectedTimeMs` helper and regression coverage in `usePracticeMidi.test.ts`
**Target Platform**: Tablet devices (iPad/Surface/Android), PWA frontend
**Project Type**: Frontend plugin (`frontend/plugins/practice-view-plugin`)
**Performance Goals**: Timing computed in-line on each MIDI attack — sub-ms, no additional latency; no measurable impact
**Constraints**: integer-tick precision (960 PPQ) preserved; timing math must remain monotonic (`expectedTimeMs` never goes backwards); must not regress existing correctness for non-loop notes, swing note values, or metronome-armed start
**Scale/Scope**: Single helper extraction + one call-site change + tests; no data model or persistence changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Timing vocabulary (onset, expected time, loop period) kept in domain terms; no UI concern touched |
| II. Hexagonal Architecture | ✅ PASS | Fix confined to the practice-view plugin hook; host `/plugin-api` unchanged |
| III. PWA Architecture | ✅ PASS | No new dependency, offline-first logic unchanged |
| IV. Precision & Fidelity | ✅ PASS | Integer ticks converted at 960 PPQ; no floating-point creep beyond existing conversions |
| V. Test-First Development | ✅ PASS | Regression test written before the fix (TDD red→green) |
| VI. Layout Engine Authority | ✅ PASS | No coordinates/geometry involved — pure tick scheduling |
| VII. Regression Prevention | ✅ PASS | This plan is itself a regression fix; regression test added for the loop-period anchor |
| VIII. User Profile Awareness | ✅ PASS | No user state introduced/changed |

## Project Structure

### Documentation (this feature)

```text
specs/100-fix-practice-repeat-delay/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — root-cause analysis
├── data-model.md        # Phase 1 output — timing computation model
├── quickstart.md        # Phase 1 output — how to run/verify
├── contracts/           # Phase 1 output — computeExpectedTimeMs contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
└── plugins/
    └── practice-view-plugin/
        ├── usePracticeMidi.ts        # MODIFIED — extract + fix computeExpectedTimeMs
        ├── usePracticeMidi.test.ts   # MODIFIED — regression test for loop-period anchor
        └── practiceEngine.ts         # UNCHANGED — engine already handles monotonic expectedTimeMs
```

**Structure Decision**: Single-file frontend plugin change. The practice-view plugin already isolates pure timing helpers (see `holdDuration.ts`); `computeExpectedTimeMs` follows the same exported-helper convention. The practice engine (`practiceEngine.ts`) needs no change — it already computes `relativeDeltaMs` correctly from monotonic `expectedTimeMs`, and the loop-boundary guard (forced delta 0 on backwards `expectedTimeMs`) remains as a safety net.

## Complexity Tracking

> No Constitution violations — no complexity justification required.