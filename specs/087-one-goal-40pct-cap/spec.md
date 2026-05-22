# Feature Specification: One-Goal 40% Session Time Cap

**Feature Branch**: `087-one-goal-40pct-cap`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "one goal tasks can only fill 40% of session time"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Balanced Session from Multiple Goals (Priority: P1)

A student is actively working on three different goals: learning Für Elise phrase 1, the Canon in D intro, and a warm-up C-major scale routine. When the system auto-generates the next practice session, the tasks are distributed so that no single goal consumes more than 40% of the session's total estimated practice time. The student sees a well-balanced session that touches all three goals without any single piece dominating the practice.

**Why this priority**: This is the core rule being introduced. Without it, goals with many dense tasks (e.g., a long multi-phrase piece) silently crowd out other goals in shared sessions, undermining balanced practice. It is the entire premise of this feature and delivers value on its own.

**Independent Test**: Can be fully tested by creating 3 or more active goals with different task volumes, triggering session generation, and verifying that the tasks of each individual goal do not account for more than 40% of the session's total estimated duration. All three goals should appear in the session.

**Acceptance Scenarios**:

1. **Given** three active goals whose combined estimated task time exceeds the session's available time, **When** the system generates the next session, **Then** no single goal's tasks account for more than 40% of the session's total estimated practice time.
2. **Given** a dominant goal whose tasks alone exceed 40% of available session time, **When** session tasks are selected, **Then** that goal contributes at most 40% worth of tasks and the remaining session time is filled by tasks from other goals.
3. **Given** a goal that contributes exactly 40% of session time, **When** the session is generated, **Then** the goal is not penalised — the cap is inclusive (≤ 40%, not < 40%).
4. **Given** two goals where each has tasks totalling more than 40% of session time individually, **When** the session is generated, **Then** each goal contributes at most 40% of the session time, and excess tasks from both goals are deferred to future sessions.
5. **Given** a session is generated and the 40% cap is applied, **When** the student views the session, **Then** the session task list visually represents tasks from multiple goals without any explicit cap annotation required (the balance is silent, not surfaced as a warning).

---

### User Story 2 — Single-Goal Session Is Unaffected (Priority: P2)

A student has only one active goal. When the system generates a session, that single goal's tasks fill the session up to 100% of the available time. The 40% cap does not apply when only one goal is contributing tasks.

**Why this priority**: Without this bypass, a student with a single active goal would always practice for at most 40% of their intended session time, leaving 60% of their practice window empty. This would be confusing and harmful to the learning experience.

**Independent Test**: Can be fully tested by having exactly one active goal with tasks whose combined estimated duration fills or exceeds the session's available time, generating a session, and verifying that tasks from that goal fill the session up to 100% of available time without any artificial cutoff.

**Acceptance Scenarios**:

1. **Given** exactly one active goal with tasks estimated at 30 minutes, and a 30-minute session target, **When** the session is generated, **Then** all of that goal's tasks (up to the 30-minute budget) are included without applying the 40% cap.
2. **Given** exactly one active goal, **When** the student views the generated session, **Then** the full available session time is used by that goal's tasks (no artificial underuse).
3. **Given** a second goal is later created and becomes active, **When** the next session is generated, **Then** the 40% cap begins to apply across both goals.

---

### User Story 3 — Excess Tasks Deferred to Future Sessions (Priority: P2)

A student has two large goals, each with enough tasks to fill two sessions on their own. The system generates multiple sessions distributing the excess tasks across future practice dates. Each generated session respects the 40% per-goal cap, and the student can see in the calendar that both goals are represented across upcoming sessions.

**Why this priority**: The cap must not silently discard tasks — deferred tasks must still be scheduled. This ensures long-term goal progress is not stalled by the balancing rule.

**Independent Test**: Can be fully tested by creating two goals each with 60 minutes of tasks in a 30-minute session target, generating sessions, and verifying that all tasks appear across two or more sessions with no session exceeding the 40% per-goal cap and no tasks dropped.

**Acceptance Scenarios**:

1. **Given** a goal has more tasks than fit within its 40% session budget, **When** the session is generated, **Then** the excess tasks from that goal are deferred to the next available session date rather than discarded.
2. **Given** multiple sessions are generated from two large goals, **When** the student views the calendar, **Then** both goals appear in the scheduled sessions and no tasks from either goal are lost.
3. **Given** tasks are deferred to a future session, **When** that future session is generated, **Then** the 40% per-goal cap is re-applied to that session as well.

---

### Edge Cases

