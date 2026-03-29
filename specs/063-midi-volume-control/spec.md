# Feature Specification: MIDI Volume Control

**Feature Branch**: `063-midi-volume-control`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: User description: "MIDI volume control — honour MIDI control and use the tablet sound as precise as possible, using its full power."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear dynamics when playing back a score (Priority: P1)

A pianist loads a score (e.g., Chopin Nocturne Op.9 No.2) and presses Play. The music plays back with varying volume that follows the dynamic markings written in the score — soft passages sound soft, loud passages sound loud, and gradual changes (crescendo/diminuendo) produce smooth volume transitions. The listener perceives an expressive, musically natural performance instead of a flat, robotic rendering.

**Why this priority**: Without dynamics in score playback, every note sounds identical regardless of what the composer wrote. This is the single biggest gap in audio realism and affects every user who presses Play.

**Independent Test**: Load a score containing at least two contrasting dynamic markings (e.g., pp and ff). Press Play and verify that the louder passage is audibly louder than the softer one.

**Acceptance Scenarios**:

1. **Given** a score with a `pp` marking at measure 1 and an `ff` marking at measure 5, **When** the user plays the score, **Then** notes under the `ff` marking are audibly louder than notes under the `pp` marking.
2. **Given** a score with a crescendo spanning measures 3–6, **When** the user plays through those measures, **Then** volume increases gradually from the starting dynamic to the ending dynamic.
3. **Given** a score with no dynamic markings at all, **When** the user plays the score, **Then** all notes play at a default moderate volume (mezzo-forte), matching current behaviour.

---

### User Story 2 - Hear touch-sensitive response from a MIDI keyboard (Priority: P2)

A pianist connects a MIDI keyboard (or uses the virtual keyboard) and plays notes with varying force. The sound output faithfully reflects their touch — soft keystrokes produce quiet sounds; hard keystrokes produce loud sounds. The full dynamic range of the hardware is utilised rather than clamped to a narrow band.

**Why this priority**: Users who own MIDI keyboards expect their instrument's touch sensitivity to translate directly into sound. This already partially works for note-on velocity but the full range is compressed and MIDI volume/expression controls are ignored.

**Independent Test**: Connect a MIDI keyboard, play one key very softly and then very hard. Verify the volume difference is clearly audible and proportional to the touch force.

**Acceptance Scenarios**:

1. **Given** a connected MIDI keyboard, **When** the user plays a note with velocity 20 (very soft), **Then** the sound is noticeably quieter than a note played with velocity 120 (very loud).
2. **Given** a connected MIDI keyboard that sends MIDI CC7 (channel volume) messages, **When** the user adjusts the volume slider/knob on their keyboard, **Then** the overall output volume changes accordingly.
3. **Given** a connected MIDI keyboard that sends MIDI CC11 (expression) messages, **When** the user uses an expression pedal or slider, **Then** the sound volume responds in real time.

---

### User Story 3 - Adjust master volume (Priority: P3)

A user wants to control the overall output volume of the application without changing their device's system volume. They find a volume control in the UI, and adjusting it scales the entire audio output (playback, live input sound, metronome) proportionally.

**Why this priority**: A master volume control is a basic usability expectation for any audio application and prevents the user from having to leave the app to adjust system volume, which disrupts the practice flow.

**Independent Test**: Play a score, and while it is playing, drag the volume slider up and down. Verify the output volume changes smoothly and immediately in response.

**Acceptance Scenarios**:

1. **Given** the application is producing audio (playback, live input, or metronome), **When** the user moves the master volume control to its minimum, **Then** the output is silent.
2. **Given** the application is producing audio, **When** the user moves the master volume control to its maximum, **Then** the output is at full level with no distortion or clipping.
3. **Given** the user has set a master volume level, **When** they close and reopen the application, **Then** the volume level is preserved.

---

### Edge Cases

- What happens when a score has conflicting dynamics on simultaneous notes (e.g., `ff` on one staff and `pp` on another)? Each staff should honour its own dynamic level independently.
- What happens when a MIDI keyboard sends velocity 0 on a note-on message? This should be treated as a note-off, per the MIDI specification.
- What happens during a crescendo that spans across a repeat or a D.S.? The dynamic ramp should reset and replay as written on each pass.
- What happens if the user's MIDI keyboard never sends CC messages (velocity-only)? The system should work correctly with velocity alone; CC support is additive.
- What happens if the master volume is at zero and the user triggers practice mode feedback? No audio should be emitted.

## Clarifications

### Session 2026-03-29

