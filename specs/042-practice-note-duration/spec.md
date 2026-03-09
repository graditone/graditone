# Feature Specification: Practice Note Duration Validation

**Feature Branch**: `042-practice-note-duration`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "In the Practice view, the duration of the note must be checked also, not just that the correct note was pressed. For example, if a chord is a round note in a 4/4 time signature, the chord must be pressed during the full measure duration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hold Whole Note for Full Measure (Priority: P1)

A learner is practicing Fur Elise, which contains whole notes. They press the correct chord and immediately release it. Currently the system advances — this feature should prevent advancing until the full measure duration has elapsed.

**Why this priority**: This is the core feature request. It establishes that duration is part of what makes a note "correct". Without it, nothing else can be built.

**Independent Test**: Load a score with a whole note in 4/4 time. Press the correct pitch, release immediately, and verify the practice session does NOT advance. Then hold the note for the full measure and verify it DOES advance.

**Acceptance Scenarios**:

1. **Given** a practice session is active and a whole note (4 beats) is the current target, **When** the user presses the correct pitch and releases after less than 10% of the required duration, **Then** the note is marked as released too early and the session does not advance to the next note.
2. **Given** a practice session is active and a whole note is the current target, **When** the user presses the correct pitch and holds it for at least 90% of the required duration, **Then** the note is accepted as correct and the session advances.
3. **Given** a practice session is active and a whole note is the current target, **When** the user presses the correct pitch and holds it longer than the full required duration, **Then** the note is accepted as correct and the session advances once the minimum duration is reached.

---

### User Story 2 - Duration Feedback During Hold (Priority: P2)

A learner is unsure how long to hold a note. While they are pressing a whole note, the practice view shows a visual indicator of the remaining hold duration so they know when they can release.

**Why this priority**: Without feedback, the user has no way to know how long to hold. This makes the feature usable in practice, not just theoretically correct.

**Independent Test**: Start a practice session with a whole note target. Press and hold the correct pitch. Verify that a duration progress indicator appears and fills over the note's required duration. Release at 50% and verify the indicator was visible and the note was not accepted.

**Acceptance Scenarios**:

1. **Given** the user is pressing the correct pitch for the current note, **When** the required duration is more than a quarter note, **Then** a visual hold indicator is displayed showing progression toward the required duration.
2. **Given** the visual hold indicator is active, **When** the required duration is reached, **Then** the indicator signals completion and the session advances to the next note.
3. **Given** the user releases the pitch before the required duration, **Then** the indicator disappears and the note is classified as released too early.

---

### User Story 3 - Duration Affects Practice Score (Priority: P3)

A learner completes a practice session where they played the correct pitches but released several long notes too early. Their score reflects that they did not fully honour the note durations.

**Why this priority**: Builds on P1 and P2 to close the feedback loop. Without score impact, learners have no long-term incentive to hold notes correctly.

**Independent Test**: Complete a practice session with multiple long notes. Release all of them early. Verify the resulting score is lower than it would be for the same session with correct durations held.

**Acceptance Scenarios**:

1. **Given** a completed practice session where some notes were released too early, **When** the results screen is shown, **Then** those notes are classified separately (e.g., "held too short") and the total score is lower than full credit.
2. **Given** a completed practice session with all notes held correctly, **When** the results screen is shown, **Then** duration is reported as fully correct and does not reduce the score.
3. **Given** a practice session with only quarter notes and eighth notes (short durations), **When** the results are shown, **Then** duration checking is still applied and early releases are still penalised.

---

### User Story 4 - Duration Checking Applies to Chords (Priority: P2)

A learner is practicing a piece with a whole-note chord (multiple simultaneous pitches). All chord pitches must be held for the full duration — releasing any one pitch counts as releasing the chord.

**Why this priority**: Chords are the specific example given in the feature request. This ensures the duration check applies to multi-note events, not just single notes.

**Independent Test**: Load a score with a whole-note chord in 4/4. Press all pitches correctly. Release one pitch after 50% of the measure. Verify the chord is not accepted. Then press all pitches and hold all of them for at least 90% of the measure and verify the chord is accepted.

**Acceptance Scenarios**:

1. **Given** the current target is a whole-note chord, **When** the user presses all required pitches correctly and releases any one before the minimum duration, **Then** the chord is classified as released too early.
2. **Given** the current target is a whole-note chord, **When** the user presses all required pitches and holds all of them for the required duration, **Then** the chord is accepted as correct.

---

### Edge Cases

