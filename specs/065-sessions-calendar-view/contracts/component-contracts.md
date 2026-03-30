# Component Contracts: Sessions Calendar View

**Feature**: 065-sessions-calendar-view | **Date**: 2026-03-30

This feature is frontend-only with no REST/GraphQL API. Contracts define the React component interfaces (props) that serve as internal boundaries.

## CalendarView (Main Orchestrator)

```typescript
interface CalendarViewProps {
  /** All sessions loaded from IndexedDB. Passed from parent to avoid re-fetching. */
  readonly sessions: Session[]
}
```

**Responsibilities**: Manages `CalendarViewState`, computes `Map<string, DaySummary>`, renders view selector (week/month/year), navigation controls, period summary, and delegates to the active sub-view.

## CalendarMonthView

```typescript
interface CalendarMonthViewProps {
  /** Aggregated day data for lookup */
  readonly daySummaries: ReadonlyMap<string, DaySummary>
  /** The month to display (any date in that month) */
  readonly referenceDate: Date
  /** Called when user clicks a day cell */
  readonly onDayClick: (date: string) => void
}
```

**Renders**: 6×7 grid (weeks × days), Monday-first. Day cells show activity count + formatted time if `DaySummary` exists for that date.

## CalendarWeekView

```typescript
interface CalendarWeekViewProps {
  /** Aggregated day data for lookup */
  readonly daySummaries: ReadonlyMap<string, DaySummary>
  /** The week to display (any date in that week) */
  readonly referenceDate: Date
  /** Called when user clicks a day column */
  readonly onDayClick: (date: string) => void
}
```

**Renders**: 7 day columns (Monday–Sunday). Each column shows day name, date, activity count, and formatted time.

## CalendarYearView

```typescript
interface CalendarYearViewProps {
  /** Aggregated day data for lookup */
  readonly daySummaries: ReadonlyMap<string, DaySummary>
  /** The year to display (any date in that year) */
  readonly referenceDate: Date
  /** Called when user clicks a month cell (navigates to month view) */
  readonly onMonthClick: (date: Date) => void
}
```

**Renders**: 4×3 grid of month cells. Each cell shows month name, total activity count, and total formatted time for that month.

## CalendarDayOverlay

```typescript
interface CalendarDayOverlayProps {
  /** The selected day's summary data */
  readonly daySummary: DaySummary
  /** Called when user closes the overlay */
  readonly onClose: () => void
  /** Maps taskId → task name for resolving task labels */
  readonly taskNameMap: ReadonlyMap<string, string>
}
```

**Renders**: Modal overlay with:
1. **Summary header**: date, total activities, total time, average practice score
2. **Activity list** (scrollable): For each activity — score title, practice name, practice score, note accuracy (correct/total), duration, completion status, optional task name

## CalendarPeriodSummary

```typescript
interface CalendarPeriodSummaryProps {
  /** Aggregated period data */
  readonly summary: PeriodSummary
}
```

**Renders**: Single line showing period label, total activities, and total formatted time.

## Utility Functions (calendarUtils.ts)

```typescript
/** Group all activities across sessions into a day-keyed map */
function aggregateByDay(sessions: readonly Session[]): Map<string, DaySummary>

/** Compute summary for a date range */
function computePeriodSummary(
  daySummaries: ReadonlyMap<string, DaySummary>,
  startDate: Date,
  endDate: Date,
  label: string
): PeriodSummary

/** Get Monday-aligned start of week for a given date */
function getWeekStart(date: Date): Date

/** Get all dates in a month grid (6 weeks × 7 days, may include prev/next month padding) */
function getMonthGrid(year: number, month: number): Date[]

/** Format milliseconds as human-readable duration */
function formatDuration(ms: number): string

/** Convert ISO string to local YYYY-MM-DD date key */
function toLocalDateKey(isoString: string): string

/** Build lookup map from taskId to task name across all sessions */
function buildTaskNameMap(sessions: readonly Session[]): Map<string, string>

/** Calculate average practice score for a list of activities */
function averagePracticeScore(activities: readonly SessionActivity[]): number
```
