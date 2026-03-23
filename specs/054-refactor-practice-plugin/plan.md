# Implementation Plan: Refactor Practice Plugin into Modular Architecture

**Branch**: `054-refactor-practice-plugin` | **Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/054-refactor-practice-plugin/spec.md`

## Summary

Decompose the 1895-line `PracticeViewPlugin.tsx` monolith into 6 focused modules (4 custom hooks, 1 React component, 1 highlight hook) plus a ~800-line orchestrator. Pure refactor — zero behavior changes, zero new features. Incremental extraction strategy: one module per commit with full test suite validation between each. Writer-owns-ref pattern for shared mutable state.

## Technical Context

**Language/Version**: TypeScript 5, React 18  
**Primary Dependencies**: React hooks (useState, useEffect, useCallback, useReducer, useRef, useMemo), ChordDetector, PluginContext API  
**Storage**: N/A (pure frontend refactor)  
**Testing**: Vitest (1636+ unit tests), Playwright E2E, `renderHook()` for new smoke tests  
**Target Platform**: Tablet devices (iPad/Surface/Android) — Chrome 57+, Safari 11+, Edge 16+  
**Project Type**: Web (monorepo — frontend/)  
**Performance Goals**: 60fps UI responsiveness, <16ms interaction feedback  
**Constraints**: Zero behavior change, zero new dependencies, all existing tests pass unmodified  
**Scale/Scope**: Single file refactor affecting 1 plugin directory (6 new files + 1 modified file)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Assessment |
|-----------|--------|------------|
| I. Domain-Driven Design | ✅ PASS | Extraction preserves ubiquitous language (practice notes, chord detection, loop region). Each hook maps to a bounded context within the practice domain. |
| II. Hexagonal Architecture | ✅ PASS | MIDI subscription (infrastructure adapter) stays isolated in `usePracticeMidi`. Practice engine reducer (core domain) remains untouched. Orchestrator threads ports. |
| III. PWA Architecture | ✅ PASS | No changes to WASM deployment, service worker, or offline capabilities. Pure React-layer refactor. |
| IV. Precision & Fidelity | ✅ PASS | No changes to timing arithmetic, PPQ constants, or tick calculations. All integer math preserved as-is. |
| V. Test-First Development | ✅ PASS | Strategy: existing 1636+ tests serve as regression gate. Each extraction verified by full suite run. New `renderHook()` smoke tests added per FR-015. |
| VI. Layout Engine Authority | ✅ PASS | No layout/coordinate/spatial logic in any extracted module. Practice hooks deal only with MIDI events, timing, and state transitions — never positions or geometry. |
| VII. Regression Prevention | ✅ PASS | Pure refactor with no bug fixes. Incremental commits detect regressions immediately. |

**Gate result**: ALL PASS — proceed to Phase 0.

### Post-Design Re-evaluation

| Principle | Post-Design Status | Notes |
|-----------|-------------------|-------|
| I. DDD | ✅ PASS | Hook names use ubiquitous language (PracticeMidi, PracticeLoop, PracticeHighlights). Interface types reference domain concepts (PracticeState, ChordDetector, LoopRegion). |
| II. Hexagonal | ✅ PASS | MIDI subscription (infrastructure) isolated in usePracticeMidi. Core domain (practiceEngine reducer) untouched. Orchestrator is the adapter wiring layer. |
| III. PWA | ✅ PASS | No impact on WASM, service worker, or offline functionality. |
| IV. Precision | ✅ PASS | No numeric changes. PPQ constant still threaded from orchestrator. Integer tick arithmetic unchanged. |
| V. Test-First | ✅ PASS | 6 new smoke tests (FR-015). 1636+ existing tests as regression gate. Incremental verification. |
| VI. Layout Engine Authority | ✅ PASS | Reviewed all 6 contracts — no coordinate, position, bounding box, or spatial logic in any hook interface. |
| VII. Regression Prevention | ✅ PASS | Not applicable (no bugs being fixed). |

**Post-design gate result**: ALL PASS — no violations found.

## Project Structure

### Documentation (this feature)

```text
specs/054-refactor-practice-plugin/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (hook interfaces)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (TypeScript interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/plugins/practice-view-plugin/
├── PracticeViewPlugin.tsx          # Orchestrator (~800 lines after refactor)
├── PracticeViewPlugin.test.tsx     # Existing tests (import paths may change)
├── PracticeViewPlugin.css          # Unchanged
├── index.tsx                       # Unchanged
├── plugin.json                     # Unchanged
├── practiceEngine.ts               # Unchanged
├── practiceEngine.types.ts         # Unchanged (+ PerformanceRecord types moved here)
├── practiceEngine.test.ts          # Unchanged
├── practiceToolbar.tsx              # Unchanged
├── practiceToolbar.test.tsx         # Unchanged
├── mergePracticeNotesByTick.ts     # Unchanged
├── usePracticeLoop.ts              # NEW — P1 extraction (~120 lines)
├── usePracticeLoop.test.ts         # NEW — smoke test
├── usePracticeMidi.ts              # NEW — P1 extraction (~250 lines)
├── usePracticeMidi.test.ts         # NEW — smoke test
├── ResultsOverlay.tsx              # NEW — P2 extraction (~500 lines)
├── ResultsOverlay.test.tsx         # NEW — smoke test
├── usePracticeHighlights.ts        # NEW — P2 extraction (~100 lines)
├── usePracticeHighlights.test.ts   # NEW — smoke test
├── usePhantomTempo.ts              # NEW — P3 extraction (~70 lines)
├── usePhantomTempo.test.ts         # NEW — smoke test
├── useHoldProgress.ts              # NEW — P3 extraction (~55 lines)
└── useHoldProgress.test.ts         # NEW — smoke test
```

**Structure Decision**: All new modules co-located in the existing `practice-view-plugin/` directory following established conventions (same pattern as `practiceEngine.ts`, `practiceToolbar.tsx`, `mergePracticeNotesByTick.ts`).

## Complexity Tracking

> No constitution violations — section not applicable.