- Q: What velocity-to-gain curve shape should be used? → A: Logarithmic (industry standard, matches human loudness perception)
- Q: What dynamic level applies when the user seeks/jumps to an arbitrary score position? → A: Scan backwards to find the most recent dynamic marking; if mid-crescendo, interpolate to exact position; if none found, default to mf
- Q: Where should dynamics extraction from MusicXML happen? → A: Backend Rust/WASM engine (alongside existing MusicXML importer), exposed via the WASM API to the frontend
- Q: Should accent-type dynamics (sfz, fp, sfp, accent marks) be in scope? → A: Out of scope; these require per-note volume envelopes and are deferred to a future feature
- Q: Where should the master volume control be placed in the UI? → A: In the playback toolbar, as a vertical slider to minimise horizontal space usage

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST extract dynamic markings (pp, p, mp, mf, f, ff, and their extensions ppp/fff) from imported scores via the backend Rust/WASM MusicXML importer and expose them through the WASM API, associating them with the correct note positions.
- **FR-001a**: Accent-type dynamic modifiers (sfz, fp, sfp, and accent marks) are explicitly OUT OF SCOPE for this feature and will not be extracted or applied. They are deferred to a future enhancement.
- **FR-002**: The system MUST extract gradual dynamic changes (crescendo, diminuendo / decrescendo, including hairpins) from imported scores via the backend Rust/WASM MusicXML importer and expose them through the WASM API, including their start and end positions.
- **FR-003**: During score playback, the system MUST vary the volume of each note according to the active dynamic marking at that note's position.
- **FR-004**: During score playback, the system MUST interpolate volume smoothly across notes that fall within a crescendo or diminuendo region.
- **FR-005**: When no dynamic marking is present in a score, the system MUST default to a mezzo-forte level, preserving current behaviour.
- **FR-005a**: When the user seeks or jumps to an arbitrary position during playback, the system MUST determine the active dynamic level by scanning backwards to the most recent dynamic marking. If the position falls within an active crescendo or diminuendo, the system MUST interpolate to the correct level at that exact position. If no prior marking exists, the system MUST default to mezzo-forte.
- **FR-006**: The system MUST use the full velocity range (1–127) from incoming MIDI note-on messages to scale the output volume of live-played notes using a logarithmic gain curve, producing a clearly audible and perceptually even difference between the softest and loudest touch.
- **FR-007**: The system MUST handle MIDI CC7 (Channel Volume) messages from a connected MIDI controller and scale the output volume of live-played notes accordingly.
- **FR-008**: The system MUST handle MIDI CC11 (Expression) messages from a connected MIDI controller and scale the output volume of live-played notes accordingly, layered on top of CC7.
- **FR-009**: The system MUST provide a master volume control in the playback toolbar, rendered as a vertical slider (to minimise horizontal space) with an accompanying speaker icon.
- **FR-010**: The master volume control MUST scale all audio output (score playback, live input sound, metronome) uniformly.
- **FR-011**: The system MUST persist the user's master volume setting across sessions.
- **FR-012**: The system MUST prevent audio clipping when high-velocity notes combine with a high master volume setting.

### Key Entities

- **Dynamic Marking**: A volume instruction attached to a score position (e.g., pp, mf, ff). Has a position (measure + beat), a level, and a scope (which staff/voice it applies to).
- **Gradual Dynamic**: A volume transition between two positions (e.g., crescendo from m3 beat 1 to m5 beat 1). Has a start position, end position, start level, and end level.
- **Note Velocity**: A per-note intensity value (1–127) derived from either the score's dynamics or a MIDI input event. Maps to audio output gain.
- **Master Volume**: A user-controlled global gain level (0–100%) applied to all audio output before it reaches the speakers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When playing a score with both pp and ff markings, the loudest notes are at least 4× the perceived loudness of the softest notes (approximately 12 dB difference).
- **SC-002**: Users can distinguish at least 5 distinct loudness levels (ppp, pp, p, mp, mf, f, ff, fff are all audibly different) during score playback.
- **SC-003**: When a user plays notes at MIDI velocity 10 and velocity 120 on a connected keyboard, the volume difference is clearly audible and proportional.
- **SC-004**: Adjusting the master volume control produces an immediate, smooth change in output level with no audible clicks or pops.
- **SC-005**: The master volume setting survives an application restart without user intervention.
- **SC-006**: No audio clipping or distortion occurs at any combination of dynamic level, MIDI velocity, and master volume setting.

## Assumptions

- The Salamander Grand Piano samples used by the application already contain natural volume variation across velocity layers. The system should leverage these sample layers rather than applying only synthetic gain scaling.
- Standard MIDI dynamic-to-velocity mapping will be used: ppp ≈ 16, pp ≈ 33, p ≈ 49, mp ≈ 64, mf ≈ 80, f ≈ 96, ff ≈ 112, fff ≈ 127.
- A logarithmic velocity-to-gain curve will be used for all velocity-to-volume conversions (both score playback and live input), matching industry-standard DAW/VST behaviour and human loudness perception.
- MIDI CC7 and CC11 follow the standard 0–127 range and are multiplicative (Expression scales Channel Volume).
- The metronome volume scales with the master volume like all other audio.
- Dynamics extraction will be implemented in the backend Rust engine as part of the existing MusicXML importer (single source of truth for all score data), with results exposed to the frontend through the WASM interface.

## Known Issues & Regression Tests *(if applicable)*

<!--
  This section is intentionally empty at spec creation time.
  Issues will be added as they are discovered during implementation.
-->

