# Feature Specification: Piano and Violin Playback Support

**Feature Branch**: `088-piano-violin-playback`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "add support for playing scores with piano and violin"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear Piano and Violin Parts Together (Priority: P1)

A musician imports a MusicXML file that contains both a piano part (treble + bass staves) and a violin part (single staff). When they press Play, both parts sound simultaneously — the piano using a piano timbre and the violin using a violin timbre — producing a cohesive ensemble playback experience.

**Why this priority**: This is the core of the feature. A score with two instruments displayed visually but played with a single undifferentiated tone is incomplete and misleading. Correct instrument timbres are the minimum viable outcome.

**Independent Test**: Import any piano+violin MusicXML score, press Play, and verify that two audibly distinct timbres are heard simultaneously — one characteristic of a bowed string instrument and one of a keyboard instrument.

**Acceptance Scenarios**:

1. **Given** a score with a piano part and a violin part, **When** the user presses Play, **Then** both parts sound at the same time with audibly distinct timbres matching each instrument.
2. **Given** a score where the violin is silent for the first 4 measures, **When** the user presses Play, **Then** only the piano sounds for those measures; both instruments enter when the violin part begins.
3. **Given** a score with only a piano part (no violin), **When** the user presses Play, **Then** playback works exactly as before — no regression.
4. **Given** a score with only a violin part (no piano), **When** the user presses Play, **Then** the violin plays with violin timbre — no regression and no silence.
5. **Given** a score where the MusicXML does not specify instrument details, **When** the user presses Play, **Then** the system falls back to a generic piano-like tone and playback does not fail.

---

### User Story 2 - Mute Individual Instruments During Playback (Priority: P2)

A musician wants to practice the violin part of a duo. They can mute the violin track and hear only the piano accompaniment, or mute the piano to check the violin melody in isolation. Instrument-level mute controls appear in the Play view when a multi-instrument score is loaded.

**Why this priority**: Being able to isolate one part is a standard feature in sheet music apps and directly supports practice use cases. Without it, the user cannot focus on one instrument.

**Independent Test**: Load a piano+violin score, mute the piano track, press Play, and verify only the violin sound is heard. Then mute the violin and verify only the piano is heard.

**Acceptance Scenarios**:

1. **Given** a two-instrument score is loaded, **When** the user mutes the piano track, **Then** during playback only the violin sounds and the piano is silent.
2. **Given** a two-instrument score is loaded, **When** the user mutes the violin track, **Then** during playback only the piano sounds and the violin is silent.
3. **Given** both tracks are muted, **When** the user presses Play, **Then** playback progresses (auto-scroll, note highlighting) but no audio is heard.
4. **Given** the user has muted the piano track and then un-mutes it, **When** the user presses Play again, **Then** both instruments sound as expected.
5. **Given** a single-instrument score, **When** the user opens Play view, **Then** no mute toggles appear in the instrument label area and the UI is unchanged from current behavior.

---

### User Story 3 - Per-Instrument Volume Balance (Priority: P3)

A musician can independently adjust the volume of each instrument part. A per-instrument volume slider allows them to bring the piano accompaniment lower while keeping the violin melody prominent, matching a desired rehearsal balance.

**Why this priority**: Volume balance between parts is musically important, especially when practicing with accompaniment. However, mute controls (P2) already enable a binary version of this, so precise balance is a refinement.

**Independent Test**: Load a piano+violin score, reduce the violin volume slider to 20%, press Play, and verify the violin is audibly quieter than the piano while both parts are still playing.

**Acceptance Scenarios**:

1. **Given** a two-instrument score is loaded, **When** the user sets the violin volume to 30%, **Then** during playback the violin is noticeably quieter than the piano at its default 100% volume.
2. **Given** the user sets both instruments to 50%, **When** the user presses Play, **Then** the combined loudness is lower than with both at 100%, but both instruments are audible.
3. **Given** the user adjusts per-instrument volume, **When** the page is reloaded, **Then** the volume settings are restored for that score.
4. **Given** a single-instrument score, **When** the user opens Play view, **Then** no per-instrument sliders are shown; the existing master volume slider remains.

---

### Edge Cases

