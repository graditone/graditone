# Feature Specification: Practice View Plugin (External)

**Feature Branch**: `037-practice-view-plugin`  
**Created**: 2026-03-03  
**Status**: Draft  
**Input**: User description: "Practice view plugin. This view must be implemented as an external plugin in plugins-external folder (like the virtual-keyboard-pro plugin). The view must be based on the Play score view plugin. A new button must be added to the toolbar in order to start the Practice of the Score. In this first step, when the Practice button is pressed, the user must press the next note in the Score using MIDI, similar to the step mode in Train view."

## Clarifications

### Session 2026-03-04 (Amendment — Results Overlay & MIDI Gate)

- Q: Should the Practice button be disabled when no MIDI device is connected? → A: Yes — the Practice button is **disabled** when the MIDI connection state is known to be absent (`midiConnected === false`). While the connection state is still being determined (`null`), the button remains enabled. A tooltip is shown on the disabled button explaining why it is inactive. If a MIDI device disconnects during an active practice session, a notice is shown inline in the toolbar, but practice mode is not automatically exited.
- Q: What happens when the user finishes practicing all notes? Should there be a summary/results screen? → A: Yes — a **results overlay** appears automatically when the last note is correctly pressed. The overlay displays: (a) a numeric score (0–100) that penalises late notes (50% weight) and wrong attempts (−2 per wrong attempt, capped at −30); (b) a grade label (Perfect / Great / Good / Keep Practising); (c) a 4-stat summary row (Notes / Correct / Late / Wrong); (d) a time comparison row showing the user's total practice time vs. the score's expected duration at the selected tempo; (e) a **collapsible** per-note detail table (collapsed by default) with one row per note showing the note name, outcome (correct / correct-late / wrong), wrong attempt count, and timing delta. The overlay is dismissed via a × button or by clicking the backdrop. The Practice button remains available to restart.

### Session 2026-03-03 (Amendment)

- Q: For chords, does the user need to press all notes simultaneously or is any single note sufficient? → A: All notes in the chord must be pressed together. An inaudible time window (≤ 80 ms) is allowed between individual key presses of the same chord — anything beyond that does not count. The chord detection logic is implemented as a `ChordDetector` class in `frontend/src/utils/chordDetector.ts` and **re-exported via the Plugin API** (`frontend/src/plugin-api/index.ts`) so any plugin can import it from the standard Plugin API surface without duplication.

### Session 2026-03-03

- Q: Does Plugin API v3 expose `context.components.ScoreRenderer` (or equivalent) to external plugins, or must feature 037 extend the API? → A: Plugin API v3 already exposes this surface to external plugins — no new Plugin API work is required for feature 037.
- Q: In multi-staff scores, which staff does Practice mode target? → A: A single user-selected staff — the user chooses the target staff (e.g. Treble/Bass) before entering Practice mode; only notes on that staff are targets.
- Q: What does the user see after completing all notes in Practice mode — silent stop or a summary screen? → A: Silent stop — the Practice button returns to its inactive state, the last note highlight clears, and the toolbar shows the stopped state at the final position. No summary screen in this first step.
- Q: Is MIDI note matching exact (including octave) or pitch-class only? → A: Exact pitch match — the played MIDI note number must equal the target note's MIDI pitch exactly; octave differences count as incorrect.
- Q: Does the Practice View plugin own its complete toolbar, or does it inject a button into the Play Score toolbar? → A: Practice View plugin owns its complete toolbar — it reconstructs the full toolbar using Plugin API primitives (play, stop, timer, tempo) and adds the Practice button; no dependency on nor modification of the Play Score toolbar component.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Load a score and see the Practice toolbar button (Priority: P1)

A user installs the Practice View external plugin from `plugins-external`. They open the app, launch the Practice View plugin, and are presented with the same score selection screen as the Play Score plugin. After selecting a score, the score renders in full screen and the familiar playback toolbar appears at the top — extended with a new "Practice" button alongside the standard Play/Pause/Stop controls.

**Why this priority**: This is the entry point for all subsequent practice functionality. Without the plugin scaffold and the toolbar button, no practice interaction is possible. It is also the validation that the external plugin is correctly structured and loadable.

