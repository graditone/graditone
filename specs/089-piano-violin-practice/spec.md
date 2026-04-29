# Feature Specification: Piano Practice with Violin Accompaniment Playback

**Feature Branch**: `089-piano-violin-practice`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "Support Piano Practice with Violin playback - If the practice score has a violin and a piano, when you practice piano performance, you can hear the violin playback to pair with the piano practice"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Violin Plays Back Automatically During Piano Practice (Priority: P1)

A piano student opens a violin+piano sonata score. They enter the Train plugin in score-preset mode to practice the piano part. As the exercise begins, the violin part plays back automatically as accompaniment. The student hears the full musical context of the piece — the violin melody against their piano performance — making it easier to stay in time and match phrasing.

**Why this priority**: This is the core value of the feature. Without the violin playing, a pianist practicing an ensemble piece lacks the melodic context that drives their accompaniment choices. Hearing the partner instrument is the primary reason such scores exist in this context.

**Independent Test**: Load a two-instrument score (violin + piano) in the Train plugin score-preset mode, start an exercise, and verify that the violin part plays back throughout the exercise while the piano practice proceeds normally.

**Acceptance Scenarios**:

1. **Given** a score containing a violin part and a piano part is loaded, **When** the user starts a piano practice exercise, **Then** the violin part plays back automatically in sync with the exercise.
2. **Given** a violin+piano exercise is active, **When** playback reaches a measure where only the violin has notes, **Then** the violin audio is heard and no piano notes are expected from the user at that moment.
3. **Given** a violin+piano exercise is active, **When** playback reaches a measure where both instruments have simultaneous notes, **Then** the violin plays back and the user is expected to play the piano notes.
4. **Given** a score containing only piano parts (no violin), **When** the user starts a practice exercise, **Then** behaviour is identical to today — no accompaniment plays and no violin-related UI is shown.

---

### User Story 2 - Violin Accompaniment Volume Is Independently Adjustable (Priority: P2)

A student finds the violin playback too loud relative to their piano playing and wants to lower it. They adjust a violin volume slider without affecting the piano playback volume. Alternatively, they silence the violin entirely to practice unaccompanied, then bring it back for the next round.

**Why this priority**: Accompaniment balance is a core musical need. A single global volume knob would not allow the student to choose how prominent the violin is relative to their own playing feedback.

**Independent Test**: Load a violin+piano score, start a practice exercise, adjust the violin accompaniment volume control, and confirm that the violin gets louder/quieter without affecting the piano note feedback volume.

**Acceptance Scenarios**:

1. **Given** a violin+piano exercise is active, **When** the user decreases the violin volume control, **Then** the violin accompaniment becomes quieter while piano note playback volume is unchanged.
2. **Given** a violin+piano exercise is active, **When** the user sets the violin volume to zero (mute), **Then** the violin is completely silent for that and subsequent rounds until the volume is raised.
3. **Given** the user has adjusted the violin volume, **When** they restart the exercise, **Then** the adjusted volume level is retained.

---

### User Story 3 - Violin Accompaniment Follows Practice Tempo (Priority: P2)

A student is practicing a difficult passage at 60% of the score's original tempo using the tempo setting. The violin accompaniment plays back at the same reduced tempo, staying perfectly in sync with the slowed-down piano exercise.

**Why this priority**: If the violin plays at full tempo while the piano practice is slowed down, the two are out of sync, making the accompaniment useless or distracting.

**Independent Test**: Load a violin+piano score, set practice tempo to below 100%, start an exercise, and verify the violin playback is aligned with the adjusted tempo.

**Acceptance Scenarios**:

1. **Given** the practice tempo is set to a value less than 100%, **When** a violin+piano exercise starts, **Then** the violin plays back at the same tempo as the practice exercise.
2. **Given** the user changes the tempo mid-session, **When** the next exercise round begins, **Then** the violin accompaniment starts at the newly selected tempo.

---

### User Story 4 - Violin Accompaniment Works With One-Hand Practice Mode (Priority: P3)

A student practices only the right hand of the piano part while hearing the violin. They select "Right hand" in the Train plugin; only piano treble-staff notes are expected from the user, but the violin still plays back in full as accompaniment.

**Why this priority**: One-hand mode (feature 084) is a sibling feature; both must coexist without conflict. A student isolating one piano hand still benefits from hearing the violin partner.

