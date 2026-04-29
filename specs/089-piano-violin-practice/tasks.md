# Tasks: Piano Practice with Violin Accompaniment Playback

**Input**: Design documents from `/specs/089-piano-violin-practice/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/plugin-api-v11.ts ✅ · quickstart.md ✅

**Principle V — Test-First (NON-NEGOTIABLE)**: In each phase, test tasks MUST be written and confirmed failing before their implementation tasks. No exceptions.

---

## Phase 1: Setup

**Purpose**: Confirm development environment and no conflicting changes

- [X] T001 Verify Feature 088 ToneAdapter.getChannel() is accessible from frontend/src/plugin-api/scorePlayerContext.ts and run `cd frontend && npx tsc --noEmit` to confirm clean baseline

---

## Phase 2: Foundational — Plugin API v11

**Purpose**: Extend the Plugin API with instrument metadata and per-part volume control. Blocks ALL user story work — no US1/US2/US3/US4 task can begin until this phase is complete.

**⚠️ CRITICAL**: US1 through US4 all depend on `getInstruments()` and `setPartVolume()` being available in `PluginScorePlayerContext`. Do not start Phase 3 until T006 passes.

- [X] T002 Add `PluginInstrumentInfo` interface and update header comment to v11 in `frontend/src/plugin-api/types.ts`
- [X] T003 Extend `PluginScorePlayerContext` interface with `getInstruments()` and `setPartVolume()` signatures in `frontend/src/plugin-api/types.ts`
- [X] T004 Write failing contract tests for `getInstruments()` and `setPartVolume()` in `frontend/tests/integration/accompaniment.test.ts` (must be red — no implementation yet)
- [X] T005 [P] Implement `getInstruments()` in `frontend/src/plugin-api/scorePlayerContext.ts` reading from `scoreRef.current.instruments` and applying `resolveInstrumentType()`
- [X] T006 [P] Implement `setPartVolume(partIndex, volume)` in `frontend/src/plugin-api/scorePlayerContext.ts` using `ToneAdapter.getInstance().getChannel(partIndex)?.setVolume(Math.max(0, Math.min(1, volume)))`
- [X] T007 Update `createNoOpScorePlayer()` stub and proxy delegation object in `frontend/src/plugin-api/scorePlayerContext.ts` to include `getInstruments: () => []` and `setPartVolume: () => {}`

**Checkpoint**: `frontend/tests/integration/accompaniment.test.ts` contract tests (T004) now pass. TypeScript compiles clean. Phase 3 may begin.

---

## Phase 3: User Story 1 — Violin Plays Back Automatically During Piano Practice (Priority: P1) 🎯 MVP

**Goal**: When a violin+piano score is loaded in the Practice plugin, the violin part plays at 70% volume automatically without any user action.

**Independent Test**: Load a violin+piano score in the Practice plugin. Start playback. Confirm violin audio is audible (accompaniment active at 70% gain via ToneAdapter channel). Load a piano-only score. Confirm no new UI appears and playback is identical to today.

- [X] T008 [US1] Write failing unit tests for `useAccompaniment` hook in `frontend/plugins/practice-view-plugin/useAccompaniment.test.ts` covering: detects accompaniment parts, derives `hasAccompaniment=true` for violin+piano score, derives `hasAccompaniment=false` for piano-only score, applies 70% default volume to all non-piano partIndexes on score load (must be red — hook does not exist yet)
- [X] T009 [US1] Create `useAccompaniment.ts` in `frontend/plugins/practice-view-plugin/` — hook that calls `scorePlayer.getInstruments()`, derives `accompanimentParts` (non-piano parts) and `hasAccompaniment`, reads/writes `pageSessionVolume` module-level singleton (default 0.7), calls `scorePlayer.setPartVolume()` for each accompaniment part on score change and on volume change, returns `{ hasAccompaniment, volume, setVolume }`
- [X] T010 [US1] Modify `PracticeViewPlugin.tsx` to call `useAccompaniment(context.scorePlayer)` and pass `{ hasAccompaniment, accompanimentVolume: volume, onAccompanimentVolumeChange: setVolume }` props to `PracticeToolbar`
- [X] T011 [P] [US1] Write regression test in `frontend/plugins/practice-view-plugin/useAccompaniment.test.ts`: piano-only score (no non-piano parts) → `hasAccompaniment=false`, `setPartVolume` never called

**Checkpoint**: US1 fully functional and independently testable. Load violin+piano score in Practice plugin → violin plays at 70%. Load piano-only score → identical to today's behaviour. All T008/T011 tests pass.

---

## Phase 4: User Story 2 — Violin Accompaniment Volume Is Independently Adjustable (Priority: P2)

**Goal**: A volume slider appears in the Practice plugin toolbar (only for violin+piano scores) allowing the student to set accompaniment volume 0–100% without affecting piano note detection volume.

**Independent Test**: Load violin+piano score. Drag accompaniment slider from 70% to 30%. Confirm violin quieter, piano feedback unchanged. Drag to 0%. Confirm violin silent. Stop and restart practice — confirm 30% is retained.

- [X] T012 [US2] Write failing component tests for `AccompanimentVolumeSlider` in `frontend/plugins/practice-view-plugin/AccompanimentVolumeSlider.test.tsx` covering: renders slider with current volume value, fires `onVolumeChange` on input change, renders label "Accompaniment", is accessible (aria-label, aria-valuemin=0, aria-valuemax=100), does not render when `visible=false` (must be red — component does not exist yet)
- [X] T013 [US2] Create `AccompanimentVolumeSlider.tsx` in `frontend/plugins/practice-view-plugin/` — renders an `<input type="range" min={0} max={100}>` slider with "Accompaniment" label, accepts `{ volume: number; onVolumeChange: (v: number) => void; visible: boolean }` props, handles tablet touch targets (min 44px), aria attributes
- [X] T014 [US2] Modify `practiceToolbar.tsx` to accept `hasAccompaniment`, `accompanimentVolume`, and `onAccompanimentVolumeChange` props and render `<AccompanimentVolumeSlider visible={hasAccompaniment} volume={accompanimentVolume} onVolumeChange={onAccompanimentVolumeChange}>` after the tempo multiplier slider
- [X] T015 [P] [US2] Write integration test in `frontend/plugins/practice-view-plugin/useAccompaniment.test.ts`: calling `setVolume(0.4)` updates `pageSessionVolume` to 0.4 and immediately calls `setPartVolume(partIndex, 0.4)` for each accompaniment part
- [X] T016 [P] [US2] Write integration test in `frontend/plugins/practice-view-plugin/useAccompaniment.test.ts`: calling `setVolume(0)` (mute) calls `setPartVolume(partIndex, 0)` — confirms full mute path

**Checkpoint**: US1 + US2 fully functional. Slider visible for violin+piano scores, hidden for piano-only scores. Volume persists across stop/restart within the session. All T012/T015/T016 tests pass.

---

## Phase 5: User Story 3 — Violin Accompaniment Follows Practice Tempo (Priority: P2)

**Goal**: Verify that violin accompaniment stays in sync when the tempo multiplier is changed (no new implementation needed — already correct by ToneAdapter architecture; this phase produces the test that proves it).

**Independent Test**: Load violin+piano score at 60% tempo. Confirm violin plays at the same scaled tempo as the piano practice.

- [X] T017 [US3] Write integration test in `frontend/tests/integration/accompaniment.test.ts`: mock scorePlayer with `setTempoMultiplier`, confirm that changing tempo multiplier does not require any additional accompaniment-specific logic (verifies R-004 orthogonality: the ToneAdapter channels are all driven by the same transport clock)

**Checkpoint**: US3 verified. Tempo sync is architecturally correct — a single test documents the guarantee.

---

## Phase 6: User Story 4 — Violin Accompaniment Works With One-Hand Practice Mode (Priority: P3)

**Goal**: Verify that `setPlaybackStaffFilter` (Feature 084 staff dropdown) and accompaniment volume control are orthogonal — staff filter affects piano notes only; violin channel is unaffected.

**Independent Test**: Load violin+piano score, select piano treble staff from dropdown, start practice. Confirm violin plays at full accompaniment volume while only right-hand piano notes are expected.

- [X] T018 [US4] Write integration test in `frontend/tests/integration/accompaniment.test.ts`: mock scorePlayer with both `setPlaybackStaffFilter(0)` and `setPartVolume(violinPartIndex, 0.7)` active simultaneously — confirm `setPartVolume` was called for the violin channel (partIndex ≠ 0) and that the staff filter and accompaniment volume states are fully independent

**Checkpoint**: US4 verified. Staff filter coexistence is architecturally guaranteed and documented by test.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, styling, regression sweep, and final TypeScript type-check.

- [X] T019 [P] Add tablet-optimized CSS for `AccompanimentVolumeSlider` in `frontend/plugins/practice-view-plugin/practiceToolbar.css` — slider width matching tempo multiplier slider, 44px minimum touch target height, label typography matching existing toolbar labels
- [X] T020 [P] Add `aria-label="Accompaniment volume"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={Math.round(volume * 100)}` to slider `<input>` in `frontend/plugins/practice-view-plugin/AccompanimentVolumeSlider.tsx`
- [X] T021 Write regression test in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`: piano-only score → AccompanimentVolumeSlider absent from rendered toolbar (SC-004 / FR-008)
- [X] T022 Run `cd frontend && npx tsc --noEmit` and resolve any TypeScript type errors introduced by v11 Plugin API extension
- [X] T023 Run `cd frontend && npm run test` (full Vitest suite) and confirm all tests pass with no regressions