**Independent Test**: Install the plugin → open app → launch Practice View plugin → select a preloaded score → verify the score renders and the toolbar shows a "Practice" button in addition to the standard playback controls.

**Acceptance Scenarios**:

1. **Given** the Practice View plugin is installed as an external plugin, **When** the app loads, **Then** the plugin appears as a launchable entry (e.g. via landing screen or nav).
2. **Given** the plugin is open with no score loaded, **When** the score selection screen appears, **Then** all preloaded scores are listed, matching the Play Score plugin experience.
3. **Given** the user selects a score, **When** it finishes loading, **Then** the score renders full-screen using the same renderer as the Play Score plugin and the toolbar shows Play/Pause, Stop, Timer, Tempo, and a **Practice** button.
4. **Given** the score is loaded and Practice mode is not active, **When** the user views the toolbar, **Then** the Practice button is visible and in its inactive state (e.g. not highlighted).

---

### User Story 2 — Start Practice mode: MIDI step-by-step note pressing (Priority: P1)

A user has a score loaded. They press the **Practice** button. The plugin enters Practice mode: normal playback stops (if running), and the score highlights the first note to be played. The user presses that note on their connected MIDI device. The highlight advances to the next note in the score. The user continues pressing each successive note on MIDI until they reach the end of the score.

**Why this priority**: This is the core value of the entire feature — MIDI-driven step-by-step note practice directly on a real score. It is the primary reason for building this plugin.

**Independent Test**: Load a score → connect a MIDI device → press Practice → first note highlighted → play that note on MIDI → highlight advances → repeat for several notes → verify each correct MIDI press advances the position exactly one note.

**Acceptance Scenarios**:

1. **Given** a score is loaded and a MIDI device is connected, **When** the user presses the Practice button, **Then** the plugin prompts the user to select a target staff (e.g. Treble / Bass) if not already selected, then enters Practice mode: any active playback stops and the first note on the selected staff (at or after the current playback position) is highlighted as the target note.
2. **Given** Practice mode is active and a note is highlighted, **When** the user presses the matching note on the MIDI device, **Then** the highlight advances to the next note in the score.
3. **Given** Practice mode is active, **When** the user presses an incorrect note on the MIDI device, **Then** the highlight does not advance and the target note remains highlighted; no error sound is required in this first step.
4. **Given** Practice mode is active and the user presses the Practice button again, **Then** Practice mode is deactivated, the highlight is removed, and the plugin returns to its normal stopped state at the current position.
5. **Given** Practice mode is active and the last note in the selected staff is pressed correctly on MIDI, **When** the advance occurs, **Then** Practice mode ends automatically: the target highlight is cleared, the Practice button returns to its inactive state, and the toolbar shows the stopped state at the final note position. No summary screen or score is displayed.
6. **Given** Practice mode is active, **When** the user presses the Back button, **Then** Practice mode is deactivated, all MIDI subscriptions are released, and the plugin closes cleanly.

---

### User Story 3 — Practice resumes from a specific position via seek (Priority: P2)

A user wants to practice starting from a specific measure rather than the beginning. Before activating Practice mode, they tap a note in the score to seek to that position. When they then press the Practice button, the highlighted target note starts from the sought position — not from the beginning of the score.

**Why this priority**: Starting from an arbitrary position is essential for focused practice on difficult passages. The Play Score plugin already supports note-tap seek; this story ensures Practice mode respects it.

**Independent Test**: Load a score → short-tap a note at measure 6 → press Practice → verify the highlighted target note is the tapped note (or the first note at/after that tick), not note 1.

**Acceptance Scenarios**:

1. **Given** the user has tapped a note to set the playback position before activating Practice mode, **When** they press Practice, **Then** the first highlighted target is the note at or immediately after the seeked position.
2. **Given** Practice mode is active, **When** the user taps a note (short tap) in the score, **Then** Practice mode resets the target highlight to the tapped note's position without deactivating Practice mode.

---

### User Story 4 — Plugin is structured as an external plugin (Priority: P1)

