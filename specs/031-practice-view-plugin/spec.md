> **Renamed** — The plugin described in this document was renamed to **Train** in feature 036.
> Canonical plugin path: `frontend/plugins/train-view/`
> See [specs/036-rename-practice-train/](../036-rename-practice-train/) for the rename spec.

---

# Feature Specification: Practice View Plugin & Plugin API Recording Extension

**Feature Branch**: `031-practice-view-plugin`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "Convert Practice view to a plugin. Extend Plugin API to cover needs to support yet, like the recording of sound."

## Clarifications

### Session 2026-02-26

- Q: Can plugins access raw audio data (PCM buffers, waveform data) via `context.recording`, or only pitch events? → A: Pitch events only — `context.recording` delivers only `PluginPitchEvent` (note, Hz, confidence, timestamp); raw PCM/audio buffers are never accessible to plugins.
- Q: Must the exercise configuration UI (BPM, clef, mode, octave range) be preserved in the migrated Practice plugin, or does the plugin ship with fixed defaults? → A: Full config UI preserved — BPM selector, clef selector, mode (flow/step), and octave range are all included, matching current behaviour.
- Q: Should the Practice plugin use two separate `StaffViewer` instances (exercise + response) or extend `StaffViewer` with a dual-staff mode? → A: Two separate `StaffViewer` instances — no `StaffViewer` API change required; the plugin arranges them with its own layout.
- Q: Does `context.recording.subscribe` deliver pitch events always-on (plugin filters by phase), or does the API expose explicit start/stop capture calls? → A: Always-on subscription — `context.recording.subscribe` delivers every detected pitch continuously; the plugin is responsible for ignoring events outside its active capture window.
- Q: Must the countdown phase ("3…2…1…Go!") before exercise playback be preserved in the Practice plugin? → A: Yes — the countdown phase is retained; it gives users time to prepare before notes begin playing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practice as a First-Class Plugin (Priority: P1)

A user opens Musicore, navigates to the Practice plugin from the navigation (just as they would navigate to the Virtual Keyboard plugin), and completes a note-matching exercise using either their microphone or a connected MIDI device. The experience is identical to the current debug-mode Practice view, but it is now available as a standard, production-quality plugin rather than a hidden debug screen.

**Why this priority**: This is the primary user-facing outcome of the entire feature. It validates that the Plugin API is rich enough to host a real, complex plugin while delivering immediate musical value to everyday users.

**Independent Test**: Can be fully tested by opening the app, navigating to the Practice plugin entry in the navigation, playing an exercise with microphone input, and verifying the score results screen appears — independently of the API extension work.

**Acceptance Scenarios**:

1. **Given** the user opens the app, **When** they look at the navigation, **Then** the Practice plugin is listed as a navigation entry alongside any other installed plugins.
2. **Given** the user navigates to the Practice plugin, **When** it loads, **Then** the exercise interface is displayed with the exercise staff, controls, and input source indicator.
3. **Given** the Practice plugin is open and the user has microphone permission, **When** they start the exercise and play the displayed notes, **Then** their pitch is captured and the result screen shows a score.
4. **Given** the Practice plugin is open and a MIDI device is connected, **When** the user starts the exercise and plays the displayed notes on the MIDI device, **Then** the notes are captured and the result screen shows a score including timing accuracy.
5. **Given** the user presses Play, **When** the countdown completes ("3…2…1…Go!"), **Then** exercise playback begins and the user can start playing notes.
6. **Given** the user is on the result screen, **When** they choose "Try Again" or "New Exercise", **Then** the exercise resets correctly and they can play again.
7. **Given** the user is inside the Practice plugin view, **When** they navigate away using the app navigation, **Then** all audio resources (microphone capture, audio playback) are cleanly released.

---

### User Story 2 - Plugin API: Real-Time Pitch Capture for Plugins (Priority: P2)

A plugin developer building an instrument-training plugin subscribes to real-time microphone pitch detection events through the Plugin API. Their plugin receives a stream of detected pitches as the user plays or sings, enabling them to build matching, feedback, or educational experiences without accessing any Musicore internal services directly.

**Why this priority**: This is the core API extension that unlocks the Practice plugin and any future recording-capable plugin. Without it, the Practice plugin cannot be isolated from internal services and the Plugin API remains insufficient for audio-input use cases.

