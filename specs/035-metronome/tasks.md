---

description: "Task list for 035-metronome: Metronome for Play and Practice Views"
---

# Tasks: Metronome for Play and Practice Views

**Input**: Design documents from `/specs/035-metronome/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/plugin-api-v5.ts ✅, quickstart.md ✅

**Tests**: Included — Principle V (Test-First Development) is enforced by the constitution; plan.md explicitly specifies Vitest unit tests and Playwright E2E tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Foundational tasks (Phase 2) must complete before any user story work can begin.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared in-progress dependencies)
- **[Story]**: Which user story this task belongs to — [US1], [US2], [US3]
- Exact file paths are included in each description

---

## Phase 1: Setup (Minimal — Project Already Initialized)

**Purpose**: Base CSS animation and module directory creation. No new dependencies are required — Tone.js v14.9.17 is already in `frontend/package.json`.

- [X] T001 Add `metro-pulse` CSS keyframe animation (.metro-pulse, .metro-downbeat classes) to `frontend/src/index.css`

**Checkpoint**: CSS animation available for use by play and practice view toolbars

---

## Phase 2: Foundational (Core Engine & Plugin API Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented. Includes: `MetronomeEngine` service, `useMetronome` React hook, Plugin API v5 types, `metronomeContext.ts` T006 proxy, and wiring in `PluginView.tsx` / `App.tsx`.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete. Write all tests FIRST — ensure they FAIL before implementing the corresponding source file.

### Engine (TDD: write tests first)

- [X] T002 Write failing unit tests for MetronomeEngine (BPM clamping, beatIndex computation, start/stop lifecycle, standalone vs phase-locked) in `frontend/src/services/metronome/MetronomeEngine.test.ts`
- [ ] T003a Extend `ToneAdapter.scheduleRepeat` to accept `string | number` as the interval parameter (currently `number` only); string values pass through directly to `Tone.Transport.scheduleRepeat` as Tone.js musical-time notation (e.g. `"4N"`, `"8N"`); update the TypeScript overload signature in `frontend/src/services/playback/ToneAdapter.ts` (prerequisite for T003 musical-time scheduling)
- [ ] T003b Wire `adapter.updateTempo(tempo * tempoMultiplier)` inside `PlaybackScheduler.scheduleNotes()` before the refill loop starts, so `Tone.Transport.bpm` always reflects `effectiveBpm = scoreBpm × activeTempoModifier` during playback — making `Transport.bpm` the single authoritative tempo source for all Transport-scheduled events (including the metronome); see R-006 in `specs/035-metronome/research.md`; file: `frontend/src/services/playback/PlaybackScheduler.ts`
- [X] T003 Implement MetronomeEngine — click synthesis with `Tone.MembraneSynth` (downbeat) + `Tone.Synth` (upbeat), `Tone.Transport.scheduleRepeat()` with **musical-time notation** (e.g. `adapter.scheduleRepeat(cb, denominator + "N")` so the interval auto-adjusts when `Transport.bpm` changes); in standalone mode calls `adapter.updateTempo(bpm)`; BPM clamping to 20–300; FR-012 audio-blocked state; **requires T003a complete** in `frontend/src/services/metronome/MetronomeEngine.ts`
- [X] T004 [P] Write failing unit tests for useMetronome hook (MetronomeState subscription, toggle, cleanup on unmount) in `frontend/src/services/metronome/useMetronome.test.ts`
- [X] T005 Implement useMetronome React hook wrapping MetronomeEngine and publishing MetronomeState snapshots in `frontend/src/services/metronome/useMetronome.ts`

### Plugin API v5 Types

- [X] T006 Add `MetronomeState` interface, `PluginMetronomeContext` interface, `readonly metronome: PluginMetronomeContext` field on `PluginContext`, `readonly timeSignature` field on `ScorePlayerState`; bump `PLUGIN_API_VERSION` from `'4'` to `'5'` in `frontend/src/plugin-api/types.ts`
- [X] T007 [P] Export `MetronomeState` and `PluginMetronomeContext` from barrel in `frontend/src/plugin-api/index.ts`

### metronomeContext — T006 Proxy (TDD: write tests first)

- [X] T008 [P] Write failing unit tests for `createNoOpMetronome`, `createMetronomeProxy`, and `useMetronomeBridge` (subscribe, toggle forwarding, no-op stub shape) in `frontend/src/plugin-api/metronomeContext.test.ts`
- [X] T009 Implement `useMetronomeBridge()`, `createNoOpMetronome()`, `createMetronomeProxy()` following the T006 proxy pattern (mirrors `scorePlayerContext.ts` structure) in `frontend/src/plugin-api/metronomeContext.ts`

### scorePlayerContext Extension

- [X] T010 [P] Add `extractTimeSignature()` private helper (reads `TimeSignatureEvent` at tick 0 from `score.global_structural_events`, defaults to 4/4) and add `timeSignature` field to `ScorePlayerState` snapshot in `frontend/src/plugin-api/scorePlayerContext.ts`

### Wiring — PluginView & App

- [X] T011 Add `metronomeRef` to `V3ProxyRefs`; call `useMetronomeBridge(metronomeRef)` inside `V3PluginWrapper` hook; write proxy ref back to `proxyRefs.metronomeRef.current` in `frontend/src/components/plugins/PluginView.tsx`
- [X] T012 [P] Create `metronomeRef` per plugin in `loadPlugins()`; add to proxy refs map; inject `metronome: createMetronomeProxy(metronomeRef)` into each `PluginContext` in `frontend/src/App.tsx`

**Checkpoint**: Foundation complete — `MetronomeEngine` ticks correctly in isolation; Plugin API v5 types compile; `context.metronome` is injectable and no-op stubs pass type checks. All user story phases can now begin.

---

## Phase 3: User Story 1 — Toggle Metronome in Play View (Priority: P1) 🎯 MVP

**Goal**: A musician opens a score in the play view, taps the metronome icon (rightmost toolbar button), and hears rhythmic beats at the score tempo. The icon shows active state and pulses visually on each beat. Tapping again stops the metronome immediately.

**Independent Test**: Load any score in play view (`http://localhost:5173`), click the metronome icon in the toolbar, verify audible ticking begins, verify the icon pulses visually, click again, verify ticking stops. Playback does NOT need to be running.

