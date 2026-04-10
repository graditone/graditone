# Implementation Plan: Review Execution of Learning Arabesque Goal

**Branch**: `077-arabesque-goal-review` | **Worktree**: `../worktrees/077-arabesque-goal-review` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/077-arabesque-goal-review/spec.md`

## Summary

When a user creates a "Learn Arabesque" goal, the system must: detect musically coherent phrases in Burgmüller Op. 100 No. 2, estimate realistic per-phrase practice durations, pack them into sensible sessions, and report per-phrase mastery clearly. Research of the current implementation reveals four concrete deficiencies (single-measure fragment phrases, oversized duration estimates, session over-budget packing, absent phrase-level progress view) that this feature corrects via targeted fixes across `backend/src/domain/phrases.rs`, `plugins-external/sessions-plugin/durationEstimation.ts`, `plugins-external/sessions-plugin/sessionDistribution.ts`, and `plugins-external/sessions-plugin/GoalsView.tsx`.

## Technical Context

**Language/Version**: Rust (stable ~1.83), TypeScript ~5.3, React 18  
**Primary Dependencies**: wasm-bindgen (WASM bindings), Vitest (plugin tests), cargo test (Rust tests), React (Goals UI)  
**Storage**: IndexedDB via `sessionStorage.ts` / `goalStorage.ts` (client-side, no server persistence)  
**Testing**: `cargo test` (Rust phrase detection), `vitest` (plugin unit + integration), Playwright (E2E)  
**Target Platform**: PWA on tablet devices (iPad, Surface, Android tablets); offline-capable  
**Project Type**: Web (frontend PWA + Rust/WASM backend, external plugin)  
**Performance Goals**: Phrase detection < 100ms for typical scores; UI feedback < 16ms  
**Constraints**: All phrase groups are atomic (RH+LH+BH together); cannot split a group across sessions  
**Scale/Scope**: Arabesque = 33 measures, 2 instruments (piano grand staff), ~9 phrases per instrument

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✓ PASS | Fixes use music domain language: phrase, measure, slur chain, volta, anacrusis. No leaking infrastructure terms. |
| II. Hexagonal Architecture | ✓ PASS | `phrases.rs` is core domain (no external deps). `durationEstimation.ts` and `sessionDistribution.ts` are pure functions. GoalsView is UI adapter. No cross-boundary leakage introduced. |
| III. PWA Architecture | ✓ PASS | All processing runs client-side (WASM + plugin). No new network dependency added. |
| IV. Precision & Fidelity | ✓ PASS | Phrase tick boundaries from `measure_end_ticks` (integer arithmetic). Duration estimates rounded to integer seconds. No float timing introduced. |
| V. Test-First Development | ⚠ GATE | Each fix MUST be preceded by a failing test: T026 expansion for Arabesque phrases, `durationEstimation.test.ts` extension, `goalEngine.test.ts` for phrase mastery reporting. Tests must fail before fixes land. |
| VI. Layout Engine Authority | ✓ PASS | No spatial geometry involved in this feature. Not applicable. |
| VII. Regression Prevention | ✓ PASS | Known issues must yield regression tests (phrase fragment detection, duration calibration, GoalsView phrase mastery). Keep existing T026 and add targeted assertions. |

**Gate result: PASS** with V/VII constraint: every fix file must have a corresponding failing test before the fix is written.

## Project Structure

### Documentation (this feature)

```text
specs/077-arabesque-goal-review/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── goal-progress-view.ts
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (worktree root)

```text
# Web application (frontend PWA + Rust/WASM backend + external plugin)

backend/
├── src/
│   └── domain/
│       └── phrases.rs               # Phrase detection algorithm
└── tests/
    └── phrase_detection_test.rs     # T026 Arabesque integration test (expand assertions)

plugins-external/sessions-plugin/
├── durationEstimation.ts            # BASE_SECS_PER_MEASURE calibration
├── durationEstimation.test.ts       # Add Arabesque-specific duration tests
├── sessionDistribution.ts           # distributeTasks — overflow handling
├── sessionDistribution.test.ts      # Add phrase-group overflow scenario tests
├── goalEngine.ts                    # createGoal, getPhraseRanges, checkGoalCompletion
├── goalEngine.test.ts               # Add phrase mastery calculation tests
├── goalTypes.ts                     # Add PhraseProgress type
├── GoalsView.tsx                    # Add per-phrase mastery section
└── GoalsView.test.tsx               # Add mastery % and per-phrase display tests

frontend/
└── (no changes — phrase detection served from existing WASM bindings)
```

**Structure Decision**: Web project. Three change areas: (1) `backend/` Rust domain logic, (2) `plugins-external/sessions-plugin/` TypeScript plugin, (3) no frontend changes. The plugin acts as the UI adapter layer; fixes to it do not breach hexagonal boundaries.

## Complexity Tracking

> No constitution violations. No additional complexity introduced.