**Independent Test**: Can be fully tested by building a minimal plugin that subscribes to pitch events and displays the currently detected note — independently of the full Practice exercise logic.

**Acceptance Scenarios**:

1. **Given** a plugin calls `context.recording.subscribe(handler)` on mount, **When** the user's microphone detects a pitched sound, **Then** the handler is called with a `PluginPitchEvent` containing the MIDI note number, frequency, and confidence value.
2. **Given** a plugin is subscribed to pitch events, **When** the plugin unmounts and calls the returned unsubscribe function, **Then** no further pitch events are delivered and the microphone resource is released if no other subscriber is active.
3. **Given** the user has not granted microphone permission, **When** a plugin subscribes to pitch events, **Then** the plugin receives an error notification via `context.recording.onError` and no permission dialog is triggered without an explicit user action.
4. **Given** the microphone is already active (shared by a prior subscriber), **When** a second plugin subscribes, **Then** microphone access is not requested again — the existing stream is shared.
5. **Given** no microphone is available or permission is permanently denied, **When** a plugin subscribes, **Then** the plugin receives an error notification rather than silently receiving nothing.

---

### User Story 3 - Plugin API: Scheduled Note Playback for Plugins (Priority: P3)

A plugin developer needs to play a sequence of notes with precise timing — for example, to demonstrate a melody that the user should then repeat. The Plugin API provides a way to schedule multiple note events relative to the current time so the plugin can drive timed playback without managing audio scheduling internally.

**Why this priority**: The Practice plugin needs to play an exercise note sequence with per-note timing offsets. The existing `playNote` call is immediate (no scheduling offset). This API gap must be filled before the Practice plugin can replicate its current playback behaviour through the API alone.

**Independent Test**: Can be fully tested by building a plugin that schedules a 4-note sequence with 500 ms offsets, and confirming each note plays at the expected time — independently of any capture or scoring logic.

**Acceptance Scenarios**:

1. **Given** a plugin calls `context.playNote` with `offsetMs: 0` and a second call with `offsetMs: 500`, **When** playback runs, **Then** the first note plays immediately and the second note plays approximately 500 ms later.
2. **Given** a plugin has scheduled a sequence of notes, **When** the plugin calls `context.stopPlayback()`, **Then** all pending scheduled notes are cancelled and no further audio is produced.
3. **Given** the host audio engine is muted (e.g. during microphone capture), **When** a plugin schedules notes, **Then** the notes are scheduled but produce no audible output until mute is lifted.
4. **Given** `context.stopPlayback()` is called when no notes are scheduled, **When** it executes, **Then** it completes without error (safe no-op).

---

### User Story 4 - Plugin Developer Migrates Practice View Using Plugin API (Priority: P4)

A plugin developer (or Musicore contributor) can migrate the existing `PracticeView` into a self-contained plugin at `frontend/plugins/practice-view/` that uses only the Musicore Plugin API. No internal Musicore services (`usePracticeRecorder`, `ToneAdapter`, `exerciseGenerator`) are imported directly by the plugin.

**Why this priority**: This is the acceptance test for the whole feature: if the migration is complete, the Plugin API is proven sufficient for a production-quality feature. It is lowest priority because it depends on all prior stories.

**Independent Test**: Can be validated by reviewing `frontend/plugins/practice-view/` and confirming zero imports of Musicore internal module paths. Static analysis must flag any violation.

**Acceptance Scenarios**:

1. **Given** the `frontend/plugins/practice-view/` codebase, **When** static analysis runs, **Then** no imports of Musicore internal paths (e.g. `../../services/`, `../../wasm/`) are found — all Musicore capabilities come from `context.*`.
2. **Given** the old `frontend/src/components/practice/PracticeView.tsx` is removed, **When** the app is built and the Practice plugin is opened, **Then** all exercise functionality (mic input, MIDI input, flow mode, step mode, scoring, result screen) remains available without regression.
3. **Given** the Practice plugin is installed as a built-in plugin, **When** the user opens the app, **Then** it appears in navigation automatically with no user setup required.

---

### Edge Cases

