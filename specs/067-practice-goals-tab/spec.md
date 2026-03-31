# Feature Specification: Practice Goals View Tab

**Feature Branch**: `067-practice-goals-tab`  
**Created**: 2026-03-31  
**Status**: Draft  
**Input**: User description: "Practice goals view tab in sessions plugin. A new tab must be added to the Sessions plugin to manage the piano practice goals for a user. Initially one goal is supported: learn to practice a score. Once the score is selected, the goal is created and also, all the related tasks for this goal. In the initial version, the goal is to learn to play the first phrase of a score. The tasks are predefined for this score goal: create 3 tasks — LH, RH, TH for the region related to the phrase. Number of repetitions: 10. Average min result to approve the task: 90%. 100% tempo. Once we have the 3 tasks related to the goal, we need to add them to sessions. In this first version, a new scheduled session is created for tomorrow including the 3 tasks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create a Practice Goal from a Score (Priority: P1)

A piano student opens the Sessions plugin and navigates to the new "Goals" tab. They select a score from the available preloaded or user scores. The system creates a new practice goal: "Learn to play the first phrase" of the selected score. Along with the goal, predefined tasks are automatically generated — one for the Left Hand (LH), one for the Right Hand (RH), and one for Together / Both Hands (TH) for multi-staff scores (or a single Both Hands task for single-staff scores) — covering the measure region of the first phrase. Each task requires 10 repetitions with a minimum average score of 90% to pass, at 100% tempo. A new scheduled session dated for tomorrow is automatically created containing these tasks.

**Why this priority**: This is the core feature — without the ability to create a goal and see the resulting tasks and session, no other functionality is meaningful.

**Independent Test**: Can be fully tested by selecting a score in the Goals tab, verifying the goal appears with its three tasks, and confirming a scheduled session for tomorrow is visible in the Sessions tab with those tasks.

**Acceptance Scenarios**:

1. **Given** the user is on the Sessions plugin, **When** they tap the "Goals" tab, **Then** the Goals view is displayed showing any existing goals and an option to create a new goal.
2. **Given** the user is on the Goals tab, **When** they tap "Create Goal" and select a score, **Then** a new goal titled "Learn first phrase — [Score Title]" is created.
3. **Given** a goal has been created for a multi-staff score, **When** the system processes the goal, **Then** three tasks are generated: LH (staffIndex 1), RH (staffIndex 0), and TH (staffIndex −1), each targeting the first phrase's measure range.
3b. **Given** a goal has been created for a single-staff score, **When** the system processes the goal, **Then** only one task is generated: TH (staffIndex −1), targeting the first phrase's measure range.
4. **Given** the tasks are generated, **When** the user inspects each task, **Then** each task has loopCount = 10, minResult = 90, and tempoMultiplier = 1.0.
5. **Given** the tasks have been generated, **When** the system finalises the goal creation, **Then** a new scheduled session with targetDate = tomorrow is created containing the three tasks.
6. **Given** the scheduled session has been created, **When** the user switches to the Sessions tab, **Then** the new session appears in the session list with status "scheduled" and targetDate of tomorrow.

---

### User Story 2 — View Practice Goals and Progress (Priority: P2)

A piano student opens the Goals tab to review their existing goals. They can see a list of all goals, each showing the associated score title, goal description, and a summary of task completion status (e.g., "1/3 tasks done"). Tapping a goal expands it to show the three individual tasks with their current status and linked practice results.

**Why this priority**: After creating goals, users need to view and track progress to stay motivated and understand where they stand.

**Independent Test**: Can be tested by creating a goal (P1), completing some task practices, then verifying the Goals tab displays updated task statuses and progress counts.

**Acceptance Scenarios**:

1. **Given** one or more goals exist, **When** the user opens the Goals tab, **Then** each goal is listed with its score title and a progress summary (e.g., "0/3 tasks done").
2. **Given** a goal is listed, **When** the user taps/expands it, **Then** the three tasks (LH, RH, TH) are shown with their current status (todo, in-progress, done, failed).
3. **Given** a task linked to a goal has been practiced and meets the 90% threshold, **When** the user views the goal, **Then** that task shows as "done" and the goal progress updates accordingly.

---

### User Story 3 — Goal Completion (Priority: P3)

When all three tasks associated with a goal reach "done" status, the goal itself is marked as completed. The user sees a visual indicator that the goal has been achieved.

**Why this priority**: Provides closure and a sense of accomplishment, but the core creation and tracking flows (P1, P2) must work first.

**Independent Test**: Can be tested by marking all three tasks as done (via practice) and verifying the goal status transitions to "completed".

**Acceptance Scenarios**:

1. **Given** a goal with 3 tasks, **When** all 3 tasks reach "done" status, **Then** the goal status transitions to "completed".
2. **Given** a goal is completed, **When** the user views the Goals tab, **Then** the completed goal is visually distinguished (e.g., checkmark, different styling) from in-progress goals.

---

### Edge Cases

