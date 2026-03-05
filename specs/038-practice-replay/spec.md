# Feature Specification: Practice Replay

**Feature Branch**: `038-practice-replay`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "Reproduce user performance in practice view. When a practice is finished in the results report a button must be shown to reproduce the user practice as if it was the original score. When you press the stop button or when the playback ends it must exit from this mode and return to the normal mode."

## Clarifications

### Session 2026-03-05

- Q: During replay mode, what does the results screen UI look like? → A: Results data (score, per-note breakdown) stays visible; only the Replay button is replaced by a Stop button in-place.
- Q: During replay, when the user played a wrong note, what does the exercise staff show? → A: Expected notes remain on the staff; the position cursor advances normally — wrong audio pitch plays but the staff still shows the expected note highlighted.
- Q: Should replay reuse `context.playNote` + `context.stopPlayback()` or a new dedicated API call? → A: Reuse `context.playNote` with `offsetMs` + `context.stopPlayback()` — the same scheduling path used for the exercise itself.
- Q: When replay completes or is stopped, can the user press Replay again on the same results screen? → A: Yes — the Replay button reappears and can be pressed any number of times on the same results screen.
- Q: What BPM is used for replay when the sidebar slider changes after the exercise completed? → A: BPM is frozen at the value active when the exercise completed — sidebar slider changes after completion do not affect replay tempo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Replay Performance from Results Screen (Priority: P1)

After completing a practice exercise, a user is on the results screen and wants to hear how their performance sounded. They press the **Replay** button and the system plays back the notes they actually played — using the same pitches they performed, played through the app's audio output in sequence, displayed on the exercise staff just as if it were a normal score playback. When the playback finishes naturally, the screen automatically returns to the results view.

**Why this priority**: This is the entire feature. It lets users hear and evaluate their own performance immediately after finishing an exercise, closing the feedback loop between playing and self-assessment.

**Independent Test**: Complete a practice exercise → reach the results screen → press Replay → audio plays the notes performed by the user in order → when audio ends, results screen reappears.

**Acceptance Scenarios**:

1. **Given** the user has just completed a practice exercise, **When** the results screen is shown, **Then** a "Replay" button is visible on the results screen.
2. **Given** the results screen is shown with the Replay button, **When** the user presses "Replay", **Then** the system enters replay mode and begins playing back the notes the user performed during the exercise, in the same order they were played.
3. **Given** replay mode is active, **When** each note is played back, **Then** the corresponding note on the exercise staff is highlighted, mirroring normal score playback behaviour.
4. **Given** replay mode is active, **When** the playback reaches the last note, **Then** the system automatically exits replay mode and returns to the results screen.
5. **Given** the user is in replay mode, **When** they press the Stop button, **Then** playback stops immediately and the system returns to the results view — the Stop button reverts to the Replay button and all results data (score, per-note breakdown) remains visible throughout.
6. **Given** the results screen is displayed, **When** the user has not yet pressed Replay, **Then** all existing results screen controls (Try Again, New Exercise, score, per-note breakdown) remain fully visible and functional.
7. **Given** replay mode is active, **When** the user looks at the results screen, **Then** the score and per-note breakdown remain visible — no layout change occurs; only the Replay button is replaced by a Stop button in-place.

---

### User Story 2 — Replay Reflects What the User Actually Played (Priority: P2)

A user wants to confirm whether they played the right pitches or were slightly off. When they press Replay, the system plays back the exact notes captured from their performance — not the expected exercise notes. This allows the user to immediately identify where their pitch or timing differed from the original.

**Why this priority**: Without this, the Replay feature would just repeat the exercise rather than reflecting the user's actual performance, making it useless for self-evaluation.

**Independent Test**: Complete a practice exercise deliberately playing some wrong notes → reach the results screen → press Replay → the audio and staff highlight the notes actually played (including the wrong ones), not the expected notes.

**Acceptance Scenarios**:

1. **Given** the user played some incorrect notes during the exercise, **When** they press Replay, **Then** the incorrect pitches they actually performed are played back in audio — the staff continues to show and highlight the expected notes at each position.
2. **Given** the user played all notes correctly, **When** they press Replay, **Then** audio playback and staff highlighting are identical to what the exercise expected.
3. **Given** a note was missed entirely (not played), **When** replay runs, **Then** the missed note is silently skipped in audio — the cursor still advances past that position on the staff.

---

