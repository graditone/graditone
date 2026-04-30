# Feature Specification: Fix Rescheduling Bugs (087 Follow-up)

**Feature Branch**: `090-fix-rescheduling-bugs`  
**Created**: 2026-04-30  
**Status**: Draft  
**Related**: [087-sessions-rescheduling](../087-sessions-rescheduling/spec.md)  
**Input**: User description: "reopen 087-sessions-rescheduling to fix bugs detected"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Past-Session Detection on View Open (Priority: P1)

When the user opens the Sessions view, every session whose scheduled date is in the past — regardless of how far back, or which position they occupy in the list — is detected and included in the rescheduling offer. No past-dated pending session is silently skipped.

**Why this priority**: Incomplete detection is a data-correctness bug. Users who accept auto-reschedule expect a clean slate; leaving orphaned past sessions undermines trust and defeats the feature's purpose.

**Independent Test**: Can be fully tested by creating several past sessions at varying distances in the past (e.g., yesterday, last week, last month) across both goal-linked and isolated types, opening the Sessions view, and verifying the dialog count matches the total number of past sessions — no omissions.

**Acceptance Scenarios**:

1. **Given** the user has 5 past-dated sessions spanning different dates, **When** they open the Sessions view, **Then** the dialog summary reflects all 5 sessions, not a subset.
2. **Given** past sessions exist both early and late in the session list, **When** the Sessions view opens, **Then** all of them — regardless of list order — are included in the detection sweep.
3. **Given** the user accepts auto-reschedule, **When** the operation completes, **Then** zero sessions remain with a past scheduled date.
4. **Given** the user dismisses the dialog without accepting, **When** they reopen the Sessions view in a new app session, **Then** the dialog reappears with the same (still-past) sessions included.

---

### User Story 2 - Correctly Themed and Informative Rescheduling Dialog (Priority: P2)

The auto-reschedule dialog uses the same visual language (colors, typography, spacing, component style) as all other dialogs in the app. The information it displays is accurate and matches the actual set of sessions that will be rescheduled.

**Why this priority**: A mismatched or misleading dialog erodes user confidence. Correct theming ensures the dialog feels native to the app; correct information ensures the user can make an informed decision.

**Independent Test**: Can be fully tested visually by opening the Sessions view with past sessions present and comparing the dialog's appearance against other dialogs in the app, then verifying that the session count and type breakdown displayed match the actual past sessions in the data.

**Acceptance Scenarios**:

1. **Given** the rescheduling dialog appears, **When** the user views it, **Then** it uses the app's established color scheme, typography, and component patterns (consistent with other dialogs).
2. **Given** the rescheduling dialog appears in dark mode, **When** the user views it, **Then** it correctly renders in dark mode without mismatched colors or contrast issues.
3. **Given** the dialog shows a session summary, **When** the user reads it, **Then** the count and breakdown (goal-linked vs. isolated) exactly matches the sessions that will actually be rescheduled.
4. **Given** the dialog summary says "2 goal-linked, 1 isolated", **When** the user accepts, **Then** exactly those sessions (and no others) are rescheduled.

---

### Edge Cases

- What if a past session has a status that should exclude it (Completed, Skipped)? It must not appear in the count — only pending sessions are included.
- What if the same goal has multiple past sessions? They should be counted individually in the summary but rescheduled together as one goal unit.
- What if the dialog summary count and the actual rescheduled count diverge (e.g., due to a race condition)? The rescheduled count takes precedence; no ghost sessions should remain past-dated after acceptance.

## Requirements *(mandatory)*

### Functional Requirements

**Bug Fix 1 — Incomplete past-session detection**

- **FR-001**: The past-session detection sweep MUST include every session in the user's session store whose scheduled date is strictly before today, regardless of list position or order.
- **FR-002**: Only sessions with a pending status (not Completed, not Skipped) MUST be included in the detection and rescheduling set.
- **FR-003**: After auto-rescheduling is accepted, zero pending sessions MUST remain with a past scheduled date.
- **FR-004**: The dialog summary count MUST equal the number of sessions that will actually be rescheduled — no undercounting or overcounting.

**Bug Fix 2 — Wrong theme, design and info in dialog**

- **FR-005**: The rescheduling dialog MUST use the same component design, color tokens, and typography as all other confirmation dialogs in the app.
- **FR-006**: The rescheduling dialog MUST correctly adapt to the active theme (light/dark) without mismatched background, text, or accent colors.
- **FR-007**: The information displayed in the dialog MUST accurately reflect the sessions that will be rescheduled, including a correct count and a breakdown by session type (goal-linked vs. isolated).
- **FR-008**: The dialog call-to-action labels and descriptive text MUST be consistent with the vocabulary used elsewhere in the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After accepting auto-reschedule, 0 pending sessions remain with a past scheduled date — 100% detection and rescheduling coverage.
- **SC-002**: The session count shown in the dialog matches the actual number rescheduled in 100% of scenarios tested.
- **SC-003**: The rescheduling dialog is visually indistinguishable in style from other app dialogs — passes a visual consistency review with no design deviations.
- **SC-004**: The dialog renders correctly in both light and dark themes with no color or contrast defects.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Rescheduling Dialog — Wrong Theme, Design, and Info

**Discovered**: 2026-04-30 during production usage

**Symptom**: The auto-reschedule dialog that appears when opening the Sessions view with past sessions present does not match the app's visual design. Colors, typography, and layout deviate from the established dialog style. Additionally, the information displayed (session count/breakdown) is inaccurate — it does not correctly reflect which sessions will be rescheduled.

**Root Cause**: To be determined during implementation investigation.

**Affected Components**: Rescheduling confirmation dialog (Sessions view), dialog summary data computation.

**Regression Test**: To be created during fix implementation — should verify dialog renders with correct theme tokens and that the summary counts match actual past-session data.

---

### Issue #2: Incomplete Past-Session Detection

**Discovered**: 2026-04-30 during production usage

**Symptom**: When the Sessions view opens and auto-reschedule is triggered, not all past-dated pending sessions are included. Some sessions are silently omitted from the detection sweep, leaving past sessions un-rescheduled even after the user accepts.

**Root Cause**: To be determined during implementation investigation — likely a filtering condition or list-traversal boundary that excludes some sessions.

**Affected Components**: Past-session detection logic (Sessions view on-open hook), rescheduling orchestration.

**Regression Test**: To be created during fix implementation — should assert that a known set of N past sessions all appear in the detected set and are rescheduled after acceptance.