- What happens when the user selects a score that has no identifiable first phrase? The system falls back to using the first 4 measures as the task region (or the full score if fewer than 4 measures exist).
- What happens when a goal already exists for the same score? The user is warned that a goal already exists for this score and asked to confirm creating a duplicate.
- What happens when the user creates a goal but tomorrow's date already has a scheduled session? A new separate session is created for tomorrow — multiple sessions for the same date are allowed.
- What happens when the user deletes a session that was auto-created by a goal? The goal retains its tasks but the session link is removed. The user can manually re-create a session from the goal's tasks.
- What happens when a score has only one staff (e.g., a melody-only lead sheet)? Only a single Both Hands (TH) task is created instead of the usual three (LH, RH, TH).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sessions plugin MUST display a "Goals" tab alongside the existing "Sessions" and "Calendar" tabs.
- **FR-002**: The Goals tab MUST provide a "Create Goal" action that lets the user select a score using the same score picker component already used in the TaskBuilder.
- **FR-003**: When a score is selected, the system MUST create a goal entity with type "learn-score-phrase" titled "Learn first phrase — [Score Title]".
- **FR-004**: The system MUST determine the first phrase's measure range from the selected score.
- **FR-005**: For scores with two or more staves, the system MUST auto-generate exactly 3 tasks for a new goal: Right Hand (staffIndex 0), Left Hand (staffIndex 1), and Both Hands (staffIndex −1), each targeting the first phrase's measure range. For single-staff scores, the system MUST generate only 1 task: Both Hands (staffIndex −1).
- **FR-006**: Each generated task MUST have loopCount = 10, minResult = 90, and tempoMultiplier = 1.0.
- **FR-007**: The system MUST create a new scheduled session with targetDate set to the day after creation, containing the generated tasks.
- **FR-008**: The Goals tab MUST display a list of all goals with their score title and task completion progress.
- **FR-009**: Each goal MUST be expandable to show its individual tasks and their statuses.
- **FR-010**: A goal's status MUST automatically transition to "completed" when all its tasks reach "done" status.
- **FR-011**: The system MUST warn the user when attempting to create a goal for a score that already has an existing goal.
- **FR-012**: When a score has no identifiable first phrase boundary, the system MUST fall back to using the first 4 measures as the task region (or the full score if fewer than 4 measures exist).
- **FR-013**: The Goals tab MUST allow the user to delete a goal. Deleting a goal MUST NOT delete the associated session or its tasks; they remain as independent entities.

### Key Entities

- **Goal**: Represents a practice objective for a specific score. Key attributes: unique identifier, score reference, goal type (initially only "learn-score-phrase"), title, status (active / completed), creation date, associated task identifiers, and associated session identifier. Goals can be deleted; deletion orphans the linked session and tasks (they remain accessible independently).
- **SessionTask** (existing): Individual practice task with score reference, measure region, staff index, loop count, tempo multiplier, minimum result threshold, and status. Tasks are linked to goals via a goal identifier.
- **Session** (existing): A practice session containing tasks. Extended with an optional goal reference to indicate it was auto-created from a goal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a practice goal from any available score in under 30 seconds (tap Goals tab → select score → goal + session created).
- **SC-002**: After goal creation, 100% of generated goals contain the correct number of tasks — 3 (LH, RH, TH) for multi-staff scores or 1 (TH) for single-staff scores — each with the correct parameters (10 repetitions, 90% threshold, 100% tempo).
- **SC-003**: A scheduled session for tomorrow is visible on the Sessions tab within 2 seconds of goal creation.
- **SC-004**: Goal progress accurately reflects task completion — when a task is marked "done", the goal's progress count updates immediately.
- **SC-005**: Goals that have all tasks completed are visually marked as completed with no manual intervention required.
- **SC-006**: Users can navigate between the Sessions, Calendar, and Goals tabs without data loss or visual glitches.

## Clarifications

### Session 2026-03-31

- Q: What is the default measure count for the "first phrase" when no explicit phrase boundary is found? → A: First 4 measures.
- Q: What happens when a user wants to remove an existing goal? → A: Goal can be deleted; associated session and tasks are kept (orphaned).
- Q: How should the score selection work when creating a goal? → A: Reuse the existing TaskBuilder score picker component.
- Q: How should the system handle scores that have only one staff (no separate LH/RH)? → A: Create only 1 task (Both Hands / TH) for single-staff scores.
- Q: Should the generated tasks enforce a specific practice order? → A: No enforced order; tasks can be practiced in any sequence.

## Assumptions

- The concept of "first phrase" is determined by the score's structure. For scores parsed from MusicXML, the first phrase is assumed to correspond to the first musical phrase boundary (e.g., first breath mark or fermata). If no explicit boundary exists, the default is the first 4 measures.
- Only one goal type is supported in this version: "learn-score-phrase". Future goal types (e.g., "master-dynamics", "improve-tempo") are out of scope.
- The 100% tempo multiplier is stored but does not currently affect the practice result calculation. This is by design for this version.
- The Sessions plugin already supports tabs (Sessions, Calendar). Adding a third tab ("Goals") follows the same tab navigation pattern.
- Goal data is persisted using the same storage mechanism as sessions (IndexedDB via sessionStorage).
- Tasks within a goal-generated session have no enforced practice order. The student may complete LH, RH, and TH tasks in any sequence.
- When a session auto-created by a goal is deleted externally, the `goal.sessionId` may become stale. The UI handles this gracefully: if the referenced session is not found, the goal renders without a session link. No active cleanup is performed.