A developer (or Musicore contributor) can find the Practice View plugin as a standalone package in `plugins-external/practice-view-plugin/`, following the same structure as `plugins-external/virtual-keyboard-pro/`. The plugin has its own `package.json`, `plugin.json`, build script, and imports the Play Score plugin's Play Score view as its base — extending it without modifying the original plugin source.

**Why this priority**: The external plugin structure requirement is architectural and must be correct from the start; retrofitting it later would require re-scaffolding the entire plugin.

**Independent Test**: Inspect `plugins-external/practice-view-plugin/` — verify it contains `package.json`, `plugin.json`, `build.sh` (or equivalent), and that no files from `frontend/plugins/play-score/` are copied or modified; the plugin only imports/extends via the Plugin API.

**Acceptance Scenarios**:

1. **Given** the repository is cloned, **When** a developer navigates to `plugins-external/practice-view-plugin/`, **Then** they find a self-contained package with its own build configuration and `plugin.json` manifest.
2. **Given** the plugin is built with its build script, **When** the output is loaded by the host app, **Then** the full plugin (score rendering + toolbar + Practice mode) functions correctly.
3. **Given** the plugin source code, **When** it is inspected, **Then** no files from `frontend/plugins/play-score/` are duplicated — the Play Score rendering capability is accessed exclusively through the Plugin API, and the toolbar is implemented independently using Plugin API primitives.

---

### Edge Cases

