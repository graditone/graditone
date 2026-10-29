# Feature Specification: Strict Tempo Mode for Metronome Practice

**Feature Branch**: `101-strict-tempo-mode`  
**Created**: 2026-10-28  
**Status**: Draft  
**Input**: User description: "Add a stricter practice mode in which the user must follow the tempo more precisely. Activating the metronome during practice activates the mode. If the user fails 3 notes, the practice stops and shows the results window with the note delays."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Strict tempo evaluation stops after three consecutive misses (Priority: P1)

A musician practices a score with the metronome enabled. Every note is judged against an absolute tempo grid, not just against the interval since the previous note. If the musician plays three consecutive notes outside the allowed timing window, or releases a sustained note early three times in a row, the practice stops immediately, the metronome stops, and the results window opens. The musician knows the session ended because the tempo was lost.

**Why this priority**: This is the core behavior. Without it, the feature does not exist.

**Independent Test**: Start Score Practice with the metronome armed, play the first note in time, then play three consecutive notes clearly outside the window. The practice stops after the third note, the metronome stops, and the results window opens with the tempo-stop reason. Repeat with in-time notes: the practice continues normally.

**Acceptance Scenarios**:

1. **Given** Score Practice with the metronome enabled and armed, **When** the user starts playing, **Then** strict tempo evaluation is active from the first accepted note.
2. **Given** strict mode, **When** the user plays a note outside the timing window, **Then** the note is recorded as an off-beat failure and the consecutive-failure count advances.
3. **Given** strict mode with two consecutive failures, **When** the user plays the next note outside the window, **Then** the session stops immediately after that note, the metronome stops, and the results window opens.
4. **Given** strict mode with one or two consecutive failures, **When** the user completes a note within the window, **Then** the consecutive-failure count resets to zero and practice continues.
5. **Given** strict mode, **When** the user plays a wrong pitch, **Then** it is handled as today and does not count toward the three failures.
6. **Given** the metronome is not enabled, **When** the user practices, **Then** the session behaves exactly as today, including the 500 ms late classification, note advancement, and no tempo stop.
7. **Given** strict mode, **When** the user releases a sustained note before its required hold time, **Then** it counts as one failure and the practice stays on that note; three consecutive early releases stop the session.
8. **Given** strict mode, **When** the user keeps playing in time, **Then** the session never stops for tempo, regardless of its length.

---

### User Story 2 - Understand why the practice stopped (Priority: P2)

After a tempo stop, the results window clearly states that the practice stopped because the metronome was not followed. It lists the three failing notes with the timing error that caused each failure — a signed onset delay, or how early a sustained note was released — and makes the timing table and delay chart available. The notes that failed the tempo window are scored as errors, not as half-correct.

**Why this priority**: A stop without an explanation feels punitive. The delays are the learning value and the reason the user asked for the results window.

**Independent Test**: Trigger a tempo stop with known errors (for example, +220 ms late, −180 ms early, and an early release). Verify that the results window shows the tempo-stop reason and the three timing errors, and that those notes reduce the score as errors.

**Acceptance Scenarios**:

1. **Given** a tempo stop, **When** the results window opens, **Then** it states that the session stopped because the metronome was not followed.
2. **Given** a tempo stop, **When** the user inspects the results, **Then** each of the three failing notes is identified with its signed onset delay or the amount by which it was released early.
3. **Given** a tempo stop, **When** the user expands the timing details, **Then** the per-note timing table and the delay-over-time chart are available, with the failing notes visually marked.
4. **Given** a tempo stop, **When** the results score is computed, **Then** off-beat and early-released notes count as errors and are not counted as half-correct.
5. **Given** a tempo stop, **When** the user chooses Repractice, **Then** a new strict session starts with the metronome still enabled and the failure count reset.

---

### User Story 3 - Know the rules before the stop, and stay in control (Priority: P3)

While strict mode is active, the practice view shows that the metronome is enforcing the tempo and how many consecutive misses have accumulated (0/3, 1/3, 2/3). Every off-beat note shows its signed timing error immediately. Turning the metronome off leaves strict mode and returns to today’s practice; turning it on mid-session activates strict mode from the next note. Repractice keeps the metronome setting and resets the count. Free practice is unaffected.

**Why this priority**: The stricter rule must be predictable and reversible; otherwise the stop feels arbitrary.

**Independent Test**: Enable the metronome, play two off-beat notes, and verify the indicator shows 2/3 and the live overlay shows the timing errors. Turn the metronome off and verify the indicator disappears and the session continues normally. Turn it back on and verify strict mode resumes from the next note.

**Acceptance Scenarios**:

