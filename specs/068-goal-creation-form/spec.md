# Feature Specification: Goal Creation Form

**Feature Branch**: `068-goal-creation-form`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Goal creation form with fields for goal type, score breakdown, number of iterations, min result, and tempo"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Goal with Custom Practice Parameters (Priority: P1)

A user navigates to the Goals tab and taps "Create Goal." Instead of the system immediately auto-generating a goal with hardcoded defaults, a creation form appears. The form displays the goal type (read-only, set to "Play Score") and the score breakdown strategy (read-only, set to "Phrases"). The user selects a score, then configures three practice parameters: number of iterations (how many times to repeat each phrase region), minimum result (the accuracy threshold to consider a task done), and tempo (the speed multiplier for practice). After filling in the form, the user submits it. The system creates the goal with its associated tasks using the user-provided parameters instead of hardcoded defaults.

**Why this priority**: This is the core feature — without the form and its configurable fields, the entire feature has no value. It replaces the current auto-generate-everything flow with user control over key practice parameters.

**Independent Test**: Can be fully tested by opening the Goals tab, tapping "Create Goal," filling in the form fields, submitting, and verifying the resulting goal and tasks reflect the chosen iterations, min result, and tempo values.

**Acceptance Scenarios**:

1. **Given** the user is on the Goals tab, **When** they tap "Create Goal," **Then** the goal creation form opens immediately and displays: a read-only "Type of goal" field showing "Play Score," a read-only "Score breakdown" field showing "Phrases," a score selector button (no score pre-selected), and editable fields for iterations, min result, and tempo with their default values.
2. **Given** the goal creation form is open, **When** the user selects a score, sets iterations to 5, min result to 80%, and tempo to 75%, **Then** all form fields reflect the chosen values.
3. **Given** the form is filled with valid values, **When** the user submits the form, **Then** a goal is created with tasks whose loop count matches the entered iterations, whose minimum result threshold matches the entered min result, and whose tempo multiplier matches the entered tempo; the form closes and the user lands on the Goals tab with the new goal visible at the top of the list.
4. **Given** the form is filled with valid values for a multi-staff score, **When** the user submits, **Then** the system generates separate tasks for right hand, left hand, and both hands — all sharing the user-specified iterations, min result, and tempo.
5. **Given** the form is filled with valid values for a single-staff score, **When** the user submits, **Then** the system generates a single task for both hands using the user-specified parameters.

---

### User Story 2 - Form Defaults Match Current Behavior (Priority: P2)

When the form opens, all editable fields are pre-populated with sensible defaults (matching the current auto-generation values: 10 iterations, 90% min result, 100% tempo). A user who wants the standard experience can simply select a score and submit without changing anything.

**Why this priority**: Ensures backward compatibility. Users accustomed to the one-tap goal creation flow experience no friction — they just have a new form step but can accept defaults immediately.

**Independent Test**: Can be tested by opening the creation form and verifying that default values are pre-filled, then submitting without changes and confirming the created goal matches current behavior.

**Acceptance Scenarios**:

1. **Given** the user opens the goal creation form, **When** the form loads, **Then** the iterations field defaults to 10, the min result field defaults to 90%, and the tempo field defaults to 100%.
2. **Given** the form is open with default values and a score selected, **When** the user submits without making changes, **Then** the resulting goal and tasks are identical to what the current auto-generation flow produces.

---

### User Story 3 - Form Validation Prevents Invalid Goals (Priority: P3)

The form validates user input before submission. If a required field is missing or a value is out of range, the user sees clear inline feedback and cannot submit the form until issues are resolved.

**Why this priority**: Prevents submission with no score selected; slider controls inherently prevent out-of-range values for iterations, min result, and tempo.

**Independent Test**: Can be tested by attempting to submit the form before selecting a score, and verifying the error message appears and submission is blocked.

**Acceptance Scenarios**:

1. **Given** the form is open with no score selected, **When** the user attempts to submit, **Then** the form shows an error indicating a score must be selected.
2. **Given** the form is open with a score selected and all sliders at valid positions, **When** the user taps the submit button, **Then** the button is active and submission proceeds.
3. **Given** the iterations, min result, and tempo fields are rendered as sliders, **When** the user drags any slider, **Then** the slider constrains the value within its defined range (iterations: 1–20; min result: 0–100%; tempo: 50–200%) — no out-of-range value can be entered.
4. **Given** the user selects a user-uploaded score (score loaded via file picker, `type: 'user'`), **When** the selection is made, **Then** no unavailability warning is shown and the submit button is enabled — user scores are always considered available once selected.

---

### Edge Cases