**Independent Test**: Load a violin+piano score, select right-hand-only piano mode, start an exercise, and verify that the violin plays back while only right-hand piano notes are active in the exercise.

**Acceptance Scenarios**:

1. **Given** a violin+piano score is loaded and right-hand-only piano mode is selected, **When** the exercise runs, **Then** the violin accompaniment plays in full while only treble-staff piano notes are expected from the user.
2. **Given** a violin+piano score is loaded and left-hand-only piano mode is selected, **When** the exercise runs, **Then** the violin plays and only bass-staff piano notes are expected.

---

### Edge Cases

- What happens when the score has two violin parts and one piano part? All non-piano parts play back together as accompaniment; both violin parts are heard.
- What happens when the score has violin but no piano part? The feature does not activate; the score is treated as a non-piano score and is not available for piano practice.
- What happens if the violin part and piano part have different lengths? Violin playback follows the piano exercise measure range; if the violin has no notes in a given measure it is silent for that measure.
- What happens during the lead-in / count-in before the exercise? The violin starts playback from the same point as the piano exercise, including any lead-in measures.
- What happens when the user pauses or restarts mid-exercise? Violin playback pauses and restarts in lockstep with the piano exercise state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the loaded score contains at least one violin part and at least one piano part, the system MUST play back the violin part during piano practice exercises.
- **FR-002**: Violin accompaniment playback MUST be synchronised with the piano exercise at all times — same tempo, same current measure, same start/stop events.
- **FR-003**: The system MUST provide an independent volume control for the violin accompaniment, separate from the piano note feedback volume.
- **FR-004**: The violin accompaniment volume control MUST support the full range from fully muted (silent) to fully audible, defaulting to a clearly audible but not dominant level.
- **FR-005**: The violin accompaniment volume setting MUST persist across exercise rounds within the same session.
- **FR-006**: Violin accompaniment MUST play back at whatever tempo the practice session is set to, matching the exercise tempo exactly.
- **FR-007**: Violin accompaniment MUST coexist with one-hand piano practice mode: the violin plays in full regardless of which piano hand is selected.
- **FR-008**: For scores with no violin part, no violin-related controls or behaviour MUST be visible or active.
- **FR-009**: For scores with multiple non-piano instrument parts, all non-piano parts MUST play back together as accompaniment.
- **FR-010**: Violin accompaniment MUST pause, resume, and restart in lockstep with the piano exercise playback state.

### Key Entities

- **Accompaniment Part**: One or more non-piano instrument parts from the loaded score that play back automatically during piano practice. For violin+piano scores, this is the violin part(s).
- **Piano Part**: The part(s) in the score assigned to piano; this is the instrument the user practices and is detected via MIDI.
- **Accompaniment Volume**: An independent gain setting (0–100%) for the accompaniment parts, distinct from piano feedback volume. Persists within a session.
- **Practice Exercise**: A single run of the Train plugin from start to results screen; violin accompaniment is active for its full duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a violin+piano score is loaded, violin accompaniment plays back during 100% of exercise runs without any additional user setup required.
- **SC-002**: The violin accompaniment and piano exercise remain in sync — no audible drift across any score at any supported tempo.
- **SC-003**: Adjusting the violin volume takes no more than one user interaction (a single slider move or tap).
- **SC-004**: Scores without a violin part show zero new UI elements — existing behaviour is fully preserved.
- **SC-005**: One-hand piano practice exercises with violin accompaniment produce no regressions in note detection or scoring accuracy compared to one-hand exercises without accompaniment.

## Assumptions

- The system can identify which parts in a loaded MusicXML score are piano parts and which are violin (or other non-piano) parts, using instrument metadata already present in MusicXML.
- The violin accompaniment is rendered from the score's notation data (same source as piano note scheduling), not from a separate audio file.
- The accompaniment volume control is placed in the Train plugin's configuration panel, near the existing tempo and MIDI volume controls.
- "Violin" in this context means any part tagged as a violin instrument in the MusicXML; the feature is generalised to "all non-piano parts" to avoid instrument-by-instrument special casing.
- The feature applies to the Train plugin's score-preset mode; free-practice or scales modes are unaffected.
- Accompaniment volume is stored in component or session state and does not need to survive full page reloads for the initial implementation.