- What happens when a MusicXML file contains more than 2 instruments (e.g., piano + violin + cello)? All parts should receive distinct timbres, not just the first two.
- What happens when the violin part has dynamics beyond the standard range? The system should clamp to the nearest supported velocity without error.
- What happens if the instrument name in the MusicXML is misspelled or non-standard (e.g., "Violyn")? The system should apply a fallback timbre and not crash.
- What happens when the user changes tempo during playback of a multi-instrument score? Both instruments must adjust simultaneously, maintaining synchronisation.
- What happens when a piano brace (treble + bass staves) appears together with a violin staff? The mute control should silence both piano staves together as one instrument unit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST play all instrument parts in a multi-instrument score simultaneously during audio playback.
- **FR-002**: Each instrument part MUST be rendered with a timbre appropriate to its instrument type; at minimum, piano and violin timbres must be audibly distinct.
- **FR-003**: The system MUST map MusicXML instrument declarations (instrument name, MIDI program number, or sound ID) to the appropriate timbre source: piano maps to a bundled audio sample; all other recognised instruments (including violin) map to a Tone.js synthesiser configured with an instrument-appropriate oscillator type and ADSR envelope.
- **FR-004**: When an instrument cannot be identified from the MusicXML, the system MUST fall back to a default piano-like timbre and continue playback without error.
- **FR-005**: The Play view MUST display a mute toggle per instrument, inline with the instrument name label at the left side of each system, when more than one instrument part is present in the loaded score.
- **FR-006**: Muting an instrument MUST silence it immediately during active playback (not only at the next play press).
- **FR-007**: The system MUST treat all staves belonging to the same instrument (e.g., piano treble + bass) as a single muteable unit.
- **FR-008**: Per-instrument volume controls MUST allow independent adjustment from 0% to 100% for each part.
- **FR-009**: Per-instrument volume levels MUST be persisted locally (via localStorage) keyed by score file name + MusicXML part name (e.g., `"MySonata.mxl::Violin I"`) and restored when the same score is reopened.
- **FR-010**: All existing single-instrument playback behaviour MUST remain unchanged (no regression).
- **FR-011**: Note highlighting and auto-scroll MUST continue to work correctly across all instrument staves during multi-instrument playback.
- **FR-012**: The tempo control (10%–200%) MUST apply uniformly to all instrument parts simultaneously.
- **FR-013**: The Train plugin's audio playback is explicitly out of scope; its synthesiser and scheduling logic MUST NOT be modified by this feature.

### Key Entities

- **Instrument Part**: A named part within a score (e.g., "Violin", "Piano") comprising one or more staves. Has a timbre assignment, a mute state, and a volume level.
- **Timbre**: The sound characteristic assigned to an instrument part during playback. Determined by MusicXML instrument data; falls back to a default if unrecognised.
- **Playback Channel**: The audio rendering unit for one instrument part. Carries the timbre, applies per-instrument volume, and respects the mute state.
- **Mute State**: Binary on/off flag per instrument part. When muted, the part's audio is suppressed but playback progression (position, highlighting) continues uninterrupted.
- **Part Volume Key**: A composite string `"<scoreFileName>::<partName>"` used to persist and restore per-instrument volume in localStorage (e.g., `"Sonata.mxl::Violin I"`). Derived from the score's file name and the MusicXML `<part-name>` value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A piano+violin MusicXML score plays back with both parts sounding simultaneously from the first press of Play, without additional user configuration.
- **SC-002**: A unit test asserts that the piano instrument is configured with a sample-based audio source and the violin instrument is configured with a Tone.js synthesiser using a distinct oscillator type and ADSR envelope, confirming the two timbres are structurally different.
- **SC-003**: Muting one instrument takes effect within one audio processing frame during active playback.
- **SC-004**: All existing single-instrument playback tests pass without modification after this feature is implemented.
- **SC-005**: A score with 3 or more instrument parts plays back with each part correctly assigned to its own audio channel and timbre.
- **SC-006**: Per-instrument volume settings survive a page reload and are restored correctly for the same score.
- **SC-007**: No audio glitches, dropouts, or desynchronisation between instrument parts occur during playback at any supported tempo (10%–200%).

## Assumptions

- MusicXML files used with this feature include standard `<score-part>` / `<midi-instrument>` elements with instrument names or MIDI program numbers that can be used for timbre mapping.
- The application already loads and renders multi-instrument scores visually (Feature 023); this feature extends only the audio playback layer.
- Multi-instrument timbre and mute/volume controls apply exclusively to the Play view. The Train plugin's audio engine is unaffected and out of scope for this feature.
- Piano timbre is produced using a bundled audio sample (included in the app bundle, no network fetch required). All other instrument timbres — including violin — are produced using Tone.js synthesisers (oscillator type + ADSR envelope per instrument). No external soundfont library is required. Both approaches are offline-safe and introduce no new runtime dependencies.
- The mute/volume UI is integrated into the existing Play view without requiring a separate mixer panel.
- Instrument-specific volume levels are stored per score, not as a global preference.

## Clarifications

### Session 2026-04-28

- Q: How should instrument timbres be sourced — General MIDI soundfont, Tone.js synthesisers, or bundled audio samples? → A: Hybrid — piano uses a bundled audio sample; all other instruments (e.g., violin) use Tone.js synthesisers (oscillator + ADSR envelope). Both are offline-safe with no new runtime dependencies.
- Q: What is the persistence identity key for per-instrument volume settings? → A: Score file name + MusicXML part name (e.g., `"Sonata.mxl::Violin I"`) stored in localStorage.
- Q: Where are the mute controls placed in the Play view UI? → A: Inline with the instrument name label at the left of each system in the score view.
- Q: Does multi-instrument timbre/mute support apply to the Train plugin as well as the Play view? → A: Play view only; Train plugin audio is unchanged and out of scope.
- Q: How is SC-002 (timbre distinction) verified in automated tests? → A: Unit test asserts piano uses a sample-based source and violin uses a Tone.js synth with distinct oscillator type + ADSR; piano samples vs. synth for all other instruments.