- What if a goal has a single task whose estimated duration alone exceeds 40% of the session time? That task must still be included (a task cannot be split); the cap is best-effort and individual tasks are never dropped or truncated.
- What if all active goals have only one task each and the combined total is under the session budget? All tasks are included and the cap is satisfied trivially.
- What if a goal's tasks have no estimated duration (legacy tasks without estimation)? Tasks without duration estimates are excluded from the per-goal time calculation; they are distributed freely without counting toward any goal's 40% allocation.
- What if the student has two goals and one contributes 40% exactly while the second contributes less than 60%? The session total is simply less than the available time — no padding or inflation occurs.
- What if the session has no available time configured (unlimited mode)? In unlimited mode, tasks are included without any time-based cap; the 40% rule does not apply.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a session is generated from two or more active goals, the system MUST ensure that tasks from any single goal do not exceed 40% of the session's total estimated practice time.
- **FR-002**: The 40% per-goal cap MUST NOT apply when only one active goal contributes tasks to a session; that goal may fill up to 100% of the available session time.
- **FR-003**: The 40% per-goal cap MUST NOT apply when the session has no configured time limit (unlimited mode).
- **FR-004**: When a goal's tasks exceed its 40% budget for a session, the excess tasks MUST be deferred to future sessions rather than discarded.
- **FR-005**: A single task that individually exceeds the 40% per-goal budget MUST still be included in the session; individual tasks cannot be split or dropped due to the cap.
- **FR-006**: Tasks that have no estimated duration MUST be excluded from per-goal time calculations and distributed freely without consuming any goal's 40% allocation.
- **FR-007**: The system MUST re-apply the 40% per-goal cap to each generated session independently when excess tasks spill into future sessions.
- **FR-008**: The cap enforcement MUST be transparent to the user — no warnings, labels, or indicators about the cap are displayed in the session view.
- **FR-009**: When a session contains tasks from goals linked to two or more distinct scores, the session's `name` MUST be recomputed as the contributing score titles sorted alphabetically and joined by `' · '` (e.g. `'Arabesque · Bach: Invention No. 1'`). The composite name MUST be derived at session-creation or redistribution time from the union of all contributing goal score titles — it MUST NOT retain a single-score name from a prior creation pass.

### Key Entities

- **Goal**: A learning objective (learn-score-phrase or warm-up-scales) that generates a set of practice tasks. Each goal has an identifier and contributes tasks with estimated durations to one or more sessions.
- **SessionTask**: A single practice unit within a session, associated with the goal that created it, with an optional estimated duration. Tasks are the atomic unit of distribution; they cannot be split.
- **Session**: A practice session with a configurable available time. When generated from multiple goals, sessions must satisfy the 40% per-goal constraint on estimated task time.
- **Per-Goal Time Budget**: The maximum estimated practice time any single goal may contribute to a session, computed as 40% of the session's total estimated task time or available time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In any auto-generated session drawing from two or more active goals, no single goal's tasks account for more than 40% of the session's total estimated practice time — verifiable by summing each goal's estimated task durations and comparing to the session total.
- **SC-002**: Sessions generated from a single active goal continue to use up to 100% of available session time with no regression in task count or duration coverage.
- **SC-003**: All tasks from all active goals are accounted for across scheduled sessions — zero tasks are silently dropped as a result of the 40% cap enforcement.
- **SC-004**: The existing session generation behaviour for unlimited-time sessions remains unchanged; no regression in task distribution for sessions without a time budget.
- **SC-005**: The time to generate sessions does not increase perceptibly compared to the pre-feature baseline — the cap calculation is a lightweight O(n) pass over task lists.
- **SC-006**: Every session containing tasks from two or more distinct scores carries a composite `name` equal to the sorted score titles joined by `' · '` — verifiable by inspecting the session's `name` field after `redistributeWithMultiGoalCap` completes.

## Assumptions

- "Session time" refers to the session's configured available time (or total estimated task duration if no available time is set).
- The 40% cap is computed using each task's estimated duration. Tasks without an estimated duration are treated as zero-duration for cap purposes and do not count against any goal's allocation.
- The cap is applied at session-generation time, not retroactively to already-created sessions.
- Goal identity is tracked per task (each task records which goal created it). Tasks with no goal association (legacy/manual tasks) are not subject to the cap and are distributed freely.

## Known Issues & Regression Tests

**Bugfix**: 2026-05-22 — BUG-002 Added FR-009 (composite session naming) and SC-006 (verifiable composite title). T023 and T009 in tasks.md reopened; regression task T028 added. Root cause: no spec defined session `name` composition for multi-score sessions — `redistributeWithMultiGoalCap` created sessions using only the creating goal's score title.
- When a single task exceeds the per-goal 40% budget, it is included regardless — best-effort enforcement, not strict enforcement.

