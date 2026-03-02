# Feature Specification: Metronome for Play and Practice Views

**Feature Branch**: `035-metronome`  
**Created**: 2026-03-02  
**Status**: Draft  
**Input**: User description: "Add a metronome to play and practice views. It is started/stopped with a metronome icon in the toolbar, place to the right. The metronome must be in sync with the tempo definition."

## Clarifications

### Session 2026-03-02

- Q: Should the metronome provide a visual beat signal in addition to audio? → A: Visual pulse on each beat — the icon (or a dedicated beat indicator) flashes/pulses in sync with every beat.
- Q: When playback and the metronome run simultaneously, what is the metronome's clock source? → A: Locked to playback clock — metronome beats are phase-aligned with the playback position, not a free-running independent timer.
- Q: What is the supported BPM range and how should out-of-range values be handled? → A: Clamp to 20–300 BPM — values outside this range are silently clamped to the nearest boundary; a warning may be logged.
- Q: When running standalone (no playback active), how does the metronome determine beat 1? → A: Reset measure counter on start — the metronome always begins at beat 1 of the time signature when toggled on, counting forward independently of score position.
- Q: How should the metronome handle browser audio autoplay restrictions? → A: Attempt unlock silently on first activation; if blocked, show a brief inline message prompting the user to tap/click anywhere to enable audio, then automatically start the metronome once unlocked.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle Metronome in Play View (Priority: P1)

A musician opens a score in the play view. They want an audible beat guide while listening to or following the score. They tap the metronome icon in the toolbar (far right). The metronome starts ticking at the tempo defined in the score. The icon shows an active state. Tapping the icon again stops the metronome immediately.

**Why this priority**: This is the core feature and minimum viable delivery. A working metronome in the play view provides immediate value — musicians can use it to keep time while reading the score.

**Independent Test**: Load any score in the play view, click the metronome icon, verify audible ticking begins at the score's tempo, click again, verify ticking stops. No playback needed.

**Acceptance Scenarios**:

1. **Given** a score is open in play view and the metronome is off, **When** the user clicks the metronome toolbar icon, **Then** rhythmic audible beats begin at the tempo defined in the score, the icon shows an active/highlighted state, and the icon (or beat indicator) pulses visually on every beat.
2. **Given** the metronome is active in play view, **When** the user clicks the metronome toolbar icon again, **Then** the beats stop immediately, the visual pulse stops, and the icon returns to its inactive state.
3. **Given** a score with no explicit tempo marking, **When** the metronome is activated, **Then** it beats at 120 BPM (standard default tempo).

---

### User Story 2 - Toggle Metronome in Practice View (Priority: P2)

A musician is in the practice view working on a piece. They toggle the metronome on to help maintain a steady rhythm while practising notes. The experience mirrors the play view: one tap to start, one to stop, using the score's tempo.

**Why this priority**: Extends the same metronome capability to the practice view, which is equally important for users actively learning — but depends on P1 delivering the metronome engine.

**Independent Test**: Open any score in the practice view, click the metronome icon in the toolbar, verify beats begin; click again to stop. Score playback is not required.

**Acceptance Scenarios**:

1. **Given** a score is open in practice view and the metronome is off, **When** the user clicks the metronome toolbar icon, **Then** audible beats begin at the score's defined tempo, the icon shows active state, and the icon (or beat indicator) pulses visually on every beat.
2. **Given** the metronome is active in practice view, **When** the user clicks the metronome toolbar icon, **Then** the beats stop, the visual pulse stops, and the icon shows inactive state.

---

### User Story 3 - Metronome Follows Tempo Changes (Priority: P3)

A musician is studying a Bach piece that contains a mid-score tempo change (e.g., from ♩=80 to ♩=120). They turn on the metronome and start playback. As playback reaches the tempo change marking, the metronome's beat rate updates automatically to match the new tempo.

**Why this priority**: Correctness for scores with multiple tempos. Valuable for advanced users but not a blocker for the core metronome feature.

**Independent Test**: Load a score containing at least one tempo change. Activate the metronome and begin playback. Observe that the beat rate changes to match the new tempo when that section is reached.

**Acceptance Scenarios**:

1. **Given** a score with multiple tempo markings and the metronome active, **When** playback reaches a tempo-change marking, **Then** the metronome immediately adopts the new tempo without interruption.
2. **Given** the metronome is active without playback running (standalone), **When** the score has multiple tempos, **Then** the metronome uses the first tempo marking (or 120 BPM if none) and starts counting from beat 1 of the time signature.

---

### Edge Cases

