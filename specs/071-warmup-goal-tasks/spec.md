# Feature Specification: Warm-Up Goal Tasks for Sessions

**Feature Branch**: `071-warmup-goal-tasks`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Add warm up tasks to sessions as a goal"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Warm-Up Scale Goal (Priority: P1)

A user opens the Goals tab and creates a new warm-up goal. They choose "Warm-Up Tasks" as the goal type, which defaults to the "Scales" warm-up type. A scale selector appears — matching the scale list from the Train view — and the user picks a scale (e.g. C Major). They configure a tempo via a slider, set iterations, a minimum score, and specify how many sessions should include this warm-up. On submit, the goal is saved and the warm-up task is prepended to the configured number of upcoming practice sessions wherever free time exists.

**Why this priority**: This is the complete, end-to-end flow for the new goal type. Without it the feature delivers no value. All other stories depend on this foundation.

**Independent Test**: Can be fully tested by creating a warm-up goal, confirming it appears in the goal list, and verifying that the designated sessions each contain a warm-up scale task prepended at the start.

**Acceptance Scenarios**:

1. **Given** the Goals tab is open, **When** the user taps "Create Goal", **Then** a form appears with a "Type of goal" selector that includes the existing "Play Score" option and a new "Warm-Up Tasks" option.
2. **Given** the goal creation form is open and "Warm-Up Tasks" is selected, **When** the form renders, **Then** a "Warm-up type" field shows "Scales" selected by default, a scale selector appears listing all 24 major/minor scales (same order as the Train view), and the scale defaults to C Major.
3. **Given** the "Warm-Up Tasks" form is fully configured, **When** the user submits, **Then** the goal is saved, appears in the goal list with status "active", and the warm-up scale task is inserted at the beginning of each targeted session that has enough free time.
4. **Given** a session contains a warm-up scale task, **When** the user taps that task, **Then** the Train view opens with the goal's configured scale pre-selected and the tempo slider set to the goal's saved tempo.

---

### User Story 2 - Scale Selector and Tempo Configuration (Priority: P2)

A user configuring a warm-up goal uses the scale selector and tempo slider. The scale selector shows the same scales available in the Train view. The tempo slider mirrors the one in the Train view toolbar, letting the user choose a playback speed from slow to fast. The scale exercise to be practiced always spans 2 octaves up and back down (4 measures of quarter notes).

**Why this priority**: The scale selection and tempo are the two distinguishing parameters of the warm-up exercise. Without them the warm-up task cannot be meaningfully configured.

**Independent Test**: Can be tested by confirming the scale dropdown lists all 24 scales in circle-of-fifths order, that selecting any scale updates the displayed selection, and that the tempo slider moves smoothly between its minimum and maximum values and its value is reflected in the saved task.

**Acceptance Scenarios**:

1. **Given** "Warm-Up Tasks / Scales" is selected in the form, **When** the user opens the scale selector, **Then** all 24 major and natural minor scales are listed (e.g. C Major, G Major, … A Minor, E Minor …) in circle-of-fifths order — identical to the Train view scale list.
2. **Given** a scale is selected, **When** the goal is executed as a session task, **Then** the exercise spans exactly 2 octaves ascending and 2 octaves descending (4 measures total), with each note as a quarter note.
3. **Given** the warm-up form is shown, **When** the user moves the tempo slider, **Then** the displayed tempo value updates continuously; the slider range and visual style match the tempo slider in the Train view toolbar.

---

### User Story 3 - Session Distribution of Warm-Up Tasks (Priority: P3)