1. **Given** strict mode is active, **When** the user looks at the practice view, **Then** the mode is visibly identified and the current consecutive-failure count is shown out of three.
2. **Given** strict mode with two failures, **When** the user turns the metronome off before the third, **Then** strict mode ends, the failure count clears, and the session continues in normal mode.
3. **Given** an active practice with the metronome off, **When** the user turns the metronome on mid-session, **Then** strict evaluation starts from the next accepted note, that note is the timing anchor and is not judged, and earlier notes are not counted.
4. **Given** strict mode, **When** the user changes the tempo, **Then** the next accepted note re-anchors the grid and is not judged, and the failure count is preserved.
5. **Given** a loop practice, **When** the user completes one loop and starts the next, **Then** the first accepted note of the new loop is a grace note and strict evaluation resumes within the loop.
6. **Given** Free Practice with the metronome on, **When** the user plays, **Then** no strict indicator appears and no tempo stop occurs.
7. **Given** strict mode, **When** an off-beat note is recorded, **Then** the live timing feedback shows its signed timing error, even when the error is below today’s 500 ms late threshold.

---

### Edge Cases

- **Metronome armed, no note played**: no evaluation and no failures; the session simply waits.
- **First input is a wrong pitch**: the metronome starts as today, but no failure is counted; the first accepted note becomes the grace note.
- **Metronome turned on mid-session**: strict mode begins with the next accepted note; that note is the grace note, and the count starts at zero.
- **Metronome turned off mid-session**: strict mode ends immediately; the count clears; no tempo stop occurs even if the user had two failures.
- **Tempo changed mid-session**: the next note whose onset occurs after the change is a grace note and the count is preserved. A sustained note already in progress is judged on the grid it started on; the note after it is the grace note.
- **Metronome subdivision changed**: the click pattern changes, but the timing grid and failure count do not.
- **Loop iteration restarts**: the first accepted note of each iteration is a grace note; the count carries across iterations.
- **Manual stop with one or two failures**: normal partial results are shown, not a tempo stop; the off-beat notes are still scored as errors.
- **Third failure on the final note**: normal completion takes precedence when the final note is accepted; the results are complete and the note is still marked off-beat. An early release on the final note that is the third failure is not a completion and yields the tempo-stop results.
- **Early-release retry**: the retry is a grace note for onset timing; the early release remains the failure. A successful retry does not reset the count; only a later in-time judged note does. If the retry is released early again, it counts as another failure.
- **Seek during strict mode**: the next accepted note is a grace note; the failure count is preserved.
- **Repeated early release on the same note**: each attempt counts as a failure; three consecutive attempts stop the session.
- **Wrong pitch between two timing failures**: the count is unchanged; a later in-time note resets it.
- **Extreme tempos**: the window uses the expected gap and its floor/ceiling; no division by zero or impossible window occurs.
- **Replay or saved results**: no live evaluation; historical results keep their recorded outcomes.
- **Metronome disabled to avoid the stop**: strict mode ends by design; this is allowed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a Score Practice session starts with the metronome enabled (armed for the first note or already ticking), the system MUST apply strict tempo evaluation for the session. When the metronome is off, strict evaluation MUST NOT be applied.
- **FR-002**: Strict evaluation MUST compare each note’s onset with its expected position on a tempo grid that advances at the current session tempo from the first accepted note. It MUST NOT rely solely on the interval since the previous note.
- **FR-003**: The first accepted note of a session MUST establish the grid and MUST NOT be judged. The first accepted note after a tempo change, a loop-iteration restart, or mid-session metronome activation MUST also be a grace note. A retry after an early release and the first accepted note after a seek MUST also be grace notes.
- **FR-004**: A note is on the beat when its onset is within 40% of the expected time between it and the previous practice note, with a floor of 120 ms and a ceiling of 300 ms. Otherwise it is off-beat and counts as one tempo failure.
- **FR-005**: Releasing a note before its required hold time MUST count as one tempo failure even when its onset was on the beat. An off-beat onset followed by an early release MUST count as one failure for that note, not two.
- **FR-006**: A wrong pitch MUST NOT count as a tempo failure and MUST NOT reset the consecutive-failure count. Wrong pitches continue to behave as they do today.
- **FR-007**: The system MUST count consecutive tempo failures. A note completed within the window MUST reset the count to zero. A grace note MUST NOT change the count.
- **FR-008**: When the consecutive-failure count reaches three, the system MUST stop the session immediately after the failing note, stop the metronome, and open the Practice Results window. No further note must be required.
- **FR-009**: The results window MUST state that the practice stopped because the metronome was not followed and MUST identify the three failing notes with their timing error: a signed onset delay, or the amount by which a sustained note was released early.
- **FR-010**: The tempo-stop results MUST include the per-note timing table and the delay-over-time chart, with the failing notes visually marked.
- **FR-011**: In strict mode, an off-beat note or an early-released note MUST count as an error in the results score. It MUST NOT receive correct or half-correct credit.
- **FR-012**: While strict mode is active, the practice view MUST show that the mode is active and the current consecutive-failure count out of three. Every off-beat note MUST show its signed timing error in the live timing feedback, even when the error is below today’s 500 ms late threshold.
- **FR-013**: Turning the metronome off during a session MUST end strict mode immediately, clear the failure count, and continue the session with today’s behavior.
- **FR-014**: Turning the metronome on during a session MUST start strict mode from the next accepted note; that note is the grace note, and notes before it are not evaluated.
- **FR-015**: Changing the tempo during strict mode MUST re-anchor the grid at the next note whose onset occurs after the change, which is a grace note. If a sustained note is in progress, it is judged on the grid it started on and the following note is the grace note. The consecutive-failure count MUST be preserved.
- **FR-016**: Each loop iteration MUST be treated as a new timing segment whose first accepted note is a grace note. The failure count MUST carry across iterations.
- **FR-017**: Choosing Repractice after a tempo stop MUST start a new strict session with the metronome still enabled and the failure count reset.
- **FR-018**: Free Practice MUST NOT apply strict tempo evaluation, even with the metronome enabled, because it has no expected score notes.
- **FR-019**: With the metronome off, Score Practice MUST retain today’s behavior: the 500 ms late classification, note advancement, and no tempo stop.
- **FR-020**: If the practice reaches its final note with an accepted note, normal completion MUST take precedence over the tempo-stop presentation; the results remain complete and any off-beat notes are still marked. An early release on the final note that is the third failure is not a completion and produces the tempo-stop results.
- **FR-021**: A retry of a sustained note after an early release MUST be a grace note for onset timing. The early release remains the single failure for that attempt, and a successful retry MUST NOT reset the consecutive-failure count; only a later in-time judged note resets it.