### Edge Cases

- What happens if the user navigates away from the results screen during replay? Playback stops immediately and all audio resources are released.
- What happens if the user completed the exercise but no notes were captured (e.g., the exercise had zero notes played)? The Replay button is not shown or is disabled with a tooltip indicating there is no performance to replay.
- What happens if the replay is triggered on a very short exercise (1–2 notes)? Playback completes almost instantly and the screen returns to results after the last note.
- What happens if the same results screen is reached after a "Try Again" reset? The Replay button always reflects the most recently completed exercise run.
- Can the user replay multiple times on the same results screen? Yes — the Replay button is always restored after replay ends (naturally or via Stop), allowing unlimited replays of the same performance.
- What happens if the user changes the BPM slider after finishing the exercise and then presses Replay? Replay uses the BPM frozen at exercise completion — the slider change has no effect on replay tempo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The results screen MUST display a "Replay" button when the exercise was completed with at least one note captured from the user's performance.
- **FR-002**: When the user presses "Replay", the system MUST enter replay mode, playing back the notes actually performed by the user (captured pitches in order) through the app's audio output.
- **FR-003**: During replay mode, the Replay button MUST be replaced in-place by a Stop button. The rest of the results screen layout (score, per-note breakdown) MUST remain fully visible and unchanged. When Stop is pressed, playback MUST immediately halt and the Stop button MUST revert to the Replay button.
- **FR-004**: When playback reaches the end of the captured note sequence, the system MUST automatically exit replay mode, restore the Replay button, and return the results screen to its normal state — allowing the user to replay again or use other controls.
- **FR-005**: During replay mode, the exercise staff MUST continue to display the expected notes. The position cursor MUST advance through each note slot in order, highlighting the expected note at the current position — regardless of whether the user played the right pitch, a wrong pitch, or missed the note entirely.
- **FR-006**: The audio played back during replay MUST be the pitches the user actually performed, not the expected exercise notes. Missed notes (no capture) MUST be silently skipped in audio; the cursor still advances past their slot.
- **FR-007**: All existing results screen controls (Try Again, New Exercise, score, per-note breakdown) MUST remain accessible after replay ends (i.e., returning to results view).
- **FR-008**: If the user navigates away from the results screen during replay, playback MUST stop immediately and all audio resources MUST be released cleanly.
- **FR-009**: The Replay button MUST NOT be shown if no notes were captured during the exercise.
- **FR-010**: The Practice plugin MUST drive replay audio using `context.playNote` with `offsetMs` scheduling and MUST cancel pending notes via `context.stopPlayback()` when the user presses Stop or navigates away. No direct use of lower-level audio APIs is permitted inside the plugin for replay.

### Key Entities

- **Performance Record**: The ordered list of notes (pitches) captured from the user during a completed exercise run, together with the BPM value frozen at exercise completion. Each note entry holds the MIDI pitch value of the captured note. Missed notes are represented as absent entries. The record is immutable for the lifetime of the results screen.
- **Replay Mode**: A transient UI state active only within the results screen, during which the user's performance is played back and the staff shows note highlights matching the playback position. Exits on stop or playback completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can press Replay and hear their performance begin within 500 ms of pressing the button.
- **SC-002**: When playback ends naturally, the results screen is restored within 300 ms, with no additional user action required.
- **SC-003**: 100% of existing results screen functionality (Try Again, New Exercise, score display) remains immediately available after replay ends or is stopped.
- **SC-004**: Pressing Stop during replay halts audio output within one audio processing frame.
- **SC-005**: Navigating away from the results screen during replay produces no lingering audio or resource leaks.

## Clarifications — Phase A+B (2026-03-05)

After the initial MVP implementation (metronomic replay), the feature was revised to provide a **faithful reproduction of the user's actual performance** — including real timing and wrong notes — so users can identify where they need to improve.

### User Story 3 — Real-Tempo Replay (Priority: P1, Phase A)

When the user presses Replay, audio playback uses the **actual `responseTimeMs`** captured during practice instead of metronomic `i × msPerBeat` spacing. This lets the user hear exactly where they slowed down, rushed, or hesitated.

**Acceptance Scenarios**:

1. **Given** the user played note 1 at 0 ms and note 2 at 1200 ms during practice, **When** they press Replay, **Then** note 2 plays 1200 ms after note 1 — not at a fixed BPM interval.
2. **Given** the user was consistently late on the second half of the exercise, **When** they press Replay, **Then** the second half audibly drags compared to the expected tempo.

