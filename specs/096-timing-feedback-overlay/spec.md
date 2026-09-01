# Feature Specification: Live Timing Feedback Overlay

**Feature Branch**: `096-timing-feedback-overlay`
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "In order the musician has more feedback, let's add a big +/- overlay using the theme style to feedback the user if the note has been played out of time. It must appear and disappear quickly to avoid disturbing the experience and it must appear/disappear with fading (but quick)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Big +/- Timing Feedback While Practicing (Priority: P1)

A musician is playing through a score in the Practice view. When they play a note out of time, a large, theme-styled overlay appears in the practice area showing the signed timing deviation (e.g., "+120 ms" for late, "-80 ms" for early). It appears and disappears quickly — fading in and out within roughly a second — so it provides immediate feedback without disrupting the flow of practice. In-time notes and wrong-pitch notes do not trigger the overlay.

**Why this priority**: This is the entire request. Live, glanceable timing feedback while playing is the value; everything else is implementation detail. Delivered alone it already improves the practice experience.

**Independent Test**: Start a practice, play a note definitely outside the timing tolerance, and observe that a large theme-styled overlay with the signed ms deviation (e.g., "+120 ms") fades in and fades out quickly. Notes played in time do not show it.

**Acceptance Scenarios**:

1. **Given** an active practice session, **When** the musician plays a note out of time (late), **Then** a large overlay showing "+{n} ms" (e.g., "+120 ms") appears in the practice area.
2. **Given** an active practice session, **When** the musician plays a note out of time (early), **Then** the overlay shows "-{n} ms" (e.g., "-80 ms").
3. **Given** the overlay has appeared, **When** it has been visible for a short moment, **Then** it fades out automatically without requiring any action from the musician.
4. **Given** the musician plays a note within the timing tolerance, **When** the note is confirmed correct, **Then** no timing overlay appears.
5. **Given** the musician plays a wrong pitch, **When** the note is recorded as wrong, **Then** no timing overlay appears (the note still turns red as today).
6. **Given** the musician plays several out-of-time notes in quick succession, **When** each out-of-time result is recorded, **Then** the overlay refreshes with the latest deviation rather than stacking or flickering repeatedly.
7. **Given** the musician stops the session and the results overlay is open, **When** they replay the practice, **Then** the timing overlay does **not** appear during replay (feedback is for live play only).

### Edge Cases

- What happens when the deviation is exactly 0 ms for an out-of-time note? The overlay renders "0 ms" with no sign, consistent with the report label.
- What happens when the user plays several out-of-time notes rapidly? The overlay text updates to the latest value; timers reset so it stays visible until the last note's fade-out.
- What happens when the session ends (Stop) while the overlay is visible? The overlay hides immediately with the results overlay.
- What happens during replay of a saved practice? No overlay — replay is not live play.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: During an active practice session, when a note is recorded with an out-of-time outcome (`correct-late` or `early-release`), the system MUST show a large overlay displaying the signed timing deviation formatted as "+{n} ms", "-{n} ms", or "0 ms".
- **FR-002**: The overlay MUST be styled with theme/custom-property colors following the existing practice view theme conventions (e.g., `--ls-accent`, `--color-danger`, with sensible fallbacks), so it matches each landing theme.
- **FR-003**: The overlay MUST appear and disappear within approximately 1 second total, using quick fade-in and fade-out transitions (CSS opacity transitions).
- **FR-004**: The overlay MUST fade out automatically once its brief display duration elapses; it MUST NOT require any action from the musician to dismiss.
- **FR-005**: The overlay MUST NOT appear for in-tolerance (`correct`) notes or wrong-pitch notes.
- **FR-006**: When out-of-time results occur in rapid succession, the overlay MUST update to the latest deviation (reset its display timer) and MUST NOT stack, accumulate, or flash-flicker.
- **FR-007**: The overlay MUST NOT appear during replay (live-play feedback only).
- **FR-008**: The overlay MUST NOT interfere with interaction — it must be non-blocking (pointer events must pass through) and must not obscure controls/score interaction beyond its brief appearance.
- **FR-009**: The overlay value MUST match the report's State label convention introduced by Feature 095 (`frontend/plugins/practice-view-plugin/stateLabel.ts` `formatStateLabel`), keeping one source of truth for the label format.

### Key Entities

- **Practice Note Result** (existing): per-note outcome with `relativeDeltaMs` (signed deviation) — the trigger and value source. Overlay fires for `correct-late` / `early-release`.
- **Timing Feedback Overlay** (new, transient): a presentation-only element with a display value, a brief visible lifetime, and fade-in/fade-out transitions. No persisted state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of out-of-time notes in a live practice session trigger the overlay within the same render frame the note result is recorded.
- **SC-002**: The overlay's full appear-and-disappear lifecycle completes in approximately 1 second or less (measured from first visible frame to fully hidden).
- **SC-003**: 0 overlays appear for in-tolerance or wrong-pitch notes across a session (verified by automated tests covering `correct`, `wrong`, and borderline outcomes).
- **SC-004**: Rapid successive out-of-time notes result in a single overlay showing the latest deviation — no stacking, no accumulation, no flicker (verified by tests and manual burst play).
- **SC-005**: The overlay does not capture pointer events: taps/clicks on score controls work normally while it is visible.
- **SC-006**: The overlay renders with the active theme's colors (no hardcoded colours that break across landing themes); verified across at least 2 themes.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will grow during implementation, deployment, or production use per Principle VII (Regression Prevention).