/**
 * component-contracts.ts — Feature 078: Session & Practice Goal Execution UX Improvements
 *
 * Documents the component interface changes introduced by this feature:
 *   1. ResultsOverlayProps gains `loopCountLocked`
 *   2. SessionTimeSummaryProps (new component)
 *   3. SessionIndexEntry gains `totalRealTimeSecs`
 *
 * These contracts are for design review and implementor reference.
 * They reflect the TypeScript interfaces to be added/updated in the codebase.
 */

// ---------------------------------------------------------------------------
// 1. ResultsOverlay — updated props (frontend/plugins/practice-view-plugin/ResultsOverlay.tsx)
// ---------------------------------------------------------------------------

/**
 * CHANGE: Add `loopCountLocked` to ResultsOverlayProps.
 * When true, the loop count slider is rendered as disabled with a tooltip.
 * Passed from PracticeViewPlugin as `loopCountLocked={!!taskIdRef.current}`.
 */
interface ResultsOverlayPropsDelta {
  /** Feature 078: When true, loop count slider is disabled. Tooltip shown. */
  loopCountLocked?: boolean;
}

// ---------------------------------------------------------------------------
// 2. SessionTimeSummary — new component props (sessionTimeSummary.tsx)
// ---------------------------------------------------------------------------

/**
 * Pure presentational component rendering the real-vs-estimated time summary
 * for a closed session. Shown in the session detail header.
 */
interface SessionTimeSummaryProps {
  /** Wall-clock practice time in seconds (from SessionIndexEntry.totalRealTimeSecs). */
  realTimeSecs: number;

  /**
   * Sum of estimated task durations in seconds (SessionIndexEntry.totalEstimatedDurationSecs).
   * Omit when no tasks in the session have estimates.
   */
  estimatedTimeSecs?: number;

  /**
   * Number of tasks that provided an estimate (≤ totalTaskCount).
   * Used to render a partial-coverage footnote when estimatedTaskCount < totalTaskCount.
   */
  estimatedTaskCount?: number;

  /** Total number of tasks in the session. */
  totalTaskCount?: number;
}

/**
 * Rendering contract:
 *
 * │ Condition                              │ Rendered output (example)                   │
 * ├────────────────────────────────────────┼─────────────────────────────────────────────│
 * │ No estimate available                  │ "Practiced: 12 min"                         │
 * │ Estimate available, real == estimated  │ "12 min / 12 min  ±0"                       │
 * │ Estimate available, real > estimated   │ "14 min / 12 min  +2 min" (warning colour)  │
 * │ Estimate available, real < estimated   │ "10 min / 12 min  −2 min" (neutral colour)  │
 * │ Partial estimates (3 of 5 tasks)       │ above + "(estimated for 3 of 5 tasks)"      │
 */

// ---------------------------------------------------------------------------
// 3. SessionIndexEntry — updated type (sessionTypes.ts)
// ---------------------------------------------------------------------------

/**
 * CHANGE: Add `totalRealTimeSecs` to SessionIndexEntry.
 * Computed at closeSession() time. Optional — undefined for sessions closed
 * before feature 078 was deployed.
 */
interface SessionIndexEntryDelta {
  /** Feature 078: Total wall-clock practice time at close in seconds. */
  totalRealTimeSecs?: number;
}

// ---------------------------------------------------------------------------
// 4. TaskRow display contract (informational — no new props)
// ---------------------------------------------------------------------------

/**
 * TaskRow displays invested / estimated time inline in the task meta row.
 *
 * │ Condition                              │ Rendered output (example)           │
 * ├────────────────────────────────────────┼─────────────────────────────────────│
 * │ Has estimate, has invested > 0         │ "⏱ 4 min / 8 min"                   │
 * │ Has estimate, invested = 0             │ "⏱ 0 min / 8 min"                   │
 * │ No estimate, has invested > 0          │ "⏱ 4 min invested"                  │
 * │ No estimate, invested = 0             │ (no time row shown)                  │
 *
 * invested = task.linkedPractices.reduce((s, lp) => s + lp.practiceTimeMs, 0)
 * Computed inline in TaskRow — not stored on SessionTask.
 */