### User Story 4 — Wrong Notes Audible in Replay (Priority: P1, Phase B)

Wrong notes the user played during practice are **captured with their timing and pitch** and played back during replay, interleaved with correct notes in chronological order. This gives a faithful "echo" of the actual session including mistakes.

**Acceptance Scenarios**:

1. **Given** the user played wrong note D# (63) at 800 ms before getting C (60) correct at 1000 ms, **When** they press Replay, **Then** D# plays at 800 ms and C plays at 1000 ms — both audible in sequence.
2. **Given** multiple wrong attempts before a correct note, **When** replay runs, **Then** all wrong pitches play at their original timestamps before the correct note sounds.
3. **Given** wrong notes are playing during replay, **When** the staff highlight advances, **Then** the staff continues to highlight expected note positions — wrong notes are audible only, not shown on staff.

### Data Gap Analysis

| Data | Previously available | Status |
|---|---|---|
| `responseTimeMs` per correct note | Yes (`PracticeNoteResult`) | Use directly for Phase A |
| `expectedTimeMs` per correct note | Yes (`PracticeNoteResult`) | Available for timing color |
| Wrong note MIDI pitch | Partially (count only via `wrongAttempts`) | **Gap — Phase B adds `WrongNoteEvent`** |
| Wrong note timestamp | No | **Gap — Phase B adds `responseTimeMs` to `WRONG_MIDI`** |

### Phase A+B Implementation Approach

- **Phase A** (easy): Replace metronomic `offsetMs = i × msPerBeat` with `result.responseTimeMs` in `handleReplay`. No engine changes.
- **Phase B** (medium): Add `WrongNoteEvent { midiNote, responseTimeMs, noteIndex }` type; extend `PracticeState` with `wrongNoteEvents[]`; extend `WRONG_MIDI` action with `responseTimeMs`; update reducer; capture in `PerformanceRecord`; interleave wrong notes into the replay timeline sorted by timestamp.

---

## Clarifications — Phase C: Timing Deviation Graph (2026-03-05)

After Phase A+B, the timing deviation graph in the results screen was improved to be more useful:

- **Incremental deviation**: Each data point shows `(actualInterval − expectedInterval)` between consecutive notes — the per-note timing drift — instead of the cumulative `responseTimeMs − expectedTimeMs` which grew monotonically and was described as "useless".
- **Real-time X axis**: The X axis maps to actual elapsed seconds of the performance (from `responseTimeMs`), so the user can identify *when* during the performance a timing problem occurred (e.g., "spike at second 10").
- **Asymmetric Y axis**: `yMax` and `yMin` are computed independently from the actual data range (with a minimum of ±50 ms), so a performance with large positive spikes but small negative deviations uses the chart area efficiently instead of wasting half the chart on a symmetric negative region that never comes close to its bound.
- **Clean axis labels**: A single `+Nms` label at the top, `0` at the zero line, and `−Nms` at the bottom; X ticks show real seconds at a "nice" interval auto-selected from the performance duration.

---

## Assumptions

- The Practice plugin already records the notes performed by the user during an exercise (as part of scoring/results calculation). This feature relies on that existing captured data and does not require a new recording mechanism.
- Replay is driven entirely through the existing Plugin API: `context.playNote` with `offsetMs` for scheduling each note, and `context.stopPlayback()` to cancel all pending notes on Stop or navigation. No new Plugin API surface is required for this feature.
- Replay plays back notes at the BPM value that was active when the exercise completed. This value is captured as part of the Performance Record and is immutable for the lifetime of the results screen. Changes to the BPM slider on the results screen do not affect replay tempo.
- ~~Replay does not include timing accuracy playback — it plays captured notes sequentially at a fixed tempo, not attempting to recreate the original timing of the user's keystrokes.~~ **Revised**: Replay uses the user's actual `responseTimeMs` for note scheduling, faithfully reproducing the real tempo and hesitations of the original performance (Phase A).
- **New**: Wrong note pitches and timestamps are captured during practice via `WrongNoteEvent` and played back during replay, interleaved chronologically with correct notes (Phase B).
- The Replay feature is scoped to the Practice plugin's results screen only. It does not affect any other part of the app.
- No persistent storage of the performance record is required; the captured notes only need to survive for the duration of the results screen session.

