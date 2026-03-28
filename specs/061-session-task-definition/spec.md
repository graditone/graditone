# Feature Specification: Tasks-Based Session Definition

**Feature Branch**: `061-session-task-definition`  
**Created**: 2025-03-28  
**Status**: Implemented  
**Completed**: 2026-03-28  
**Input**: User description: "Tasks based Session definition — When you create a new session you need to define the tasks for it."

## Clarifications

### Session 2026-03-28

- Q: When a task reaches "done" or "failed", can the user still practice it again via the task link? → A: "Done" is terminal (practice link disabled); "failed" allows retry (resets to "in-progress", iteration count resets).
- Q: Which score catalog(s) should be available for selection in a task? → A: Both preloaded and user-uploaded scores, using the same score picker as the Load dialog in the Play view plugin.
- Q: What default values should a new empty task row have (no inheritance)? → A: Score blank (must be selected); Region "all"; Hands "both"; Iterations 3; Tempo 100% (score's base tempo); Min result 70%.
- Q: Should the user be required to practice tasks in the defined order, or freely? → A: Free order — all non-terminal tasks can be practiced in any order.
- Q: Can the user edit the task list after the session is created? → A: No — the task list is locked at creation. To change tasks, close the session and create a new one (inheriting via FR-006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Define Tasks When Creating a Session (Priority: P1)

A musician wants to plan a structured practice session by defining a list of tasks upfront. When creating a new session, the user sees a task-builder interface where they can add one or more tasks. Each task specifies a score, a region (all measures or a specific range), which hand(s) to practice, the number of iterations, a tempo, and the minimum result required to consider the task completed. The user submits the session and it becomes active with all tasks in a "todo" state.

**Why this priority**: This is the core value of the feature — without task definition there is no task-based session. It converts sessions from passive activity collectors into planned practice roadmaps.

**Independent Test**: Can be fully tested by creating a session with multiple tasks, verifying that all tasks appear in the session with the correct configuration, and that each task starts in the "todo" status.

**Acceptance Scenarios**:

1. **Given** the user is on the sessions view with no active session, **When** they tap "New Session", **Then** a task-builder form appears with one empty task row (score blank, region "all", hands "both", iterations 3, tempo 100%, min result 70%) and an "Add Task" button.
2. **Given** the task-builder is open, **When** the user fills in Score, Region (all), Hands (Right), Iterations (5), Tempo (80%), Min Result (70%), **Then** the task configuration is accepted and shown in the task list.
3. **Given** the user has defined two tasks, **When** they tap "Create Session", **Then** a new active session is created containing both tasks, each with status "todo".
4. **Given** the user defines a task with region "Measures 5–12", **When** they submit the session, **Then** the task stores the start measure (5) and end measure (12) boundaries.
5. **Given** the user leaves a required field empty (e.g., no score selected), **When** they attempt to create the session, **Then** a validation message highlights the missing field and prevents creation.

---

### User Story 2 — Inherit Task Structure from Previous Session (Priority: P2)

A musician often practices the same set of tasks across multiple sessions, tweaking parameters as they improve. When creating a new session, the task list is pre-populated with the task definitions from the most recently created session. The user can then modify, remove, or add tasks before confirming the new session.

**Why this priority**: Reduces the effort of re-entering repetitive configurations, which is critical for daily practice routines and directly supports session-over-session progression.

**Independent Test**: Can be tested by creating a session with specific tasks, closing it, starting a new session, and verifying the task-builder is pre-populated with the previous session's task definitions.

**Acceptance Scenarios**:

1. **Given** a closed session exists with three tasks, **When** the user taps "New Session", **Then** the task-builder is pre-populated with the same three task definitions (score, region, hands, iterations, tempo, min result) from the most recent session.
2. **Given** the inherited tasks are displayed, **When** the user changes the tempo on one task and removes another, **Then** the new session is created with the modified task list (two tasks, one with the updated tempo).
3. **Given** no previous session exists, **When** the user taps "New Session", **Then** the task-builder shows a single empty task row (no inheritance).

---

### User Story 3 — Launch Task Practice from Active Session (Priority: P1)

With an active session containing defined tasks, the musician taps a "Practice" link on a specific task. This opens the practice view pre-configured with the task's settings (score, region, hands, tempo, iterations). When the practice is completed and saved, the resulting saved practice is linked back to both the session (as an activity) and the originating task.

**Why this priority**: This connects the task definition to actual practice execution — without it, task definitions have no way to be fulfilled. It is equally critical as task creation.

**Independent Test**: Can be tested by creating a session with a task, tapping the practice link, completing a practice, and verifying the saved practice appears both in the session's activities and is linked to the specific task.

**Acceptance Scenarios**:

1. **Given** an active session with a task (Score: Fur Elise, Region: Measures 1–8, Hand: Right, Tempo: 60 BPM, Iterations: 3), **When** the user taps the "Practice" link on that task, **Then** the practice view opens with the score loaded, the loop region set to measures 1–8, staff set to right hand, tempo multiplier matching 60 BPM, and loop count set to 3.
2. **Given** the practice view was opened from a task, **When** the user completes and saves the practice, **Then** a `SessionActivity` is created referencing the saved practice ID, and the activity is also linked to the originating task.
3. **Given** a task has a "Practice" link, **When** no active session exists (session was closed meanwhile), **Then** the practice link is disabled or hidden with a message indicating the session is no longer active.

---

### User Story 4 — Track Task Status Based on Practice Results (Priority: P2)

After practicing a task, its status updates automatically based on the practice results and the task's "min result to complete" threshold. A task starts as "todo", moves to "in-progress" once a practice is linked, and becomes "done" if any linked practice meets or exceeds the minimum result. If all iterations are completed but the minimum result was never met, the task is marked "failed".

**Why this priority**: Automated status tracking gives the musician clear visibility into their session progress without manual bookkeeping.

**Independent Test**: Can be tested by creating a session with a task requiring 70% minimum, completing practices with varying scores, and verifying the task status transitions correctly.

**Acceptance Scenarios**:

1. **Given** a task with status "todo", **When** a practice is saved and linked to it, **Then** the task status changes to "in-progress".
2. **Given** a task with min result 70% and 3 iterations, **When** a linked practice achieves 75%, **Then** the task status changes to "done".
3. **Given** a task with min result 80% and 2 iterations, **When** two linked practices score 65% and 70%, **Then** the task status changes to "failed" (all iterations used, threshold never met).
4. **Given** a task with status "done", **When** the user views the session, **Then** the task shows a visual indicator (e.g., checkmark), the achieving practice score, and the practice link is disabled.
5. **Given** a task with status "failed", **When** the user taps the "Practice" link, **Then** the task resets to "in-progress" with the iteration count reset, allowing a fresh retry round.

---

### User Story 5 — View Session Progress Overview (Priority: P3)

The musician views an active or closed session and sees a summary of all tasks with their statuses, linked practices, and overall session progress (e.g., "3 of 5 tasks completed").

**Why this priority**: Provides the progress overview that makes task-based sessions meaningful for tracking improvement over time.

**Independent Test**: Can be tested by creating a session with tasks in mixed statuses and verifying the summary counts and task details display correctly.

**Acceptance Scenarios**:

1. **Given** a session with 5 tasks (2 done, 1 in-progress, 1 failed, 1 todo), **When** the user views the session, **Then** a progress summary shows "2 of 5 tasks completed" and each task displays its status.
2. **Given** a task with status "done", **When** the user expands the task, **Then** the linked saved practices are listed with their scores and timestamps.
3. **Given** a closed session, **When** the user views it, **Then** all tasks are visible with their final statuses and no practice links are active.

---

### Edge Cases

- What happens when the user selects a measure range where the start measure is greater than the end measure? The system must reject the input and display a validation error.
- What happens when a score referenced by a task is deleted or no longer available? The task should show an "unavailable score" indicator and the practice link should be disabled.
- What happens when the user creates a session with zero tasks? The system must require at least one task before allowing session creation.
- What happens when a practice is saved but the active session was closed between opening the practice view and saving? The practice should still be saved (as a standalone practice), but the task linkage is skipped and the user is informed.
- What happens when the user tries to create a new session while one is already active? The system must enforce at-most-one-active-session (existing behavior) and prompt the user to close the current session first.
- What happens if the inherited previous session had tasks referencing scores that are no longer available? Those tasks should be included in the pre-populated list but marked with a warning so the user can replace the score or remove the task.
- What happens when a user retries a "failed" task? The task resets to "in-progress", its iteration count resets to zero, and a new round of practices begins. Previous practices from the failed round remain linked for history but do not count toward the new iteration limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to define one or more tasks when creating a new session.
- **FR-002**: Each task MUST include: score selection (from both preloaded and user-uploaded scores, using the same score picker as the Load dialog in the Play view plugin), region definition (all or measure range), hand selection (right/left/both), number of iterations, tempo multiplier (percentage of score base tempo, range 50%–200%), and minimum result percentage to complete.
- **FR-003**: System MUST validate that all required task fields are filled before allowing session creation.
- **FR-004**: System MUST validate that the start measure is less than or equal to the end measure when a measure range is specified.
- **FR-005**: System MUST require at least one task in a session.
- **FR-006**: When creating a new session, the system MUST pre-populate the task list with the task definitions from the most recently created session (if one exists).
- **FR-007**: Users MUST be able to modify, add, or remove inherited tasks before creating the session.
- **FR-008**: Each task in an active session MUST display a "Practice" link that opens the practice view pre-configured with the task's settings (score, region, hand, tempo, iterations).
- **FR-009**: The "Practice" link MUST only be available when the session is active.
- **FR-010**: When a practice is saved from a task's practice link, the resulting saved practice MUST be linked to both the session (as a `SessionActivity`) and the originating task.
- **FR-011**: Each task MUST have a status: "todo" (default), "in-progress" (at least one practice linked), "done" (a linked practice meets or exceeds the minimum result), or "failed" (all iterations used without meeting the minimum result). "Done" is terminal — the practice link is disabled. "Failed" allows retry: the task resets to "in-progress" with the iteration count reset when the user taps the practice link again.
- **FR-012**: Task status MUST update automatically when a linked practice is saved.
- **FR-013**: The session view MUST display a progress summary showing how many tasks are completed out of the total.
- **FR-014**: Users MUST be able to expand a task to see its linked practices with scores, timestamps, and completion status.
- **FR-015**: System MUST persist all task definitions and their linked practices across browser sessions (consistent with existing session storage approach).
- **FR-016**: Tasks referencing unavailable scores MUST show a visual warning and have their practice link disabled.
- **FR-017**: When adding a new empty task row (no inheritance), defaults MUST be: score blank (must be explicitly selected), region "all", hands "both", iterations 3, tempo 100% (score's base tempo), min result 70%.
- **FR-018**: Tasks within a session MUST be practicable in any order. All non-terminal tasks (status "todo", "in-progress", or "failed") display an active practice link simultaneously.
- **FR-019**: The task list MUST be immutable once the session is created. Users cannot add, remove, or reorder tasks in an active or closed session. To adjust tasks, the user closes the current session and creates a new one (which inherits via FR-006).

### Key Entities

- **SessionTask**: A planned practice activity within a session. Attributes: unique ID, score reference (preloaded or user-uploaded, same `ScoreRef` format used by the Play view), score title, region type (all or measure range), start measure, end measure, hand selection, number of iterations, tempo multiplier (ratio of score base tempo), minimum result threshold, status, and an ordered list of linked practice references.
- **Session** (extended): The existing session entity gains a new `tasks` collection. A session's activities continue to exist for backward compatibility, and new activities created via task practice links are also recorded in the task's linked practices.
- **SessionActivity** (extended): Gains an optional reference to the originating task ID, enabling the system to track which task a practice was performed for.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a task-based session with up to 10 tasks in under 2 minutes.
- **SC-002**: 90% of users who create a session via task inheritance make no more than 2 modifications before confirming, indicating the inherited defaults are useful.
- **SC-003**: Users can launch a practice from a task link and return to the session view with the practice linked in under 10 seconds of navigation time.
- **SC-004**: Task status transitions (todo → in-progress → done/failed) occur within 1 second of a practice being saved.
- **SC-005**: Session progress summary accurately reflects task statuses 100% of the time.
- **SC-006**: All task-based session data persists correctly across page reloads with zero data loss.

## Assumptions

- The existing at-most-one-active-session constraint remains in place. Task-based sessions do not change this model.
- Tempo is stored as a `tempoMultiplier` ratio (0.5–2.0, representing 50%–200% of the score's base tempo). The task builder UI displays this as a percentage slider. When a score is selected, the UI may additionally show the resulting BPM as `baseBPM × multiplier` for reference.
- "Minimum result" is a percentage (0–100) compared against the practice score (correct notes / total notes × 100).
- Measure numbers use the 1-based numbering visible to the user in the score. The system internally maps these to the corresponding tick positions when configuring the practice loop region.
- The maximum number of tasks per session is not explicitly capped, but the UI is optimized for up to 10 tasks. Performance with more tasks is not a priority.
- Backward compatibility: existing sessions created before this feature (with no tasks) continue to work. They display as sessions without a task section, and their activities remain accessible.
- The task list is immutable after session creation. This keeps the data model simple and avoids complex edge cases (e.g., removing a task with linked practices). Inheritance (FR-006) provides the escape hatch for adjustments.

