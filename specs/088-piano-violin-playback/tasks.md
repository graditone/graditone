# Tasks: Piano and Violin Playback Support

**Input**: Design documents from `/specs/088-piano-violin-playback/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Format**: `- [ ] [TaskID] [P?] [Story?] Description — file path`  
- **[P]**: Parallelizable (different files, no dependency on in-progress tasks)  
- **[Story]**: User story label (US1 / US2 / US3)

---

## Phase 1: Setup

**Purpose**: Add shared TypeScript types needed by all phases.

- [X] T001 Add `InstrumentChannelConfig`, `InstrumentMixerEntry`, `InstrumentMixerState`, and `TaggedNote` type definitions (per data-model.md) to `frontend/src/types/playback.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend instrument classification + frontend timbre registry. All user stories depend on `instrument_type` being correctly populated and on the timbre lookup table existing before any audio-channel code runs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write inline Rust unit tests for `classify_instrument_type()` covering piano/violin/viola/cello/guitar/flute/trumpet/default cases (TDD red step) — `backend/src/domain/instrument.rs`
- [X] T003 Implement `pub fn classify_instrument_type(name: &str, midi_program: Option<u8>) -> String` using the lookup table from research.md R-002 (TDD green step) — `backend/src/domain/instrument.rs`
- [X] T004 Update MusicXML converter to pass part name and MIDI program to `classify_instrument_type()` and set `instrument.instrument_type` accordingly — `backend/src/domain/importers/musicxml/converter/mod.rs`
- [X] T005 Rebuild WASM bundle after backend changes so the frontend receives correctly typed instruments: `cd backend && wasm-pack build --target web --out-dir ../frontend/public/wasm`
- [X] T006 [P] Write `InstrumentTimbres.test.ts` covering: SC-002 piano=sampler/violin=polysynth+triangle+bowed-ADSR, `getTimbre('default')` returns polysynth fallback, all registry keys map to valid `TimbreConfig` — `frontend/src/services/playback/InstrumentTimbres.test.ts`
- [X] T007 Create `InstrumentTimbres.ts` with `TimbreConfig`/`SynthEnvelope`/`TimbreSource` types and `getTimbre(instrumentType: string): TimbreConfig` registry matching the table in data-model.md — `frontend/src/services/playback/InstrumentTimbres.ts`

**Checkpoint**: `cargo test classify_instrument` passes; `npm run test InstrumentTimbres` passes — foundation ready.

---

## Phase 3: User Story 1 — Simultaneous Multi-Instrument Playback (Priority: P1) 🎯 MVP

**Goal**: A piano+violin MusicXML score plays with audibly distinct timbres for each instrument part simultaneously from the first press of Play.

**Independent Test**: Load `Pachelbel_CanonD.mxl` (multi-instrument) in Play Score, press Play, verify two distinctly different timbres are heard at the same time. Load any existing single-instrument score and verify playback is unchanged.

### Tests for User Story 1 (TDD — write first, verify red before implementing)

- [X] T008 [P] [US1] Write `PlaybackChannel.test.ts` — contract tests for `IPlaybackChannel`: `playNote()` calls synth triggerAttackRelease, `setMuted(true)` sets volumeNode to −Infinity, `setMuted(false)` restores gain, `setVolume(0.5)` converts to dBFS, `dispose()` is idempotent — `frontend/src/services/playback/PlaybackChannel.test.ts`
- [X] T010 [P] [US1] Extend `ToneAdapter.test.ts` with multi-channel tests: `initChannel(1, violinTimbre)` creates a second channel, `playNoteOnChannel(1, ...)` routes to channel 1 not channel 0, `destroyChannels()` removes all channels, `playNoteOnChannel(99, ...)` falls back to channel 0 — `frontend/src/services/playback/ToneAdapter.test.ts`

### Implementation for User Story 1

