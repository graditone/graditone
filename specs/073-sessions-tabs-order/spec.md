# Feature Specification: Sessions Plugin Tabs Reorder

**Feature Branch**: `073-sessions-tabs-order`  
**Worktree**: `../worktrees/073-sessions-tabs-order`  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: User description: "change sessions plugin tabs order to goals, calendar, sessions"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tabs Display in Correct Order (Priority: P1)

A user opens the Sessions plugin and sees the tabs displayed in the order: Goals, Calendar, Sessions — from left to right.

**Why this priority**: This is the entire scope of the feature — the correct tab ordering is the single deliverable.

**Independent Test**: Open the Sessions plugin and verify the tabs appear left-to-right as Goals, Calendar, Sessions.

**Acceptance Scenarios**:

1. **Given** the Sessions plugin is open, **When** the user views the tab bar, **Then** the tabs appear in the order: Goals (first), Calendar (second), Sessions (third).
2. **Given** the Sessions plugin is open, **When** the user clicks each tab, **Then** each tab activates its corresponding view with no errors or broken behaviour.
3. **Given** the user has previously used the Sessions plugin, **When** they reopen it, **Then** the tab bar still shows Goals, Calendar, Sessions in that order.

---

### Edge Cases

- If a future tab is added to the plugin, the new tab order definition (Goals, Calendar, Sessions) should remain stable as the baseline — any new tab is appended after Sessions unless explicitly specified.
- If a tab is conditionally hidden, the remaining visible tabs must preserve the relative order Goals → Calendar → Sessions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sessions plugin tab bar MUST display tabs in the following order (left to right): Goals, Calendar, Sessions.
- **FR-002**: Each tab MUST remain fully functional after the reorder — clicking any tab must activate its corresponding view with no broken behaviour.
- **FR-003**: No other aspect of the Sessions plugin (tab labels, tab icons, tab content, navigation logic) MUST change as a result of this reorder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Sessions plugin tab bar shows exactly the three tabs — Goals, Calendar, Sessions — in that left-to-right order, with no regressions in tab functionality.
- **SC-002**: All existing automated tests for the Sessions plugin pass without modification after the reorder.

