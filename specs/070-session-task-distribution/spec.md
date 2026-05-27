# Feature Specification: Session Task Distribution

**Feature Branch**: `070-session-task-distribution`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Evolve the goal tasks distribution to sessions - Add to the session an availableTime field measured in seconds: if it is not filled, the session has no time limit. If it has a value, before adding a new task to it, the free time space will be checked. When creating a new task (miniscore), the difficulty must be computed as with the global score. When creating a new task, an estimated duration must be computed using: number of measures, repetitions, difficulty, result. When a goal is created, if it is a score play goal, 3 tasks per phrase will be created with RH, LH, BH. Sessions will be created to accommodate all the tasks created. Sessions will be scheduled in the next free days (days without sessions already)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Goal Creates Tasks for Every Phrase (Priority: P1)

A user creates a "learn score" goal for a piano score that contains multiple phrases. The system detects all phrases in the score and generates three tasks per phrase (Right Hand, Left Hand, Both Hands), giving the user a structured practice plan that covers the entire score.

**Why this priority**: This is the core behavioral change - expanding goal-based task generation from one phrase to all phrases. Without it, the other stories (session distribution, scheduling) have nothing to distribute.

**Independent Test**: Create a goal for a known two-staff score with at least 3 detected phrases. Verify 9 tasks are generated (3 phrases x 3 hands) with correct measure ranges and staff indices.

**Acceptance Scenarios**:

1. **Given** a two-staff (piano) score with 4 detected phrases, **When** the user creates a score play goal, **Then** 12 tasks are generated: 3 per phrase (staffIndex 0 for RH, staffIndex 1 for LH, staffIndex -1 for BH), each covering the correct start/end measure range.
2. **Given** a single-staff score with 3 detected phrases, **When** the user creates a score play goal, **Then** 3 tasks are generated (one BH task per phrase, staffIndex -1), since there is only one staff.
3. **Given** a two-staff score where phrase detection falls back to default 4-measure grouping, **When** the user creates a score play goal, **Then** tasks are still generated for every default phrase region with RH, LH, BH variants.
4. **Given** a two-staff (piano) score where the Left Hand staff is silent (no notes) in phrase 2, **When** the user creates a score play goal, **Then** phrase 2 produces only 2 tasks (RH + BH) — no LH task is created, because `getRegionDifficulty()` returns `null` for staffIndex 1 in that phrase range.

---

### User Story 2 - Task Difficulty and Duration Estimation (Priority: P1)

When tasks are auto-generated from a goal, each task receives a computed difficulty rating and an estimated duration in seconds. The difficulty is computed the same way as the global score difficulty (note density + polyphony), but scoped to the task's measure range and staff. The estimated duration considers measures, repetitions (loopCount), difficulty, and target result.

**Why this priority**: Duration estimation is a prerequisite for time-limited session distribution (Story 3). Without per-task duration, sessions cannot enforce time budgets.

**Independent Test**: Create a goal for a score with phrases of varying complexity. Verify each generated task has a difficulty rating and a positive estimated duration in seconds, and that tasks covering denser passages have higher difficulty and longer duration estimates.

**Acceptance Scenarios**:

1. **Given** a task covering measures 1-4 with loopCount 10, **When** the task is generated, **Then** it has a difficulty rating (easy/medium/hard) computed from note density and polyphony within those measures for the assigned staff.
2. **Given** two tasks in the same score - one covering an easy 4-measure phrase and one covering a complex 4-measure phrase, **When** both are generated with the same loopCount and minResult, **Then** the complex phrase task has a higher estimated duration.
3. **Given** a task with loopCount 10, **When** compared to the same task with loopCount 5, **Then** the task with loopCount 10 has a proportionally longer estimated duration.

---

### User Story 3 - Session Available Time and Task Accommodation (Priority: P2)

Sessions gain an optional availableTime field (in seconds). When tasks are distributed into sessions, the system checks whether the session has remaining time before adding a new task. If a session has no availableTime set, it accepts tasks without a time limit. When a session fills up, a new session is created for overflow tasks.

**Why this priority**: Time-limited sessions give users control over practice length and enable realistic daily practice plans. Depends on duration estimation from Story 2.

**Independent Test**: Create a goal that generates 12 tasks with estimated durations. Set a session time limit. Verify tasks are distributed across multiple sessions, with no session exceeding its time budget.

**Acceptance Scenarios**:

