# Feature Specification: Free Practice Option

**Feature Branch**: `092-free-practice-option`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "Add to the Practice Plugin a new option to practice free without an score. In the practice loading score, a new button must be added to the dialog to create a free practice. This practice by default will have a 4:4 signature and a 80 tempo. The goal is to have a free practice that can be replayed, saved or repracticed, exiting features in the practice plugin."

## Clarifications

### Session 2026-05-31

- Q: What should the results overlay show after a free practice session ends? → A: Simplified view — elapsed time + total notes played + Replay/Repractice/Save buttons; no accuracy score or per-note correctness metrics.
- Q: How does a free practice session end? → A: Only by the user pressing Stop — the session never auto-completes or ends automatically.
- Q: What does the Replay button actually replay for a free practice session? → A: MIDI audio playback of the notes the user played, with original timestamps preserved.
- Q: What should the toolbar progress area display during a free practice session? → A: Both elapsed time and a running count of notes played.
- Q: Should the "Free Practice" button appear in the Play plugin's score selection dialog as well? → A: No — the "Free Practice" button MUST only appear in the Practice plugin's score selection dialog, never in the Play plugin's dialog.
- Q: How should the notes-played count be formatted in the toolbar (separator after the count)? → A: No "/" separator — display as plain count (e.g., "47 notes"), not "47 / notes" or "47 /N".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Start a Free Practice from the Score Selection Dialog (Priority: P1)

A user opens the Practice plugin and sees the score selection dialog. Without choosing a specific score, they click a new "Free Practice" button visible in the dialog. The plugin immediately enters the practice view with a blank, open-ended practice session pre-configured with a 4/4 time signature and 80 BPM tempo. No score is shown on the staff; the user can begin playing freely with the metronome as their guide.

**Why this priority**: This is the entire value of the feature. Everything else (replay, save, repractice) is built on top of existing infrastructure and only becomes available once a free practice session can be started. Without this, nothing else works.

**Independent Test**: Open Practice plugin → score selection dialog appears → click "Free Practice" → practice session opens with 4/4 time and 80 BPM → metronome is available → user can start playing.

**Acceptance Scenarios**:

1. **Given** the Practice plugin is open and the score selection dialog is displayed, **When** the user clicks the "Free Practice" button, **Then** the plugin transitions to the practice view without loading any score, with tempo set to 80 BPM and a 4/4 time signature.
2. **Given** the free practice session is active, **When** the user views the toolbar, **Then** the score title area shows a label indicating this is a free practice session (e.g., "Free Practice") instead of a score title.
3. **Given** the free practice session has started, **When** the user activates the metronome, **Then** it beats in 4/4 at 80 BPM.
4. **Given** the free practice session is active, **When** the user adjusts the tempo, **Then** the tempo changes from the 80 BPM default, exactly as it would in a normal practice session.
5. **Given** the free practice session is active, **When** the user presses Back, **Then** they return to the score selection dialog (same as normal practice exit behaviour).
6. **Given** the free practice session is active, **When** the user views the toolbar progress area, **Then** it shows both the elapsed time and a running count of notes played (e.g., "01:32 · 47 notes").
7. **Given** the free practice session is running, **When** no Stop action is taken, **Then** the session continues indefinitely — it never auto-completes or ends automatically.

---

### User Story 2 — Save, Replay, and Repractice a Free Practice Session (Priority: P2)

After playing freely for a while, the user stops the free practice session. The results overlay appears (as it does for normal practices), including the existing "Save", "Replay", and "Repractice" buttons. The user can save the session for later review, replay their performance, or start a new free practice immediately.

**Why this priority**: The request explicitly calls for parity with existing features. Enabling save/replay/repractice for free practice completes the feature and makes free practice a first-class citizen alongside score-based practices.

**Independent Test**: Start a free practice → play some notes → stop → results overlay appears → "Save", "Replay", and "Repractice" buttons are present and functional.

**Acceptance Scenarios**:

1. **Given** the user has stopped a free practice session, **When** the results overlay appears, **Then** it shows elapsed time, total notes played, and the "Save", "Replay", and "Repractice" buttons — no accuracy score or per-note correctness metrics are displayed.
2. **Given** the results overlay is showing for a free practice, **When** the user clicks "Save", **Then** the session is saved under a generated name that identifies it as a free practice (e.g., `FreePractice-datetime`).
3. **Given** the user has saved a free practice, **When** they open the score selection dialog and expand "Saved Practices", **Then** the free practice entry is listed alongside score-based practices.
4. **Given** the results overlay is showing for a free practice, **When** the user clicks "Replay", **Then** the MIDI audio of what the user played is replayed with original note timestamps preserved.
5. **Given** the results overlay is showing for a free practice, **When** the user clicks "Repractice", **Then** a new free practice session begins immediately (same 4/4, 80 BPM defaults), identical to clicking "Free Practice" in the selection dialog.

---

### Edge Cases