---

## Dependencies

### User Story Completion Order

```
Phase 2 (Plugin API v11)
  ├── Phase 3 (US1 — automatic playback at 70%) — MVP
  │     ├── Phase 4 (US2 — volume slider UI)
  │     │     └── Final Phase (polish)
  │     ├── Phase 5 (US3 — tempo sync test)  ← can run in parallel with Phase 4
  │     └── Phase 6 (US4 — staff filter test)  ← can run in parallel with Phase 4
  └── (no other dependencies)
```

### Task-Level Dependencies

| Task | Depends On |
|------|------------|
| T002 | T001 |
| T003 | T002 |
| T004 | T002 (must fail before T005/T006) |
| T005 | T002, T003 |
| T006 | T002, T003 |
| T007 | T005, T006 |
| T008 | T007 (must fail before T009) |
| T009 | T007, T008 |
| T010 | T009 |
| T011 | T009 |
| T012 | T010, T011 (must fail before T013) |
| T013 | T012 |
| T014 | T013 |
| T015 | T009 |
| T016 | T009 |
| T017 | T009 |
| T018 | T009 |
| T019 | T013, T014 |
| T020 | T013 |
| T021 | T010, T013 |
| T022 | T007, T013 |
| T023 | all prior tasks |

---

## Parallel Execution Examples