- What happens when the user navigates away from the Practice plugin mid-exercise? Microphone capture and all pending playback timers must be released on plugin unmount.
- What happens when microphone permission is revoked by the OS while a pitch-capture subscription is active? The plugin receives an error event and the subscription is inactivated.
- What happens when two plugins subscribe to pitch events simultaneously? The host shares a single microphone stream; both handlers receive events independently.
- What happens if `context.stopPlayback()` is called when no notes are scheduled? The call must be a safe no-op.
- What happens when the Practice plugin is reloaded via the error boundary "Reload plugin" action during an active exercise? All audio resources must be released before reload to avoid orphaned mic streams or audio processes.
- What happens if the user rapidly starts and stops exercises, causing multiple concurrent capture windows? Only one capture window must be active at a time; starting a new one implicitly stops any currently in progress.

## Requirements *(mandatory)*

### Functional Requirements

**Plugin API Extension — Pitch Capture**

- **FR-001**: The Plugin API MUST expose a `recording` namespace on `PluginContext` that allows plugins to subscribe to real-time pitch detection events from the microphone. The `recording` namespace MUST deliver only interpreted pitch data (`PluginPitchEvent`); raw PCM audio buffers, waveform data, and AudioWorklet output MUST NOT be accessible to plugins under any circumstances.
- **FR-002**: `context.recording.subscribe(handler)` MUST return an unsubscribe function; calling it MUST stop pitch event delivery to that handler and release the microphone if no other subscriber remains active. The subscription is always-on — pitch events are delivered continuously from the moment of subscription; the plugin is responsible for filtering events by its own internal state (e.g. ignoring events outside an active exercise capture window).
- **FR-003**: Pitch events delivered to plugin handlers MUST include: detected MIDI note number (integer, 0–127), frequency in Hz, confidence value (0.0–1.0), and a millisecond timestamp.
- **FR-004**: The microphone resource MUST be shared across all active pitch-capture subscribers; the host MUST NOT open more than one microphone stream regardless of how many plugins subscribe.
- **FR-005**: When microphone access is unavailable or denied, the host MUST notify the subscribing plugin via `context.recording.onError`; the plugin MUST NOT trigger a permission dialog without a direct user action.
- **FR-006**: The Plugin API version MUST be incremented to reflect the addition of the `recording` namespace, following the existing integer versioning scheme (`"1"` → `"2"`).

**Plugin API Extension — Scheduled Playback**

- **FR-007**: The existing `context.playNote(event)` MUST be extended to accept an optional `offsetMs` field; when present, the note MUST be played that many milliseconds after the call rather than immediately. Omitting `offsetMs` preserves existing immediate-playback behaviour.
- **FR-008**: The Plugin API MUST expose `context.stopPlayback()` to cancel all pending scheduled note events for the calling plugin without affecting other plugins or app-level playback.

**Practice Plugin**

- **FR-009**: The Practice exercise feature MUST be re-implemented as a self-contained built-in plugin at `frontend/plugins/practice-view/`, following the same internal conventions as `frontend/plugins/virtual-keyboard/`.
- **FR-010**: The Practice plugin MUST be available in the app navigation by default with no user import required.
- **FR-011**: The Practice plugin MUST support both microphone input (via `context.recording.subscribe`) and MIDI device input (via `context.midi.subscribe`) — no direct imports of `usePracticeRecorder` or `useMidiInput` are permitted within plugin code.
- **FR-012**: The Practice plugin MUST implement both flow mode (full playback, notes captured in one pass) and step mode (advance on each correct note), preserving the behaviour of the current `PracticeView`. The plugin MUST also include a countdown phase ("3…2…1…Go!") between the Play action and the start of exercise note playback, giving the user time to prepare.
- **FR-013**: The Practice plugin MUST drive exercise playback using `context.playNote` with `offsetMs` scheduling — no direct use of `ToneAdapter` is permitted inside the plugin.
- **FR-014**: The Practice plugin MUST use `context.components.StaffViewer` to render the exercise staff and the response staff — no direct use of the WASM layout engine is permitted inside the plugin.
- **FR-015**: The Practice plugin MUST display exercise results (per-note comparison, total score) after each completed exercise run.
- **FR-016**: After the Practice plugin migration is complete, the original `frontend/src/components/practice/PracticeView.tsx` and its debug-mode wiring in `App.tsx` / `ScoreViewer.tsx` MUST be removed from the codebase.
- **FR-017**: The Practice plugin MUST be visible to all users in the standard production navigation — it is NOT restricted to debug mode. This is consistent with `PracticeView` having already been promoted out of debug mode prior to this feature.
- **FR-018**: All Plugin API additions (`recording` namespace, `offsetMs`, `stopPlayback`) MUST be documented within the repository alongside the existing Plugin API reference before the feature is merged.
- **FR-019**: Static analysis MUST flag any import of a Musicore internal path within `frontend/plugins/practice-view/` as a lint or type error, consistent with the enforcement established in feature 030.
- **FR-020**: The Plugin API boundary for microphone access MUST enforce least privilege — the `context.recording` namespace is the sole authorised route for plugins to receive audio-derived data. Plugins MUST NOT receive raw audio streams, PCM buffers, or any uninterpreted microphone output. This constraint MUST be documented in the Plugin API reference.
- **FR-021**: The Practice plugin MUST include a user-configurable exercise setup UI that exposes, at minimum: BPM (tempo), clef (Treble/Bass), exercise mode (flow/step), and octave range — matching the configuration options available in the current `PracticeView`. These settings MUST be adjustable before starting each exercise.