- What happens when the user stops a free practice immediately (no notes played)? The results overlay appears showing zero notes played; all buttons (Save, Replay, Repractice) remain available.
- What happens when the user loads a saved free practice from the "Saved Practices" section? The free practice session is restored and the results overlay is displayed with the saved performance stats and Replay button ready — identical to the loading behaviour of saved score-based practices.
- What happens when the user navigates away from a free practice session mid-play? The session closes cleanly; any unsaved data is discarded, consistent with existing practice behaviour.
- What happens when a saved free practice is loaded but its source is gone? Because free practices carry no external score reference, they are always self-contained and can always be loaded successfully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Practice plugin's score selection dialog MUST display a "Free Practice" button that is always visible, regardless of whether any scores are available in the catalogue. The Play plugin's score selection dialog MUST NOT display this button.
- **FR-002**: Clicking "Free Practice" MUST launch the practice view without loading any score file, using a synthetic empty session pre-configured with a 4/4 time signature and 80 BPM tempo.
- **FR-003**: The free practice session MUST display a localised label (e.g., "Free Practice") in the score title area of the toolbar instead of a score title.
- **FR-004**: All existing practice toolbar controls (tempo adjustment, metronome, stop) MUST remain fully functional during a free practice session.
- **FR-005**: The metronome in a free practice session MUST default to 4/4 at 80 BPM. The user MAY adjust the tempo after starting; the time signature is fixed at 4/4 for free practice sessions.
- **FR-006**: Stopping a free practice session (via the Stop button only — the session MUST never auto-complete) MUST trigger the results overlay using the existing results overlay component. The overlay MUST display elapsed time and total notes played; it MUST NOT show accuracy scores, correct/wrong note breakdowns, or timing deviation metrics.
- **FR-007**: The results overlay for a free practice MUST include the "Save" button (Feature 056). Clicking "Save" MUST persist the free practice using the same storage mechanism as score-based practices.
- **FR-008**: The saved name for a free practice MUST follow the format `FreePractice-{datetime}` (e.g., `FreePractice-20260531T112000`), omitting the score name, hand, and scope segments that are not applicable.
- **FR-009**: The results overlay for a free practice MUST include the "Replay" button. Clicking "Replay" MUST play back MIDI audio of the notes the user played during the session, with original note timestamps preserved.
- **FR-010**: The results overlay for a free practice MUST include the "Repractice" button. Clicking "Repractice" MUST start a new free practice session with the same defaults (4/4, 80 BPM), bypassing the score selection dialog.
- **FR-011**: A saved free practice loaded from the "Saved Practices" section MUST restore the results overlay displaying elapsed time, total notes played, and a functional Replay button.
- **FR-012**: Free practice sessions MUST be self-contained in storage — they carry no external score reference — and MUST always load successfully regardless of the state of the score catalogue or user scores.
- **FR-013**: The toolbar progress area MUST display both elapsed time (e.g., "01:32") and a running count of notes played (e.g., "47 notes") simultaneously during a free practice session. The count MUST be displayed without a "/" separator (e.g., "47 notes", not "47 / notes"). The standard note-progress indicator (X / N) MUST be hidden.

### Key Entities

- **Free Practice Session**: An open-ended practice session not tied to any score. Attributes: session type (`free`), default tempo (80 BPM), default time signature (4/4), raw MIDI note events with timestamps (for replay), elapsed time, total note count, start and stop timestamps. Ends only when the user presses Stop.
- **Saved Free Practice**: A persisted free practice record stored using the Feature 056 save/load infrastructure. Its name follows the format `FreePractice-{datetime}`. Carries raw MIDI event data (for replay), elapsed time, and note count. Carries no score reference and is always self-contained.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start a free practice session in under 3 seconds from opening the Practice plugin (clicking "Free Practice" and entering the practice view).
- **SC-002**: 100% of the applicable existing practice controls (tempo, metronome, stop, save, replay, repractice) remain available and fully functional during and after a free practice session. Accuracy metrics are intentionally not shown for free practice.
- **SC-003**: A saved free practice can be found in the "Saved Practices" list and loaded in under 10 seconds, consistent with Feature 056 load performance. The replay (MIDI audio playback) begins within 1 second of clicking Replay.
- **SC-004**: Free practice sessions are always loadable from saved data — 0% failure rate on load due to missing score references.
- **SC-005**: The "Free Practice" button is visible and reachable within the Practice plugin's score selection dialog on both desktop and mobile viewports without scrolling. It MUST NOT appear in the Play plugin's score selection dialog.

## Assumptions

- The free practice session does not display a score staff; the main content area is empty or shows a placeholder encouraging the user to play freely.
- The time signature for free practice is fixed at 4/4 and is not user-configurable in this feature. If user-configurable time signatures are desired, that is a separate future enhancement.
- The default tempo of 80 BPM can be adjusted by the user after starting, using the same tempo controls as score-based practice.
- Free practice sessions never auto-complete — they end only when the user presses Stop. There is no notion of a "complete" vs "partial" result; every free practice ends via Stop and shows the simplified results overlay.
- The "Save" button for free practices follows the Feature 056 mechanism exactly, with only the generated name format differing (`FreePractice-{datetime}` instead of `{score_name}-{hand}-{scope}-{datetime}`).
- Replay plays back the raw MIDI events (pitches + timestamps) captured during the session. No score rendering is involved; only audio output is produced.
- The "Repractice" button for free practice starts a new free practice session directly (no score selection dialog), bypassing score selection, analogous to how "Repractice" for score-based sessions re-launches practice on the same score.
- Staff selection controls are hidden for free practice sessions since there is no score with multiple staves.
- Free practices are stored in the same "Saved Practices" index (Feature 056) and are subject to the same 100-entry limit and oldest-first eviction policy.
