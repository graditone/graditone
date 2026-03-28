# Implementation Plan: Sessions Plugin

**Branch**: `060-sessions-plugin` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/060-sessions-plugin/spec.md`

## Summary

Create a new Graditone plugin (`sessions-plugin`) that lets users group saved practices into named sessions. Adds a Plugin API event for practice-save notifications (v8), session/activity persistence via IndexedDB + localStorage index (mirroring the saved-practices pattern), a collapsible session list UI, and deletion protection for session-linked practices. Frontend-only; no backend changes.

## Technical Context

**Language/Version**: TypeScript (strict), React 18+
**Primary Dependencies**: Plugin API v8 (new — extends v7 with practice-saved event), existing savedPractice services, IndexedDB, localStorage
**Storage**: IndexedDB (`sessions` object store in `graditone-db` v3) + localStorage index (`graditone-sessions-index`)
**Testing**: Vitest (unit), Playwright (e2e), TDD per Constitution Principle V
**Target Platform**: Tablet devices (iPad/Surface/Android), PWA, offline-capable
**Project Type**: Web — frontend plugin (monorepo `frontend/plugins/sessions-plugin/`)
**Performance Goals**: Session list renders <1s with 50+ sessions (SC-005), 60fps interactions
**Constraints**: Max 50 sessions, oldest-closed evicted first, active session never evicted. Max 100 saved practices (existing). Session-linked practices undeletable.
**Scale/Scope**: Single plugin + Plugin API v8 extension + deletion-guard in ScoreSelector

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | **PASS** | Session and Activity are first-class domain entities with clear attributes and relationships. Ubiquitous language maintained. |
| II. Hexagonal Architecture | **PASS** | Backend not modified. Frontend plugin follows ports-and-adapters: storage services are adapters, Plugin API is the port boundary. |
| III. PWA Architecture | **PASS** | Frontend-only, offline-first (IndexedDB + localStorage), no network dependency. |
| IV. Precision & Fidelity | **N/A** | No timing/PPQ calculations in this feature. |
| V. Test-First Development | **PASS** | Plan includes unit tests (storage, state logic), component tests (UI), and e2e tests. TDD workflow enforced. |
| VI. Layout Engine Authority | **N/A** | No layout/spatial calculations in this feature. |
| VII. Regression Prevention | **PASS** | Any bugs found during implementation will produce regression tests before fixes. |

**Gate result: PASS** — No violations. Proceed to Phase 0.

### Post-Design Re-evaluation (after Phase 1)

All principles re-checked after data model, contracts, and quickstart design:

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Domain-Driven Design | **PASS** | Session/Activity are first-class domain entities. Ubiquitous language consistent. |
| II. Hexagonal Architecture | **PASS** | Storage as adapters, Plugin API as port boundary. Domain types independent of storage. |
| III. PWA Architecture | **PASS** | Offline-first: IndexedDB + localStorage. No network dependency. |
| IV. Precision & Fidelity | **N/A** | No timing/PPQ calculations in this feature. |
| V. Test-First Development | **PASS** | TDD implementation order defined in quickstart. Storage → components → e2e. |
| VI. Layout Engine Authority | **N/A** | No layout/spatial calculations. Standard React list UI. |
| VII. Regression Prevention | **PASS** | Spec has Known Issues section; any bugs will produce tests before fixes. |

**Post-design gate: PASS** — No violations introduced by design decisions.

## Project Structure

### Documentation (this feature)

```text
specs/060-sessions-plugin/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── plugin-api-v8.ts # Plugin API v8 contract (practice-saved event + sessions namespace)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── plugins/
│   └── sessions-plugin/           # NEW — the sessions plugin
│       ├── plugin.json            # Plugin manifest
│       ├── index.tsx              # GraditonePlugin entry point (init, dispose, Component)
│       ├── SessionsPlugin.tsx     # Main orchestrator component
│       ├── SessionsPlugin.css     # Styles
│       ├── SessionsPlugin.test.tsx # Component tests
│       ├── sessionStorage.ts      # IndexedDB + localStorage persistence
│       ├── sessionStorage.test.ts # Storage unit tests
│       ├── sessionTypes.ts        # Session, Activity, SessionIndexEntry types
│       └── useSessionManager.ts   # React hook: state management, CRUD, event handling
├── src/
│   ├── plugin-api/
│   │   ├── types.ts               # MODIFIED — add PracticeSavedEvent, onPracticeSaved, sessions namespace (v8)
│   │   └── index.ts               # MODIFIED — re-export new types
│   ├── services/
│   │   └── savedPracticeStorage.ts # MODIFIED — bump DB version to 3, add sessions object store
│   └── components/                # MODIFIED — ScoreSelector deletion guard for session-linked practices
└── tests/
    └── (existing test structure)
```

**Structure Decision**: Follows established plugin directory convention (`frontend/plugins/<plugin-id>/`). Plugin API types extended in existing `types.ts` (v7 → v8). IndexedDB schema upgraded in existing `savedPracticeStorage.ts` (v2 → v3) to add `sessions` store. ScoreSelector modified for deletion guard.

## Complexity Tracking

> No constitution violations — section not needed.
