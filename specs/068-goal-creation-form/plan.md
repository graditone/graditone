# Implementation Plan: Goal Creation Form

**Branch**: `068-goal-creation-form` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/068-goal-creation-form/spec.md`

## Summary

Add a goal creation form to the sessions-plugin Goals tab. When the user taps "+ Create Goal," a form appears (replacing the previous direct score-picker flow) with read-only goal type / score breakdown labels, a score selector button, and three sliders (iterations 1–20, min result 0–100%, tempo 50–200%). On submission the existing `createGoal` engine generates tasks using the user-supplied parameters. The plugin is a standalone external React 19 plugin (TypeScript 5.5, Vitest 2) served inside the Graditone PWA frontend.

**Implementation state**: Core logic and tests are **fully implemented and passing** (266/266). Two gaps remain:
1. **CSS**: `goal-creation-form__*` styles not yet added to `SessionsPlugin.css`
2. **FR-014**: Duplicate goal warning must fire *inside* the form (prop-driven), not after form closes

## Technical Context

**Language/Version**: TypeScript 5.5, React 19  
**Primary Dependencies**: Vitest 2, `@testing-library/react` 16, Vite 6 (build), `idb` (IndexedDB via goalStorage.ts)  
**Storage**: IndexedDB (`graditone-goals-index`, `goals` store via goalStorage.ts); localStorage index in GoalsView  
**Testing**: Vitest 2 + `@testing-library/react` (unit/component tests); no E2E tests required for this feature  
**Target Platform**: Tablet PWA (iPad/Surface/Android) — plugin rendered in iframe inside Graditone frontend  
**Project Type**: External plugin (flat `plugins-external/sessions-plugin/` directory, no subdirectory structure)  
**Performance Goals**: Goal creation completes in < 30 seconds user interaction; form renders synchronously  
**Constraints**: No new npm packages; use existing slider pattern from TaskBuilder; offline-capable (IndexedDB only)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `Goal`, `SessionTask`, `ScoreRef` are first-class domain entities. `createGoal` uses ubiquitous language from spec (loopCount, minResult, tempoMultiplier). |
| II. Hexagonal Architecture | ✅ PASS | Feature is frontend-only (sessions plugin). No backend changes. Plugin boundary respected. |
| III. PWA Architecture | ✅ PASS | Plugin runs in-browser, uses IndexedDB for offline persistence, no network calls at goal creation time. |
| IV. Precision & Fidelity | ✅ PASS | No timing calculations involved; this is a UI form feature. |
| V. Test-First Development | ✅ PASS | All acceptance scenarios have corresponding tests (T005, T006, T010, T013, T014). 266/266 pass. CSS gap requires visual verification, not new tests. |
| VI. Layout Engine Authority | ✅ PASS | No layout engine involvement. Feature is form UI only. |
| VII. Regression Prevention | ✅ PASS | No bugs discovered. Gaps (CSS, FR-014 prop) are pre-implementation gaps, not regressions. |

**Pre-design gate**: ALL PASS — proceed to Phase 0.

**Post-design gate** (re-check after Phase 1): CSS additions and FR-014 prop change are additive-only. No principle violations anticipated.

## Project Structure

### Documentation (this feature)

```text
specs/068-goal-creation-form/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/    ← External sessions plugin (flat structure)
├── GoalCreationForm.tsx             ← ✅ Form component (COMPLETE)
├── GoalCreationForm.test.tsx        ← ✅ Component tests T005/T010/T013/T014 (COMPLETE)
├── GoalsView.tsx                    ← ✅ Goals tab + form integration (COMPLETE)
├── GoalsView.test.tsx               ← ✅ T006 form-first flow tests (COMPLETE)
├── goalEngine.ts                    ← ✅ createGoal() accepts loopCount/minResult/tempoMultiplier (COMPLETE)
├── goalEngine.test.ts               ← ✅ Engine tests (COMPLETE)
├── goalTypes.ts                     ← ✅ GoalCreationFormParams type added (COMPLETE)
├── sessionTypes.ts                  ← ✅ SessionTask with loopCount/minResult/tempoMultiplier (COMPLETE)
├── goalStorage.ts                   ← ✅ hasGoalForScoreAsync() available (COMPLETE)
└── SessionsPlugin.css               ← ⚠️ goal-creation-form__* styles MISSING (GAP 1)
```

**Structure Decision**: Single external plugin — flat directory under `plugins-external/sessions-plugin/`. No subdirectory structure per existing convention.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. No entries required.
