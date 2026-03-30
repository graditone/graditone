# Data Model: Sessions Calendar View

**Feature**: 065-sessions-calendar-view | **Date**: 2026-03-30

## Existing Entities (No Changes)

### SessionActivity (read-only, from `sessionTypes.ts`)

The calendar reads from existing `SessionActivity` records. No modifications needed.

```typescript
interface SessionActivity {
  readonly id: string
  readonly type: 'score-practice'
  readonly createdAt: string              // ISO 8601 — used as calendar day key
  readonly savedPracticeId: string
  readonly practiceName: string
  readonly scoreTitle: string
  readonly completionStatus: 'complete' | 'partial'
  readonly practiceScore: number          // 0–100
  readonly correctCount: number
  readonly totalNotes: number
  readonly practiceTimeMs: number         // wall-clock duration in milliseconds
  readonly taskId?: string                // optional link to session task
}
```

### Session (read-only, from `sessionTypes.ts`)

```typescript
interface Session {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly status: 'active' | 'closed'
  readonly tasks: SessionTask[]
  readonly activities: SessionActivity[]
}
```

## New Presentation Entities

These are frontend-only view models derived from session data. They are not persisted.

### DaySummary

Aggregated data for a single calendar day. Keyed by ISO date string (YYYY-MM-DD).

```typescript
interface DaySummary {
  readonly date: string                   // ISO date: "2026-03-15"
  readonly activityCount: number          // total activities completed this day
  readonly totalTimeMs: number            // sum of practiceTimeMs for all activities
  readonly activities: SessionActivity[]  // full activity records for overlay detail
}
```

**Derivation**: Group all `SessionActivity` records across all sessions by the date portion of `createdAt` (converted to local timezone). Sum counts and durations per day.

### CalendarViewState

Current view state managed by the CalendarView component.

```typescript
type CalendarGrouping = 'week' | 'month' | 'year'

interface CalendarViewState {
  readonly grouping: CalendarGrouping     // active view mode
  readonly referenceDate: Date            // anchor date for current view period
}
```

**Navigation**:
- `month` view: `referenceDate` determines which month to display (any date in that month)
- `week` view: `referenceDate` determines which week to display (any date in that week, Monday-aligned)
- `year` view: `referenceDate` determines which year to display

### DayOverlayState

State for the day detail overlay.

```typescript
interface DayOverlayState {
  readonly isOpen: boolean
  readonly selectedDate: string | null    // ISO date of the selected day, or null if closed
}
```

### PeriodSummary

Aggregated data for the currently visible time period (week/month/year).

```typescript
interface PeriodSummary {
  readonly label: string                  // e.g., "March 2026", "Week of Mar 23", "2026"
  readonly activityCount: number          // total activities in period
  readonly totalTimeMs: number            // sum of all practice time in period
}
```

## Data Flow

```
IndexedDB (sessions store)
    │
    ▼
loadAllSessionsFromIndexedDB()  ──→  Session[]
    │
    ▼
aggregateByDay(sessions)  ──→  Map<string, DaySummary>
    │                           key: "YYYY-MM-DD"
    │
buildTaskNameMap(sessions) ──→  Map<string, string>
    │                           key: taskId, value: task name
    ▼
CalendarView component
    │
    ├── filterByPeriod(map, viewState) ──→ DaySummary[] for visible period
    │                                      + PeriodSummary
    ├── MonthView / WeekView / YearView renders day cells
    │
    └── onClick(day) ──→ DayOverlay with DaySummary.activities + taskNameMap
```

## Aggregation Logic (calendarUtils.ts)

### `aggregateByDay(sessions: Session[]): Map<string, DaySummary>`

1. Iterate all sessions, then all activities within each session.
2. For each activity, extract the local date from `createdAt` (ISO string → `Date` → local YYYY-MM-DD).
3. Group into `Map<string, DaySummary>` — accumulate counts and durations; collect activity references.

### `computePeriodSummary(daySummaries: Map<string, DaySummary>, startDate: Date, endDate: Date, label: string): PeriodSummary`

1. Filter map entries where date falls within [startDate, endDate] inclusive.
2. Sum activity counts and total time across matching days.
3. Use the provided `label` (e.g., "March 2026", "Week of Mar 23") for the PeriodSummary label field.

### `buildTaskNameMap(sessions: Session[]): Map<string, string>`

1. Iterate all sessions, then all tasks within each session.
2. Map `task.id → task.name` into a `Map<string, string>`.
3. Used by CalendarDayOverlay to resolve taskId to display name.

### `formatDuration(ms: number): string`

Convert milliseconds to human-readable format:
- `< 60000` → "< 1 min"
- `< 3600000` → "{N} min"
- `≥ 3600000` → "{H}h {M}min"
