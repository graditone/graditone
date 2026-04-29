# Feature Specification: Piano Practice with Violin Accompaniment Playback

**Feature Branch**: `089-piano-violin-practice`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "Support Piano Practice with Violin playback - If the practice score has a violin and a piano, when you practice piano performance, you can hear the violin playback to pair with the piano practice"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Violin Plays Back Automatically During Piano Practice (Priority: P1)

A piano student opens a violin+piano sonata score. They open the Practice plugin to practice the piano part. As they start playback in practice mode, the violin part plays back automatically as accompaniment. The student hears the full musical context of the piece — the violin melody against their piano performance — making it easier to stay in time and match phrasing.

**Why this priority**: This is the core value of the feature. Without the violin playing, a pianist practicing an ensemble piece lacks the melodic context that drives their accompaniment choices. Hearing the partner instrument is the primary reason such scores exist in this context.

**Independent Test**: Load a two-instrument score (violin + piano) in the Practice plugin, enable practice mode, start playback, and verify that the violin part plays back throughout the practice session while the piano practice proceeds normally.

**Acceptance Scenarios**:

1. **Given** a score containing a violin part and a piano part is loaded, **When** the user starts a piano practice exercise, **Then** the violin part plays back automatically in sync with the exercise.
2. **Given** a violin+piano practice session is active, **When** playback reaches a measure where only the violin has notes, **Then** the violin audio is heard and no piano notes are expected from the user at that moment.
3. **Given** a violin+piano practice session is active, **When** playback reaches a measure where both instruments have simultaneous notes, **Then** the violin plays back and the user is expected to play the piano notes.
4. **Given** a score containing only piano parts (no violin), **When** the user starts a practice exercise, **Then** behaviour is identical to today — no accompaniment plays and no violin-related UI is shown.

---

### User Story 2 - Violin Accompaniment Volume Is Independently Adjustable (Priority: P2)

A student finds the violin playback too loud relative to their piano playing and wants to lower it. They adjust a violin volume slider without affecting the piano playback volume. Alternatively, they silence the violin entirely to practice unaccompanied, then bring it back for the next round.

**Why this priority**: Accompaniment balance is a core musical need. A single global volume knob would not allow the student to choose how prominent the violin is relative to their own playing feedback.

**Independent Test**: Load a violin+piano score in the Practice plugin, start playback in practice mode, adjust the violin accompaniment volume control, and confirm that the violin gets louder/quieter without affecting the piano note feedback volume.

**Acceptance Scenarios**:

1. **Given** a violin+piano practice session is active, **When** the user decreases the violin volume control, **Then** the violin accompaniment becomes quieter while piano note playback volume is unchanged.
2. **Given** a violin+piano practice session is active, **When** the user sets the violin volume to zero (mute), **Then** the violin is completely silent for that and subsequent rounds until the volume is raised.
3. **Given** the user has adjusted the violin volume, **When** they stop and restart the practice session, **Then** the adjusted volume level is retained.

---

### User Story 3 - Violin Accompaniment Follows Practice Tempo (Priority: P2)

A student is practicing a difficult passage at 60% of the score's original tempo using the Practice plugin's tempo multiplier. The violin accompaniment plays back at the same reduced tempo, staying perfectly in sync with the slowed-down practice session.

**Why this priority**: If the violin plays at full tempo while the piano practice is slowed down, the two are out of sync, making the accompaniment useless or distracting.

**Independent Test**: Load a violin+piano score in the Practice plugin, set the tempo multiplier to below 100%, start playback in practice mode, and verify the violin playback is aligned with the adjusted tempo.

**Acceptance Scenarios**:

1. **Given** the tempo multiplier is set to a value less than 100%, **When** a violin+piano practice session starts, **Then** the violin plays back at the same scaled tempo as the practice session.
2. **Given** the user changes the tempo multiplier mid-session, **When** playback is restarted, **Then** the violin accompaniment plays at the newly selected tempo.

---

### User Story 4 - Violin Accompaniment Works With One-Hand Practice Mode (Priority: P3)

A student practices only the right hand of the piano part while hearing the violin. They select the piano treble staff in the Practice plugin's staff dropdown (feature 084); only treble-staff piano notes are expected from the user, but the violin still plays back in full as accompaniment.

**Why this priority**: One-hand mode (feature 084) is a sibling feature in the Practice plugin; both must coexist without conflict. A student isolating one piano hand still benefits from hearing the violin partner.

**Independent Test**: Load a violin+piano score in the Practice plugin, select the piano treble staff from the staff dropdown, start practice mode, and verify that the violin plays back while only right-hand piano notes are active.

**Acceptance Scenarios**:

1. **Given** a violin+piano score is loaded and the piano treble staff is selected in the staff dropdown, **When** the practice session runs, **Then** the violin accompaniment plays in full while only treble-staff piano notes are expected from the user.
2. **Given** a violin+piano score is loaded and the piano bass staff is selected in the staff dropdown, **When** the practice session runs, **Then** the violin plays and only bass-staff piano notes are expected.

---

### Edge Cases

