# Feature Specification: Session Scheduling

**Feature Branch**: `066-session-scheduling`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Session scheduling: In order to schedule the practicing with the piano of a user, the sessions can be scheduled for the future, not only to have closed sessions and one active session. Scheduled sessions can be activated. A closed session can not be reactivated. Only one active session can exist."

## Clarifications

### Session 2026-03-31

- Q: How should the user choose between starting an immediate session versus scheduling one for later? → A: Option A — A date picker is integrated into the existing "Start Session" flow, always defaulting to today's date. Selecting today starts the session immediately; selecting a future date creates a scheduled session.
- Q: When the user tries to activate a scheduled session but another session is already active, what should happen? → A: The activate button is disabled with a tooltip indicating "Only one active session can exist".
- Q: Can a scheduled session have pre-defined tasks attached at creation time, or only after activation? → A: Tasks can be assigned when creating a scheduled session (plan what + when).
- Q: When a scheduled session is activated, should the target date be preserved or cleared? → A: Preserve target date on the session after activation (kept for history/analytics).
- Q: Should future dates in the date picker be constrained to a maximum range? → A: No limit — any future date is allowed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schedule a Future Practice Session (Priority: P1)

A user wants to plan their piano practice ahead of time. They create a scheduled session with a name and a target date, so they can organize upcoming practice commitments. The scheduled session appears in their session list with a clear visual indicator that it is planned for the future.

**Why this priority**: This is the core capability of the feature. Without the ability to create scheduled sessions, no other scheduling functionality is possible.

**Independent Test**: Can be fully tested by creating a scheduled session with a name and target date, then verifying it appears in the session list with a "scheduled" status indicator and the correct date.

**Acceptance Scenarios**:

1. **Given** the user is on the sessions screen, **When** they open the session creation flow, **Then** a date picker is shown defaulting to today's date.
2. **Given** the date picker defaults to today, **When** the user keeps today's date and confirms, **Then** the session starts immediately with "active" status (existing behavior preserved).
3. **Given** the date picker defaults to today, **When** the user selects a future date and confirms, **Then** a session is created with "scheduled" status displaying the chosen date.
4. **Given** the user has multiple scheduled sessions, **When** they view the session list, **Then** scheduled sessions are visually distinct from active and closed sessions and sorted by target date.
5. **Given** the user is creating a scheduled session, **When** they set a name and target date, **Then** the session is persisted and survives page reload.

---

### User Story 2 - Activate a Scheduled Session (Priority: P1)

A user has a scheduled session and wants to begin practicing. They activate the scheduled session, which transitions it to "active" status so they can start recording practice activities against it. The system enforces that only one session can be active at a time.

**Why this priority**: Activation is essential to make scheduled sessions usable. Without it, scheduled sessions would be inert entries with no practical purpose.

**Independent Test**: Can be fully tested by creating a scheduled session, activating it, and verifying it transitions to active status and accepts practice activities.

**Acceptance Scenarios**:

1. **Given** a scheduled session exists and no session is currently active, **When** the user activates the scheduled session, **Then** the session transitions to "active" status.
2. **Given** a scheduled session exists and another session is already active, **When** the user views the scheduled session, **Then** the activate button is disabled and displays a tooltip: "Only one active session can exist".
3. **Given** a scheduled session has been activated, **When** the user views the session list, **Then** the session no longer shows as "scheduled" and instead shows as "active".

---

### User Story 3 - View Session Lifecycle States (Priority: P2)

A user wants to understand the state of all their sessions at a glance. The session list clearly shows whether each session is scheduled, active, or closed, with appropriate visual cues and ordering.

**Why this priority**: Provides the user with the context needed to manage their practice schedule effectively. Depends on the new "scheduled" state existing.

**Independent Test**: Can be fully tested by creating sessions in each state (scheduled, active, closed) and verifying the list displays correct status indicators and ordering.

**Acceptance Scenarios**:

1. **Given** sessions exist in all three states (scheduled, active, closed), **When** the user views the session list, **Then** each session displays its current state with a distinct visual indicator.
2. **Given** sessions exist in all three states, **When** the user views the session list, **Then** the active session appears prominently, followed by scheduled sessions sorted by target date ascending, followed by closed sessions sorted by creation date descending.

---

### User Story 4 - Enforce Closed Session Finality (Priority: P2)

A user cannot reactivate or reschedule a closed session. Closed sessions represent completed or abandoned practice periods and remain as historical records only.

