# Implementation Plan: Session Scheduling

**Branch**: `066-session-scheduling` | **Date**: 2026-03-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/066-session-scheduling/spec.md`

## Summary

Extend the sessions plugin to support a "scheduled" session status with a target date, allowing users to plan future practice sessions. The existing session creation flow gains a date picker (defaulting to today) where selecting today preserves existing behavior (immediate active session) and selecting a future date creates a scheduled session. Scheduled sessions can hold pre-defined tasks and be activated later. State machine: scheduled → active → closed (closed is terminal). Target date is preserved across all transitions for history/analytics.

## Technical Context

**Language/Version**: TypeScript (frontend), React 18+ components
**Primary Dependencies**: React, IndexedDB (via sessionStorage.ts), localStorage
**Storage**: IndexedDB (`sessions` store) for full Session objects; localStorage (`graditone-sessions-index`) for SessionIndexEntry[] fast index
**Testing**: Vitest (unit tests), Playwright (e2e tests)
**Target Platform**: Tablet devices (iPad/Surface/Android) — PWA
**Project Type**: Web (frontend plugin — `plugins-external/sessions-plugin/`)
**Performance Goals**: Session creation <200ms, list render at 60fps, offline-capable
**Constraints**: Max 50 sessions total (eviction: oldest closed first), at most one active session, offline-first (all data in IndexedDB + localStorage)
**Scale/Scope**: Single plugin extending existing session management; no backend changes required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Status | Notes |
|-----------|----------|--------|-------|
| I. Domain-Driven Design | Yes | PASS | Session, SessionTask, SessionActivity are established domain entities. New "scheduled" status and targetDate extend the Session aggregate using ubiquitous language. No new bounded contexts introduced. |
| II. Hexagonal Architecture | Minimal | PASS | Feature is entirely frontend (plugin layer). Storage adapters (IndexedDB, localStorage) already follow ports & adapters pattern via sessionStorage.ts. No backend changes. |
| III. PWA Architecture | Yes | PASS | All data persisted in IndexedDB + localStorage (offline-first). No network dependency. Date picker is standard HTML input, tablet-friendly. |
| IV. Precision & Fidelity | No | N/A | No music timing or PPQ calculations involved. |
| V. Test-First Development | Yes | PASS | Unit tests for state transitions, date validation, and sorting. E2e tests for session creation with date picker and activation flows. |
| VI. Layout Engine Authority | No | N/A | No spatial geometry or layout calculations. Pure data model + UI plugin. |
| VII. Regression Prevention | Yes | PASS | Edge cases (past-date rejection, closed-session finality, single-active constraint) will have dedicated tests. Any bugs found during implementation will get regression tests per constitution. |

**Gate result: PASS** — No violations. Proceed to Phase 0.

### Post-Design Re-evaluation (after Phase 1)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. DDD | PASS | `targetDate` and `'scheduled'` status use domain language. State machine (scheduled → active → closed) models the real-world practice planning lifecycle. No anemic model — transitions are guarded by business rules. |
| II. Hexagonal | PASS | New functions (`scheduleSession`, `activateScheduledSession`) live in the session manager hook (application layer). Storage adapters unchanged. No new infrastructure dependencies. |
| III. PWA | PASS | HTML `<input type="date">` is native, offline-compatible, no network calls. `targetDate` persisted in IndexedDB + localStorage. |
| V. Test-First | PASS | Contract file defines testable function signatures. Data model specifies validation rules that map directly to test cases. |
| VII. Regression | PASS | Edge cases documented in spec and data-model (past-date, closed-terminal, single-active) each have explicit test requirements. |

**Post-design gate result: PASS** — No new violations introduced by design artifacts.

## Project Structure

### Documentation (this feature)

```text
specs/066-session-scheduling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (TypeScript interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── sessionTypes.ts          # Session, SessionTask, SessionIndexEntry types (MODIFY: add 'scheduled' status, targetDate field)
├── sessionStorage.ts        # IndexedDB + localStorage persistence (MODIFY: persist targetDate, sort by targetDate)
├── useSessionManager.ts     # Session lifecycle hooks (MODIFY: add scheduleSession, activateScheduledSession)
├── SessionsPlugin.tsx       # Main plugin UI (MODIFY: add date picker to creation flow, sort logic)
├── TaskBuilder.tsx           # Task creation UI (REUSE: for scheduled sessions with tasks)
├── TaskStatusEngine.ts       # Task status state machine (NO CHANGE)
└── [new/modified test files]

frontend/
├── src/                      # No changes expected (plugin is external)
└── tests/                    # E2e tests for scheduling flows
```

**Structure Decision**: This feature modifies the existing `plugins-external/sessions-plugin/` directory. No new directories needed. All changes are within the established plugin boundary.

## Complexity Tracking

No constitution violations requiring justification. Table omitted.
