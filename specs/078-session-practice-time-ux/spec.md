# Feature Specification: Session & Practice Goal Execution UX Improvements

**Feature Branch**: `078-session-practice-time-ux`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "Improve Sessions and Practice plugins with goal execution experience — In every task, sum the activity time already invested and put it along the estimated time for an easy compare — Once we finish a Session, show the diff between the real time and the estimated time — Block that if you are practising inside a task, change the loops in Repractice from the Practice Results overlay"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Task-Level Time Progress: Invested vs. Estimated (Priority: P1)

A musician is working through an active session with several tasks. Each task row in the session view shows both the estimated practice time (calculated when the session was generated) and the time already invested in that task (the sum of durations from all linked practices so far). Without navigating away, the musician can quickly see at a glance whether they are on track for any given task.

**Why this priority**: This is the most visible and immediately useful change. It provides task-level feedback during an active session and builds trust in the time estimates. It requires no interaction change — only an additional display element.

**Independent Test**: Can be fully tested by creating a session with tasks that have an estimated duration, completing one or more partial practices against a task, and verifying that the task row shows both values — e.g., "Invested: 4 min / Estimated: 8 min" — and that the invested time updates after each practice is saved.

**Acceptance Scenarios**:

1. **Given** an active session with tasks that have estimated practice durations, **When** the user views the task list, **Then** each task displays both its estimated duration and the total invested time (sum of all linked practice durations for that task) in a clear side-by-side format (e.g., "4 min / 8 min").
2. **Given** a task that has not yet been practiced at all, **When** the user views it, **Then** the invested time shows zero (e.g., "0 min / 8 min") rather than being absent or blank.
3. **Given** a task that has two linked practices totalling 6 minutes, **When** the user views the task row, **Then** the invested time reflects the combined duration (6 min), not just the most recent practice.
4. **Given** the user completes and saves a practice linked to a task, **When** they return to the session view, **Then** the task's invested time updates to include the just-completed practice duration.
5. **Given** a task without an estimated duration (e.g., a manually defined task with no auto-estimate), **When** the invested time is non-zero, **Then** the display shows the invested time alone without showing a misleading estimated value.

---

### User Story 2 — Session Completion Summary: Real vs. Estimated Time (Priority: P2)

After the musician completes all tasks in a session (all tasks reach a terminal status: done or failed), a session completion summary is shown. The summary includes the total real time spent in the session (sum of all practice durations across all tasks) and the total estimated time (sum of all task estimates), with the difference highlighted. This helps the musician understand how their actual practice pace compares to the plan.

**Why this priority**: Closing the feedback loop at session level is the next step after task-level visibility. It gives the learner a reflection point and helps build realistic expectations in future sessions.

**Independent Test**: Can be fully tested by creating a session with two or more tasks, completing practices for all of them so all tasks reach a terminal status, closing the session, and verifying the summary shows total real time, total estimated time, and the delta (e.g., "+5 min over estimate" or "−2 min under estimate").

**Acceptance Scenarios**:

1. **Given** all tasks in a session have reached a terminal status (done or failed), **When** the user triggers session close or the session auto-closes, **Then** a summary screen or panel is shown with: total real practice time, total estimated time, and the difference between the two (delta).
2. **Given** the real time exceeds the estimated time, **When** the summary is displayed, **Then** the delta is shown as a positive overrun and visually styled to draw attention (e.g., warning colour).
3. **Given** the real time is less than the estimated time, **When** the summary is displayed, **Then** the delta is shown as a time saving and visually styled in a neutral or positive way.
4. **Given** one or more tasks have no estimated duration, **When** the session summary is computed, **Then** only tasks with estimates contribute to the total estimated time, and this partial-coverage is clearly indicated (e.g., "Estimated: 24 min (3 of 5 tasks)").
5. **Given** a session is already closed (viewed as history), **When** the user opens it, **Then** the real vs. estimated time comparison remains visible on the session detail view, not only immediately after closing.
6. **Given** the session duration summary is shown, **When** the values are displayed, **Then** times are shown to the nearest minute, with sub-minute precision noted only when the total is under 2 minutes.

---

### User Story 3 — Lock Loop Count During Task-Linked Practice (Priority: P1)

A musician opened the practice view from a session task that specifies 3 iterations. The task definition is the authoritative source for the loop count. After completing one round and landing on the Results overlay, the loop count slider is visible but non-editable (locked), preventing the musician from inadvertently changing the iteration count before hitting Repractice. The task-defined loop count is preserved across all repractice cycles within the same task practice session.

**Why this priority**: Allowing the musician to freely change loops mid-task undermines the task contract: the iterations were set when the goal was created and are used to compute the estimated time and the min-result threshold. Changing them silently corrupts task tracking. This ranks equally with the invested time display because it prevents data integrity issues.

**Independent Test**: Can be fully tested by launching the practice view from a session task, completing one iteration, reaching the Results overlay, and verifying that the loop count slider is displayed in a read-only or disabled state that cannot be changed — and that Repractice starts again with the task's original loop count.

**Acceptance Scenarios**:

