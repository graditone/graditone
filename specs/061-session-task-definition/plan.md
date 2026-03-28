# Implementation Plan: Tasks-Based Session Definition

**Branch**: `061-session-task-definition` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/061-session-task-definition/spec.md`

## Summary

Extend the existing Sessions Plugin (Feature 060) to support task-based session creation. When creating a session, users define an ordered list of practice tasks — each specifying a score, measure region, hand, iterations, tempo, and minimum result. Tasks drive practice execution: each task's "Practice" link opens the practice view pre-configured with its settings. When a practice is saved, it links back to both the session activity and the originating task. Task status transitions automatically (todo → in-progress → done/failed) based on practice results. New sessions inherit the previous session's task structure. The task list is immutable after creation. This is a frontend-only feature extending the sessions plugin with new types, UI, and storage.

## Technical Context

**Language/Version**: TypeScript (strict), React 18+, CSS  
**Primary Dependencies**: React (hooks, useState, useCallback, useEffect), Vite bundler, existing plugin API v8 (`PluginContext`, `openPlugin`, `getNavigationData`, `broadcastPracticeSaved`, `onPracticeSaved`)  
**Storage**: IndexedDB (`sessions` store — full Session objects) + localStorage (`graditone-sessions-index` — lightweight index). Same dual-layer pattern used by Feature 060.  
**Testing**: Vitest (unit tests), existing vitest.setup.ts in sessions plugin  
**Target Platform**: Tablet PWA (iPad, Surface, Android tablets), Chrome 57+, Safari 11+, Edge 16+  
**Project Type**: Web — external plugin (`plugins-external/sessions-plugin/`)  
**Performance Goals**: Task status transitions < 1s after practice save; session creation UI responsive at 60fps; IndexedDB reads < 100ms  
**Constraints**: Offline-first (all data in IndexedDB/localStorage); no backend changes; backward compatible with existing task-less sessions  
**Scale/Scope**: Up to 10 tasks per session, up to 50 sessions total (existing cap), ≤3 iteration rounds per task typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Assessment |
|-----------|--------|------------|
| I. Domain-Driven Design | ✅ PASS | New entities (`SessionTask`, extended `Session`, extended `SessionActivity`) follow ubiquitous language. Task status model uses domain terms (todo, in-progress, done, failed). |
| II. Hexagonal Architecture | ✅ PASS | Feature is frontend-only — extends an adapter layer (sessions plugin). No backend domain changes. Storage access via existing adapter functions. |
| III. Progressive Web Application | ✅ PASS | All data in IndexedDB/localStorage — fully offline. No new network calls. PWA/tablet constraints unchanged. |
| IV. Precision & Fidelity | ✅ PASS | Measure-to-tick conversion uses existing `measure_end_ticks` from the Rust/WASM engine. No new timing calculations; task stores user-facing measure numbers and maps to ticks at practice time. |
| V. Test-First Development | ✅ REQUIRED | Task status engine, task validation, inheritance logic must have unit tests before implementation. Contract tests for extended `PracticeSavedEvent` navigation data. |
| VI. Layout Engine Authority | ✅ N/A | No layout/rendering changes. Task form is standard React UI, no spatial calculations. |
| VII. Regression Prevention | ✅ PASS | Backward compatibility with task-less sessions tested. Existing session tests remain valid. |

**Gate result: PASS** — no violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/061-session-task-definition/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── plugin-api-v8-task-extensions.ts
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── sessionTypes.ts          # Extended: SessionTask, updated Session & SessionActivity
├── sessionStorage.ts        # Extended: task persistence, inheritance loading
├── useSessionManager.ts     # Extended: createSessionWithTasks, task status updates
├── SessionsPlugin.tsx       # Extended: task builder UI, task list display, progress
├── SessionsPlugin.css       # Extended: task builder / task list styles
├── TaskBuilder.tsx           # NEW: task creation form component
├── TaskRow.tsx               # NEW: single task display with status + practice link
├── TaskStatusEngine.ts       # NEW: pure function for status transitions
├── sessions-plugin.test.tsx  # Extended: task-related tests
└── taskStatusEngine.test.ts  # NEW: unit tests for status engine

frontend/plugins/practice-view-plugin/
└── PracticeViewPlugin.tsx   # Extended: read task config from navigation data
```

**Structure Decision**: All new code lives in the existing `plugins-external/sessions-plugin/` directory, following the established plugin pattern. The practice view plugin receives minor extensions to accept task configuration via navigation data. No new directories created. No backend changes.

## Complexity Tracking

> No constitution violations — table not needed.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Assessment |
|-----------|--------|------------------------|
| I. DDD | ✅ PASS | `SessionTask`, `TaskStatus`, `TaskLinkedPractice` use ubiquitous music practice language. Status transitions model real domain concepts. |
| II. Hexagonal | ✅ PASS | Plugin API boundary preserved: `PracticeSavedEvent` extension is backward-compatible optional field. Storage stays in existing adapter layer. |
| III. PWA | ✅ PASS | All data in IndexedDB/localStorage — fully offline. No new network calls. Score picker reuses host component. |
| IV. Precision & Fidelity | ✅ PASS | Tasks store 1-based measure numbers. Tick conversion at practice launch uses `measure_end_ticks` from Rust/WASM — no frontend layout calculations. Integer arithmetic preserved. |
| V. Test-First | ✅ REQUIRED | `TaskStatusEngine.ts` is a pure function with dedicated test file. Status transitions, validation, inheritance, backward compat all have test scenarios defined. |
| VI. Layout Engine Authority | ✅ N/A | No layout calculations. Task builder is standard React form. Measure-to-tick reads from backend data, no spatial computation. |
| VII. Regression Prevention | ✅ PASS | Backward compatibility tested explicitly. Legacy session normalization (`tasks: undefined → []`) prevents data regression. Protected practice IDs extended for task-linked practices. |

**Post-design gate: PASS** — no violations introduced by the design.