- What happens when the selected score has no detectable phrases? The system falls back to the first 4 measures (or entire score if fewer than 4 measures), consistent with current behavior.
- What happens when the user selects a score that already has an active goal? A dismissible inline warning is shown in the form (e.g., "An active goal already exists for this score") but does not block submission — the user can dismiss or ignore it and proceed.
- What happens when the user dismisses the form without submitting? No goal or session is created; the user returns to the Goals tab unchanged.
- What happens after successful submission? The form closes and the user lands on the Goals tab; the newly created goal appears at the top of the list with no intermediate confirmation screen or toast.
- What happens when the selected score becomes unavailable after selection but before submission? The score selector shows a warning icon and the submit button is disabled until the user selects a valid score.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tapping "Create Goal" MUST open the goal creation form directly (all fields visible at once), replacing the prior flow where the score picker opened first and auto-generated the goal upon selection. The score picker is accessible from within the form via a dedicated score selector button.
- **FR-002**: The form MUST display a "Type of goal" field, read-only, showing "Play Score."
- **FR-003**: The form MUST display a "Score breakdown" field, read-only, showing "Phrases."
- **FR-004**: The form MUST include a score selector that opens the existing score picker overlay.
- **FR-005**: The form MUST include an "Iterations" slider (integer, range 1–20, step 1), defaulting to 10.
- **FR-006**: The form MUST include a "Min result" slider (percentage, range 0–100%, step 5%), defaulting to 90%.
- **FR-007**: The form MUST include a "Tempo" slider (percentage, range 50–200%, step 5%), defaulting to 100%.
- **FR-008**: The form MUST validate all fields before allowing submission, showing inline error messages for invalid values.
- **FR-009**: Upon submission, the system MUST create a goal whose auto-generated tasks use the user-specified iterations (as loop count), min result, and tempo (as tempo multiplier) instead of hardcoded defaults.
- **FR-010**: The phrase detection, staff-based task generation (RH/LH/TH for multi-staff, TH-only for single-staff), and scheduled session creation MUST continue to work as they do today, unchanged.
- **FR-011**: The form MUST block submission if no score is selected or if the selected score is unavailable. "Unavailable" applies only to **preloaded catalogue scores** that are no longer present in the catalogue after selection; when such a score is detected as removed, the score selector MUST display a warning icon and the submit button MUST be disabled until the user selects a valid score. User-uploaded scores (`type: 'user'`) MUST always be treated as available once selected — they MUST NOT trigger the unavailability warning or disable the submit button.
- **FR-013**: Upon successful goal creation, the form MUST close and the user MUST be returned to the Goals tab, where the new goal is visible at the top of the list. No intermediate confirmation screen or success notification is required.
- **FR-014**: When the user selects a score that already has an active goal, the form MUST display a dismissible inline warning. The warning MUST NOT block submission — the user may dismiss it or proceed regardless.
- **FR-012**: The "Type of goal" and "Score breakdown" fields MUST be visually distinct as non-editable (e.g., disabled styling, label-only display) so users understand they cannot change them in this version.

### Key Entities

- **Goal**: A high-level practice objective. Gains no new fields — the existing `type` field already supports goal-type distinction. The user-specified parameters (iterations, min result, tempo) flow through to the generated tasks, not stored on the goal itself.
- **SessionTask**: An individual practice unit within a goal's session. The `loopCount`, `minResult`, and `tempoMultiplier` fields already exist and will now be populated from the form inputs instead of hardcoded values.
- **Goal Creation Form State**: A transient UI state holding the user's in-progress selections (goal type, score breakdown, score reference, iterations, min result, tempo) before submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a goal with custom parameters in under 30 seconds (select score + adjust up to 3 fields + submit).
- **SC-002**: 100% of goals created through the form produce tasks whose iterations, min result, and tempo match the values entered by the user.
- **SC-003**: Users who do not modify defaults experience no change in goal/task output compared to the previous auto-generation flow.
- **SC-004**: All form validation errors are surfaced inline before submission, preventing creation of goals with invalid parameters.
- **SC-005**: The form is accessible and usable on both mobile and desktop screen sizes.

## Clarifications

### Session 2026-04-01

- Q: When the user taps "Create Goal," what opens first? → A: The goal creation form opens directly (all fields visible); a score selector button inside the form opens the score picker overlay when tapped.
- Q: After the user submits the form and the goal is created, what happens? → A: Form closes; user lands on the Goals tab with the new goal visible in the list (no confirmation screen).
- Q: What input control should be used for the three editable fields (iterations, min result, tempo)? → A: All three use sliders, matching the existing TaskBuilder controls. Iterations slider spans 1–20 at step 1; tempo and min result match current TaskBuilder slider ranges and steps.
- Q: When the user selects a score that already has an active goal, what should happen? → A: Show a dismissible warning inside the form but allow the user to proceed and submit.
- Q: If the selected score becomes unavailable before the user submits, should the form block submission or warn-and-allow? → A: Block submission — show a warning icon on the score selector and disable the submit button until a valid score is re-selected.

**Bugfix**: 2026-05-20 — BUG-001 Clarified FR-011 to restrict "unavailable" check to preloaded catalogue scores only; added US3 acceptance scenario 4 for user-uploaded score selection.

## Assumptions

- The "Play Score" goal type and "Phrases" score breakdown are the only options needed for this version. Future iterations will introduce additional goal types and breakdown strategies, at which point these read-only fields will become selectable.
- The existing phrase detection logic (first phrase for instrument 0, fallback to first 4 measures) remains unchanged.
- The existing scheduled session creation logic (session scheduled for tomorrow) remains unchanged.
- The tempo slider uses the same 50–200% range and 5% step increments as the existing TaskBuilder tempo slider.
- The min result slider uses the same 0–100% range and 5% step increments as the existing TaskBuilder.
- The iterations slider spans 1–20 at step 1. The hardcoded default in the current goal engine is 10, which sits comfortably within this range. Scores requiring more than 20 repetitions are considered an edge case outside the initial scope.

