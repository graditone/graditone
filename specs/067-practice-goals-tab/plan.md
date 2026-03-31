# Implementation Plan: Practice Goals View Tab

**Branch**: `067-practice-goals-tab` | **Date**: 2026-03-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/067-practice-goals-tab/spec.md`

## Summary

Add a "Goals" tab to the Sessions plugin that lets users create practice goals from scores. A goal auto-generates 3 tasks (LH, RH, TH — or 1 TH for single-staff scores) for the first detected musical phrase and schedules a session for tomorrow. Goals are persisted in a new IndexedDB object store. The plugin API is extended with a `getPhrases()` method so the plugin can access detected phrase regions.

## Technical Context

**Language/Version**: TypeScript (React 18+), Rust (stable) for backend WASM  
**Primary Dependencies**: React, existing SessionsPlugin, PluginContext API (v8), wasm-bindgen for phrase detection  
**Storage**: IndexedDB (`graditone-db`, currently version 3 → version 4 for `goals` store) + localStorage index  
**Testing**: Vitest for unit tests, Playwright for e2e  
**Target Platform**: Tablet devices (iPad/Surface/Android), PWA  
**Project Type**: Web (monorepo: `backend/` + `frontend/` + `plugins-external/sessions-plugin/`)  
**Performance Goals**: Goal creation < 2 seconds, 60 fps tab navigation, offline-capable  
**Constraints**: Plugin-only changes where possible; minimize plugin API surface additions; no Rust/WASM changes needed (phrases already computed during parsing)  
**Scale/Scope**: ~8 new/modified files in sessions-plugin, 1 new plugin API method, 1 IndexedDB schema upgrade

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Goal is a new domain entity with clear ubiquitous language (Goal, PhraseRegion, SessionTask). Uses existing music domain terms. |
| II. Hexagonal Architecture | ✅ PASS | Phrase detection runs in Rust core (backend). Frontend reads results via plugin API port. Goal storage is an adapter (IndexedDB). No domain logic in infrastructure. |
| III. PWA Architecture | ✅ PASS | All processing client-side via WASM. Goals persisted in IndexedDB for offline access. No network dependency. |
| IV. Precision & Fidelity | ✅ PASS | Phrase boundaries use integer tick positions from backend (960 PPQ). No floating-point timing in task definitions. |
| V. Test-First Development | ✅ PASS | Plan includes unit tests for goal creation logic, task generation, and storage. Contract tests for new plugin API method. |
| VI. Layout Engine Authority | ✅ PASS | Feature does not touch layout or rendering geometry. All spatial decisions remain in Rust/WASM. |
| VII. Regression Prevention | ✅ PASS | Any bugs found during implementation will produce regression tests per constitution. |

**Gate result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/067-practice-goals-tab/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── SessionsPlugin.tsx      # MODIFY: Add 'goals' tab to TabId union, render GoalsView
├── GoalsView.tsx           # NEW: Goals tab UI — list, expand, create, delete
├── goalTypes.ts            # NEW: Goal interface definition
├── goalStorage.ts          # NEW: IndexedDB CRUD for goals (+ localStorage index)
├── goalEngine.ts           # NEW: Goal creation logic (phrase lookup, task generation, session scheduling)
├── goalEngine.test.ts      # NEW: Unit tests for goal creation, task generation, edge cases
├── GoalsView.test.tsx      # NEW: Component tests for goals UI
├── sessionTypes.ts         # MODIFY: Add optional goalId to SessionTask
├── SessionsPlugin.css      # MODIFY: Add goals tab styles
└── useSessionManager.ts    # READ-ONLY: Reuse scheduleSession()

frontend/src/
├── plugin-api/types.ts     # MODIFY: Add getPhrases() to PluginScorePlayerContext
├── plugin-api/scorePlayerContext.ts  # MODIFY: Implement getPhrases()
├── services/storage/local-storage.ts # MODIFY: Bump DB_VERSION 3 → 4, add 'goals' store
└── plugin-api/scorePlayerContext.test.ts # MODIFY: Add getPhrases() contract test
```

**Structure Decision**: Web application (Option 2). Feature primarily lives in `plugins-external/sessions-plugin/` with minimal changes to `frontend/src/plugin-api/` for the new `getPhrases()` method and IndexedDB schema upgrade.

## Complexity Tracking

No constitution violations; section not applicable.
