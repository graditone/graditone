# Implementation Plan: Session Task Distribution

**Branch**: `070-session-task-distribution` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/070-session-task-distribution/spec.md`

## Summary

Evolve goal-based task generation from creating tasks for a single phrase to generating tasks for **all** detected phrases (RH, LH, BH per phrase for piano). Each task receives a computed difficulty rating and estimated practice duration. Tasks are distributed into time-limited sessions (default 1 hour), keeping phrase triplets as atomic units. Sessions are scheduled on the next available free days.

**Key changes**: (1) goalEngine.ts expanded to iterate all phrases, applying a silent-region filter (skip task creation when `getRegionDifficulty()` returns `null`), (2) new Rust WASM function for per-region difficulty, (3) new TypeScript duration estimation module, (4) new session distribution algorithm updated to handle phrase groups with fewer than 3 tasks, (5) free-day scheduling logic.

## Technical Context

**Language/Version**: Rust (latest stable) + TypeScript (strict mode), React 18+
**Primary Dependencies**: wasm-pack, wasm-bindgen, Vite, Vitest, @testing-library/react
**Storage**: IndexedDB (sessions + goals stores) with localStorage index layer
**Testing**: Vitest (frontend/plugin unit tests), cargo test (Rust domain tests)
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, Chrome 57+, Safari 11+
**Project Type**: Web — monorepo with `backend/` (Rust/WASM) + `frontend/` (React) + `plugins-external/sessions-plugin/`
**Performance Goals**: Goal creation < 2s including score load + task generation; session distribution < 100ms
**Constraints**: 50-session cap with eviction; phrase triplet is the atomic distribution unit; availableTime hardcoded at 3600s
**Scale/Scope**: Scores with up to ~50 phrases (150 tasks for piano), distributed into ~10-15 sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | PASS | Duration estimation, difficulty, phrase regions are all music domain concepts modeled as first-class entities |
| II. Hexagonal Architecture | PASS | Difficulty computation stays in Rust core domain; WASM binding is an adapter; TypeScript consumes via port (ScorePlayer API) |
| III. Progressive Web Application | PASS | All computation client-side (WASM + TypeScript); IndexedDB storage; offline-capable |
| IV. Precision & Fidelity | PASS | Duration estimation uses difficulty derived from PPQ-based tick arithmetic; no floating-point timing in core domain |
| V. Test-First Development | PASS | Plan includes unit tests for: Rust region difficulty, TypeScript duration estimation, distribution algorithm, free-day scheduling, goalEngine expansion |
| VI. Layout Engine Authority | PASS | No layout/rendering changes — this feature is pure data/logic |
| VII. Regression Prevention | PASS | Existing goal completion tests maintained; new tests cover expanded task generation |

**GATE RESULT: PASS** — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/070-session-task-distribution/
\u251c\u2500\u2500 spec.md              # Feature specification (complete)
\u251c\u2500\u2500 plan.md              # This file
\u251c\u2500\u2500 research.md          # Phase 0: Research findings
\u251c\u2500\u2500 data-model.md        # Phase 1: Entity changes
\u251c\u2500\u2500 quickstart.md        # Phase 1: Implementation guide
\u251c\u2500\u2500 contracts/           # Phase 1: WASM contract changes
\u2502   \u2514\u2500\u2500 wasm-difficulty-region.md
\u2514\u2500\u2500 tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
\u251c\u2500\u2500 src/
\u2502   \u251c\u2500\u2500 domain/
\u2502   \u2502   \u2514\u2500\u2500 difficulty/
\u2502   \u2502       \u251c\u2500\u2500 density.rs          # MODIFY: add compute_region_difficulty()
\u2502   \u2502       \u2514\u2500\u2500 level.rs            # NO CHANGE
\u2502   \u2514\u2500\u2500 adapters/wasm/
\u2502       \u2514\u2500\u2500 bindings.rs             # MODIFY: add compute_region_difficulty WASM export
\u2514\u2500\u2500 tests/
    \u2514\u2500\u2500 difficulty_region_tests.rs  # NEW: tests for per-region difficulty

plugins-external/sessions-plugin/
\u251c\u2500\u2500 goalEngine.ts               # MODIFY: iterate all phrases, generate tasks per phrase; skip task when getRegionDifficulty() returns null (FR-017 silent-region guard)
\u251c\u2500\u2500 goalEngine.test.ts           # MODIFY: add tests for multi-phrase generation, add silent-hand regression test
\u251c\u2500\u2500 goalTypes.ts                 # MODIFY: Goal.sessionIds (was sessionId)
\u251c\u2500\u2500 sessionTypes.ts              # MODIFY: Session.availableTime, SessionTask.difficulty/estimatedDurationSecs
\u251c\u2500\u2500 durationEstimation.ts        # NEW: practice time estimation module
\u251c\u2500\u2500 durationEstimation.test.ts   # NEW: unit tests
\u251c\u2500\u2500 sessionDistribution.ts       # NEW: task-to-session distribution algorithm; must handle phrase groups with fewer than 3 tasks (BUG-001 / FR-017)
\u251c\u2500\u2500 sessionDistribution.test.ts  # NEW: unit tests
\u251c\u2500\u2500 GoalsView.tsx                # MODIFY: create multiple sessions, eviction warning
\u251c\u2500\u2500 GoalsView.test.tsx            # MODIFY: update for multi-session creation
\u251c\u2500\u2500 sessionStorage.ts            # MODIFY: free-day query helper
\u2514\u2500\u2500 SessionsPlugin.tsx           # MINOR: display estimatedDuration in session card
```

**Structure Decision**: Existing monorepo structure maintained. New modules (`durationEstimation.ts`, `sessionDistribution.ts`) added to sessions-plugin as pure-function modules following the existing `goalEngine.ts` / `taskStatusEngine.ts` pattern.

## Complexity Tracking

No constitution violations — table not needed.

**Bugfix**: 2026-06-07 — BUG-001 Updated Phase 4 task generation to document the silent-region filter step: for each (phrase × hand), skip task creation when `getRegionDifficulty()` returns `null`. Updated `sessionDistribution.ts` note to reflect variable-size phrase groups.