1. **Given** a session with availableTime of 1800 seconds (30 minutes) and tasks with estimated durations totaling 4500 seconds, **When** tasks are distributed, **Then** multiple sessions are created, and no single session's total estimated task duration exceeds 1800 seconds.
2. **Given** a session with no availableTime set, **When** tasks are distributed, **Then** all tasks are placed in that single session regardless of their total estimated duration.
3. **Given** a session with availableTime of 600 seconds and a phrase group (RH+LH+BH) with a combined estimated duration of 900 seconds, **When** that phrase group is the first to be assigned, **Then** all three tasks are placed in the session anyway (a session always accepts at least one full phrase group).
4. **Given** tasks are distributed across sessions, **When** the user views each session, **Then** the session displays its total estimated duration and remaining available time.

---

### User Story 4 - Sessions Scheduled on Free Days (Priority: P2)

When a goal generates multiple sessions, those sessions are scheduled on consecutive free days - days that do not already have a scheduled or active session. This gives users a spread-out practice plan without double-booking.

**Why this priority**: Scheduling on free days ensures the generated practice plan fits into the user's existing calendar. Depends on session creation from Story 3.

**Independent Test**: Pre-create sessions on specific dates. Then create a goal that generates 3 sessions. Verify the 3 new sessions are scheduled on the next 3 days that had no prior sessions.

**Acceptance Scenarios**:

1. **Given** no existing scheduled sessions, **When** a goal creates 3 sessions, **Then** sessions are scheduled for tomorrow, the day after tomorrow, and the day after that.
2. **Given** sessions already exist on April 2 and April 4, **When** a goal creates 3 sessions starting from April 2, **Then** the new sessions are scheduled for April 3, April 5, and April 6 (skipping occupied days).
3. **Given** a goal creates sessions, **When** the user views the session list, **Then** all new sessions appear as 'scheduled' with their respective target dates, sorted chronologically.

---

### Edge Cases

- What happens when a score has no detected phrases? The system falls back to default phrase grouping (e.g., 4-measure groups) and still generates tasks.
- What happens when a phrase group's combined estimated duration exceeds the session's availableTime? The phrase group (RH+LH+BH) is still assigned together to a new session — the phrase triplet is the atomic unit and a session always accepts at least one phrase group.
- What happens when there are no free days in the foreseeable future? The system schedules on the next days after the last occupied day, effectively queuing sessions sequentially.
- What happens when a score has only one staff? Only BH tasks are generated (one per phrase), not RH/LH/BH triplets.
- What happens when a hand (staff) is silent (no notes) in a phrase? No task is created for that hand/phrase combination — `getRegionDifficulty()` returns `null` for that (startMeasure, endMeasure, staffIndex), and the task is skipped. The phrase group for that phrase may therefore contain fewer than 3 tasks (e.g., only RH + BH when LH is silent).
- What happens when availableTime is set to 0? A value of 0 is treated the same as unset (no time limit).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a score play goal is created for a multi-staff (piano) score, the system MUST generate 3 tasks per detected phrase: one for Right Hand (staffIndex 0), one for Left Hand (staffIndex 1), one for Both Hands (staffIndex -1), **except** where FR-017 applies.
- **FR-002**: When a score play goal is created for a single-staff score, the system MUST generate 1 task per detected phrase for Both Hands (staffIndex -1).
- **FR-003**: Each auto-generated task MUST have a difficulty rating (easy, medium, hard) computed using the same algorithm as the global score difficulty, scoped to the task's measure range and assigned staff.
- **FR-004**: Each auto-generated task MUST have an estimatedDurationSecs field representing the total practice time needed to reach the minResult threshold (not a single playback duration). The estimate is computed from: number of measures in the task, loopCount (repetitions), difficulty rating, and minResult (target score percentage). Base calibration: a medium-difficulty measure requires approximately 3-4 minutes of practice time; easy measures require less, hard measures require more.
- **FR-005**: The Session entity MUST support an optional availableTime field measured in seconds. When not set or set to 0, the session has no time limit. For auto-generated sessions, availableTime MUST default to 3600 seconds (1 hour) as a hardcoded global value (no user configuration UI in this iteration).
- **FR-006**: When distributing tasks into sessions, the system MUST check the session's remaining available time (availableTime minus sum of estimatedDurationSecs of already-assigned tasks) before adding a new task.
- **FR-007**: If a session's remaining time is insufficient for a new task, the system MUST create a new session to accommodate overflow tasks.
- **FR-008**: A session MUST always accept at least one full phrase group (RH + LH + BH, or just BH for single-staff), even if the group's combined estimated duration exceeds the session's availableTime.
- **FR-009**: All sessions created from a single goal MUST be scheduled on distinct future free days - days without any existing scheduled or active sessions.
- **FR-010**: Free-day detection MUST consider all sessions (not just goal-linked ones) when determining whether a day is occupied.
- **FR-011**: Sessions MUST be scheduled starting from tomorrow and proceeding forward, selecting only free days.
- **FR-012**: Each generated session MUST display its total estimated duration (sum of task estimated durations) and, if availableTime is set, the remaining available time.
- **FR-013**: The Goal entity MUST support referencing multiple sessions (since tasks may span more than one session).
- **FR-014**: The duration estimation formula MUST produce longer estimates for higher difficulty and lower minResult targets.
- **FR-015**: Tasks MUST be ordered by phrase progression: all three hand variants (RH, LH, BH) of phrase 1 first, then phrase 2, etc. When distributing across sessions, same-phrase tasks MUST always be kept together in the same session (phrase triplet is the atomic distribution unit). A session may exceed its availableTime to keep a phrase group intact.
- **FR-016**: If creating a goal would generate sessions that push the total session count above the 50-session storage cap, the system MUST warn the user with the number of sessions to be created and the number of oldest closed sessions that will be evicted, and proceed only upon user confirmation.
- **FR-017**: A hand-specific task MUST NOT be created for a given (phrase, staffIndex) pair when `getRegionDifficulty()` returns `null` for that pair — meaning the staff has no playable notes within the phrase's measure range. A `null` return MUST be treated as a skip condition, not as a fallback to medium difficulty. As a result, a phrase group may contain fewer than 3 tasks when one or more hands are silent in that phrase.

