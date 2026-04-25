# Feature Specification: Tempo Slider Range Extension & Practice Metronome Deferred Start

**Feature Branch**: `083-tempo-metronome-practice`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Modify the tempo slider to cover 10% - 200%. And in practise mode, if the metronome is active, start it when the first note is played in the practice."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ultra-Slow Tempo for Difficult Passages (Priority: P1)

A student encounters a technically demanding passage they cannot play at normal speed. They drag the tempo slider all the way down to 10% to hear and practice the passage at an extremely slow pace, allowing them to absorb each individual note before gradually increasing speed.

**Why this priority**: Extending the slow end of the tempo range (down to 10%) directly addresses the core use case of deliberate slow practice, which is the most common reason musicians adjust tempo during learning.

**Independent Test**: Can be fully tested by opening any score, dragging the tempo slider to its minimum position, and verifying playback at approximately 10% of the original tempo — independently valuable without the metronome feature.

**Acceptance Scenarios**:

1. **Given** a score is loaded and the tempo slider is visible, **When** the user drags the slider to the leftmost position, **Then** the displayed tempo reads 10% and playback speed reflects that value.
2. **Given** playback is active at 10% tempo, **When** the user observes notes being played, **Then** all notes play at the correct duration proportional to 10% speed with no audio artifacts.
3. **Given** the slider is at any position between 10% and 100%, **When** the user moves it, **Then** the tempo adjusts smoothly with no gaps or jumps in the available range.

---

### User Story 2 - High-Speed Challenge Practice (Priority: P2)

An advanced student wants to push themselves by practicing a piece faster than the original score tempo. They drag the slider up to 200% to challenge their sight-reading speed or test muscle memory under pressure.

**Why this priority**: Extending the upper limit to 200% broadens the tool's utility for advanced users. Lower priority than the slow end because extreme fast playback is less universally needed.

**Independent Test**: Can be fully tested by dragging the tempo slider to its maximum position and verifying playback at 200% tempo — independently valuable and demonstrable.

**Acceptance Scenarios**:

1. **Given** a score is loaded, **When** the user drags the slider to the rightmost position, **Then** the displayed tempo reads 200% and playback speed doubles relative to the original.
2. **Given** the slider is at 200%, **When** playback runs, **Then** all notes play correctly at double speed without skipping, clipping, or corrupting the audio.
3. **Given** the user is at any position between 100% and 200%, **When** they adjust the slider, **Then** the tempo changes proportionally and the display updates immediately.

---

### User Story 3 - Metronome Starts on First Note in Practice Mode (Priority: P1)

A student enters practice mode with the metronome enabled. Instead of the metronome clicking from the moment they enter practice mode, it remains silent until they play their first note. Once they play, the metronome kicks in from that beat, helping them stay in time from the point of actual playing rather than from a premature countdown.

**Why this priority**: This is a fundamental UX improvement for practice mode — a ticking metronome before the student is ready is disorienting. Synchronising the start to the first played note mirrors how human teachers count musicians in, making the tool more natural and effective.

**Independent Test**: Can be fully tested by entering practice mode, enabling the metronome, waiting several seconds, then playing a note — verifying the metronome only starts upon note detection and not before.

**Acceptance Scenarios**:

1. **Given** practice mode is active and the metronome is enabled, **When** the session starts, **Then** the metronome does NOT produce any sound or visual beat until the first note is played.
2. **Given** practice mode is active and the metronome is enabled, **When** the user plays the first note, **Then** the metronome begins ticking immediately treating that moment as beat 1 (starting a fresh measure cycle from the first note).
3. **Given** practice mode is active and the metronome is enabled, **When** the user plays a wrong note or an accidental key press as their first input, **Then** the metronome still starts — any note event qualifies as the trigger.
4. **Given** practice mode is active and the metronome is enabled, **When** the user plays a chord as their first input, **Then** the metronome starts on the first note event of that chord (whichever arrives first); subsequent simultaneous events are ignored as additional triggers.
5. **Given** practice mode is active and the metronome is disabled, **When** the user plays the first note, **Then** the metronome remains silent (no change from current behaviour).
6. **Given** practice mode is active and the metronome is enabled, **When** the session starts and no note has been played yet, **Then** the metronome button/control shows a distinct visual "armed" state (different from both the off state and the active ticking state) to signal it is waiting for input.
7. **Given** practice mode is active and the metronome is enabled, **When** the user plays a note after a long pause at the start, **Then** the metronome starts cleanly on that note's beat without any retroactive clicks.
8. **Given** practice mode is NOT active (e.g., normal playback mode), **When** the metronome is enabled, **Then** the metronome starts immediately as it does today (no change to non-practice behaviour).

---

### Edge Cases

