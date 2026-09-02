# Implementation Plan: Fix Chord Hold Validation at the Measure Boundary

**Branch**: `098-fix-chord-hold-validation` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/098-fix-chord-hold-validation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Whole-measure chords changed at the next downbeat are sometimes rejected as
"released too early". Root cause (see [research.md](research.md)): the practice
engine's hold-acceptance decision is not based on measured elapsed hold time versus
the required hold. The MIDI release handler dispatches `EARLY_RELEASE`
unconditionally while in `holding` mode, and the reducer's `EARLY_RELEASE` case
never checks `holdDurationMs` against `requiredHoldMs` — so when the release event
is processed before the rAF-driven `HOLD_COMPLETE` (which coincides at the measure
boundary), a correct full-measure hold is recorded as `early-release`. A secondary
path flags wrong the next-chord press that arrives while the previous chord is
still held.

Fix: introduce one pure hold-acceptance rule — `isHoldAccepted(required, elapsed)`
(≥75%; a release margin of up to 25% capped at 1500 ms — feature 098 follow-up) —
and apply it at every decision point (release handler, press-during-hold, reducer
guard, rAF loop) so the outcome depends only on how long the chord was held, never
on which event is processed first. Genuine early releases (below the margin) remain
detected and penalised.

**Status**: Implemented (2026-09-02). All tasks complete — see [tasks.md](tasks.md).

## Technical Context

**Language/Version**: TypeScript (strict), React 18+, Vite/Vitest — same stack as the Practice View plugin  
**Primary Dependencies**: React hooks (`usePracticeMidi`, `useHoldProgress`), pure reducer (`practiceEngine.ts`); no new runtime dependencies  
**Storage**: N/A — in-memory practice engine state; no persistence changes  
**Testing**: Vitest (`frontend/plugins/practice-view-plugin/*.test.ts`), test-first per Constitution V; `npm run typecheck` (tsc -b) + `npm run lint` (eslint)  
**Target Platform**: Tablet PWA (this is frontend-only; no WASM changes)  
**Project Type**: Web (frontend plugin module in a monorepo)  
**Performance Goals**: No measurable-performance impact — the change adds O(1) comparisons in event handlers; the existing rAF hold loop and 60 fps target are undisturbed  
**Constraints**: Do not change Feature 042 tolerances; preserve short-note/no-hold behaviour; must not regress normal-tempo holds; holds judged on measured duration regardless of event ordering  
**Scale/Scope**: Single plugin module + pure helper; ~5 files edited, ~5 test files (incl. new helper tests)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| I. Domain-Driven Design | ✅ Pass | The accept/reject rule lives in the pure domain layer (`practiceEngine` reducer + pure helpers); events carry facts, the domain decides. |
| II. Hexagonal Architecture | ✅ Pass | No new infrastructure coupling; helpers are pure TS with zero external deps; hooks remain adapters over MIDI. |
| III. PWA Architecture | ✅ Pass | Frontend-only change; no storage/network/WASM impact; offline-capable unchanged. |
| IV. Precision & Fidelity | ✅ Pass | All arithmetic integer ms; no float timing introduced; PPQ=960 untouched. |
| V. Test-First Development (NON-NEGOTIABLE) | ✅ Pass | Red-regression tests first for every changed decision point; existing suites stay green. |
| VI. Layout Engine Authority | ✅ Pass | No spatial/geometry logic touched. |
| VII. Regression Prevention | ✅ Pass | Bug documented in spec Known Issues; failing regression tests added before the fix; remain permanently. |
| VIII. User Profile Awareness | ✅ Pass | No user state stored or displayed by this feature. |

**Gate: PASS — no violations requiring Complexity Tracking.**

> **Note (worktree workflow)**: The constitution's Git Worktree Workflow mandates
> spec work inside `../worktrees/<branch>`. This repo's activated tooling resolves
> the feature via `.specify/feature.json` / `SPECIFY_FEATURE` (directory-based) and
> the worktree extension is not active in the current tree, so this feature is
> developed in place on the working tree `main`, with all artifacts under
> `specs/098-fix-chord-hold-validation/`. Implementation commits must still go
> through a feature branch + PR per the Branching Strategy.

## Project Structure

### Documentation (this feature)

```text
specs/098-fix-chord-hold-validation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── practice-engine.md
│   └── hold-validation.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/plugins/practice-view-plugin/
├── holdDuration.ts               # NEW pure helpers (HOLD_FLOOR_MS, computeRequiredHoldMs,
│                                 #   computeHoldAcceptanceMs, isHoldAccepted)
├── holdDuration.test.ts          # NEW unit tests
├── practiceEngine.ts             # reducer EARLY_RELEASE guard (isHoldAccepted)
├── practiceEngine.test.ts        # + boundary/guard regression tests
├── usePracticeMidi.ts            # release + press-during-hold use isHoldAccepted;
│                                 #   re-export HOLD_FLOOR_MS/computeRequiredHoldMs
├── usePracticeMidi.test.ts       # + measure-boundary regression tests
├── useHoldProgress.ts            # use shared helpers (behaviour unchanged)
└── useHoldProgress.test.ts       # unchanged (expectations still valid)

frontend/tests/unit/
└── (no changes)
```

**Structure Decision**: The practice-view plugin module is self-contained in
`frontend/plugins/practice-view-plugin/`. The new pure helper module lives next to
its consumers (mirroring the existing placement of `practiceEngine.ts`). The
`ChordDetector` in `frontend/src/utils/` and `extractPracticeNotes` in
`frontend/src/plugin-api/` are **not** modified.

## Complexity Tracking

> Not required — Constitution Check passed with zero violations.