### Tests for User Story 1 ⚠️ Write FIRST — ensure they FAIL

- [X] T013 [P] [US1] Add metronome toggle button render test, active-state class test, and `onMetronomeToggle` callback test to `frontend/plugins/play-score/playbackToolbar.test.tsx`

### Implementation for User Story 1

- [X] T014 [US1] Add `metronomeActive: boolean`, `metronomeIsDownbeat: boolean`, `onMetronomeToggle: () => void` props and render metronome toggle button (rightmost, `aria-label`, `metro-pulse`/`metro-downbeat` classes) in `frontend/plugins/play-score/playbackToolbar.tsx`
- [X] T015 [US1] Subscribe to `context.metronome.subscribe()` in `PlayScorePlugin`, track `MetronomeState`, wire `context.metronome.toggle()` to toolbar prop, pass `metronomeActive` and `metronomeIsDownbeat` to `<PlaybackToolbar>` in `frontend/plugins/play-score/PlayScorePlugin.tsx`

**Checkpoint**: User Story 1 fully functional and independently testable — metronome toggle works in play view without playback running; visual pulse fires on each beat; FR-001, FR-003, FR-003a, FR-004, FR-005, FR-006, FR-008, FR-012 satisfied.

---

## Phase 4: User Story 2 — Toggle Metronome in Practice View (Priority: P2)

**Goal**: A musician in the practice view taps the metronome icon in the header toolbar and hears beats at the score's defined tempo. The experience mirrors the play view. Each view's metronome state is independent (FR-011).

**Independent Test**: Open any score in practice view, click the metronome icon, verify beats begin. Score playback not required. Verify that toggling in practice view does not affect a simultaneous play view instance.

### Tests for User Story 2 ⚠️ Write FIRST — ensure they FAIL

- [X] T016 [P] [US2] Add metronome button render test, active state toggle test, and independence-from-play-view assertion to `frontend/plugins/practice-view/PracticePlugin.test.tsx`

### Implementation for User Story 2

- [X] T017 [US2] Add metronome toggle button (rightmost in practice header toolbar, `aria-label`, `metro-pulse`/`metro-downbeat` classes); subscribe to `context.metronome.subscribe()` and wire `context.metronome.toggle()` in `frontend/plugins/practice-view/PracticePlugin.tsx`