### Key Entities

- **Strict Tempo Session**: The session-scoped state of strict evaluation — active or inactive, current tempo, grid origin, consecutive-failure count (0–3), grace-note state, and stop reason. It is not persisted across sessions.
- **Tempo Grid**: The expected onset of each practice note at the current tempo, anchored at the first accepted note and re-anchored at each grace note.
- **Tempo Failure**: One note attempt that is off-beat or early-released, with the note index, the signed timing error, the failure kind, and its position in the consecutive-failure streak.
- **Practice Note Result** (extended): The existing per-note outcome plus whether the note failed the strict window, its signed deviation from the tempo grid, and its hold outcome.
- **Practice Results Summary** (extended): The existing score and statistics plus the stop reason and the list of failing notes with their timing errors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 30-note passage played within the strict window with the metronome on completes without a tempo stop in 100% of test runs.
- **SC-002**: Three consecutive off-beat notes stop the session after the third note, before another note is required, in 100% of automated and manual test runs.
- **SC-003**: Two off-beat notes followed by an in-time note never stop the session; the consecutive count returns to zero.
- **SC-004**: With the metronome off, zero tempo stops occur and the existing 500 ms late classification remains unchanged across the regression suite.
- **SC-005**: 100% of tempo stops show the stop reason and all three failing notes with their timing errors in the results window.
- **SC-006**: 100% of tempo-stop results include the timing table and delay chart, with the failing notes visually marked.
- **SC-007**: A tempo-stopped session scores off-beat and early-released notes as errors, while a session with only in-time notes still scores 100.
- **SC-008**: The strict-mode indicator and failure count update on the same note as the failure and reset on the next in-time note.
- **SC-009**: Turning the metronome off before the third failure prevents the stop and clears the count; turning it on mid-session activates strict mode from the next note.
- **SC-010**: Free Practice with the metronome on never shows the strict indicator or a tempo stop.
- **SC-011**: Repractice after a tempo stop starts a new strict session with the count at zero and the metronome enabled.
- **SC-012**: A musician following the metronome at both 60 BPM and 120 BPM completes a 20-note passage without a false tempo stop, confirming that the window scales with tempo.
- **SC-013**: On a tempo stop, the results window opens and the metronome stops in the same interaction; no clicks continue after the stop.

## Assumptions

- The metronome is the switch for strict mode. There is no separate strict-mode toggle or settings screen.
- Strict mode applies to Score Practice only. Free Practice has no expected notes and is unchanged.
- The metronome starts on the first note input, as it does today (feature 083), so the first accepted note defines the timing origin. The first accepted note is always a grace note.
- “Consecutive” means consecutive evaluated note attempts. Wrong-pitch attempts neither increment nor reset the count.
- Each note attempt can contribute at most one failure, even when it is both off-beat and released early.
- The tolerance is 40% of the expected gap between practice notes, clamped to 120–300 ms. This is the initial tuning and was adjusted after user testing (doubled from 20% / 60–150 ms).
- The metronome’s own timing accuracy is at most 50 ms (feature 085), so the 60 ms floor keeps the window wider than the metronome’s own error.
- Input latency is assumed to be constant, so anchoring the grid at the first accepted note cancels it. No input calibration is in scope.
- Tempo changes and loop restarts re-anchor with a grace note because the user cannot be expected to hit a grid that was interrupted.
- A tempo stop produces a partial-results record, consistent with a manual stop. Existing save, replay, and repractice behavior applies.
- The failure count is session-only and is not persisted.
- The user can always leave strict mode by turning the metronome off; this is intentional, not a bypass to prevent.
- Metronome subdivision changes do not affect the timing grid.
- Historical saved results are not re-evaluated under the new strict rules.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will grow during implementation, deployment, or production use per Principle VII (Regression Prevention).
