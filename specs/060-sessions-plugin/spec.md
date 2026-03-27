# Feature Specification: Sessions Plugin

**Feature Branch**: `060-sessions-plugin`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "Sessions Plugin initial development — Create a new plugin to manage practice sessions in Graditone. A practice session groups multiple session activities. A user has an active session; activities within that session track temporal and practice context. Initially the only activity type is score practice (aligned with the existing practice plugin). From the sessions plugin: show all sessions in a list; selecting a session reveals a collapsible list of its activities where opening an activity loads the practice (same flow as the current load dialog); start a new session and set it as active so that all saved practices are linked to it; close a session so no more activities are added."

## Clarifications

### Session 2026-03-27

- Q: Should activities snapshot display metadata or only store a reference to the saved practice? → A: Snapshot key metadata (score title, completion status, date) into the activity at creation time; also keep a reference for loading the full practice. Additionally, saved practices that belong to a session cannot be deleted from the load dialog.
- Q: What is the maximum number of stored sessions? → A: 50 sessions maximum; oldest closed sessions are evicted first; the active session is never evicted.
- Q: When a session is evicted, what happens to its linked saved practices? → A: The link is released; saved practices become standalone again and are deletable from the load dialog as normal.
- Q: Can the user rename a session after creation, and from where? → A: Users can rename a session anytime from the sessions list (tap on the session name to edit). No rename at creation time — the default name is assigned automatically.
- Q: How should the practice plugin communicate a saved practice to the sessions plugin? → A: Via a Plugin API event/hook — the practice save flow emits a notification through the Plugin API that any plugin can subscribe to. No direct coupling between plugins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a New Practice Session (Priority: P1)

A user opens the Sessions plugin and starts a new session. The session is created with a timestamp, given a default name (editable), and set to the "active" state. While the session is active, every practice the user saves through the existing practice plugin is automatically linked to this session as a new activity.

**Why this priority**: Without the ability to create and activate a session, no other feature in this plugin delivers value. This is the foundational capability that connects the sessions concept to the existing practice workflow.

**Independent Test**: Can be fully tested by starting a new session and then saving a practice — the saved practice should appear as an activity within the active session.

**Acceptance Scenarios**:

1. **Given** the user has the Sessions plugin open and no active session, **When** the user taps "Start Session", **Then** a new session is created with the current date/time as the default name, it is marked as "active", and the sessions list updates to show it.
2. **Given** there is an active session, **When** the user completes and saves a practice in the practice plugin, **Then** a new activity of type "score-practice" is automatically added to the active session with a reference to the saved practice.
3. **Given** there is an active session, **When** the user stops a practice mid-way and saves partial results, **Then** a new activity is still added to the active session reflecting the partial practice.
4. **Given** there is already an active session, **When** the user taps "Start Session", **Then** the system either closes the current active session first and starts a new one, or informs the user that the current session must be closed before starting a new one.

---

### User Story 2 - View Sessions List (Priority: P2)

A user opens the Sessions plugin and sees a chronologically ordered list of all their sessions. Each session entry shows its name, date, status (active or closed), and the number of activities it contains. The list is sorted with the most recent session at the top.

**Why this priority**: Viewing sessions is needed to browse, select, and manage sessions. It is the primary navigation interface for the plugin and second only to creation in importance.

**Independent Test**: Can be fully tested by creating multiple sessions and verifying they appear in the list with correct metadata and order.

**Acceptance Scenarios**:

1. **Given** the user has previously created sessions, **When** the user opens the Sessions plugin, **Then** a list of all sessions is displayed showing name, date, status, and activity count for each.
2. **Given** the user has no sessions, **When** the user opens the Sessions plugin, **Then** an empty state message is shown with a prompt to start their first session.
3. **Given** sessions exist with varying dates, **When** the list renders, **Then** sessions are sorted with the most recent at the top.
4. **Given** one session is active, **When** the list renders, **Then** the active session is visually distinguished from closed sessions.
5. **Given** any session in the list, **When** the user taps on the session name, **Then** an inline edit field appears allowing the user to rename the session.

---

### User Story 3 - Browse Session Activities (Priority: P3)

A user selects a session from the list to see its activities. The activities are displayed in a collapsible section within the session entry. Each activity shows the score title, date/time, and completion status. The user can open an activity to load the associated practice, using the same flow as the existing load dialog.

**Why this priority**: Browsing activities within a session is the primary way users review their practice history and re-load previous practices. It completes the core session management loop.

**Independent Test**: Can be fully tested by selecting a session that has activities and verifying the collapsible list shows correct activity details, and that opening an activity triggers the practice load flow.

**Acceptance Scenarios**:

1. **Given** a session with multiple activities exists, **When** the user taps on the session in the list, **Then** a collapsible section expands showing all activities for that session in chronological order.
2. **Given** the activities list is expanded, **When** the user taps on the session header again, **Then** the activities list collapses.
3. **Given** the activities list is expanded, **When** the user taps on a specific activity, **Then** the associated practice is loaded (same behavior as loading a saved practice from the existing load dialog).
4. **Given** a session has no activities, **When** the user expands the session, **Then** a message indicates no activities have been recorded yet.

---

### User Story 4 - Close a Session (Priority: P4)

A user closes an active session to signal that the practice block is finished. Once closed, no new activities are added to that session. The session remains visible in the list for review.

**Why this priority**: Closing a session is necessary for the active/closed lifecycle to function, but it depends on session creation (P1) to exist first.