**Checkpoint**: User Stories 1 AND 2 both independently functional — metronome works in play view and practice view independently; FR-002, FR-011 satisfied.

---

## Phase 5: User Story 3 — Metronome Follows Tempo Changes (Priority: P3)

**Goal**: When playback is running and reaches a tempo-change marking in the score, the metronome immediately adopts the new beat rate without interruption. In standalone mode the first tempo marking (or 120 BPM) applies.

**Independent Test**: Load `scores/Bach_InventionNo1.mxl` or any multi-tempo score; activate metronome; start playback; observe beat rate changes when the tempo marking is crossed. Verify no audio glitch or mis-alignment occurs at the transition.

### Tests for User Story 3 ⚠️ Write FIRST — ensure they FAIL

- [X] T018 [P] [US3] Add failing unit tests for `MetronomeEngine.updateBpm()` — verify Transport repeat interval is rescheduled to new BPM without stop/start click; verify beatIndex continuity in `frontend/src/services/metronome/MetronomeEngine.test.ts`

### Implementation for User Story 3

- [X] T019 [US3] Implement `MetronomeEngine.updateBpm(newBpm: number)` — clamp new BPM to 20–300 then call **only** `adapter.updateTempo(clampedBpm)`; no cancel-and-reschedule needed because musical-time notation causes `Transport.scheduleRepeat` to automatically use the updated BPM on the next beat; zero audio glitch; see R-006 in `frontend/src/services/metronome/MetronomeEngine.ts`
- [X] T020 [US3] Subscribe to `context.scorePlayer.subscribe()` inside `useMetronomeBridge` to detect `bpm` changes in `ScorePlayerState`; when engine is active and BPM differs, call `engine.updateBpm(newBpm)` — now glitch-free due to musical-time scheduling (R-006; requires T003b so `Transport.bpm` is already the authoritative tempo) in `frontend/src/plugin-api/metronomeContext.ts`

**Checkpoint**: All three user stories independently functional — metronome BPM tracks playback tempo changes; FR-007, FR-007a, FR-007b, SC-003, SC-004 satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, accessibility, FR-010 (navigation cleanup) confirmation, and full test suite run.

- [X] T021 [P] Write Playwright E2E test: play view metronome toggle → audible tick? (use `page.evaluate` to check Tone.Transport state), icon active class, visual `.metro-pulse` class on beat in `frontend/tests/metronome.spec.ts`
- [X] T022 [P] Write Playwright E2E test: practice view metronome toggle + independence from play view in `frontend/tests/metronome.spec.ts`
- [X] T023 [P] Write Playwright E2E test: navigate away from play view while metronome is active → verify metronome stops (FR-010) in `frontend/tests/metronome.spec.ts`
- [X] T024 Add `aria-pressed` attribute to both metronome toolbar buttons (FR-003 accessibility) and verify screen-reader label changes between active/inactive states in `frontend/plugins/play-score/playbackToolbar.tsx` and `frontend/plugins/practice-view/PracticePlugin.tsx`
- [X] T025 Run full test suite — `npx vitest run` (unit) + `npx playwright test --project=chromium` (E2E) — confirm 0 failures; fix any regressions

---

## Phase 7: Post-PR Bug Fixes & Refinements

**Purpose**: Fixes discovered during manual testing after initial PR merge.