- What happens when the score has two violin parts and one piano part? All non-piano parts play back together as accompaniment; both violin parts are heard.
- What happens when the score has violin but no piano part? The feature does not activate; the score is treated as a non-piano score and is not available for piano practice.
- What happens when MusicXML instrument metadata is absent or ambiguous and the piano part cannot be identified? Piano practice mode is unavailable for that score; the system fails closed rather than guessing.
- What happens if the violin part and piano part have different lengths? Violin playback follows the loaded score's measure range; if the violin has no notes in a given measure it is silent for that measure.
- What happens during the lead-in / count-in before the session? The violin plays its notated score notes during lead-in measures (same behaviour as the Play view); it does not stay silent during the lead-in.
- What happens when the user pauses or restarts mid-session? Violin playback pauses and restarts in lockstep with the Practice plugin's playback state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the loaded score contains at least one violin part and at least one piano part, the system MUST play back the violin part during Practice plugin sessions.
- **FR-002**: Violin accompaniment playback MUST be synchronised with the practice session at all times — same tempo multiplier, same current measure, same start/stop/pause events — including lead-in measures, during which the violin plays its notated score notes.
- **FR-003**: The system MUST provide an independent volume control for the violin accompaniment, separate from the piano note feedback volume.
- **FR-004**: The violin accompaniment volume control MUST support the full range from fully muted (silent) to fully audible, defaulting to **70%**.
- **FR-005**: The violin accompaniment volume setting MUST persist across practice runs and across score changes within the same page session; it resets to the default only on a full page reload.
- **FR-006**: Violin accompaniment MUST play back at the tempo produced by the Practice plugin's tempo multiplier, staying in sync with the score player at all times.
- **FR-007**: Violin accompaniment MUST coexist with one-hand mode (feature 084 — Practice plugin staff dropdown): the violin plays in full regardless of which piano staff is selected.
- **FR-008**: For scores with no violin part, no violin-related controls or behaviour MUST be visible or active.
- **FR-009**: For scores with multiple non-piano instrument parts, all non-piano parts MUST play back together as accompaniment.
- **FR-010**: Violin accompaniment MUST pause, resume, and restart in lockstep with the Practice plugin's playback state.
- **FR-011**: If the loaded score's piano part cannot be unambiguously identified from MusicXML instrument metadata, the piano practice mode MUST be unavailable for that score; no violin accompaniment controls are shown.

### Key Entities

- **Accompaniment Part**: One or more non-piano instrument parts from the loaded score that play back automatically during piano practice. For violin+piano scores, this is the violin part(s).
- **Piano Part**: The part(s) in the score assigned to piano; this is the instrument the user practices and is detected via MIDI.
- **Accompaniment Volume**: An independent gain setting (0–100%) for the accompaniment parts, distinct from the piano note feedback volume. Persists across practice runs within the same page session.
- **Practice Session**: A single playback run in the Practice plugin from play to stop; violin accompaniment is active for its full duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a violin+piano score is loaded in the Practice plugin, violin accompaniment plays back during 100% of practice sessions without any additional user setup required.
- **SC-002**: The violin accompaniment and piano practice session remain in sync — no audible drift across any score at any supported tempo multiplier.
- **SC-003**: Adjusting the violin volume takes no more than one user interaction (a single slider move or tap).
- **SC-004**: Scores without a violin part show zero new UI elements — existing Practice plugin behaviour is fully preserved.
- **SC-005**: One-hand piano practice with violin accompaniment produces no regressions in note detection or scoring accuracy compared to one-hand practice without accompaniment.

## Assumptions

- The system can identify which parts in a loaded MusicXML score are piano parts and which are violin (or other non-piano) parts, using instrument metadata already present in MusicXML.
- The violin accompaniment is rendered from the score's notation data (same source as piano note scheduling), not from a separate audio file.
- **Audio synthesis uses the same pipeline as the Play view**, which already plays piano and violin parts together. No separate engine or instance is introduced; the accompaniment is routed through the existing shared audio engine with an independent gain node for volume control.
- The accompaniment volume control is placed in the Practice plugin's toolbar, near the existing tempo multiplier and MIDI controls.
- "Violin" in this context means any part tagged as a violin instrument in the MusicXML; the feature is generalised to "all non-piano parts" to avoid instrument-by-instrument special casing.
- The feature applies to the Practice plugin only; the Train plugin (note drills) is unaffected.
- Accompaniment volume is stored in global page-session state (e.g. a shared store or context), shared across all loaded scores; it does not need to survive full page reloads.

## Clarifications

### Session 2026-04-29

- Q: What audio synthesis approach should be used for violin accompaniment playback? → A: Use the same pipeline as the Play view, which already supports playing piano and violin together (shared engine, independent gain channel).
- Q: What is the default accompaniment volume level? → A: 70%.
- Q: What is the persistence scope for the accompaniment volume setting? → A: Global per page session — shared across score changes, resets on full page reload.
- Q: What is the fallback when piano part identification from MusicXML metadata is ambiguous? → A: Fail closed — piano practice mode is unavailable for that score.
- Q: Does the violin play during the count-in / lead-in measures? → A: Yes — plays notated score notes during lead-in (same as Play view).

