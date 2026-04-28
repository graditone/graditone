# Implementation Plan: One-Goal 40% Session Time Cap

**Branch**: `087-one-goal-40pct-cap` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/087-one-goal-40pct-cap/spec.md`

## Summary

When a `learn-score-phrase` goal is created and at least one other active `learn-score-phrase` goal already exists, the session generation algorithm must cap each goal's contribution to at most 40% of the session's available practice time (FR-001). A single-goal session is unaffected — that goal may fill 100% of available time (FR-002). Excess tasks spill into future sessions rather than being dropped (FR-004). The cap is applied silently with no UI indicators (FR-008).

**Technical approach**: Extend `sessionDistribution.ts` in `plugins-external/sessions-plugin/` with a new `distributeMultiGoalTasks()` function that interleaves `GoalPhraseGroup[]` (phrase groups tagged with their goalId) across sessions, enforcing a per-goal budget of `availableTime × 0.4` per session. The `GoalsView.tsx` orchestration layer detects multi-goal context, reconstructs pending phrase groups from existing scheduled sessions, cancels those sessions, and calls the new distribution function for a unified redistribution. No backend (Rust/WASM) changes are needed.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 18+
**Primary Dependencies**: Vitest (testing), @testing-library/react, IndexedDB (via plugin-api)
**Storage**: IndexedDB `goals` + `sessions` stores; localStorage index layer
**Testing**: Vitest (sessions-plugin unit tests)
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA, Chrome 57+, Safari 11+
**Project Type**: Web — changes confined to `plugins-external/sessions-plugin/` (external plugin repo)
**Performance Goals**: Multi-goal distribution < 100ms (O(n) greedy pass over phrase groups, n ≤ ~150 groups per goal)
**Constraints**: Phrase group is the atomic distribution unit (tasks within a group are never split); a single phrase group exceeding 40% budget is still included best-effort (FR-005); warmup-scales goals are excluded from the 40% cap logic entirely
**Scale/Scope**: Up to ~50 phrases per learn-score-phrase goal; up to 5 concurrent active goals expected in practice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | PASS | `GoalPhraseGroup` is a first-class domain concept; per-goal budget is `availableTime × 0.4` modelled in music-domain vocabulary |
| II. Hexagonal Architecture | PASS | `distributeMultiGoalTasks()` is a pure domain function with no infrastructure deps; `GoalsView` is the adapter that orchestrates storage |
| III. Progressive Web Application | PASS | All computation client-side; no new network calls; IndexedDB storage unchanged |
| IV. Precision & Fidelity | PASS | No PPQ/tick arithmetic touched; duration estimates come from existing `estimateTaskDuration()` formula |
| V. Test-First Development | PASS | Plan specifies failing unit tests for: 40% cap enforcement, single-goal bypass, excess deferral, best-effort oversized group, unlimited-mode passthrough, and `reconstructPhraseGroupsFromTasks` correctness |
| VI. Layout Engine Authority | PASS | No layout/rendering changes — pure data/logic feature |
| VII. Regression Prevention | PASS | Existing `distributeTasks` tests remain unchanged; single-goal path explicitly delegates to existing function |
| VIII. User Profile Awareness | PASS | New multi-goal sessions use `getActiveProfileId()` (same path as existing creation); no new localStorage keys |

**GATE RESULT: PASS** — No violations. Proceeding to Phase 0.

**Post-Design Re-check**: PASS — Data model additions (`goalIds?: string[]`) are backwards-compatible optional fields; no profile scoping gaps introduced.

## Project Structure

### Documentation (this feature)

```text
specs/087-one-goal-40pct-cap/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

No `contracts/` subdirectory — this feature adds no new WASM exports or plugin-API surface changes.

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── sessionDistribution.ts      # MODIFY: add GoalPhraseGroup + distributeMultiGoalTasks()
├── sessionDistribution.test.ts # MODIFY: add 40%-cap test suite (6+ new test cases)
├── sessionTypes.ts             # MODIFY: add goalIds?: string[] to Session + SessionIndexEntry
├── goalEngine.ts               # MODIFY: add reconstructPhraseGroupsFromTasks()
├── goalEngine.test.ts          # MODIFY: add tests for reconstructPhraseGroupsFromTasks
└── GoalsView.tsx               # MODIFY: multi-goal detection + cancel/redistribute orchestration
```

No changes to `backend/`, `frontend/`, or any other plugin.

**Structure Decision**: All changes are confined to the `sessions-plugin` external repo. Pure-function distribution logic stays in `sessionDistribution.ts`; storage orchestration stays in `GoalsView.tsx`; the domain helper `reconstructPhraseGroupsFromTasks` goes in `goalEngine.ts` to keep storage-free domain functions co-located.

## Complexity Tracking

No constitution violations — table not needed.