### Key Entities

- **Session**: Extended with optional availableTime (number, seconds). Represents the maximum practice time budget for the session. Auto-generated sessions default to 3600 seconds (1 hour). Also extended to display total estimated duration.
- **SessionTask**: Extended with difficulty (easy | medium | hard) and estimatedDurationSecs (number, seconds). estimatedDurationSecs represents the total practice time needed to master the phrase (memorize notes, learn fingering, rhythm, accidentals) to reach minResult. Computed at creation time from the task's measure range, staff, loopCount, and minResult.
- **Goal**: Extended from single sessionId to support multiple session references (sessionIds), since a goal may now span multiple sessions.
- **PhraseRegion**: Existing entity used for phrase detection. Tasks are generated for each detected phrase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A score play goal for a piano score with N phrases generates at most 3×N tasks (RH, LH, BH per phrase); the actual count may be less when one or more hands are silent in a given phrase (FR-017).
- **SC-002**: Every auto-generated task has a computed difficulty and a positive estimated duration before the user interacts with it.
- **SC-003**: No session with a defined availableTime exceeds its time budget (exception: the first phrase group assigned to an empty session may exceed the budget to keep the triplet intact).
- **SC-004**: All auto-generated sessions are scheduled on distinct days, with no day hosting more than one newly created session.
- **SC-005**: Users can view the estimated total practice time for each session before starting it.
- **SC-006**: Goal completion logic continues to work correctly - a goal transitions to 'completed' when all tasks across all linked sessions reach 'done' status.

## Clarifications

### Session 2026-04-01

- Q: When sessions are auto-generated from a goal, where does the availableTime value come from? → A: Global preference, hardcoded at 3600 seconds (1 hour). No configuration UI in this iteration.
- Q: In what order should tasks for each phrase be grouped when distributing across sessions? → A: Same-phrase grouping (RH, LH, BH for phrase 1 together, then phrase 2, etc.) — pedagogical progression.
- Q: How should the system handle goal creation when resulting sessions would exceed the 50-session storage cap? → A: Warn user with session count and eviction impact, proceed on confirmation.
- Q: What should the base duration per measure be for the estimation formula? → A: Duration estimates total practice time to reach minResult (not playback time). Base ~3-4 min per measure at medium difficulty (covers memorizing notes, fingering, rhythm, accidentals).
- Q: If a phrase triplet (RH+LH+BH) exceeds the session's availableTime, should it be split across sessions? → A: No. Keep phrase triplet together — session may exceed availableTime for that phrase group. Phrase triplet is the atomic distribution unit.

**Bugfix**: 2026-06-07 — BUG-001 Added FR-017 (skip task creation for silent staves), updated FR-001 to reference FR-017, added silent-hand edge case, updated SC-001 to reflect variable phrase group size.