1. **Given** the practice view was launched from a session task with a defined loop count, **When** the Results overlay is shown, **Then** the loop count slider is displayed in a disabled (non-interactive) state that cannot be changed by the user.
2. **Given** the practice view was launched from a session task, **When** the user inspects the loop count display in the Results overlay, **Then** the displayed value matches the loop count originally defined in the task.
3. **Given** the loop count control is locked during a task practice, **When** the user taps Repractice, **Then** the new practice round starts with exactly the same iteration count defined in the task.
4. **Given** the practice view was launched outside of any task context (standalone practice), **When** the Results overlay is shown, **Then** the loop count slider remains fully interactive as before (no regression to non-task flows).
5. **Given** the practice view was launched from a session task, **When** the Results overlay shows the disabled loop slider, **Then** a visual hint or tooltip indicates that the loop count is locked because it was defined by the session task.

---

### Edge Cases

- What if a task practice is started but the user exits the practice without saving — does the invested time update? (Expected: no, unsaved practices do not count.)
- What if a session contains tasks with a mix of estimated and non-estimated durations: how is the session completion summary clearly communicated without misleading the user?
- What if a user navigates away from the session completion summary before reading it — is it available later from the session history view?
- What if a practice launched from a task has a loop region that is cleared mid-practice — does the loop count lock still apply on the next Results overlay?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each task row in the session task list MUST display both the task's estimated practice duration and the total invested time (sum of all linked practice durations) simultaneously.
- **FR-002**: The invested time displayed per task MUST accumulate across all linked practices, not be limited to the most recent one.
- **FR-003**: Tasks with zero invested time MUST display a zero value (e.g., "0 min") rather than omitting the invested time field entirely.
- **FR-004**: Tasks that have no estimated duration MUST display only the invested time without showing a blank or zero estimated value that could mislead the user.
- **FR-005**: The invested time per task MUST update in the task list view after any new practice linked to that task is saved.
- **FR-006**: When a session transitions to a closed/completed state (all tasks in terminal status), a time comparison summary MUST be presented showing: total real practice time, total estimated time, and the signed delta between them.
- **FR-007**: The session completion summary MUST remain accessible from the closed session's detail view, not only at the moment of closing.
- **FR-008**: When one or more tasks in a session have no estimate, the session completion summary MUST still be shown, but MUST clearly indicate how many tasks contributed to the estimated total.
- **FR-009**: The session completion summary MUST visually differentiate a time overrun (real > estimated) from a time saving (real < estimated).
- **FR-010**: When the practice view is launched from a session task, the loop count control in the Results overlay MUST be disabled (non-interactive) for the duration of that task practice session.
- **FR-011**: The loop count value displayed in the disabled control MUST equal the loop count defined in the originating session task.
- **FR-012**: When Repractice is triggered from the Results overlay during a task-linked practice, the new round MUST use the loop count defined in the session task, regardless of any prior user-set value in the same overlay session.
- **FR-013**: When the practice view is launched outside of a task context, the loop count control in the Results overlay MUST remain fully interactive (no regression to standalone practice flows).
- **FR-014**: A visual hint (tooltip or inline label) MUST be shown alongside the locked loop count control indicating that the value is fixed by the session task.

### Key Entities

- **Session Task**: A practice assignment within a session. Gains a derived `investedTimeMs` value — the sum of `practiceTimeMs` across all linked practices for this task.
- **Task-Linked Practice**: A saved practice associated with both a session and a specific task. Provides the `practiceTimeMs` field used to compute the task's invested time.
- **Session Completion Summary**: A derived view — computed once all tasks reach terminal status — showing `totalRealTimeMs`, `totalEstimatedTimeMs`, `deltaMs`, and the count of tasks that contributed to the estimate total.
- **Results Overlay (task-locked mode)**: The practice results overlay rendered when practice was launched from a session task. Gains a context flag that disables loop count editing and preserves the task-defined iteration count across repractice cycles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can compare invested and estimated time for any task without leaving the session view — the information is visible at a glance in the task row without any extra navigation.
- **SC-002**: After closing a session, the total time comparison (real vs. estimated) is visible within 1 tap/navigation from the session list.
- **SC-003**: When practising a session task, 100% of attempts to change the loop count via the Results overlay loop slider are prevented — no practice can be saved with a loop count that differs from the originating task definition.
- **SC-004**: Standalone (non-task) practices experience no change in loop count behaviour — the lock introduces zero regressions for that flow.
- **SC-005**: Learners completing an Arabesque goal session report that time tracking requires no manual bookkeeping — all time values are derived automatically from saved practices.

## Assumptions

- Practice duration is already recorded on saved practices as a `practiceTimeMs` (or equivalent millisecond field). This feature reads that field; it does not introduce new timing capture logic.
- Estimated duration per task is already stored on the task definition (introduced in feature 061). This feature reads it; it does not change how estimates are computed or stored.
- "Session completion" is when all tasks reach a terminal status (done or failed), consistent with the task lifecycle defined in feature 061.
- The Results overlay already receives a `setLoopCount` prop controlled by the practice orchestrator. Locking requires adding a flag from the orchestrator indicating whether the current practice originated from a task.
- Invested time accumulates only from practices that were fully saved; abandoned (unsaved) practices do not contribute.