- What happens when the user sets the slider to exactly 10% and then tries to drag it lower? The slider must clamp at 10% with no ability to go below.
- What happens when the user sets the slider to exactly 200% and tries to drag it higher? The slider must clamp at 200% with no ability to exceed.
- What happens if the user exits practice mode before playing any note while the metronome is enabled? The metronome must not start when re-entering a non-practice context — the deferred start resets.
- What happens if the user replays (restarts) a practice session? The metronome deferred-start resets: it should again wait for the first note.
- What happens if tempo is restored from a saved session where the value was outside the new 10–200% range? The value must be clamped to the nearest boundary (10% or 200%) and the user must be shown the clamped value.
- What happens when the score's original tempo is very slow (e.g., Largo at 40 BPM) and 10% would yield 4 BPM? The slider minimum is clamped to the absolute BPM floor (10 BPM) and the UI must communicate this limit clearly — the displayed percentage reflects the clamped value, not 10%.
- What happens when the user drags the slider near 100%? The slider must snap to exactly 100% within a comfortable tolerance zone (e.g., ±3 percentage points) to make returning to the original tempo easy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tempo slider MUST have a minimum value of 10% and a maximum value of 200% of the original score tempo.
- **FR-002**: The tempo display label MUST always show the currently selected integer percentage value, updating in real-time as the slider moves.
- **FR-003**: The slider MUST prevent values below 10% and above 200% (hard clamp at both ends).
- **FR-004**: Playback speed MUST accurately reflect the selected tempo percentage across the full 10%–200% range with no audible distortion or timing errors.
- **FR-005**: In practice mode, when the metronome is enabled, the metronome MUST remain silent from the start of the practice session until the first note input event is detected.
- **FR-006**: In practice mode, when the first note input event is detected and the metronome is enabled, the metronome MUST start immediately treating that moment as beat 1 (a fresh measure cycle), maintaining steady beat at the configured tempo thereafter.
- **FR-007**: The deferred metronome start behaviour MUST be exclusive to practice mode. Outside practice mode the metronome MUST continue to start immediately when enabled, as today.
- **FR-008**: When a practice session is restarted or reset, the deferred metronome start MUST reset so the metronome again waits for the next first note.
- **FR-009**: Previously saved tempo values that fall outside the new 10%–200% range MUST be silently clamped to the nearest boundary on load.
- **FR-010**: The tempo slider MUST use 1% integer steps — values snap to whole-number percentages; the display always shows an exact integer (e.g., "73%", never "73.6%").
- **FR-011**: The slider MUST include a snap zone at 100% — when the user drags within approximately ±3 percentage points of 100%, the slider MUST snap to exactly 100%, allowing easy return to the original score tempo. A visual indicator (e.g., tick mark or label) MUST mark the 100% position on the slider track.
- **FR-012**: While the metronome is in the "armed/waiting" state (enabled in practice mode, before the first note), the metronome button or control MUST show a distinct visual state that is clearly different from both the off state and the active ticking state (e.g., a different icon, a pulsing effect, or a muted/desaturated colour).
- **FR-013**: Any note input event qualifies as the first-note trigger for the metronome deferred start — wrong notes, correct notes, and any note in a chord all qualify. No note-matching or correctness check is required.
- **FR-014**: If 10% of the score's original tempo would result in a speed below 10 BPM, the slider's effective minimum MUST be clamped to 10 BPM. The UI MUST communicate this limit visually (e.g., a tooltip or label) so the user understands why the slider cannot go lower than a displayed percentage higher than 10%.

### Assumptions

- The term "first note played" means the first note input event captured by the practice session (MIDI input, keyboard, or on-screen tap) — any input qualifies regardless of correctness. It is not the first note in the score.
- When the metronome starts on the first note, that note's arrival is treated as beat 1 of a fresh measure cycle. The metronome does not attempt to align to the score position of the note.
- A chord (multiple simultaneous note events) still counts as a single trigger — whichever note event arrives first fires the metronome; subsequent simultaneous events within the same chord attack are ignored as duplicate triggers.
- The metronome visual control defers together with the audio. It displays a distinct armed/waiting state before the first note is played.
- The existing tempo slider persists its value across sessions. This feature does not change persistence behaviour — only the allowable range and step size.
- The absolute BPM floor is 10 BPM. For scores whose original tempo is 100 BPM or higher, 10% always exceeds this floor and no clamping occurs. The floor only applies to unusually slow scores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set any integer tempo between 10% and 200% inclusive using the slider, with the displayed value always matching the selected speed.
- **SC-002**: Playback at 10% and 200% is perceptually correct — notes are heard at the proportional duration with no skipping or audio glitches.
- **SC-003**: In practice mode with metronome enabled, zero metronome beats are produced before the first note is played across 100% of test runs.
- **SC-004**: The metronome starts within one beat's duration of the first note being played (i.e., no perceptible lag between first note and metronome onset).
- **SC-005**: Outside practice mode, metronome behaviour is unchanged — it starts immediately when enabled, verified by regression tests covering existing behaviour.
- **SC-006**: A user can land on exactly 100% from a nearby position in a single drag gesture without requiring pixel-perfect accuracy — verified by usability test or automated drag test within ±3% of 100%.
- **SC-007**: When the metronome is armed in practice mode, the metronome control is visually distinguishable from both its off state and its active state, confirmed by visual inspection or snapshot test.
- **SC-008**: For scores where 10% of original tempo falls below 10 BPM, the slider's lower limit is clamped to 10 BPM and a user-visible indicator communicates the constraint.