- [X] T009 [US1] Create `PlaybackChannel.ts` implementing `IPlaybackChannel` (contract from `contracts/internal-contracts.md`): sampler path when `timbre.source === 'sampler'` reuses ToneAdapter's existing Sampler ref; polysynth path creates a `Tone.PolySynth` with timbre's oscillator+ADSR; owns a `Tone.Volume` node connecting to the shared limiter — `frontend/src/services/playback/PlaybackChannel.ts`
- [X] T011 [US1] Extend `ToneAdapter.ts` with multi-channel API: `initChannel(partIndex, config)`, `playNoteOnChannel(partIndex, pitch, duration, time, velocity?)`, `stopAllChannels()`, `destroyChannels()`, `getChannel(partIndex)` — update `stopAll()` and `clearSchedule()` to call `stopAllChannels()` — `frontend/src/services/playback/ToneAdapter.ts`
- [X] T012 [US1] Modify `PlaybackScheduler.scheduleWindow()` to call `toneAdapter.playNoteOnChannel((note as TaggedNote)._partIndex ?? 0, ...)` instead of `toneAdapter.playNote()` — `frontend/src/services/playback/PlaybackScheduler.ts`
- [X] T013 [US1] Add `extractTaggedNotes(score)` function to `scorePlayerContext.ts`; update score load flow to: (1) extract tagged notes, (2) call `ToneAdapter.getInstance().destroyChannels()` then `initChannel(i, getTimbre(instrument.instrument_type))` for each instrument, (3) pass tagged notes to `usePlayback` — `frontend/src/plugin-api/scorePlayerContext.ts`
- [X] T014 [US1] Update `allNotes` useMemo in `ScoreViewer.tsx` to tag each note with its instrument's 0-based index using `_partIndex`; call `ToneAdapter.getInstance().destroyChannels()` + `initChannel()` per instrument when score changes — `frontend/src/components/ScoreViewer.tsx`

**Checkpoint**: US1 complete — piano+violin score plays two distinct timbres; single-instrument regression passes.

---

## Phase 4: User Story 2 — Mute Individual Instruments During Playback (Priority: P2)

**Goal**: Instrument-level mute toggle buttons appear in the Play view when multiple instrument parts are loaded. Muting takes effect immediately during active playback.

**Independent Test**: Load a piano+violin score, mute the piano track via its toggle, press Play — only the violin is heard. Toggle piano unmuted — both sound again. Verify no mute controls appear for a single-instrument score.

### Tests for User Story 2

- [X] T015 [P] [US2] Write `useInstrumentMixer.test.ts` — tests for `initMixer()` creating entries, `toggleMute()` calling `PlaybackChannel.setMuted()`, all muted → isMuted=true on both, `resetMixer()` clearing state, single-instrument score → `isMultiInstrument=false` — `frontend/src/services/hooks/useInstrumentMixer.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Create `useInstrumentMixer.ts` with `initMixer(instruments, scoreId)`, `toggleMute(partIndex)`, `resetMixer()` — `toggleMute` calls `ToneAdapter.getInstance().getChannel(partIndex)?.setMuted(isMuted)` immediately — `frontend/src/services/hooks/useInstrumentMixer.ts`
- [X] T017 [US2] Create `InstrumentMixerOverlay.tsx` — renders mute toggle buttons positioned at each `StaffGroup.name_label.position` (scaled by `scoreScale`); renders `null` when `mixerState.isMultiInstrument === false`; first system only — `frontend/src/components/notation/InstrumentMixerOverlay.tsx`
- [X] T018 [US2] Create `InstrumentMixerOverlay.css` with mute-button styles (circular icon button, muted=red state indicator, positioned absolutely over score canvas) — `frontend/src/components/notation/InstrumentMixerOverlay.css`
- [X] T019 [US2] Mount `InstrumentMixerOverlay` as an absolutely-positioned sibling to the SVG canvas in `LayoutView.tsx`; pass `systems`, `mixerState`, `scoreScale`, `onToggleMute` props — `frontend/src/components/layout/LayoutView.tsx`
- [X] T020 [US2] Wire `useInstrumentMixer` into `scorePlayerContext.ts`: expose `mixerState` and `toggleMute` via the `ScorePlayerInternal` bridge; call `initMixer()` on score load, `resetMixer()` on score unload — `frontend/src/plugin-api/scorePlayerContext.ts`

**Checkpoint**: US2 complete — mute toggles visible and functional; muting takes effect during active playback without interruption.

---

## Phase 5: User Story 3 — Per-Instrument Volume Balance (Priority: P3)

**Goal**: Each instrument part has an independent volume slider (0–100%). Settings persist across page reloads keyed by score + part name.

**Independent Test**: Load a piano+violin score, drag violin slider to 20%, press Play — violin is noticeably quieter than piano. Reload the page, load the same score — violin slider restores to 20%.

### Tests for User Story 3

- [X] T021 [P] [US3] Add volume persistence tests to `useInstrumentMixer.test.ts`: `setVolume(1, 0.3)` persists via `scopedSetItem`, `initMixer()` restores volume from `scopedGetItem`, volume clamped to [0,1], single-instrument score has no volume entry — `frontend/src/services/hooks/useInstrumentMixer.test.ts`

### Implementation for User Story 3

- [X] T022 [US3] Extend `useInstrumentMixer.ts` with `setVolume(partIndex, volume)`: clamp to [0,1], call `ToneAdapter.getInstance().getChannel(partIndex)?.setVolume(volume)`, persist via `scopedSetItem('graditone:volume:part:<scoreId>::<partName>', String(volume))` — `frontend/src/services/hooks/useInstrumentMixer.ts`
- [X] T023 [US3] Update `initMixer()` in `useInstrumentMixer.ts` to restore volume from `scopedGetItem` for each instrument on score load; default to `1.0` if no persisted value found — `frontend/src/services/hooks/useInstrumentMixer.ts`
- [X] T024 [US3] Add per-instrument volume slider to `InstrumentMixerOverlay.tsx` below each mute button; slider range 0–100 maps to 0.0–1.0; slider hidden when `isMultiInstrument === false` — `frontend/src/components/notation/InstrumentMixerOverlay.tsx`
- [X] T025 [US3] Wire `setVolume` through `ScorePlayerInternal` bridge in `scorePlayerContext.ts` and pass `onVolumeChange` down through `LayoutView.tsx` → `InstrumentMixerOverlay` — `frontend/src/plugin-api/scorePlayerContext.ts` + `frontend/src/components/layout/LayoutView.tsx`

**Checkpoint**: US3 complete — per-instrument volume persists across reloads; slider hidden for single-instrument scores.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T026 [P] Write E2E test covering: multi-instrument score plays distinct timbres (US1), mute piano → only violin heard (US2), volume slider at 20% → violin quieter (US3), reload → volume restored (US3 SC-006) — `frontend/e2e/playback-multi-instrument.spec.ts`
- [X] T027 Run full frontend unit test suite and confirm all pre-existing tests pass unchanged (SC-004 regression check): `cd frontend && npm run test`
- [X] T028 [P] Run full Rust test suite and confirm all pre-existing tests pass (SC-004): `cd backend && cargo test`
- [X] T029 [P] Verify piano brace edge case (FR-007): in a piano+violin score, confirm piano's treble and bass staves share `_partIndex = 0` and a single mute toggle silences both staves — manual inspection + unit test assertion in `PlaybackChannel.test.ts`

---

## Dependencies

```
T001 (types) ─────────────────────────────────────── blocks T008, T010, T015, T021

