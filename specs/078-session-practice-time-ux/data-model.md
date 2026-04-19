# Data Model: Session & Practice Goal Execution UX Improvements

**Branch**: `078-session-practice-time-ux` | **Phase**: 1 | **Date**: 2026-04-10

This feature is purely additive UI + derived data. No new persistence schemas are introduced,
no existing schemas are broken. Changes are confined to:
1. A new derived field on `SessionIndexEntry` (populated at close time).
2. A new prop on `ResultsOverlayProps` (runtime UI flag, not persisted).
3. New i18n keys in locale JSON files.

---

## Modified Entity: `SessionIndexEntry`

**File**: `plugins-external/sessions-plugin/sessionTypes.ts`

```ts
// BEFORE (existing)
export interface SessionIndexEntry {
  readonly id: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed' | 'scheduled';
  targetDate?: string;
  activityCount: number;
  taskCount: number;
  allTasksDone: boolean;
  goalId?: string;
  totalEstimatedDurationSecs?: number;   // Feature 070 — already exists
}

// AFTER (this feature adds one field)
export interface SessionIndexEntry {
  // ... all existing fields unchanged ...
  totalEstimatedDurationSecs?: number;   // Feature 070 — unchanged
  /** Feature 078: Total wall-clock practice time at session close, in seconds. */
  totalRealTimeSecs?: number;
}
```

**Population**: Computed in `useSessionManager.closeSession()` by summing
`task.linkedPractices[*].practiceTimeMs` across all tasks, converting ms → s.
Stored via `updateSessionIndex(id, { totalRealTimeSecs })`.

**Reading**: `SessionsPlugin.tsx` reads `entry.totalRealTimeSecs` from the index
for display in the closed session detail header (no extra DB load needed).

---

## Modified Interface: `ResultsOverlayProps`

**File**: `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`

```ts
// BEFORE (existing)
interface ResultsOverlayProps {
  // ... existing props ...
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  // ...
}

// AFTER (this feature adds one prop)
interface ResultsOverlayProps {
  // ... all existing props unchanged ...
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  /** Feature 078: When true (task-launched practice), the loop count slider is disabled. */
  loopCountLocked?: boolean;
}
```

**Population**: Set by `PracticeViewPlugin.tsx` as `loopCountLocked={!!taskIdRef.current}`.

---

## New Component: `SessionTimeSummary`

**File**: `plugins-external/sessions-plugin/SessionTimeSummary.tsx` (new)

Pure presentational component. Receives pre-computed values and renders the
real-vs-estimated comparison badge in the closed session detail header.

```ts
interface SessionTimeSummaryProps {
  /** Total wall-clock practice time in seconds (from SessionIndexEntry.totalRealTimeSecs). */
  realTimeSecs: number;
  /** Sum of estimated task durations in seconds (from SessionIndexEntry.totalEstimatedDurationSecs). */
  estimatedTimeSecs?: number;
  /** Number of tasks that have an estimate (for partial-coverage footnote). */
  estimatedTaskCount?: number;
  /** Total number of tasks in the session (for partial-coverage footnote). */
  totalTaskCount?: number;
}
```

**Rendering rules**:
- If `estimatedTimeSecs` is present: show `real / estimated` with delta badge.
  - `delta = realTimeSecs - estimatedTimeSecs`
  - `delta > 0` → overrun: e.g. `+3 min` styled with `--overrun` modifier (warning colour).
  - `delta <= 0` → saving: e.g. `−2 min` styled with `--saving` modifier (neutral/positive colour).
- If `estimatedTimeSecs` is absent or 0: show only real time (`X min practice`).
- If `estimatedTaskCount !== totalTaskCount` (partial estimates): show footnote
  "(estimated for N of M tasks)".
- Times formatted as `Xm Ys` for < 2 min, `X min` for ≥ 2 min.

---

## New i18n Keys

### `plugins-external/sessions-plugin/locales/en.json` additions

```json
"task_row.invested_estimate": "{invested} / {estimated}",
"task_row.invested_only": "{invested} invested",
"task_row.invested_aria": "Invested time vs estimated: {invested} of {estimated}",

"session_summary.real_time": "Practiced: {time}",
"session_summary.real_vs_estimated": "{real} / {estimated}",
"session_summary.overrun": "+{delta} over",
"session_summary.saving": "-{delta} under",
"session_summary.partial_estimate": "(estimated for {n} of {total} tasks)",
"session_summary.section_label": "Session Time"
```

### `frontend/src/i18n/locales/en.json` additions

```json
"practice.results.loop_locked_hint": "Loop count set by session task"
```

---

## Derived Computation Summary

| Derived value | Computed in | Formula |
|---|---|---|
| `investedTimeMs` per task | `TaskRow.tsx` (inline, not stored) | `task.linkedPractices.reduce((s, lp) => s + lp.practiceTimeMs, 0)` |
| `totalRealTimeSecs` per session | `useSessionManager.closeSession()` | `Math.round(session.tasks.flatMap(t => t.linkedPractices).reduce((s, lp) => s + lp.practiceTimeMs, 0) / 1000)` |
| `estimatedTaskCount` (partial) | `SessionTimeSummary.tsx` (inline) | `session tasks where estimatedDurationSecs > 0` — passed as prop from call site |

---

## Schema Migration

No schema migration needed. `totalRealTimeSecs` is an optional additive field.
Closed sessions created before this feature will show only `totalEstimatedDurationSecs`
if available, or no time summary if neither is present. This is handled by the
`SessionTimeSummary` "real-only" rendering path.
