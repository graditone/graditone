# Research: Sessions Calendar View

**Feature**: 065-sessions-calendar-view | **Date**: 2026-03-30

## Research Tasks & Findings

### R1: Activity Timestamp Strategy

**Question**: How to attribute activities to calendar days when `SessionActivity` already has `createdAt` but no `completedAt`?

**Finding**: `SessionActivity` already has `readonly createdAt: string` (ISO 8601 format), set via `new Date().toISOString()` at the moment the practice is saved. This timestamp effectively represents when the activity was completed (it's set when `PracticeSavedEvent` fires after practice ends).

**Decision**: Rename the spec's concept of `completedAt` to use the existing `createdAt` field directly — it already captures completion time. No new field or backfill needed.

**Rationale**: The `createdAt` field in `SessionActivity` is set when the practice finishes (via `PracticeSavedEvent`), not when the session starts. This is functionally equivalent to "completed at" and already exists on every activity.

**Alternatives considered**:
- Add a separate `completedAt` field → Rejected: redundant with existing `createdAt` which already captures completion time
- Use session-level `createdAt` → Rejected: less precise; a session may contain activities from different practice completion times

### R2: Date Library Choice

**Question**: Should we use a date library for calendar date math (week boundaries, month grids, navigation)?

**Finding**: The frontend has no date library dependency. All existing code uses native `Date` and `toISOString()`.

**Decision**: Use native `Date` API with custom utility functions in `calendarUtils.ts`.

**Rationale**: Calendar date math (start-of-week, days-in-month, month grid generation) is well-defined and doesn't require a library for this scope. Adding `date-fns` would increase bundle size for ~5 utility functions. The 50-session/1000-activity scale doesn't need optimized date parsing.

**Alternatives considered**:
- `date-fns` → Good tree-shaking but adds a dependency for simple operations
- `dayjs` → Lightweight but still an unnecessary dependency for this scope

### R3: Tab/Toggle UI Pattern

**Question**: How to implement the Sessions/Calendar tab toggle?

**Finding**: No dedicated tab component exists. Existing patterns use button groups with `aria-pressed` and bottom-border active indicators (see `DesignNavbar.css`).

**Decision**: Create a simple two-button tab bar within the `SessionsPlugin` component using `aria-selected` attributes and the existing `--ls-` CSS variable system. Follow the `DesignNavbar.css` bottom-border pattern for active state.

**Rationale**: Consistent with existing project patterns. Two tabs don't warrant a generic TabBar component — a dedicated inline implementation is simpler.

### R4: Day Detail Overlay Pattern

**Question**: How to implement the day detail overlay (modal/dialog)?

**Finding**: Multiple modal/dialog patterns exist: `ListDialog`, `PluginManagerDialog`, `LoadScoreDialog`, `IOSInstallModal`. `ListDialog` is the closest match — it provides a generic scrollable list with header and footer.

**Decision**: Follow the `ListDialog` pattern (React state + CSS backdrop overlay) but create a purpose-built `CalendarDayOverlay` component. The overlay will have a summary header (total activities, total time, average score) and a scrollable activity list.

**Rationale**: `ListDialog` demonstrates the established overlay pattern but is specific to its use case. The calendar day overlay has unique layout requirements (summary header + activity cards) that justify its own component while following the same CSS/structural conventions.

### R5: Data Loading & Aggregation Strategy

**Question**: How to efficiently load and aggregate session data for the calendar?

**Finding**: `loadAllSessionsFromIndexedDB()` returns `Promise<Session[]>` — loads all sessions at once. Max 50 sessions. Each session has an `activities: SessionActivity[]` array. Activities have `createdAt` (ISO string) and `practiceTimeMs` (integer milliseconds).

**Decision**: Load all sessions once on Calendar tab activation. Build an in-memory `Map<string, DaySummary>` keyed by ISO date string (YYYY-MM-DD), grouping activities by their `createdAt` date. Keep the map in React state while the Calendar tab is open. Recompute only when tab is re-activated.

**Rationale**: With max ~1000 activities, in-memory aggregation is fast (<10ms). No need for lazy loading, pagination, or pre-computed caches. The one-time IndexedDB read + aggregation fits well within the 200ms load target.

### R6: CSS Styling Conventions

**Question**: What CSS patterns to follow for calendar components?

**Finding**: Sessions plugin uses plain CSS (not CSS modules) with `--ls-` prefixed CSS custom properties. Key tokens: `--ls-bg`, `--ls-navbar-bg`, `--ls-cta-bg`, `--ls-heading`, `--ls-body`, `--color-border`, `--ls-font-body`, `--ls-font-heading`.

**Decision**: Add calendar styles to `SessionsPlugin.css` using the existing `--ls-` variable system. Use `.calendar-` prefixed class names for namespacing.

**Rationale**: Consistent with the existing sessions plugin styling approach. Keeps all plugin styles in one file. Calendar should visually match the sessions list view.

### R7: Week Start Convention

**Question**: The spec says Monday start (ISO 8601). Need to verify this aligns with existing locale handling.

**Finding**: No locale-specific week start logic exists in the codebase. The spec explicitly states "Week starts on Monday (ISO 8601 standard)."

**Decision**: Hardcode Monday as week start. Use `getDay()` with adjustment (Sunday=0 mapped to 7) for consistent Monday-first week calculations.

**Rationale**: Spec requirement. ISO 8601 standard. Simpler than locale-aware week starts.