- What happens when no MIDI device is connected and the user presses Practice? → Practice mode activates but no note events will arrive; the target note remains highlighted indefinitely. A notice informs the user that a MIDI device is required.
- What happens when a MIDI device is disconnected while Practice mode is active? → Practice mode remains active but the user is notified that the MIDI device has disconnected. The target note keeps its highlight until a device reconnects or the user exits Practice mode.
- What happens when the score has no notes (empty score)? → The Practice button is disabled; the user cannot enter Practice mode.
- What happens when the score has only one staff? → The staff-selection step is skipped; Practice mode uses that single staff automatically.
- What happens when the user reaches the last note of the score in Practice mode and presses it? → A results overlay appears automatically showing the session score, grade, per-category stats (Notes / Correct / Late / Wrong), a time comparison (practice time vs. score time), and a collapsible per-note detail table. The overlay is dismissed via × or the backdrop. Practice mode ends and the Practice button returns to its inactive state.
- What happens when the user presses Stop during Practice mode? → Practice mode is deactivated, the highlight is cleared, and the playback position resets to tick 0 (or the pinned start tick).
- What happens when Practice mode is active and there is a rest (non-note) in the score? → Rests are skipped automatically; the target highlight advances to the next playable note.
- What happens when the score contains chords (multiple simultaneous notes)? → All notes in the chord are highlighted together as a single target. The user must press **all** chord notes on MIDI within a short simultaneous-press window (≤ 80 ms, inaudible as a delay) for the target to advance. Pressing only some of the chord notes — or pressing them too far apart — does not advance the target.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Practice View plugin MUST be implemented as an external plugin located at `plugins-external/practice-view-plugin/`, following the same package structure as `plugins-external/virtual-keyboard-pro/` (own `package.json`, `plugin.json`, build script, and `index.tsx` entry point).
- **FR-002**: The plugin MUST reuse the full Play Score plugin experience — score selection screen and full-screen score rendering via the Rust layout engine accessed through `context.components.ScoreRenderer` and related Plugin API v3 surfaces. The plugin MUST own its complete toolbar, reconstructing play, pause, stop, timer, and tempo controls using Plugin API primitives rather than importing or extending the Play Score toolbar component.
- **FR-003**: The plugin MUST implement its own toolbar containing: Back button, score title, Play/Pause toggle, Stop button, elapsed timer, Tempo control, staff selector (for multi-staff scores before Practice mode), and a **Practice** button. The toolbar MUST be implemented using Plugin API primitives — no Play Score toolbar component is imported or extended. The Practice button MUST be visible whenever a score is loaded.
- **FR-004**: Pressing the Practice button when Practice mode is inactive MUST first prompt the user to select a target staff if the score contains more than one staff and no staff is already selected. Once a staff is selected, Practice mode activates: any active playback MUST stop, and the first note on the selected staff at or after the current playback position MUST be highlighted as the target note.
- **FR-005**: In Practice mode, the plugin MUST subscribe to MIDI note-on events via `context.midi.subscribe`. When the user plays a note on a connected MIDI device, the plugin MUST compare the played MIDI note number to the target note's MIDI pitch number using an exact match — the octave must be correct. Playing the same pitch class in a different octave MUST be treated as incorrect.
- **FR-006**: When the correct MIDI note is played in Practice mode, the plugin MUST advance the target highlight to the next note on the selected staff in tick order. Rests and notes on non-selected staves MUST be skipped automatically — only playable notes on the selected staff are targets.
- **FR-007**: When an incorrect MIDI note is played in Practice mode (including the correct pitch class in the wrong octave), the target note MUST remain highlighted and the position MUST NOT advance. No correct/incorrect sound feedback is required in this first step.
- **FR-008**: Pressing the Practice button while Practice mode is active MUST deactivate Practice mode: the target highlight MUST be cleared, the MIDI subscription MUST remain active (as MIDI may be used elsewhere) but the practice note-matching logic MUST be disabled, and the plugin returns to its normal stopped state at the current tick.
- **FR-009**: When the last note of the selected staff is correctly pressed in Practice mode, Practice mode MUST end automatically: the target highlight MUST be cleared, the Practice button MUST return to its inactive state, and the toolbar MUST show the stopped state at the final note position. No summary screen, score, or result data is shown in this first step.
- **FR-010**: Short-tapping a note on the score canvas (same as Play Score seek) MUST be supported in Practice mode: it MUST reposition the target highlight to the tapped note without exiting Practice mode.
- **FR-011**: Pressing Stop in Practice mode MUST deactivate Practice mode, clear the highlight, and reset the playback position to tick 0 (or the pinned start tick if set), consistent with Play Score Stop behaviour.
- **FR-012**: When no MIDI device is connected and the user activates Practice mode, the plugin MUST display a notice informing the user that a MIDI device is required; the Practice button remains active (the mode is entered) but note advances do not occur until a MIDI device is available.
- **FR-013**: Exiting the plugin via Back or `context.close()` MUST deactivate Practice mode (if active), release all event subscriptions (MIDI), stop any active playback, and release audio resources before control returns to the host — identical to the Play Score plugin exit behaviour.
- **FR-014**: The plugin MUST NOT import directly from `frontend/plugins/play-score/` source files, `src/components/`, `src/services/`, or `src/wasm/`; all capabilities MUST be accessed via `context.*` or host-provided components.
- **FR-016**: The Practice button in the toolbar MUST be **disabled** (non-interactive) when the MIDI connection state is known to be disconnected (`midiConnected === false`). When the MIDI state is still pending (`null`), the button MUST be enabled to avoid blocking interaction during the asynchronous connection check. A tooltip on the disabled button MUST inform the user that a MIDI device is required. If a MIDI device disconnects while Practice mode is active, the plugin MUST display an inline notice in the toolbar without exiting Practice mode automatically.
- **FR-017**: When Practice mode ends by the user completing all notes (the last note is correctly pressed), the plugin MUST display a **results overlay** containing: (a) a numeric score (0–100), calculated as `((correct + late × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)`, clamped to [0, 100]; (b) a grade label (Perfect ≥ 90, Great ≥ 75, Good ≥ 60, Keep Practising < 60); (c) a 4-stat summary row (Notes / Correct / Late / Wrong); (d) a time comparison row with the user's total practice session duration vs. the score's expected duration at the selected tempo; (e) a collapsible per-note detail table (collapsed by default) with columns: note number, expected pitch name, played pitch name, outcome (correct / correct-late / wrong), wrong attempt count, timing delta in ms. The overlay MUST be dismissible via a × close button or by clicking the backdrop, after which the plugin returns to the idle-complete state. The Practice button MUST remain available to start a new session. A note is classified as **correct-late** when the user plays it correctly but more than 500 ms after its expected beat position.
- **FR-015**: Score notes that are part of a chord (multiple simultaneous pitches) MUST all be highlighted together as a single target. The user MUST press **all** pitches in the chord on MIDI within a simultaneous-press window of ≤ 80 ms for the target to advance. Pressing only a subset of the chord notes, or pressing them further apart than the window, MUST NOT advance the target. The chord detection logic MUST be implemented in a reusable, framework-agnostic `ChordDetector` utility class (canonical implementation in `frontend/src/utils/chordDetector.ts`, re-exported via the Plugin API in `frontend/src/plugin-api/index.ts`) that accepts individual MIDI attack events and reports a complete/incomplete state; single-note entries MUST continue to use a window of 1 (trivially complete on the first press).