A user specifies how many sessions should receive the warm-up task. The system inserts the warm-up task at the beginning of that number of already-existing scheduled sessions, but only in sessions that have free time available (i.e. where the total scheduled task duration is below the session's available time budget). No new sessions are created.

**Why this priority**: This controls reach and avoids overloading sessions. It's important for correct scheduling behavior but can be verified independently of the scale configuration.

**Independent Test**: Can be tested by creating a warm-up goal with a given session count, then inspecting the session list to confirm the warm-up task appears only in sessions with spare capacity and only in up to the configured number of them.

**Acceptance Scenarios**:

1. **Given** a warm-up goal is created with "Warm-up sessions" set to 3, **When** the system distributes the task, **Then** up to 3 already-existing scheduled sessions are targeted (or fewer if fewer existing sessions with free time are available); no new sessions are created.
2. **Given** a target session has no free time, **When** the warm-up distribution runs, **Then** that session is skipped and the next session with free time is used instead.
3. **Given** the warm-up task is inserted into a session, **When** the user views the session's task list, **Then** the warm-up task appears first, before any practice tasks.

---

### User Story 4 - Iterations and Min Score on Warm-Up Goals (Priority: P4)

A user can configure the number of iterations (how many times the scale must be played through) and the minimum score (the accuracy threshold to mark the task done) on a warm-up goal — the same controls that exist on the existing "Play Score" goal form.

**Why this priority**: Parity with existing goal behavior ensures users have full control over completion criteria. This is a lower priority because the feature works without it, but it is required for the warm-up task to integrate correctly with the existing task-completion engine.

**Independent Test**: Can be tested by setting iterations to 5 and min score to 80%, completing the warm-up task, and verifying it is marked "done" only when both conditions are satisfied.

**Acceptance Scenarios**:

1. **Given** the warm-up goal form is open, **When** the user adjusts the iterations slider, **Then** the value updates and is saved with the goal.
2. **Given** the warm-up goal form is open, **When** the user adjusts the min score slider, **Then** the value updates and is saved with the goal.
3. **Given** a warm-up task with iterations = 3 and min score = 85%, **When** the user completes the scale twice with scores of 90%, **Then** the task remains "in progress"; after a third completion at 90%, the task is marked "done".

---

### Edge Cases

- What happens when the user sets "Warm-up sessions" to a number larger than the available sessions? → The system fills as many sessions as are available with free time; no error is shown, but the goal summary reflects how many sessions were actually populated.
- What happens when a session's available time is shorter than the 5-minute warm-up duration? → That session is skipped (the warm-up task is not inserted).
- What happens if the user creates two active warm-up goals for the same scale? → The system allows it (no duplicate check required for warm-up goals, unlike score-based goals).
- What happens if all warm-up tasks complete before the user expected? → The goal transitions to "completed" automatically; the user sees it in the goal list with completed status.
- What happens if a session that received a warm-up task is deleted? → The goal's progress reflects only the remaining sessions; if all remaining warm-up tasks are done, the goal completes.
- What happens if the user changes the scale or tempo in the Train view after being navigated there from a warm-up task? → Changes made in the Train view during practice do not update the saved warm-up goal or task configuration; the task's scale and tempo remain as originally set.
- What happens if the user changes the tempo slider to the minimum value? → The warm-up task is saved with the minimum tempo; no validation error.
- What happens if no sessions with free time exist when the goal is created? → The goal is saved with an empty session list; no warm-up tasks are inserted; the goal list shows 0 sessions populated.

## Clarifications

### Session 2026-04-03

- Q: When a warm-up goal is created, should the system add the warm-up task to already-existing scheduled sessions (with free time), or create brand-new sessions? → A: Add to already-existing scheduled sessions that have free time.
- Q: When should a warm-up goal transition from "active" to "completed"? → A: Auto-completes when all targeted sessions have had their warm-up task marked "done".
- Q: When the user taps a warm-up scale task in a session, where should it take them to practice it? → A: Opens the Train view with the configured scale and tempo pre-selected.
- Q: What should the default value of the "Warm-up sessions" counter be when the form first opens? → A: 5 sessions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The goal creation form MUST offer "Warm-Up Tasks" as a selectable goal type alongside the existing "Play Score" type.
- **FR-002**: When "Warm-Up Tasks" is selected, the form MUST display a "Warm-up type" field with "Scales" as the only option and selected by default.
- **FR-003**: When "Scales" warm-up type is active, the form MUST display a scale selector listing all 24 major and natural minor scales in the same order and format as the Train view scale dropdown.
- **FR-004**: The selected scale MUST default to C Major when the warm-up goal form is first opened.
- **FR-005**: The warm-up goal form MUST include a tempo slider that matches the visual style and value range of the tempo slider in the Train view toolbar.
- **FR-006**: The warm-up goal form MUST include an iterations slider (same range and behavior as the existing goal form).
- **FR-007**: The warm-up goal form MUST include a minimum score slider (same range and behavior as the existing goal form).
- **FR-008**: The warm-up goal form MUST include a "Warm-up sessions" numeric control (integer ≥ 1) defining how many sessions should receive the warm-up task. The default value MUST be 5.
- **FR-009**: The default value for task duration MUST be 5 minutes.
- **FR-010**: When a warm-up goal is submitted, the system MUST insert the warm-up scale task at the beginning of up to N already-existing scheduled sessions (where N is the user-specified "Warm-up sessions" count), skipping any session that does not have sufficient free time. The system MUST NOT create new sessions to fulfil the warm-up count.
- **FR-011**: A warm-up scale exercise MUST cover 2 octaves ascending and 2 octaves descending (4 measures total) with all notes as quarter notes.
- **FR-012**: A warm-up goal MUST be saved with status "active" and appear in the goal list immediately after creation.
- **FR-013**: The system MUST NOT insert the warm-up task into a session whose remaining available time is less than the configured task duration.
- **FR-014**: When all warm-up tasks across all targeted sessions are marked "done", the warm-up goal MUST automatically transition to status "completed".
- **FR-015**: When the user activates a warm-up scale task in a session, the system MUST navigate to the Train view with the task's scale pre-selected and the tempo slider pre-set to the task's saved tempo.

### Key Entities

- **Warm-Up Goal**: Represents a user's commitment to practice a warm-up routine across a fixed set of existing sessions. Stores the warm-up type (scales), the selected scale, the desired playback tempo, the required number of iterations per completion, the minimum accuracy threshold, and the list of sessions targeted. Status transitions: active → completed (when all targeted warm-up tasks are marked "done").
- **Warm-Up Scale Task**: A task within a session that instructs the user to play a specific scale exercise. Carries the scale identity and tempo. The exercise always covers 2 octaves ascending and descending (4 measures, quarter notes). Tracks completion status, the number of attempts, and the accuracy results of each practice attempt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a warm-up goal from start to finish in under 90 seconds.
- **SC-002**: 100% of sessions with sufficient free time (up to the configured count) receive the warm-up task immediately upon goal creation, with no manual steps.
- **SC-003**: The scale selector in the warm-up form lists all 24 scales, matching the Train view exactly — verified visually and by automated test.
- **SC-004**: The warm-up task appears as the first item in the session task list for every session it is added to.
- **SC-005**: Users can adjust tempo, iterations, and min score without leaving the goal creation form; all values are persisted correctly to the saved goal.

## Assumptions

- The warm-up goal distributes its task into already-existing scheduled sessions — unlike the score-phrase goal which creates new sessions. The free-day scheduling logic used by the score-phrase goal is not involved.
- The 5-minute default task duration is consistent with the default task duration already used in the session builder.
- The scale exercise content (2 octaves up + down, quarter notes, 4 measures) is fully determined by the chosen scale and tempo; no sheet music file is required.
- More warm-up types (arpeggios, chord progressions, etc.) may be added in future features; the "Warm-up type" selector is designed to be extensible but this spec covers only "Scales".
- The tempo slider range and step values match those used in the Train view toolbar (50%–200% in 5% steps).

