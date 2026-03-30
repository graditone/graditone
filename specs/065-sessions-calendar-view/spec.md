# Feature Specification: Sessions Calendar View

**Feature Branch**: `065-sessions-calendar-view`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "Sessions Calendar view: Show in a calendar the number of activities done each day and the total time. Click on calendar day data to show an overlay window with activity details. Support week, month, year grouping for different time period reports."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monthly Calendar Overview (Priority: P1)

A musician opens the Sessions Calendar view and sees a monthly calendar grid. Each day cell that has recorded practice activities displays a summary badge showing the number of activities completed and the total practice time for that day. Days without activity appear empty. The user can quickly scan the month to understand their practice consistency and identify gaps.

**Why this priority**: The monthly calendar is the core visual representation that delivers immediate value — users can see their practice habits at a glance without navigating away or clicking anything.

**Independent Test**: Can be fully tested by creating sessions with activities on several dates, opening the calendar view, and verifying that each day cell shows the correct activity count and total time.

**Acceptance Scenarios**:

1. **Given** the user has completed 3 activities totaling 45 minutes on March 15, **When** they open the Sessions Calendar in month view for March, **Then** the cell for March 15 displays "3 activities · 45 min".
2. **Given** the user has no recorded activities on March 10, **When** they view the month calendar, **Then** the cell for March 10 appears empty (no badge or summary).
3. **Given** the user opens the calendar for the first time with no session data, **When** the month view loads, **Then** the current month is displayed with all day cells empty and a message indicating no practice data is available.
4. **Given** the user is viewing March 2026, **When** they navigate to a previous or next month, **Then** the calendar updates to show the selected month with the correct daily summaries.
5. **Given** the user is viewing March 2026 with activities across several days, **When** the month view loads, **Then** a period summary line at the top shows the total activities and total time for the entire month.

---

### User Story 2 - Day Detail Overlay (Priority: P2)

A musician sees an interesting day on the calendar (e.g., a day with many activities) and clicks on that day's cell to learn more. An overlay window appears showing the full list of activities for that day, including for each activity: the score title, practice name, practice score (0–100), note accuracy (correct/total), practice duration, and completion status. The user can close the overlay to return to the calendar.

**Why this priority**: The day detail overlay transforms the calendar from a read-only summary into an interactive exploration tool, letting users review their practice history in depth for any specific day.

**Independent Test**: Can be fully tested by clicking on a day cell that has activities and verifying the overlay displays correct, complete activity details.

**Acceptance Scenarios**:

1. **Given** the user is viewing the month calendar and March 15 has 3 activities, **When** they click on the March 15 cell, **Then** an overlay window appears listing all 3 activities with score title, practice name, practice score, note accuracy, duration, and completion status for each.
2. **Given** the day detail overlay is open, **When** the user clicks the close button or clicks outside the overlay, **Then** the overlay closes and the calendar view is visible again.
3. **Given** the user clicks on a day with no activities, **Then** no overlay is shown (or the click has no effect).
4. **Given** an activity is linked to a session task, **When** the overlay is displayed, **Then** the task name is shown alongside the activity details.

---

### User Story 3 - Week Grouping View (Priority: P3)

A musician wants a more granular view of their recent practice. They switch to the week view, which shows the 7 days of the current week as columns. Each day column shows the activity count and total time, similar to the month view cells. The user can navigate to previous or next weeks.

**Why this priority**: Week view provides a focused short-term perspective that complements the monthly overview, ideal for tracking weekly goals or recent activity.

**Independent Test**: Can be fully tested by switching to week view and verifying the 7-day columns display correct summaries and navigation works.

**Acceptance Scenarios**:

1. **Given** the user switches to week view, **When** the view loads, **Then** the current week (Monday–Sunday) is displayed with each day showing activity count and total time, plus a period summary line at the top for the week total.
2. **Given** the user is in week view, **When** they navigate to the previous week, **Then** the displayed week shifts back 7 days with updated summaries.
3. **Given** the user clicks on a day in week view, **When** that day has activities, **Then** the same day detail overlay opens as in month view.

---

### User Story 4 - Year Grouping View (Priority: P4)

A musician wants to see their long-term practice patterns over an entire year. They switch to the year view, which displays all 12 months in a grid. Each month cell shows the total number of activities and total practice time for that month. Clicking on a month cell navigates the user to the month view for that specific month.

**Why this priority**: Year view enables long-term pattern recognition and motivation tracking, but depends on users having accumulated enough data to be meaningful.

**Independent Test**: Can be fully tested by switching to year view and verifying each month cell shows correct aggregated totals, and clicking a month navigates to month view.

**Acceptance Scenarios**:

1. **Given** the user switches to year view for 2026, **When** the view loads, **Then** all 12 months are displayed, each showing total activity count and total time for that month, plus a period summary line at the top for the year total.
2. **Given** the user clicks on a month cell in year view, **When** that month has activities, **Then** the calendar switches to month view for that specific month.
3. **Given** the user is in year view, **When** they navigate to the previous or next year, **Then** the year updates with correct aggregated data.

---

### Edge Cases