**Independent Test**: Can be fully tested by starting a session, adding activities, closing it, and then verifying that subsequent saved practices are not linked to the closed session.

**Acceptance Scenarios**:

1. **Given** an active session exists, **When** the user taps "Close Session", **Then** the session status changes to "closed" and the visual indicator updates accordingly.
2. **Given** a session has been closed, **When** the user saves a new practice, **Then** the practice is not linked to any session (since no active session exists).
3. **Given** a session has been closed, **When** the user views the sessions list, **Then** the closed session still appears in the list with all its previously recorded activities intact.
4. **Given** a closed session, **When** the user attempts to close it again, **Then** no action is taken (the close control is not available for already-closed sessions).

---

### Edge Cases

- What happens when the user saves a practice but no active session exists? The practice is saved normally through the existing flow but is not linked to any session. The sessions plugin does not interfere with the standalone practice save behavior.
- What happens when the user force-closes the app while a session is active? The session remains in active state and can be resumed or closed when the user next opens the app.
- What happens when a user tries to delete a saved practice that belongs to a session? The delete option is not available for session-linked practices; the user must remove the session first. Activity display metadata is snapshotted at creation time, so activities always show meaningful information regardless.
- What happens when the maximum storage limit is reached? The system enforces a cap of 50 sessions; the oldest closed session is automatically evicted when a new session would exceed the limit. The active session is never evicted. When a session is evicted, its linked saved practices are released and become standalone (deletable from the load dialog as normal).
- What happens if the user tries to start a session when one is already active? The system requires the user to close the current active session before starting a new one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a new practice session from the Sessions plugin view.
- **FR-002**: System MUST assign a default name to a new session based on the current date and time. Users MUST be able to rename any session at any time from the sessions list.
- **FR-003**: System MUST mark a newly created session as "active" and enforce that at most one session can be active at any time.
- **FR-004**: System MUST automatically create a new activity of type "score-practice" within the active session whenever the user saves a practice (complete or partial) through the practice plugin. This communication MUST happen via a Plugin API event/hook, keeping the sessions and practice plugins decoupled.
- **FR-005**: System MUST display all sessions in a chronologically sorted list (most recent first) showing name, date, status, and activity count.
- **FR-006**: System MUST display an empty state with guidance when the user has no sessions.
- **FR-007**: System MUST allow users to expand a session to reveal its activities in a collapsible list.
- **FR-008**: Each activity entry MUST display the score title, date/time, and completion status (complete or partial), using metadata snapshotted at activity creation time.
- **FR-009**: System MUST allow users to open an activity, which loads the associated saved practice using the same flow as the existing load dialog.
- **FR-010**: System MUST allow users to close the active session, changing its status to "closed".
- **FR-011**: System MUST NOT add new activities to a closed session.
- **FR-012**: System MUST persist sessions and their activities across app restarts.
- **FR-013**: System MUST visually distinguish the active session from closed sessions in the list.
- **FR-014**: System MUST prevent deletion of saved practices that are referenced by any session activity; the delete option MUST NOT be available for such practices in the load dialog.
- **FR-015**: System MUST be implemented as a Graditone plugin following the existing plugin architecture and conventions.
- **FR-016**: System MUST prevent starting a new session while another session is already active — the user must close the current session first.
- **FR-017**: System MUST enforce a maximum of 50 stored sessions; when the limit is reached, the oldest closed session is automatically evicted. The active session MUST never be evicted. When a session is evicted, its linked saved practices MUST be released (become standalone and deletable from the load dialog).

### Key Entities

- **Session**: Represents a practice session block. Key attributes: unique identifier, name, creation date/time, status (active or closed), and an ordered collection of activities.
- **Activity**: Represents a single practice event within a session. Key attributes: unique identifier, activity type (initially only "score-practice"), creation date/time, snapshotted display metadata (score title, completion status), and a reference to the associated saved practice data.
- **Score Practice Activity**: A specialization of Activity for the "score-practice" type. Inherits core Activity attributes and adds a reference to the saved practice record (which contains score title, performance data, completion status).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start a new session and have a saved practice automatically linked to it within a single workflow, requiring no additional manual steps beyond what they do today.
- **SC-002**: Users can view all their sessions and drill into any session's activities within 2 taps from the Sessions plugin view.
- **SC-003**: Users can re-load a previous practice from a session activity using the same familiar flow as the existing load dialog.
- **SC-004**: Session data persists reliably across app restarts with no data loss.
- **SC-005**: The Sessions plugin view loads and renders the session list within 1 second, even with 50+ sessions.
- **SC-006**: The active session is immediately identifiable in the list without reading text labels (via visual distinction).
- **SC-007**: Users who create and use sessions report that the feature helps them organize their practice history (qualitative validation).

## Assumptions

- The existing saved practice storage remains the source of truth for practice data. The sessions plugin references saved practices by identifier rather than duplicating data.
- The sessions plugin is a frontend-only feature; no backend changes are required for this iteration.
- Only one activity type ("score-practice") is supported in this iteration. The data model supports extensibility to additional activity types in the future, but no other types are implemented now.
- The sessions plugin does not replace or modify the existing practice plugin — it adds an organizational layer on top of it.
- Communication between the practice plugin and the sessions plugin happens through a Plugin API event/hook mechanism, not through direct coupling or storage polling. The Plugin API may need to be extended to support a practice-saved notification.
- Practice saves performed before the sessions plugin is installed/available are not retroactively assigned to sessions.

