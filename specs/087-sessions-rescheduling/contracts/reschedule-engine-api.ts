/**
 * Contract: Reschedule Engine Public API
 * Feature 087: Sessions Rescheduling
 *
 * Defines the public interface of rescheduleEngine.ts —
 * the pure/async functions that implement all rescheduling logic.
 * UI components import from this module; no business logic lives in JSX.
 */

import type { SessionIndexEntry } from '../sessionTypes';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

/**
 * Partition of overdue sessions by linkage type.
 * Used to populate the auto-reschedule dialog body.
 */
export interface RescheduleSummary {
  /** Overdue sessions that belong to a goal (Session.goalId is set). */
  goalLinked: SessionIndexEntry[];
  /** Overdue sessions with no goal association. */
  isolated: SessionIndexEntry[];
}

// ---------------------------------------------------------------------------
// Pure detection functions (synchronous)
// ---------------------------------------------------------------------------

/**
 * Returns all entries where status === 'scheduled' and targetDate < todayISO.
 *
 * @param entries   Full localStorage session index (from listSessionsIndex()).
 * @param todayISO  Current date as "YYYY-MM-DD".
 */
export declare function detectOverdueSessions(
  entries: SessionIndexEntry[],
  todayISO: string,
): SessionIndexEntry[];

/**
 * Partitions overdue sessions into goal-linked vs isolated buckets.
 */
export declare function classifyOverdueSessions(
  overdue: SessionIndexEntry[],
): RescheduleSummary;

// ---------------------------------------------------------------------------
// Async mutation functions
// ---------------------------------------------------------------------------

/**
 * Reschedules all pending sessions belonging to a goal, starting from todayISO.
 *
 * Algorithm:
 *   1. Load Goal from IndexedDB.
 *   2. Filter goal.sessionIds to sessions with status === 'scheduled' (pending).
 *   3. Build adjustedOccupied = globalOccupied minus the goal's own pending targetDates.
 *   4. findFreeDaysFrom(todayISO, pendingCount, adjustedOccupied).
 *   5. Update each pending session's targetDate on index + IndexedDB.
 *
 * @param goalId          The goal whose sessions to redistribute.
 * @param globalOccupied  Occupied dates from getOccupiedDates() — modified in-place as new dates are claimed.
 * @param todayISO        Current date as "YYYY-MM-DD".
 */
export declare function rescheduleGoalSessions(
  goalId: string,
  globalOccupied: Set<string>,
  todayISO: string,
): Promise<void>;

/**
 * Reschedules a single isolated (non-goal) session to the next free day.
 *
 * @param entry    The overdue isolated session index entry.
 * @param occupied Occupied date set — the new date is added before returning.
 * @param todayISO Current date as "YYYY-MM-DD".
 * @returns        The new targetDate assigned to the session.
 */
export declare function rescheduleIsolatedSession(
  entry: SessionIndexEntry,
  occupied: Set<string>,
  todayISO: string,
): Promise<string>;

/**
 * Top-level orchestrator called when the user accepts the auto-reschedule dialog.
 *
 * Order of operations:
 *   1. Build globalOccupied from getOccupiedDates().
 *   2. Collect unique goalIds from summary.goalLinked.
 *   3. For each goalId: rescheduleGoalSessions(...).
 *   4. For each isolated session: rescheduleIsolatedSession(...).
 *
 * @param summary   From classifyOverdueSessions() — drives what gets rescheduled.
 * @param todayISO  Current date as "YYYY-MM-DD".
 */
export declare function applyAutoReschedule(
  summary: RescheduleSummary,
  todayISO: string,
): Promise<void>;

// ---------------------------------------------------------------------------
// Manual date update (called from date picker onChange)
// ---------------------------------------------------------------------------

/**
 * Updates a single session's targetDate (manual calendar pick).
 * Sets status to 'scheduled' if not already, then persists to index + IndexedDB.
 *
 * @param sessionId   ID of the session to update.
 * @param newDate     New date as "YYYY-MM-DD" (must be >= today; validated by caller via DatePicker min prop).
 */
export declare function updateSessionDate(
  sessionId: string,
  newDate: string,
): Promise<void>;
