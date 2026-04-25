# Feature Specification: One-Hand Playback in Practice Mode

**Feature Branch**: `083-one-hand-playback`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "When practising with one hand, playback only this hand"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Right-Hand-Only Playback During Exercise (Priority: P1)

A piano student is practicing the right hand of Chopin's Nocturne. They select a score in the Train plugin, choose "Right hand" (treble staff) as their practice hand, and start the exercise. During the playback phase, only the right-hand notes are heard — the left-hand accompaniment is silent. The student focuses entirely on matching the right-hand melody without the bass line interfering.

**Why this priority**: This is the core value of the feature. A student practicing one hand wants to hear only their part. Without this, notes from the other hand obscure whether the student is playing the correct pitches.

**Independent Test**: Load any two-stave score (e.g., Arabesque) in the Train plugin with score preset, select treble/right-hand mode, start an exercise, and verify that only treble-staff notes produce audio output.

**Acceptance Scenarios**:

1. **Given** the Train plugin is in score-preset mode with a two-stave piano score, **When** the user selects "Right hand" and starts the exercise, **Then** only notes from the treble staff are played back; bass-staff notes are completely silent.
2. **Given** an active right-hand-only exercise, **When** playback reaches a measure with simultaneous notes in both staves, **Then** only the treble-staff notes are heard.
3. **Given** a right-hand-only session, **When** the exercise ends and results are shown, **Then** the scoring reflects only the right-hand notes that were expected.

---

### User Story 2 - Left-Hand-Only Playback During Exercise (Priority: P1)

A student is working on the bass line of Bach's Invention No. 1. They select "Left hand" (bass staff) in the Train plugin and start the exercise. Only the left-hand notes play; the right-hand melody is silent throughout the session.

**Why this priority**: Symmetric case to User Story 1. Both hands are equally common practice targets and must be supported.

**Independent Test**: Load a two-stave score in the Train plugin, select bass/left-hand mode, start the exercise, and confirm only bass-staff notes are audible.

**Acceptance Scenarios**:

1. **Given** the Train plugin is in score-preset mode and the user selects "Left hand", **When** the exercise begins, **Then** only bass-staff notes are played; treble-staff notes are silent.
2. **Given** a left-hand-only exercise, **When** notes from the treble staff would normally be scheduled for playback, **Then** those notes produce no sound.

---

### User Story 3 - Hand Mode Persists Across Exercise Rounds (Priority: P2)

A student completes a right-hand exercise, reviews their results, and starts another round without changing any settings. The system remembers the hand mode and once again plays back only the right-hand notes.

**Why this priority**: Removes repetitive re-selection when repeating the same exercise multiple times, which is the most common practice workflow.

**Independent Test**: Complete a right-hand exercise, view results, restart the exercise without changing settings, and confirm only right-hand notes play in the new round.

**Acceptance Scenarios**:

1. **Given** the user completed a one-hand exercise and is viewing results, **When** they restart the exercise without changing hand selection, **Then** the same hand's notes are played back.
2. **Given** one-hand mode is active, **When** the user navigates away from the plugin and returns within the same session, **Then** the previously selected hand mode is restored.

---

### User Story 4 - Both-Hands Mode Is Unaffected (Priority: P1)

A student who has not selected a single-hand mode practices with both hands. The playback behaves exactly as it does today — all notes from all staves are heard.

**Why this priority**: Ensures the feature is purely additive and does not break the existing default behaviour.

**Independent Test**: Load a score, leave hand selection at its default (both hands), start an exercise, and confirm all notes from all staves are audible as before.

**Acceptance Scenarios**:

1. **Given** the Train plugin is in score-preset mode with default (both-hands) settings, **When** the exercise plays back, **Then** notes from all staves are heard exactly as before this feature was introduced.
2. **Given** a student switches from one-hand mode back to both-hands mode, **When** the next exercise starts, **Then** all notes are heard again.

---

### Edge Cases

- What happens when the score has only one staff? The one-hand selector is hidden or disabled; all notes play normally.
- What happens with cross-staff notation (a note written on the opposite staff)? The note belongs to the staff it is notated on.
- What happens if the user changes hand mode mid-exercise? The change takes effect from the next exercise round, not during the current playback.
- What happens for scores with more than two staves (orchestral)? One-hand mode is only available for two-stave piano scores; the option is hidden for other configurations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When one-hand practice mode is active, playback MUST produce audio only for notes belonging to the selected hand's staff; notes on the other staff MUST be completely silent.
- **FR-002**: The system MUST support three hand-mode states: "Right hand only" (treble staff), "Left hand only" (bass staff), and "Both hands" (default).
- **FR-003**: Hand mode selection MUST persist for the duration of the practice session without requiring reselection between exercise rounds.
- **FR-004**: Switching from one-hand mode back to both-hands mode MUST restore full playback of all staves from the next exercise round onward.
- **FR-005**: One-hand playback filtering MUST respect existing dynamics, tempo, and volume settings — only which notes are heard changes, not how they sound.
- **FR-006**: The feature MUST apply to both the Train plugin's score-preset playback phase and the Practice View plugin's playback; notes from the non-selected hand MUST be silent in both contexts.
- **FR-007**: For scores with only one staff, the one-hand mode selector MUST be hidden or disabled.
- **FR-008**: Note highlighting during one-hand playback MUST continue to function correctly for the active hand's notes.

### Key Entities

- **Hand Mode**: A three-state selection (Right hand / Left hand / Both hands) associated with a practice session; determines which staves contribute audio to playback.
- **Staff**: A single notation line within a score; in standard piano scores, staff 1 = treble/right hand, staff 2 = bass/left hand.
- **Practice Session**: A single run of the Train plugin exercise from start to results; hand mode is fixed for its duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When one-hand mode is active, 100% of notes from the non-selected staff are silent during playback — verifiable by inspecting scheduled audio events.
- **SC-002**: Selecting a hand mode requires no more than one user interaction (a single tap or click).
- **SC-003**: Switching hand mode between sessions adds zero additional steps to the exercise restart flow.
- **SC-004**: Both-hands playback is entirely unaffected — existing exercise behaviour is unchanged.
- **SC-005**: One-hand filtering is applied within the same latency budget as standard playback scheduling — no perceptible delay introduced.

## Assumptions

- The Train plugin already distinguishes between treble-staff notes and bass-staff notes in score-preset mode; this feature filters at the note-scheduling level using that existing data.
- A "hand" maps directly to a staff number: staff 1 = right hand (treble), staff 2 = left hand (bass). This matches standard piano MusicXML conventions.
- The hand selection UI is placed within the Train plugin's configuration panel, alongside the existing clef/hand selection control.
- Hand mode persists for the current session (in component state or localStorage) but does not need to survive full page reloads unless trivially simple to implement.
- Cross-staff notation is treated as belonging to the staff it is notated on.

