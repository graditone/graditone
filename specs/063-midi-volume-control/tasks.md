# Tasks: MIDI Volume Control

**Input**: Design documents from `/specs/063-midi-volume-control/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/wasm-dynamics-api.md

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new domain types and project structure shared across all user stories

- [x] T001 [P] Create dynamics.rs with DynamicLevel enum, DynamicMarking struct, GradualDirection enum, and GradualDynamic struct in backend/src/domain/events/dynamics.rs
- [x] T003 [P] Add velocity field (Option<u8>) to Note struct in backend/src/domain/events/note.rs
- [x] T004 [P] Add DynamicsData, WedgeData structs and Dynamics/Wedge variants to MeasureElement enum in backend/src/domain/importers/musicxml/types.rs
- [x] T005 [P] Add sound_dynamics field (Option<f64>) to MeasureData in backend/src/domain/importers/musicxml/types.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Frontend type definitions and shared utilities that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Add DynamicMarking, GradualDynamic, DynamicLevel, GradualDirection TypeScript interfaces to frontend/src/types/score.ts
- [x] T007 [P] Add optional velocity field to Note interface in frontend/src/types/score.ts
- [x] T008 [P] Add velocity field to ScheduledNote interface in frontend/src/types/playback.ts
- [x] T009 [P] Create volumeUtils.ts with logarithmic velocity-to-gain curve function in frontend/src/services/playback/volumeUtils.ts
- [x] T010 [P] Create unit tests for logarithmic curve (boundary values: 1, 64, 80, 127, and standard dynamic levels) in frontend/tests/unit/volumeUtils.test.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Hear dynamics when playing back a score (Priority: P1) 🎯 MVP

**Goal**: Score playback varies note volume according to dynamic markings (pp, ff, crescendo, diminuendo)

**Independent Test**: Load Chopin Nocturne Op.9 No.2, press Play, verify soft passages are quieter than loud passages

### Backend: MusicXML Dynamics Parsing

- [x] T011 [US1] Extend parse_direction() to extract `<dynamics>` child elements (p, pp, f, ff, etc.) in backend/src/domain/importers/musicxml/parser/structure.rs
- [x] T012 [US1] Extend parse_direction() to extract `<sound dynamics="N"/>` attribute alongside existing `<sound tempo>` in backend/src/domain/importers/musicxml/parser/structure.rs
- [x] T013 [US1] Extend parse_direction() to extract `<wedge>` elements (crescendo/diminuendo/stop with number matching) in backend/src/domain/importers/musicxml/parser/structure.rs
- [x] T014 [US1] Implement velocity assignment in the MusicXML converter stage: for each Note, look up the active DynamicMarking at its start_tick and staff, interpolate through GradualDynamic ranges, default to 80 (mf) if none found, in backend/src/domain/importers/musicxml/converter/ module (mod.rs or notes.rs)
- [x] T015 [US1] Extend ScoreDto serialisation to include dynamics and gradual_dynamics arrays, and Note.velocity field in backend/src/adapters/wasm/bindings.rs

### Backend: Tests

- [x] T016 [P] [US1] Unit test: parse score with static dynamics (pp at m1, ff at m5) and verify correct DynamicMarking extraction in backend/tests/dynamics_parsing/
- [x] T017 [P] [US1] Unit test: parse score with crescendo/diminuendo wedges and verify correct GradualDynamic start_tick/stop_tick pairing in backend/tests/dynamics_parsing/
- [x] T018 [P] [US1] Unit test: parse score with `<sound dynamics="N"/>` and verify velocity is clamped to 1–127 range in backend/tests/dynamics_parsing/
- [x] T019 [P] [US1] Unit test: parse score with no dynamics and verify all notes get velocity 80 (mf default) in backend/tests/dynamics_parsing/
- [x] T020 [P] [US1] Unit test: verify notes within a crescendo region have linearly interpolated velocities between surrounding dynamic levels in backend/tests/dynamics_parsing/

### Frontend: Dynamics Resolver

- [x] T021 [US1] Create DynamicsResolver service that resolves velocity at any tick position for a given staff (scan backwards + gradual interpolation) in frontend/src/services/playback/DynamicsResolver.ts
- [x] T022 [P] [US1] Unit tests for DynamicsResolver: static lookup, crescendo interpolation, no-dynamics default, seek/jump backward scan, multi-staff independence in frontend/tests/unit/DynamicsResolver.test.ts

### Frontend: Playback Pipeline

- [x] T023 [US1] Add velocity parameter to ToneAdapter.playNote() and pass it as 4th argument to sampler.triggerAttackRelease() and polySynth.triggerAttackRelease() using logarithmic gain from volumeUtils in frontend/src/services/playback/ToneAdapter.ts
- [x] T024 [US1] Extend PlaybackScheduler to read Note.velocity (or resolve via DynamicsResolver) and forward it to ToneAdapter.playNote() in frontend/src/services/playback/PlaybackScheduler.ts
- [x] T025 [US1] Extend WASM type definitions to carry dynamics and gradual_dynamics arrays from parse_musicxml() result in frontend/src/wasm/layout.ts
- [x] T026 [US1] Wire dynamics data from WASM parse result through to PlaybackScheduler in the score loading pipeline (App.tsx or ScoreViewer.tsx)

**Checkpoint**: Score playback with dynamics is fully functional. Pachelbel Canon D (no dynamics) plays at uniform mf — regression verified.

---

## Phase 4: User Story 2 — Hear touch-sensitive response from MIDI keyboard (Priority: P2)

**Goal**: MIDI keyboard velocity produces proportional volume; CC7/CC11 messages control live output volume

**Independent Test**: Connect MIDI keyboard, play softly then hard, verify clear volume difference. Adjust CC7 knob, verify volume responds.

### MIDI CC Parsing

- [x] T027 [P] [US2] Add parseMidiCC() function to parse 0xB0 Control Change messages returning {controller, value, channel} in frontend/src/services/recording/midiUtils.ts
- [x] T028 [P] [US2] Unit tests for parseMidiCC(): valid CC7, valid CC11, non-CC message returns null, other CC numbers ignored in frontend/tests/unit/midiUtils.test.ts

### MIDI Input Hook

- [x] T029 [US2] Extend useMidiInput to detect 0xB0 status bytes, route through parseMidiCC(), and call new onCC callback for CC7 and CC11 in frontend/src/services/recording/useMidiInput.ts
- [x] T030 [US2] Create MidiCCState tracking (channelVolume=127, expression=127 defaults) and apply multiplicative scaling formula in ToneAdapter.attackNote() using volumeUtils in frontend/src/services/playback/ToneAdapter.ts

### Velocity Curve for Live Input

- [x] T031 [US2] Update ToneAdapter.attackNote() to use the logarithmic gain curve from volumeUtils instead of the current linear (velocity/127) mapping in frontend/src/services/playback/ToneAdapter.ts

**Checkpoint**: MIDI keyboard produces full-range touch-sensitive volume. CC7/CC11 knobs control live volume. Velocity-only keyboards work correctly (CC defaults to 127).

---

## Phase 5: User Story 3 — Adjust master volume (Priority: P3)

**Goal**: Vertical volume slider in playback toolbar; scales all audio; persisted to localStorage

**Independent Test**: Play a score, drag volume slider up and down, verify smooth immediate volume change. Refresh page, verify volume restored.

### Master Volume in ToneAdapter

- [x] T032 [US3] Add setMasterVolume(percent: number) method to ToneAdapter that maps 1–100% to Tone.Destination.volume dB range (-60 dB to 0 dB) and mutes output (Tone.Destination.mute = true) at 0% for true silence, in frontend/src/services/playback/ToneAdapter.ts
- [x] T032a [US3] Add a Tone.Limiter(-1 dB) node between instruments and Tone.Destination to prevent audio clipping when high-velocity notes combine with high master volume (FR-012). Add unit test verifying output stays below 0 dBFS at max velocity + max volume in frontend/src/services/playback/ToneAdapter.ts
- [x] T033 [US3] Add getMasterVolume() method to ToneAdapter that reads current Tone.Destination.volume and returns 0–100% in frontend/src/services/playback/ToneAdapter.ts

### Persistence

- [x] T034 [P] [US3] Implement master volume persistence with localStorage key "graditone:volume:master" (load on init with default 80, save on change) in frontend/src/services/playback/ToneAdapter.ts

### UI: Volume Slider

- [x] T035 [US3] Create VolumeSlider component: vertical range input with speaker icon, 44×44px touch target, emits onChange with 0–100 value in frontend/src/components/VolumeSlider.tsx
- [x] T036 [US3] Add VolumeSlider to the score-playback-bar section of ScoreViewer, wired to ToneAdapter.setMasterVolume() in frontend/src/components/ScoreViewer.tsx

**Checkpoint**: Master volume slider appears in toolbar. All audio (playback, live input, metronome) scales uniformly. Setting persists across page refreshes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, regression verification, and cleanup

- [x] T037 [P] Regression test: load Pachelbel Canon D (no dynamics), play back, verify uniform mf volume — no change from pre-feature behaviour
- [x] T038 [P] Regression test: verify existing playback tests pass with velocity=undefined (backwards compatibility for scores parsed before this feature)
- [x] T039 [P] Update FEATURES.md with MIDI volume control feature description
- [x] T040 [P] Update docs/frontend-pwa.md with master volume architecture and dynamics pipeline
- [x] T041 Run quickstart.md validation — execute all verification steps from specs/063-midi-volume-control/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Rust types must exist before TS types mirror them)
- **US1 (Phase 3)**: Depends on Phase 2 — backend parsing + frontend pipeline
- **US2 (Phase 4)**: Depends on Phase 2 (volumeUtils) — independent of US1
- **US3 (Phase 5)**: Depends on Phase 2 — independent of US1 and US2
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Independence

- **US1 (P1)**: Score dynamics playback — requires backend + frontend work. **MVP scope.**
- **US2 (P2)**: MIDI touch response — frontend only (midiUtils, useMidiInput, ToneAdapter). Can proceed in parallel with US1 after Phase 2.
- **US3 (P3)**: Master volume — frontend only (ToneAdapter, new component). Can proceed in parallel with US1/US2 after Phase 2.

### Within Each User Story

- Backend parsing before frontend consumption (US1)
- Types/models before services
- Services before UI integration
- Tests can run in parallel with each other (all marked [P])

### Parallel Opportunities per Story

**US1 parallel batch 1** (after Phase 2): T016–T020 (backend tests) + T022 (DynamicsResolver tests) — all test files, independent  
**US1 parallel batch 2**: T011–T013 (parser extensions) — different XML elements, same file but sequential sections  
**US2 parallel batch**: T027–T028 (CC parsing + tests) — independent files  
**US3 parallel batch**: T034 (persistence) can run in parallel with T035 (UI component) — different files  

---

## Implementation Strategy

### MVP Scope

User Story 1 (Phase 3) alone delivers the highest-value outcome: scores play with dynamics instead of flat volume. This is a complete, demonstrable, independently testable increment.

### Incremental Delivery

1. **Phase 1+2**: Setup + Foundation (~5 tasks foundational types/utils)
2. **Phase 3**: US1 — Score dynamics playback (16 tasks, largest phase)
3. **Phase 4**: US2 — MIDI touch response (5 tasks, frontend-only)
4. **Phase 5**: US3 — Master volume slider (5 tasks, frontend-only)
5. **Phase 6**: Polish (5 tasks)

### Suggested Sprint Breakdown

- **Sprint 1**: Phases 1–3 (Setup + Foundation + US1 MVP)
- **Sprint 2**: Phases 4–6 (US2 + US3 + Polish)