### Phase 2 — after T004 is written
```
T005 (getInstruments impl)  ←── parallel ──→  T006 (setPartVolume impl)
     ↓
T007 (stubs/proxy)
```

### Phase 3 — after T008 tests written
```
T009 (useAccompaniment hook)
     ↓
T010 (PracticeViewPlugin wiring)
     ↓
T011 (regression test) ←── parallel ──→ [start writing T012 AccompanimentVolumeSlider tests]
```

### After Phase 3 checkpoint
```
Phase 4 (US2 — slider)  ←── parallel ──→  Phase 5 (US3 test)  ←── parallel ──→  Phase 6 (US4 test)
```

### Final Phase — after T014
```
T019 (CSS)  ←── parallel ──→  T020 (aria attrs)  ←── parallel ──→  T021 (regression test)
                                    ↓
                               T022 (tsc)
                                    ↓
                               T023 (full test run)
```

---

## Implementation Strategy

### MVP Scope: Phase 2 + Phase 3 (US1 only)

The minimal working product that delivers value:

1. Complete Phase 2 (Plugin API v11) — T001–T007
2. Complete Phase 3 (US1 — automatic playback) — T008–T011

**After MVP**: Violin plays at 70% automatically in violin+piano scores. No UI yet — volume is fixed at default. This is independently releasable and already satisfies FR-001, FR-002, FR-006, FR-010.

### Incremental Delivery Order

| Release | Tasks | User Value |
|---------|-------|------------|
| MVP | T001–T011 | Violin plays automatically in Practice plugin |
| US2 | T012–T016 | Volume slider: student can balance accompaniment |
| US3+US4 | T017–T018 | Tests documenting tempo and staff-filter guarantees |
| Polish | T019–T023 | Accessibility, CSS, full regression sweep |
