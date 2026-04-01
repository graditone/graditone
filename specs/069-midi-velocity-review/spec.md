# Feature Specification: Review MIDI Keys Velocity

**Feature Branch**: `069-midi-velocity-review`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Review MIDI keys velocity. In the Recording view we are going to add additional information to show all MIDI received information from the MIDI controller."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Velocity for Each Played Note (Priority: P1)

As a musician practicing with a MIDI controller, I want to see the velocity value for each note I play in the Recording view so I can understand and improve my touch dynamics.

**Why this priority**: Velocity is the most fundamental piece of MIDI data currently captured but not displayed. Showing it alongside existing note history provides immediate value with minimal UI disruption.

**Independent Test**: Can be tested by connecting a MIDI controller, playing notes at varying dynamics, and verifying velocity values appear next to each note in the note history list.

**Acceptance Scenarios**:

1. **Given** a MIDI controller is connected and the Recording view is open, **When** the user plays a note with soft touch, **Then** a low velocity value (e.g., 20–50) is displayed next to the note label and elapsed time in the note history.
2. **Given** a MIDI controller is connected and the Recording view is open, **When** the user plays a note with hard touch, **Then** a high velocity value (e.g., 100–127) is displayed next to the note label and elapsed time in the note history.
3. **Given** the user is in microphone input mode (no MIDI), **When** they view the note history, **Then** no velocity column or indicator is shown.

---

### User Story 2 - Visual Velocity Indicator (Priority: P2)

As a musician, I want a visual representation of velocity (e.g., a bar or color intensity) for each note so I can quickly scan my dynamics at a glance without reading numbers.

**Why this priority**: A visual indicator provides faster feedback than numeric values alone, helping musicians develop consistent touch. It builds on the numeric display from P1.

**Independent Test**: Can be tested by playing notes at minimum, medium, and maximum velocity and verifying the visual indicator scales proportionally.

**Acceptance Scenarios**:

1. **Given** a MIDI controller is connected and Recording view is open, **When** the user plays a note at velocity 1, **Then** the visual velocity indicator shows a minimal level.
2. **Given** a MIDI controller is connected and Recording view is open, **When** the user plays a note at velocity 127, **Then** the visual velocity indicator shows a full/maximum level.
3. **Given** a MIDI controller is connected and Recording view is open, **When** the user plays a note at velocity 64 (medium), **Then** the visual velocity indicator shows an approximately half-full level.

---

### User Story 3 - Display MIDI Channel Information (Priority: P3)

As a musician using a multi-channel MIDI controller or layered setup, I want to see the MIDI channel number for each received note so I can verify that notes are arriving on the expected channel.

**Why this priority**: Channel information is already captured in the MIDI event data. While less commonly needed than velocity, it is essential for users with multi-channel setups to diagnose routing issues.

**Independent Test**: Can be tested by sending MIDI notes on different channels and verifying the correct channel number appears for each note.

**Acceptance Scenarios**:

1. **Given** a MIDI controller is connected and Recording view is open, **When** the user plays a note on channel 1, **Then** the channel number "Ch 1" is displayed alongside the note entry.
2. **Given** a MIDI controller sends notes on channel 10 (percussion), **When** the Recording view receives the note, **Then** "Ch 10" is displayed for that note entry.

---

### User Story 4 - View Raw MIDI Message Data (Priority: P4)

As a musician or developer troubleshooting MIDI connectivity, I want to see raw MIDI message details (status byte, data bytes) in an expandable detail view so I can diagnose controller issues or understand exactly what data the controller sends.

**Why this priority**: This is a power-user/debug feature. While highly useful for troubleshooting, most users will rely on the formatted velocity and channel information from P1–P3.

**Independent Test**: Can be tested by playing a note and expanding the detail view to verify raw byte values match the expected MIDI protocol encoding.

**Acceptance Scenarios**:

1. **Given** a MIDI controller is connected and Recording view is open, **When** the user plays a note and expands its detail view, **Then** raw MIDI bytes are displayed (e.g., status: 0x90, data1: 60, data2: 100).
2. **Given** a MIDI CC message is received, **When** the user views recent MIDI activity, **Then** the CC message appears with controller number and value.

---

### Edge Cases

- What happens when velocity is exactly 0? (MIDI spec treats note-on with velocity 0 as note-off; the system should not display a velocity-0 note in the history.)
- What happens when the MIDI device disconnects mid-session? (Existing disconnect handling continues; the note history retains all previously received MIDI data with its velocity and channel info.)
- What happens when the note history reaches the 200-entry cap? (Oldest entries are removed as before; the velocity and channel data is removed along with the entry.)
- How does the display behave when notes arrive in rapid succession (e.g., fast arpeggios)? (Each note is appended to the list individually with its own velocity and channel; the scrollable list handles high throughput.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the velocity value (1–127) for each MIDI note event in the Recording view note history.
- **FR-002**: System MUST display a visual velocity indicator that scales proportionally from velocity 1 (minimum) to velocity 127 (maximum) for each MIDI note event.
- **FR-003**: System MUST display the MIDI channel number (1–16) for each MIDI note event in the Recording view note history.
- **FR-004**: System MUST provide an expandable detail view for each MIDI note event showing the raw MIDI message data (status byte, note number, velocity byte).
- **FR-005**: System MUST display received MIDI CC (Control Change) messages in the MIDI activity view, showing controller number and value.
- **FR-006**: System MUST hide velocity, channel, and raw MIDI data columns when the input source is microphone (not MIDI).
- **FR-007**: System MUST continue to display note label and elapsed time for each note as it does currently, adding the new MIDI data alongside without removing existing information.
- **FR-008**: System MUST preserve all MIDI detail data (velocity, channel, raw bytes) when entries are in the note history, and remove them together when the 200-entry cap causes eviction.

### Key Entities

- **MidiNoteEvent (enhanced display)**: Represents a single MIDI note onset displayed in the Recording view. Key attributes: note label, velocity (1–127), channel (1–16), elapsed time, raw status byte, raw data bytes.
- **MidiCCEvent (new display)**: Represents a MIDI Control Change message displayed in the MIDI activity view. Key attributes: controller number, value (0–127), channel (1–16), elapsed time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see the velocity value for every MIDI note they play within the Recording view upon playing the note (no perceptible delay).
- **SC-002**: The visual velocity indicator accurately represents the velocity proportionally—users can distinguish between soft (pp), medium (mf), and loud (ff) touches at a glance.
- **SC-003**: Users can identify which MIDI channel each note arrived on without needing external MIDI monitoring tools.
- **SC-004**: Users can access raw MIDI byte data for any note event within two interactions (e.g., one tap/click to expand).
- **SC-005**: The Recording view remains responsive and usable when receiving up to 50 notes per second with full MIDI detail display.
- **SC-006**: 90% of users with a MIDI controller can confirm their controller's velocity sensitivity is working correctly using the Recording view alone.