- What happens when the score has no tempo marking? → Metronome defaults to 120 BPM.
- What happens when the user activates the metronome but browser autoplay policy has not yet been satisfied? → A silent unlock attempt is made; if blocked, a brief inline prompt asks the user to tap/click anywhere, after which the metronome starts automatically.
- What happens when the user navigates away from the play or practice view while the metronome is active? → The metronome stops when the view is left.
- What happens if the tempo marking is set to an extreme value (e.g., 1 BPM or 999 BPM)? → The metronome silently clamps the value to the supported range of 20–300 BPM.
- What happens when the user switches between play and practice views with the metronome on? → Each view maintains its own independent metronome state; switching views does not carry the active state across.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The play view toolbar MUST include a metronome toggle button positioned at the rightmost end of the toolbar.
- **FR-002**: The practice view toolbar MUST include a metronome toggle button positioned at the rightmost end of the toolbar.
- **FR-003**: The metronome toggle button MUST use a recognizable metronome icon and display a visually distinct active state when the metronome is running.
- **FR-003a**: While the metronome is active, the icon or a dedicated beat indicator element MUST visually pulse (flash/highlight) in sync with every beat, providing a visual rhythm cue alongside the audio.
- **FR-004**: Clicking the metronome button when inactive MUST start the metronome; clicking it when active MUST stop the metronome immediately.
- **FR-005**: The metronome MUST produce audible beats at the BPM defined by the tempo marking in the loaded score.
- **FR-006**: The metronome MUST produce a perceptually distinct sound for the first beat of each measure (downbeat) versus remaining beats (upbeats).
- **FR-006a**: When the metronome is toggled on in standalone mode (no active playback), it MUST always begin at beat 1 of the time signature and count forward continuously, independent of the current score scroll position.
- **FR-007**: When a score defines multiple tempo markings, the metronome MUST update its beat rate to match the tempo at the current playback position.
- **FR-007a**: When playback is active, the metronome beat timing MUST be derived from the playback clock (phase-locked), so that metronome ticks remain aligned with the playing notes and do not drift relative to playback position.
- **FR-007b**: When the metronome runs without active playback, it operates on its own independent timer at the score's first-applicable tempo.
- **FR-007c**: The metronome beat interval MUST be expressed in Tone.js musical-time notation (e.g. one beat of the time signature's denominator) rather than a fixed interval in seconds. This ensures that when `Tone.Transport.bpm` is updated — whether by the playback engine applying the score's tempo map or a practice tempo modifier — the metronome's beat interval self-adjusts automatically, without any cancel-and-reschedule operation between beats. The playback engine MUST write the effective tempo (`scoreBpm × tempoModifier`) to `Tone.Transport.bpm` at playback start and whenever either value changes, making `Transport.bpm` the single authoritative tempo source for all Transport-scheduled events, including the metronome.
- **FR-008**: If a score contains no tempo marking, the metronome MUST default to 120 BPM.
- **FR-008a**: The metronome MUST support a BPM range of 20–300. Any tempo value from the score that falls outside this range MUST be silently clamped to the nearest boundary (20 or 300); a diagnostic warning MAY be logged.
- **FR-009**: Stopping or pausing playback MUST NOT automatically stop the metronome; the metronome's running state is independent of playback state.
- **FR-010**: Navigating away from the play or practice view MUST stop the metronome and reset its state.
- **FR-011**: The metronome state (on/off) in the play view and in the practice view MUST be independent of each other.
- **FR-012**: When the user activates the metronome and browser audio is not yet unlocked, the system MUST silently attempt to unlock the audio context. If the attempt fails (browser autoplay policy), the system MUST display a brief inline message instructing the user to tap or click anywhere to enable audio, and MUST automatically start the metronome as soon as audio is unlocked.

### Key Entities

- **Metronome**: Represents the ticking engine. Attributes: active state (on/off), current BPM, current beat position within measure, time signature numerator.
- **Tempo Definition**: A tempo marking from the loaded score. Attributes: BPM value, score position where it applies. A score may have one or many.

## Assumptions

- The score model already exposes the tempo value(s) and time signature in a way accessible to the frontend views.
- The playback engine exposes a clock or position event that the metronome can subscribe to for phase-locked beat alignment when playback is running.
- `Tone.Transport.bpm` is the single authoritative tempo clock for all Transport-scheduled events during playback. The playback engine writes `effectiveBpm = scoreBpm × activeTempoModifier` to `Transport.bpm` at playback start and on every tempo or modifier change; the metronome reads this clock implicitly through its musical-time notation scheduling interval.
- Each view (play, practice) has an existing toolbar component that can accept new icon buttons.
- The metronome sound is generated client-side (no network request required per beat).
- Downbeat and upbeat sounds are two short, distinct audio tones; no configuration by the user is required in this feature.
- The metronome volume follows the existing application audio output; no separate volume control is added in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start and stop the metronome with a single click; the action takes effect within 50 ms of the click.
- **SC-002**: The metronome beat timing is accurate to within ±10 ms of the expected interval at any supported tempo (20–300 BPM).
- **SC-003**: When a tempo change is reached during playback, the metronome adopts the new tempo within one beat.
- **SC-004**: 100% of tested scores that include a tempo marking cause the metronome to tick at the correct BPM when activated.
- **SC-005**: The metronome icon is discoverable without instructions — users identify and use it on first encounter during usability testing.