### Key Entities

- **`PluginPitchEvent`**: A single pitch detection sample delivered to a plugin. Carries MIDI note number, frequency (Hz), confidence (0–1), and timestamp (ms). Part of the public Plugin API.
- **`PluginRecordingContext`**: The `recording` namespace on `PluginContext`. Exposes `subscribe(handler: (event: PluginPitchEvent) => void): () => void` and `onError(handler: (error: string) => void): () => void`.
- **`Practice Plugin`**: The built-in plugin at `frontend/plugins/practice-view/` that replaces the debug-only `PracticeView`. Communicates with the host exclusively through the Plugin API.
- **`PracticeExercise`** (plugin-internal): A generated sequence of target notes with BPM, mode (flow | step), and clef. Lives entirely within the Practice plugin — not part of the Plugin API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Practice plugin is accessible to all users within two navigation taps from the app home screen, with no setup required.
- **SC-002**: A user can complete a full practice exercise (load → configure → play → capture → view results) in under 3 minutes from first opening the plugin.
- **SC-003**: Pitch events are delivered to plugin handlers within 50 ms of microphone detection — matching the responsiveness of the existing internal `usePracticeRecorder` implementation.
- **SC-004**: 100% of the Practice plugin's Musicore-facing calls go through the Plugin API — zero direct imports of internal Musicore services, verifiable by static analysis with no exceptions.
- **SC-005**: All existing Practice view acceptance tests pass after migration, with no regression in exercise flow, scoring logic, MIDI integration, or microphone capture behaviour.
- **SC-006**: The Plugin API documentation covers the `recording` namespace and `offsetMs` scheduling additions within the same feature branch; no undocumented API surface is shipped.
- **SC-007**: A plugin developer can build a functional microphone pitch-detection plugin using only the Plugin API documentation, without reading any Musicore internal source files.
- **SC-008**: `context.stopPlayback()` cancels all pending scheduled notes for the calling plugin within one audio processing frame (≤ 10 ms of the call).

## Assumptions

- The Practice plugin owns its exercise generation and scoring logic internally; only the input capture and audio playback primitives are added to the Plugin API.
- The Practice plugin renders two independent `StaffViewer` instances — one for the exercise (target notes) and one for the response (played notes). No new `StaffViewer` props or API surface changes are required.
- The `offsetMs` addition to `PluginNoteEvent` is backward-compatible: omitting it preserves existing immediate-playback behaviour for all existing plugins.
- `context.recording.subscribe` is always-on once called; there are no start/stop capture methods on the API. The Practice plugin gates note accumulation into the exercise response by checking its own phase state (only committing events received while in the "playing" phase), consistent with how `context.midi.subscribe` works.
- The microphone pitch detection behind `context.recording` reuses the same AudioWorklet pipeline currently powering `usePracticeRecorder`, without changing the detection algorithm.
- Removing `PracticeView.tsx` and its debug-mode wiring is in scope for this feature and counts as a required migration deliverable.
- The existing `PracticeView.test.tsx` unit tests are ported or replaced by equivalent tests within the Practice plugin's own test suite.
- Plugin API version increments from `"1"` to `"2"` to reflect the additions; the `PluginImporter` rejection logic (FR-019 of feature 030) will correctly reject plugins requiring API version `"2"` if run against an older host.

