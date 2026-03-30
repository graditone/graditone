# Implementation Plan: Sessions Calendar View

**Branch**: `065-sessions-calendar-view` | **Date**: 2026-03-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/065-sessions-calendar-view/spec.md`

## Summary

Add a Calendar tab to the Sessions plugin that visualizes practice history. The calendar aggregates existing `SessionActivity` records by day (using the existing `createdAt` timestamp) and displays them in week/month/year views with period summaries. Clicking a day opens a detail overlay with activity-level data. Built entirely in the frontend React/TypeScript layer with no backend or data model changes — reads from existing IndexedDB/localStorage session storage.

## Technical Context

**Language/Version**: TypeScript ~5.9.3, React 19.2.0
**Primary Dependencies**: React 19, Vite 7.2.4, existing sessions plugin (`plugins-external/sessions-plugin/`)
**Storage**: IndexedDB (`sessions` store via `loadAllSessionsFromIndexedDB()`) + localStorage (`graditone-sessions-index`)
**Testing**: Vitest 4.0.18 (unit), Playwright 1.58.2 (e2e), @testing-library/react 16.3.2
**Target Platform**: Tablet devices (iPad/Surface/Android tablets) — PWA, Chrome 57+, Safari 11+, Edge 16+
**Project Type**: Web (monorepo: `frontend/` + `plugins-external/sessions-plugin/`)
**Performance Goals**: Calendar tab loads and aggregates all sessions (<50) in <200ms; 60fps UI interactions
**Constraints**: Max 50 sessions in storage; offline-first; touch targets ≥44×44px; read-only view (no writes)
**Scale/Scope**: Up to 50 sessions × ~20 activities each = ~1000 activities max to aggregate

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Uses existing domain entities (Session, SessionActivity). New DaySummary and CalendarView are presentation-layer aggregates, not domain entities. |
| II. Hexagonal Architecture | ✅ PASS | Calendar is a frontend presentation feature. Reads from storage adapters via existing `sessionStorage.ts` functions. No backend or domain changes needed. |
| III. Progressive Web Application | ✅ PASS | Runs entirely client-side from cached data. Offline-capable. Tablet-optimized touch targets. |
| IV. Precision & Fidelity | ✅ N/A | Calendar does not perform music timing calculations. `practiceTimeMs` is wall-clock duration (integers). |
| V. Test-First Development | ✅ PASS | Will follow TDD: unit tests for aggregation logic, component tests for views, e2e for navigation flows. |
| VI. Layout Engine Authority | ✅ N/A | Calendar is UI chrome, not score layout. No spatial geometry or notation rendering involved. |
| VII. Regression Prevention | ✅ PASS | Any bugs found during implementation will get regression tests before fixes. |

**Gate result: PASS — No violations. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/065-sessions-calendar-view/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── index.tsx                     # Plugin registration (add Calendar tab support)
├── sessionTypes.ts               # No changes needed (createdAt already exists)
├── sessionStorage.ts             # No changes needed (loadAllSessionsFromIndexedDB already exists)
├── SessionsPlugin.tsx            # Add Sessions/Calendar tab toggle
├── SessionsPlugin.css            # Styles for tab toggle + calendar
├── CalendarView.tsx              # NEW — Main calendar component (week/month/year switcher + navigation)
├── CalendarMonthView.tsx         # NEW — Month grid component
├── CalendarWeekView.tsx          # NEW — Week columns component
├── CalendarYearView.tsx          # NEW — Year grid component
├── CalendarDayOverlay.tsx        # NEW — Day detail overlay with activity list
├── CalendarPeriodSummary.tsx     # NEW — Period summary line component
├── calendarUtils.ts              # NEW — Date math, aggregation logic, formatting helpers
├── calendarUtils.test.ts         # NEW — Unit tests for aggregation and date logic
└── calendarView.test.tsx         # NEW — Component tests for calendar views
```

**Structure Decision**: All new code lives within the existing `plugins-external/sessions-plugin/` directory, following the established plugin structure pattern. No new top-level directories or projects needed. Calendar components are co-located with the sessions plugin they extend.

## Complexity Tracking

No constitution violations — this section is not needed.
