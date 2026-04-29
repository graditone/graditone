# Implementation Plan: Sessions Rescheduling

**Branch**: `087-sessions-rescheduling` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/087-sessions-rescheduling/spec.md`

## Summary

Add rescheduling capabilities to the sessions plugin. Two stories: (1) when the Sessions view opens and one or more scheduled sessions have a `targetDate` in the past, show a one-time dialog (suppressed for the app session after dismiss) summarising how many sessions will be moved, then on accept bulk-reschedule goal-linked and isolated sessions via `findFreeDays()` logic; (2) when a session is in edit mode, clicking the `targetDate` label opens the existing `DatePicker` component (min=today) to let the user manually pick a new date, transitioning the session to `'scheduled'` status.

## Technical Context

**Language/Version**: TypeScript 5.5+, React 19  
**Primary Dependencies**: React 19, Vitest 2, @testing-library/react 16, jsdom 24, Vite (build)  
**Storage**: IndexedDB (full `Session` objects via `saveSessionToIndexedDB`) + localStorage (lightweight `SessionIndexEntry[]` via `scopedSetItem`) — both already profile-scoped  
**Testing**: Vitest + @testing-library/react + jsdom (matching existing plugin test setup)  
**Target Platform**: Tablet PWA — Chrome/Safari/Edge on iPad, Surface, Android tablets  
**Project Type**: External plugin (`plugins-external/sessions-plugin/`) — TypeScript/React, compiled via esbuild + ZIP, symlinked into `frontend/plugins/` for local dev  
**Performance Goals**: Auto-reschedule dialog must appear within 1 second of Sessions view open (SC-001); IndexedDB reads are async but the index is already in localStorage so detection is synchronous  
**Constraints**: Offline-first (no network calls whatsoever); profile-aware (Principle VIII — all session writes go through existing profile-scoped helpers); date picker `min` = today

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Reschedule logic extracted as pure functions (`rescheduleEngine.ts`); no business logic in JSX |
| II. Hexagonal Architecture | N/A | Backend-only principle; plugin is frontend only |
| III. PWA / Offline-First | ✅ PASS | All operations use existing IndexedDB + localStorage helpers — no network calls |
| IV. Precision & Fidelity | N/A | No music timing involved |
| V. Test-First Development | ✅ REQUIRED | New pure functions in `rescheduleEngine.ts` get unit tests before implementation; UI interaction tested with @testing-library/react |
| VI. Layout Engine Authority | N/A | No spatial/rendering changes |
| VII. Regression Prevention | ✅ REQUIRED | Edge cases (all goal sessions past, no free days, mixed session types) must be covered by tests |
| VIII. User Profile Awareness | ✅ PASS | All persistence goes through `updateSessionIndex` / `saveSessionToIndexedDB` which already profile-scope via `getActiveProfileId()`; `goalStorage` lookups are also profile-scoped |

**Gate result**: PASS — no violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/087-sessions-rescheduling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── rescheduleEngine.ts          # NEW: pure reschedule logic (detect overdue, redistribute)
├── rescheduleEngine.test.ts     # NEW: unit tests for reschedule engine
├── SessionsPlugin.tsx           # MODIFIED: auto-reschedule dialog + date picker in edit mode
├── SessionsPlugin.test.tsx      # MODIFIED: add dialog and date picker tests
├── sessionDistribution.ts       # MODIFIED: export findFreeDaysFrom() (start-date variant)
├── sessionDistribution.test.ts  # MODIFIED: add tests for findFreeDaysFrom()
├── sessionStorage.ts            # MODIFIED: export updateSessionTargetDate() helper
└── i18n.tsx / locales/          # MODIFIED: add i18n keys for reschedule dialog strings
```

**Structure Decision**: Single plugin directory (`plugins-external/sessions-plugin/`). All changes are self-contained in the external plugin with no backend changes. New business logic goes into a dedicated `rescheduleEngine.ts` to keep `SessionsPlugin.tsx` as a thin orchestrator.

## Complexity Tracking

No complexity violations — feature is contained within a single plugin with no new abstractions beyond what the existing codebase already uses.