- What happens when sessions span midnight (an activity started before midnight and ended after)? The activity is attributed to the day of its `createdAt` timestamp (set at practice completion time).
- What happens when the user has sessions but all activities have zero duration? The day cell shows the activity count with "< 1 min" for the time (consistent with the formatDuration rule for durations under 60 seconds).
- What happens when the user deletes a session that had activities? The calendar recalculates and no longer shows those activities for the affected days.
- How does the calendar handle different time zones? The calendar uses the user's local time zone for all date grouping.
- What happens when the user has a very large number of activities on one day (e.g., 50+)? The day detail overlay should be scrollable to accommodate long activity lists.

## Clarifications

### Session 2026-03-30

- Q: How should the calendar determine which day an activity belongs to? → A: Use the existing `createdAt` field on SessionActivity, which is already set at practice completion time (when `PracticeSavedEvent` fires). No new field or backfill needed.
- Q: How should the user access the calendar view within the Sessions plugin? → A: A tab/toggle at the top of the Sessions panel switching between "Sessions" list and "Calendar" view.
- Q: When should the calendar load and aggregate session activity data? → A: Load all sessions once when Calendar tab is activated; keep aggregated data in memory while tab is open.
- Q: Should the day detail overlay include a summary header with day-level aggregates? → A: Yes — summary header with total activities, total time, and average practice score.
- Q: Should each view (week/month/year) display a total summary for the visible time period? → A: Yes — a period summary line (total activities + total time) displayed at the top of each view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a calendar view accessible via a tab/toggle at the top of the Sessions plugin panel, alongside the existing Sessions list view. The calendar shows practice activity data aggregated by day.
- **FR-002**: Each day cell in the calendar MUST display the total number of activities completed and the total practice time for that day.
- **FR-003**: Users MUST be able to switch between week, month, and year grouping views using a view selector control.
- **FR-004**: The month view MUST display a standard calendar grid (rows of weeks, columns for days Monday–Sunday) for the selected month.
- **FR-005**: The week view MUST display 7 day columns (Monday–Sunday) for the selected week.
- **FR-006**: The year view MUST display all 12 months for the selected year, each showing aggregated activity count and total time.
- **FR-007**: Users MUST be able to navigate forward and backward in time (previous/next week, month, or year depending on the active view).
- **FR-008**: When a user clicks on a day cell that has activities (in week or month view), the system MUST display an overlay window with the detailed list of activities for that day.
- **FR-009**: The day detail overlay MUST display a summary header at the top showing total activities, total practice time, and average practice score for that day. Below the header, it MUST list each activity with: score title, practice name, practice score (0–100), note accuracy (correct notes / total notes), practice duration, completion status, and task name (when the activity is linked to a session task).
- **FR-010**: The day detail overlay MUST be dismissible by clicking a close button or clicking outside the overlay area.
- **FR-011**: When a user clicks on a month cell in year view, the system MUST navigate to the month view for that specific month.
- **FR-012**: The calendar MUST aggregate activity data from all sessions stored in the sessions index, reading activity details from persisted session data. All session data is loaded once when the Calendar tab is activated and kept in memory while the tab remains open.
- **FR-013**: The calendar MUST default to the month view showing the current month when first opened.
- **FR-014**: Practice time MUST be displayed in a human-readable format (e.g., "1h 23min" for durations over an hour, "45 min" for shorter durations).
- **FR-015**: The day detail overlay MUST be scrollable when the number of activities exceeds the visible area.
- **FR-016**: Days without any activities MUST appear visually distinct from days with activities (no badge, no summary text).
- **FR-017**: Each view (week, month, year) MUST display a period summary line at the top showing the total number of activities and total practice time for the currently visible time period.

### Key Entities

- **DaySummary**: Represents the aggregated data for a single calendar day — includes the date, total activity count, and total practice time. Derived by grouping all SessionActivity records by their completion date.
- **ActivityDetail**: Represents a single practice activity displayed in the day overlay — includes score title, practice name, practice score, note accuracy, duration, completion status, and optional task linkage. Maps directly to the existing SessionActivity data. Each activity is attributed to the calendar day based on its `createdAt` timestamp.
- **CalendarView**: Represents the current view state — includes the active grouping mode (week/month/year), the selected time period, and the navigation position.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify which days they practiced and how much time they spent within 5 seconds of opening the calendar view.
- **SC-002**: Users can access the full activity details for any specific day within 2 clicks (one to open calendar, one to click the day).
- **SC-003**: Users can switch between week, month, and year views within 1 click using the view selector.
- **SC-004**: The calendar correctly aggregates and displays data from all stored sessions (up to the 50-session storage cap) without data loss or miscounting.
- **SC-005**: Users can navigate to any past time period to review historical practice data with no more than one click per period shift.
- **SC-006**: The day detail overlay displays all activity fields (score title, practice name, score, accuracy, duration, status) for 100% of activities on the selected day.

## Assumptions

- The calendar reads from existing session and activity data — no changes to the session data model are required.
- Each SessionActivity's existing `createdAt` field (set at practice completion time) is used for calendar date grouping. The user's local time zone is used for date grouping.
- The calendar view is accessed via a tab/toggle at the top of the Sessions plugin panel (switching between "Sessions" and "Calendar"), not as a separate top-level view.
- Week starts on Monday (ISO 8601 standard).
- The calendar is read-only — it does not allow creating, editing, or deleting sessions or activities.