T002 (Rust tests)
  └── T003 (classify_instrument_type)
        └── T004 (converter update)
              └── T005 (WASM rebuild)
                    └── T013, T014 (note tagging with correct instrument_type)

T006 (timbre tests)
  └── T007 (InstrumentTimbres.ts) ────────────────── blocks T009

T008 (PlaybackChannel tests)
  └── T009 (PlaybackChannel.ts) ──────────────────── blocks T011

T010 (ToneAdapter multi-channel tests)
  └── T011 (ToneAdapter extend) ───────────────────── blocks T012
        └── T012 (Scheduler routing)
              └── T013 (scorePlayerContext tagging + channel init)
                    ├── T015 → T016 → T017 → T018 → T019 → T020 (US2 chain)
                    └── T021 → T022 → T023 → T024 → T025 (US3 chain)

T026, T027, T028, T029 — after all user story phases complete
```

## Parallel Execution Examples

### During Phase 2 (after T001 is done)
- **Track A**: T002 → T003 → T004 → T005
- **Track B**: T006 → T007

### During Phase 3 setup (after Phase 2 complete)
- **Track A**: T008 → T009
- **Track B**: T010 → T011
(T012 can start once both T011 and T009 are done)

### During Final Phase
- T026 and T027 and T028 and T029 all parallelizable

---

## Implementation Strategy

**MVP scope (US1 only — Phase 2 + Phase 3)**: Tasks T001–T014 deliver a fully working multi-instrument playback engine with distinct piano and violin timbres. This alone satisfies SC-001, SC-002, SC-004, SC-005, SC-007 and the core feature requirement.

**Incremental delivery**:
1. Merge Phase 1+2+3 (T001–T014) for US1 MVP — multi-timbre playback
2. Merge Phase 4 (T015–T020) for US2 — mute controls
3. Merge Phase 5 (T021–T025) for US3 — volume balance + persistence

**Format validation**: All tasks follow `- [ ] T### [P?] [US?] Description — path` format. ✅