**Why this priority**: Enforces data integrity and prevents confusion about session history. A closed session's activities are a sealed record.

**Independent Test**: Can be fully tested by closing a session and verifying no option to activate or reschedule it is available.

**Acceptance Scenarios**:

1. **Given** a session is in "closed" status, **When** the user views the session details, **Then** no option to activate or reschedule the session is available.
2. **Given** a session is in "closed" status, **When** any attempt is made to change its status, **Then** the system rejects the transition and the session remains closed.

---

### Edge Cases

- What happens when the user tries to schedule a session with a date in the past? The system prevents this and informs the user that scheduled sessions require a future date.
- What happens when the user tries to activate a scheduled session while another session is already active? The system blocks activation and clearly communicates the constraint.
- What happens when the maximum session limit (50) is reached and the user tries to create a new scheduled session? The existing eviction policy (oldest closed session removed) applies.
- What happens when a scheduled session's target date arrives but the user hasn't activated it? The session remains in "scheduled" status; there is no automatic activation.
- What happens when the user deletes a scheduled session? The session is removed entirely, same as deleting any other session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a "scheduled" session status in addition to "active" and "closed".
- **FR-002**: The session creation flow MUST include a date picker defaulting to today's date. Selecting today starts the session immediately ("active"); selecting a future date creates a "scheduled" session.
- **FR-003**: System MUST prevent creating a scheduled session with a target date in the past.
- **FR-004**: Users MUST be able to activate a scheduled session, transitioning it from "scheduled" to "active" status.
- **FR-005**: System MUST enforce that at most one session can be in "active" status at any time.
- **FR-006**: System MUST disable the activate button on scheduled sessions when another session is already active, showing a tooltip: "Only one active session can exist".
- **FR-007**: System MUST prevent any status transition from "closed" to "active" or "scheduled" (closed is terminal).
- **FR-008**: System MUST display scheduled sessions with a distinct visual indicator showing the "scheduled" status and target date.
- **FR-009**: System MUST order the session list as: active session first, then scheduled sessions sorted by target date ascending, then closed sessions sorted by creation date descending.
- **FR-010**: System MUST persist scheduled sessions (including target date) in local storage, surviving page reloads.
- **FR-011**: System MUST allow users to delete a scheduled session.
- **FR-012**: System MUST allow users to rename a scheduled session.
- **FR-013**: The existing session eviction policy (MAX_SESSIONS = 50, oldest closed session evicted) MUST apply when creating new scheduled sessions.
- **FR-014**: Users MUST be able to assign tasks (score, measures, hand, loop count, tempo, minimum result) to a scheduled session at creation time, reusing the existing task definition flow.

### Key Entities

- **Session**: Existing entity extended with a new status value ("scheduled") and a new attribute: target date. Represents a container for practice activities. Valid statuses: "active", "closed", "scheduled". Allowed transitions: scheduled -> active, active -> closed. No transitions out of "closed". A scheduled session can hold pre-defined tasks before activation. The target date is preserved after activation and closing for historical reference.
- **Session Index Entry**: Lightweight summary entry extended to include target date and the "scheduled" status, used for fast list rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a scheduled session with a name and target date in under 30 seconds.
- **SC-002**: Users can activate a scheduled session in a single action (one tap or click).
- **SC-003**: The session list clearly distinguishes all three states (scheduled, active, closed) so that users can identify each session's status at a glance without reading labels.
- **SC-004**: 100% of attempts to reactivate a closed session are blocked by the system.
- **SC-005**: 100% of attempts to have more than one active session simultaneously are blocked by the system.
- **SC-006**: Scheduled sessions persist correctly across page reloads with no data loss.

## Assumptions

- The target date for a scheduled session is a date only (no specific time of day), representing the day the user intends to practice.
- There is no maximum range for future dates in the date picker; the user can schedule arbitrarily far into the future.
- Scheduled sessions do not automatically activate when the target date arrives; the user must manually activate them.
- The existing session creation flow is extended with a date picker (defaulting to today). Selecting today preserves the current immediate-start behavior; selecting a future date creates a scheduled session. There is no separate "Schedule" action.
- A scheduled session can be activated before its target date if the user chooses to start early.
- The existing maximum session limit of 50 applies to all sessions regardless of status (active + scheduled + closed combined).
- Users can create scheduled sessions regardless of whether an active session currently exists. The "New Session" button is always visible.