- [X] T026 [US1] Fix subdivision dropdown icon not updating immediately when engine is inactive — `PlayScorePlugin.tsx` tracked `metronomeSubdivision` from `metronomeState.subdivision` which only updates on engine beat emissions; fix: add separate local `metronomeSubdivision` state that is updated synchronously in `handleMetronomeSubdivisionChange` and kept in sync with the engine subscription as a secondary path; file: `frontend/plugins/play-score/PlayScorePlugin.tsx`
- [X] T027 [US1] Fix metronome–playback phase sync: (a) subscriber passeed stale async `scheduleOffsetSeconds=0` when metronome was active and playback started — fix: use `computeBeatPhase(getCurrentTickLive(), getTransportSeconds())` in the subscriber (same as `toggle()` path); (b) remove over-eager `SNAP` guard in `computeBeatPhase` that set `scheduleOffsetSeconds = transportSeconds` when near a beat boundary, causing Tone.js to skip one full interval and shift the downbeat by one beat — fix: always schedule the next beat boundary with a strictly-future start time; files: `frontend/src/plugin-api/metronomeContext.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 — can start as soon as Phase 2 is complete
- **Phase 4 (US2)**: Depends on Phase 2 — can run in parallel with Phase 3 (different files)
- **Phase 5 (US3)**: Depends on Phase 2 — can run in parallel with Phase 3 and Phase 4; small surface area (2 engine + 1 context change)
- **Phase 6 (Polish)**: Depends on all desired user story phases being complete before running T025

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Independent after Phase 2 — no dependency on US1 or US3; mirrors US1 pattern
- **US3 (P3)**: Independent after Phase 2 — extends `MetronomeEngine` and `metronomeContext`; does not touch play/practice view UI

### Within Each Phase

- Tests (marked ⚠️) MUST be written and FAIL before the corresponding implementation
- T002 (engine tests) before T003 (engine impl)
- T004 (hook tests) can be written in parallel with T003 (different file; mock the engine)
- T006 (types) before T007, T008, T009, T010 (all depend on new interfaces)
- T008 (metronomeContext tests) and T010 (scorePlayerContext) can be written in parallel
- T009 (metronomeContext impl) before T011 and T012 (need the proxy factory)
- T011 and T012 (wiring) can be done in parallel (different files)
- T018 (updateBpm tests) before T019 (updateBpm impl)
- T019 (engine) before T020 (context subscription)

### Parallel Opportunities

All tasks marked `[P]` within a phase can be executed concurrently:
- **Phase 2**: T004, T007, T008, T010, T012 are all parallelizable after their named dependencies
- **Phase 3**: T013 (test) runs in parallel while finalizing Phase 2 foundational tasks
- **Phase 4**: T016 (test) runs in parallel with Phase 3 implementation
- **Phase 5**: T018 (test) runs in parallel with Phase 3/4 implementation
- **Phase 6**: T021, T022, T023 are fully parallel (all write to same file, different `test()` blocks — coordinate to avoid merge conflicts)

---

## Parallel Execution Example: Phase 2 (Foundational)

```
Stream A (Engine TDD):
  T002 → T003 → T004 → T005

Stream B (API Types + Context TDD):
  T006 → [T007 ‖ T008 ‖ T010] → T009 → [T011 ‖ T012]
```

## Parallel Execution Example: User Stories (post-Phase-2)

```
Stream A (US1 — Play View):   T013 → T014 → T015
Stream B (US2 — Practice):    T016 → T017
Stream C (US3 — Tempo):       T018 → T019 → T020
```

---

## Implementation Strategy

### MVP Scope (deliver first)

**Phase 1 + Phase 2 + Phase 3** — US1: Play View Metronome Toggle. This is a fully functional metronome that:
- Ticks audibly at the score's tempo
- Shows visual beat pulse on every beat (including downbeat distinction)
- Is toggled by a rightmost toolbar button
- Handles audio unlock (FR-012)
- Stops when leaving the view (FR-010)

Delivering US1 alone satisfies SC-001, SC-002, SC-004, SC-005.

### Incremental Delivery

1. **MVP**: Phase 1 + 2 + 3 → US1 in play view (all core FRs)
2. **+US2**: Phase 4 → practice view mirrors play view (FR-002, FR-011)
3. **+US3**: Phase 5 → tempo change tracking during playback (FR-007, FR-007a, SC-003)
4. **Polish**: Phase 6 → E2E validation, accessibility attributes, full regression pass

### TDD Order (per quickstart.md)

1. `MetronomeEngine.test.ts` (failing) → `MetronomeEngine.ts` (pass)
2. `useMetronome.test.ts` (failing) → `useMetronome.ts` (pass)
3. `types.ts` + `index.ts` (type-only, no tests needed)
4. `metronomeContext.test.ts` (failing) → `metronomeContext.ts` (pass)
5. `scorePlayerContext.ts` extension (covered by existing snapshot tests)
6. `PluginView.tsx` + `App.tsx` wiring (integration covered by E2E)
7. `playbackToolbar.test.tsx` extension (failing) → `playbackToolbar.tsx` extension (pass)
8. `PracticePlugin.test.tsx` extension (failing) → `PracticePlugin.tsx` extension (pass)
9. `tests/metronome.spec.ts` (Playwright E2E — last)
