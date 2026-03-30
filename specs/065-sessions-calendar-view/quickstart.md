# Quickstart: Sessions Calendar View

**Feature**: 065-sessions-calendar-view | **Date**: 2026-03-30

## Prerequisites

- Node.js with npm/pnpm installed
- Working Graditone frontend dev environment

## Development Setup

```bash
# Checkout feature branch
git checkout 065-sessions-calendar-view

# Install frontend dependencies (if not already done)
cd frontend && npm install

# Start dev server with hot reload
npm run dev
```

## Where to Write Code

All new code goes in `plugins-external/sessions-plugin/`:

| File | Purpose |
|------|---------|
| `calendarUtils.ts` | Date math, aggregation, formatting (start here — TDD) |
| `calendarUtils.test.ts` | Unit tests for all utility functions |
| `CalendarView.tsx` | Main orchestrator: tab content, view switcher, navigation |
| `CalendarMonthView.tsx` | Month grid (6×7 calendar) |
| `CalendarWeekView.tsx` | Week columns (7-day row) |
| `CalendarYearView.tsx` | Year grid (12 month cells) |
| `CalendarDayOverlay.tsx` | Day detail modal overlay |
| `CalendarPeriodSummary.tsx` | Period summary line |
| `SessionsPlugin.tsx` | Add Sessions/Calendar tab toggle (modify existing) |
| `SessionsPlugin.css` | Add calendar styles (modify existing) |

## Existing Files to Read (Not Modify)

- `sessionTypes.ts` — `SessionActivity`, `Session`, `SessionTask` interfaces
- `sessionStorage.ts` — `loadAllSessionsFromIndexedDB()` function
- `useSessionManager.ts` — React hook for session state
- `index.tsx` — Plugin registration pattern

## Running Tests

```bash
# Unit tests (from frontend directory)
cd frontend && npx vitest run --reporter=verbose

# Watch mode for TDD
cd frontend && npx vitest --watch

# Run only calendar tests
cd frontend && npx vitest run calendarUtils
```

## Implementation Order (TDD)

1. **calendarUtils.ts**: Write tests first for `toLocalDateKey`, `aggregateByDay`, `formatDuration`, `getWeekStart`, `getMonthGrid`, `computePeriodSummary`, `averagePracticeScore`
2. **CalendarView.tsx**: Wire up data loading from `loadAllSessionsFromIndexedDB()` and view state
3. **CalendarMonthView.tsx**: Month grid with day cells
4. **SessionsPlugin.tsx**: Add tab toggle to switch between Sessions list and Calendar
5. **CalendarDayOverlay.tsx**: Day detail overlay with summary header + activity list
6. **CalendarWeekView.tsx**: Week columns view
7. **CalendarYearView.tsx**: Year grid view
8. **CalendarPeriodSummary.tsx**: Period summary line component

## Key Design Decisions

- **No date library**: Use native `Date` API with custom utilities
- **No data model changes**: Existing `SessionActivity.createdAt` is sufficient
- **Load-once strategy**: All sessions loaded on Calendar tab activation, aggregated in memory
- **Monday-first weeks**: ISO 8601 standard, hardcoded
- **CSS conventions**: Use `--ls-` CSS variables, `.calendar-` class prefix
- **Overlay pattern**: Follow `ListDialog` modal pattern from existing codebase