- What happens when a note's required duration is less than or equal to one quarter note? Duration checking still applies but the tolerance window scales proportionally.
- What happens when the user releases and re-presses the same pitch during a required hold? The release is recorded immediately as "released too early" (half-credit, which cannot be upgraded). The session stays on the same note: the user may re-press the required pitches and complete the hold on retry. The session advances only once the full hold is completed — on the original press or on a subsequent retry. The half-credit outcome is final regardless of retry success.
- What happens in free-practice mode where the user inputs random notes (not from a score)? Duration checking is disabled — it only applies when practicing from a loaded score where note durations are defined.
- What happens when the score has a tempo change mid-practice? Mid-score tempo change events embedded in the score do not affect the required hold duration. The BPM slider is the sole source of truth for hold duration calculation throughout the entire session.
- What happens when the user presses a wrong pitch during an ongoing correct hold? The hold is broken and both errors are recorded (wrong pitch + early release).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The practice system MUST track the duration for which each pressed note or chord is held by the user.
- **FR-002**: For each practice note, the required hold duration MUST be derived from the note's written duration in the score and the active tempo at that position.
- **FR-003**: A note MAY be accepted as correctly held when the user has held all required pitches for at least 90% of the note's required real-time duration.
- **FR-004**: A note MUST be classified as "released too early" when all required pitches are released before 90% of the expected duration has elapsed.
- **FR-005**: Holding a note longer than the required duration MUST be treated as correct — no penalty is applied for over-holding.
- **FR-006**: Duration checking MUST apply to both single notes and chords. For chords, the hold ends as soon as any one active pitch is released.
- **FR-007**: While the user is holding a note that requires a duration longer than a quarter note, the practice view MUST display a visual indicator showing the progression toward the required hold duration. The indicator threshold (quarter note) is independent of the scoring threshold: duration checking and half-credit penalties apply to all note values, including quarter notes and shorter, regardless of whether an indicator is shown.
- **FR-008**: The visual hold indicator MUST disappear immediately if the user releases the note before the required duration.
- **FR-009**: Notes classified as "released too early" MUST be included in the post-session results and counted as half-credit events (equivalent to `correct-late`). An early-release earns 0.5 of the note's credit toward the session score, the same weighting already applied to late responses.
- **FR-010**: Duration checking MUST only be active in score-based practice sessions where the loaded score provides explicit note duration values. It MUST be disabled in random-note or scale practice modes.
- **FR-011**: The required hold duration for each note MUST be derived from the session playback tempo (the BPM value active when the note is presented, as set by the BPM slider). If the learner slows the session tempo, the required hold duration lengthens proportionally. The score's written tempo and any mid-score tempo change events embedded in the score are not used for this calculation — the BPM slider is the sole source of truth for the entire session.
- **FR-012**: After an early-release is recorded for the current note, the session MUST remain on that note and allow the user to re-press the required pitches and complete the hold. The half-credit outcome from the early release is final and cannot be upgraded to full credit by a subsequent successful hold. The session advances to the next note only once the hold duration requirement is fully met (whether on the original attempt or a retry).

### Key Entities

- **Practice Note Target**: A single note or chord the user must play in a practice session. Includes the real-time duration the user must hold the note/chord, derived from the written note duration in the score and the tempo active at that position.
- **Hold Outcome**: The result of a user's hold attempt for a given note — either accepted (held long enough), released too early (released before the minimum hold threshold), or not applicable (duration checking is not active for this session type).
- **Hold Progress**: Transient state tracking what percentage of the required hold duration has elapsed while the user is actively pressing all required pitches. Used to drive the visual hold indicator shown to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a user holds a note for exactly 90% of its required duration, the practice session accepts it and advances to the next note 100% of the time.
- **SC-002**: When a user releases a note at 50% of its required duration, the session never advances and the note is classified as "released too early" 100% of the time.
- **SC-003**: The visual hold indicator updates at a minimum of 60 frames per second (~16 ms per update), ensuring hold progress appears smooth and continuous with no perceptible lag between the user's action and the indicator state.
- **SC-004**: Duration validation is consistent across all note values (whole, half, quarter, eighth, sixteenth) and all supported tempos (20–400 BPM).
- **SC-005**: Sessions composed entirely of quarter notes or shorter notes that are played perfectly in pitch also pass duration validation without any additional user effort beyond normal playing.
- **SC-006**: A learner who repeatedly plays whole notes with early releases receives a lower session score than the same session played with full-duration holds, providing a measurable improvement signal.

## Assumptions

- **A-001**: The 90% minimum hold threshold is an initial default. It may be adjusted based on user feedback without requiring a new specification.
- **A-002**: Over-holding (holding longer than required) is always acceptable. The common music-education standard is that sustaining is a positive, not a mistake.
- **A-003**: Random-note and scale practice modes do not assign durations to notes, so duration checking is out of scope for those modes in this feature.
- **A-004**: The visual hold indicator is shown only for notes with a required duration longer than one quarter note, since shorter notes are played staccato in normal usage and a progress bar would be too brief to be useful. This threshold applies to the indicator only — duration scoring applies to all note values.
- **A-005**: The required hold duration for each note is governed by the session playback tempo (BPM slider), not the score's written tempo. Slowing down the session makes the required hold longer proportionally, which is the correct behaviour for slow-practice techniques.

## Clarifications

### Session 2026-03-09

- Q: After an early-release, does the session stay on the note (allowing retry), advance immediately, or reset the attempt with no penalty? → A: The session stays on the note and allows the user to re-press and complete the hold (retry). The early-release half-credit is recorded immediately and is final — a successful retry advances the session but does not upgrade the outcome to full credit.
- Q: Should the visual hold indicator threshold and the duration scoring threshold be the same value? → A: Decoupled. The indicator is only shown for notes longer than a quarter note. Duration checking and half-credit penalties apply to all note values regardless of whether an indicator is visible.
- Q: Which tempo governs the required hold duration — the session BPM slider or the score's written tempo? → A: The session playback tempo (BPM slider). Slowing the session lengthens the required hold proportionally. The score's written tempo is not used for hold duration calculation.
- Q: What is the minimum update rate for the visual hold indicator? → A: 60 fps (~16 ms per update).
- Q: Do mid-score tempo change events in the score affect the required hold duration? → A: No. The BPM slider is the sole source of truth for hold duration for the entire session. Mid-score tempo events are ignored for hold duration calculation.

## Known Issues & Regression Tests *(if applicable)*

*(No known issues at spec creation. This section will be updated during implementation.)*

