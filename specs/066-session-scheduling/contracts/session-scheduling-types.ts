/**
 * Contract: Session Scheduling Type Extensions
 * Feature 066: Session Scheduling
 *
 * Defines the type changes to sessionTypes.ts for adding
 * the "scheduled" status and targetDate field.
 */

// ---------------------------------------------------------------------------
// Modified types (changes from Feature 060/061 baseline)
// ---------------------------------------------------------------------------

/**
 * Session status union — extended with 'scheduled'.
 * Replaces: `'active' | 'closed'`
 */
export type SessionStatus = 'active' | 'closed' | 'scheduled';

/**
 * Session entity — extended with targetDate.
 * Changes from baseline:
 *   - status: added 'scheduled' to union
 *   - targetDate: new optional field (ISO 8601 date string, e.g. "2026-04-15")
 */
export interface Session {
  readonly id: string;
  name: string;
  readonly createdAt: string;
  status: SessionStatus;
  /**
   * Feature 066: Target practice date (date-only, ISO 8601, e.g. "2026-04-15").
   * Set on creation for scheduled sessions. Preserved across all state transitions.
   * Undefined for immediate (today) sessions and legacy sessions.
   */
  targetDate?: string;
  tasks: import('./sessionTypes').SessionTask[];
  activities: import('./sessionTypes').SessionActivity[];
}

/**
 * Session index entry — extended with targetDate.
 * Changes from baseline:
 *   - status: added 'scheduled' to union
 *   - targetDate: new optional field mirroring Session.targetDate
 */
export interface SessionIndexEntry {
  readonly id: string;
  name: string;
  readonly createdAt: string;
  status: SessionStatus;
  activityCount: number;
  taskCount: number;
  allTasksDone: boolean;
  /**
   * Feature 066: Mirrors Session.targetDate for fast list rendering.
   */
  targetDate?: string;
}

// ---------------------------------------------------------------------------
// New function signatures for useSessionManager
// ---------------------------------------------------------------------------

/**
 * Creates a scheduled session with a future target date.
 * @param targetDate - ISO 8601 date string (date-only, e.g. "2026-04-15"). Must be in the future.
 * @param tasks - Optional pre-defined tasks for the session.
 * @throws if targetDate is not in the future.
 */
export type ScheduleSessionFn = (targetDate: string, tasks?: import('./sessionTypes').SessionTask[]) => Promise<void>;

/**
 * Activates a scheduled session, transitioning it to 'active' status.
 * @param id - The session ID to activate.
 * No-op if another session is already active (UI should prevent this via disabled button).
 * No-op if session status is not 'scheduled'.
 */
export type ActivateScheduledSessionFn = (id: string) => Promise<void>;

// ---------------------------------------------------------------------------
// Session list sort contract
// ---------------------------------------------------------------------------

/**
 * Sort order for the session list:
 * 1. Active sessions first (at most one)
 * 2. Scheduled sessions sorted by targetDate ascending
 * 3. Closed sessions sorted by createdAt descending
 */
export type SessionSortComparator = (a: SessionIndexEntry, b: SessionIndexEntry) => number;

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

/**
 * Validates that a target date string is strictly in the future (after today).
 * @param targetDate - ISO 8601 date-only string (e.g. "2026-04-15")
 * @returns true if the date is after today
 */
export type IsValidTargetDateFn = (targetDate: string) => boolean;