### Key Entities

- **Practice View Plugin**: The external plugin package at `plugins-external/practice-view-plugin/`. Extends the Play Score experience with MIDI-driven step practice. Communicates with the host exclusively through the Plugin API.
- **Practice Mode**: A modal state within the plugin. When active, one note (or chord) in the score is highlighted as the current target, and MIDI input drives position advancement rather than automatic playback.
- **Target Note**: The currently highlighted note (or chord) in Practice mode that the user must press on MIDI to advance. Rests are excluded from target selection.
- **PracticePosition**: An index or tick pointer into the selected staff's ordered list of playable notes/chords, tracking which note is the current target in Practice mode.
- **SelectedStaff**: The staff (identified by its index or name, e.g. Treble / Bass) that the user has chosen as the target for Practice mode. Chosen once before entering Practice mode; persists for the duration of the Practice session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from launching the plugin to their first MIDI-driven note advance in 4 steps or fewer: launch plugin → select score → press Practice → press correct MIDI note.
- **SC-002**: Every correct MIDI note press advances the target highlight within 100 ms of the note being played, providing a responsive, real-time feel.
- **SC-003**: The plugin correctly identifies the target note for all note types present in the test score catalogue (single notes, chords, notes across different octaves) with zero false advances on incorrect MIDI input. For chords, the target advances only when all chord notes are pressed within the 80 ms simultaneous-press window.
- **SC-004**: Activating and deactivating Practice mode is instantaneous from the user's perspective — no loading state or perceptible delay when the Practice button is pressed.
- **SC-005**: The plugin builds and loads from `plugins-external/practice-view-plugin/` without requiring changes to the core app or the Play Score plugin source code.
- **SC-006**: All MIDI subscriptions and audio resources are released when the plugin is closed, verified by an automated test asserting clean teardown on unmount.

## Assumptions

- Plugin API v3 (as delivered in feature 033) exposes `context.components.ScoreRenderer` (or equivalent score-rendering surface) to external plugins in `plugins-external/`. No new Plugin API additions are required for feature 037 — the existing v3 surface is sufficient for both score rendering and MIDI pitch matching.
- "Next note" in Practice mode is defined as the next note (or chord) in tick order on the user-selected staff only. Notes on other staves are ignored for highlighting and MIDI matching purposes.
- Scoring and timing measurement are now included via the results overlay (FR-017). The session score, per-note timing deltas, and practice vs. score time comparison are computed client-side in the plugin from data already available in the practice engine state — no server round-trip is required.
- Chords are treated as a single target; **all** pitches in the chord must be pressed within a 80 ms simultaneous-press window to advance the position. Pressing only a subset does not advance. The definition of "chord" is notes with the same tick position in a single voice/staff.
- The plugin follows the same `plugin.json` manifest conventions as `virtual-keyboard-pro` for registration with the host app.
- The MIDI subscription in Practice mode listens for note-on events only; note-off events are not used for pitch matching. Matching is exact: the played MIDI note number must equal the target's MIDI pitch (0–127); the same pitch name in a different octave does not count as correct.
- Chord detection is handled by a `ChordDetector` class that accumulates individual note presses within a configurable time window (default 80 ms). The detector is reset each time the target advances to a new entry. The canonical implementation lives in `frontend/src/utils/chordDetector.ts` and is **re-exported via the Plugin API barrel** (`frontend/src/plugin-api/index.ts`), so any plugin imports it from the standard Plugin API surface — no mirror or duplication required.
- The Practice View plugin owns its complete toolbar UI. Playback controls (play, pause, stop, timer, tempo) are implemented using Plugin API v3 primitives. The Play Score plugin's toolbar component is not imported, extended, or modified. No changes to the Play Score plugin source are required.

