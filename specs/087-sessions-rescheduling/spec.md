# Feature Specification: Sessions Rescheduling

**Feature Branch**: `087-sessions-rescheduling`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "Sessions rescheduling"

## Clarifications

### Session 2026-04-28

- Q: Where are sessions persisted (storage layer)? → A: Local-only — IndexedDB (full session objects) + localStorage (session index). No backend API. Confirmed from `sessionStorage.ts` which uses `openDB()` and `scopedGetItem/SetItem`.
- Q: Should the auto-reschedule dialog re-appear if the user dismisses it, navigates away, then returns to the Sessions view in the same app session? → A: No — suppress for the rest of the app session using an in-memory flag (e.g. a React ref). No persistence needed.
- Q: What is the spacing rule for redistributing goal-linked sessions during auto-reschedule? → A: Reuse `findFreeDays()` logic — skip all occupied days (active + scheduled), but exclude the current dates of the goal's own sessions being rescheduled (since those slots are being vacated).
- Q: Should the manual date picker restrict past dates? → A: Yes — set `min` to today. Prevents scheduling sessions in the past, avoiding an immediate re-trigger of the auto-reschedule dialog.
- Q: Should the auto-reschedule dialog display a summary of what will change before the user accepts? → A: Yes — show a concise count summary (e.g. "2 goal sessions, 1 isolated session") so the user can make an informed decision before accepting the bulk action.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-Reschedule Past Sessions on View Open (Priority: P1)

When a user opens the Sessions view, the system automatically scans for sessions whose scheduled date is in the past. If any are found, a dialog is presented offering to auto-reschedule them. The user can accept or dismiss. On acceptance, the system applies the appropriate rescheduling strategy for each session: goal-linked sessions have all pending sessions for the goal redistributed starting from today; isolated sessions are simply moved to the next available day.

**Why this priority**: This is the core user-facing need — stale scheduled sessions cause confusion and friction. Auto-detection and bulk rescheduling on view open is the primary value of this feature.

**Independent Test**: Can be fully tested by creating sessions in the past (both goal-linked and isolated), opening the Sessions view, and verifying the dialog appears with correct options and that accepting it reschedules sessions as expected.

**Acceptance Scenarios**:

1. **Given** the user has sessions scheduled in the past, **When** they open the Sessions view, **Then** a dialog appears showing a summary of past sessions to reschedule (e.g. "2 goal-linked sessions, 1 isolated session") and asking if they want to auto-reschedule them.
2. **Given** the dialog is shown, **When** the user dismisses it, **Then** no sessions are modified and the dialog closes.
3. **Given** the dialog is shown and past sessions include goal-linked sessions, **When** the user accepts, **Then** all pending sessions for those goals are rescheduled starting from today, preserving their relative ordering.
4. **Given** the dialog is shown and past sessions include isolated (non-goal) sessions, **When** the user accepts, **Then** those sessions are moved to the next available day.
5. **Given** the Sessions view is opened, **When** there are no past sessions, **Then** no dialog appears.
6. **Given** the dialog is shown, **When** past sessions include a mix of goal-linked and isolated sessions, **Then** both rescheduling strategies are applied correctly to each respective session type.

---

### User Story 2 - Manual Reschedule via In-Session Date Picker (Priority: P2)

When a session is in edit mode, the user can tap or click the date displayed just below the session title to open a calendar date picker. Selecting a new date reschedules that individual session and transitions it to "Scheduled" state.

**Why this priority**: Provides fine-grained control when the automatic approach doesn't meet the user's needs, or when the user wants to set a specific date for a single session.

**Independent Test**: Can be fully tested by opening a session in edit mode, clicking the date label below the title, selecting a date in the calendar, and verifying the session's date updates and its state changes to "Scheduled".

**Acceptance Scenarios**:

1. **Given** a session is in edit mode, **When** the user clicks/taps the date shown below the session title, **Then** a calendar date picker opens.
2. **Given** the calendar is open, **When** the user selects a date, **Then** the session's scheduled date is updated to the selected date and the calendar closes.
3. **Given** the user selects a new date, **When** the date differs from the original, **Then** the session's state transitions to "Scheduled".
4. **Given** the calendar is open, **When** the user dismisses it without selecting a date, **Then** the session's date and state remain unchanged.
5. **Given** a session is NOT in edit mode, **When** the user views the session, **Then** clicking the date does not open a calendar (date is not an interactive control).

---

### Edge Cases

- What happens when a goal has all its sessions in the past with no future sessions remaining? All pending sessions for the goal are redistributed starting from today using free-day allocation, excluding the goal's own (vacated) dates from the occupied set.
- What happens when there are no available days for isolated sessions (all near-future days are fully booked)? The system places the session on the earliest unoccupied day within a reasonable future window, or at the end of the queue.
- How does the system handle sessions already marked "Completed"? They are never rescheduled — completed sessions are immutable.
- What if a user accepts auto-reschedule and then manually changes a date via the calendar? The manually selected date takes precedence.
- What happens to "Skipped" sessions? Treated as non-pending — not rescheduled by the auto-reschedule flow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect sessions with a scheduled date in the past when the Sessions view is opened.
- **FR-002**: The system MUST display a dialog to the user when one or more past-scheduled sessions are detected on Sessions view open, unless the dialog was already dismissed in the current app session.
- **FR-002a**: The dialog MUST include a concise summary of sessions to be rescheduled, broken down by type (e.g. "2 goal-linked sessions, 1 isolated session").
- **FR-002b**: Once dismissed, the dialog MUST NOT reappear during the same app session (controlled via an in-memory flag; no persistence required).
- **FR-003**: The dialog MUST allow the user to accept auto-rescheduling or dismiss without changes.
- **FR-004**: On accepting auto-reschedule, goal-linked sessions MUST trigger rescheduling of all pending (non-completed, non-skipped) sessions within the same goal, starting from today and preserving relative order. Free days are computed using `findFreeDays()` logic — skipping all occupied days (active + scheduled sessions) — but the goal's own sessions being rescheduled are excluded from the occupied set (their current dates are treated as vacated).
- **FR-005**: On accepting auto-reschedule, isolated (non-goal) sessions MUST be moved to the next available day.
- **FR-006**: Completed or skipped sessions MUST NOT be rescheduled under any circumstances.
- **FR-007**: When a session is in edit mode, the scheduled date displayed below the session title MUST be interactive (tappable/clickable).
- **FR-008**: Clicking the date in edit mode MUST open a calendar date picker with `min` set to today's date, preventing selection of past dates.
- **FR-009**: Selecting a date from the calendar MUST update the session's scheduled date to the selected value.
- **FR-010**: When a session's date is changed via the calendar picker, the session's state MUST transition to "Scheduled".
- **FR-011**: If the user dismisses the calendar without selecting a date, the session MUST remain unchanged.
- **FR-012**: The date control MUST only be interactive when the session is in edit mode.

### Key Entities

- **Session**: A scheduled practice unit with a `targetDate` (ISO date, e.g. `"2026-04-15"`), a status (`'active' | 'closed' | 'scheduled'`), and a list of tasks. May be linked to a Goal or standalone (isolated). Persisted in IndexedDB; indexed in localStorage.
- **Goal**: A collection of related sessions that together accomplish a practice objective; sessions within a goal share a sequential ordering.
- **Isolated Session**: A session not linked to any goal; rescheduled independently to the next available day.
- **Available Day**: A future calendar day that does not already have a session scheduled for the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with past sessions see the auto-reschedule dialog within 1 second of opening the Sessions view, 100% of the time.
- **SC-002**: After accepting auto-reschedule, no sessions remain with a scheduled date in the past.
- **SC-003**: Users can manually change a session's date in 3 interactions or fewer (enter edit mode → click date → select date).
- **SC-004**: 100% of sessions changed via the calendar correctly reflect the "Scheduled" state after the change.
- **SC-005**: Auto-rescheduling correctly preserves goal session ordering — no pending goal session ends up scheduled before a previously completed session.

## Known Issues & Regression Tests *(if applicable)*

*None at this time. This section will be updated during development and testing.*

