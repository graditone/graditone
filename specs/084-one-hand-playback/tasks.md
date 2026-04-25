# Tasks: One-Hand Playback in Practice Mode

**Branch**: `084-one-hand-playback` | **Date**: 2026-04-25
**Input**: Design documents from `/specs/084-one-hand-playback/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (operates on different files, no incomplete-task dependencies)
- **[Story]**: Which user story: US1 (right-hand Train), US2 (left-hand + PracticeView), US3 (persistence), US4 (both-hands regression)
- Constitution V (Test-First) is **NON-NEGOTIABLE** — every test task must be written and verified failing **before** its paired implementation task

---

## Phase 1: Setup

**Purpose**: Establish baseline — all existing tests must stay green throughout this feature

- [X] T001 Run full vitest suite in `frontend/` and record passing count as baseline (`cd frontend && npx vitest run`)

---

## Phase 2: Foundational — Plugin API Extension

**Purpose**: Extend the host plugin API with `setPlaybackStaffFilter` and the `HandMode` type. All user story plugin work is **blocked** until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Write contract tests for `setPlaybackStaffFilter` (filter=0, filter=1, filter=null, out-of-range index, persists across `loadScore`) — add describe block to `frontend/src/plugin-api/scorePlayerContext.test.ts`; verify tests **FAIL** before proceeding
- [X] T003 [P] Add `HandMode = 'both' | 'right' | 'left'` type and `setPlaybackStaffFilter(staffIndex: number | null): void` signature to `PluginScorePlayerContext` in `frontend/src/plugin-api/types.ts`
- [X] T004 [P] Re-export `HandMode` type from `frontend/src/plugin-api/index.ts`
- [X] T005 Add `playbackStaffFilter` state (`number | null`, default `null`) and `filteredNotes` useMemo (returns `expandedNotesByStaff[filter]` when set, `notes` when null, `notes` when filter is out-of-range) to `useScorePlayerBridge` in `frontend/src/plugin-api/scorePlayerContext.ts`
- [X] T006 Pass `filteredNotes` (not `notes`) to both `usePlayback` and `useNoteHighlight` in `useScorePlayerBridge` in `frontend/src/plugin-api/scorePlayerContext.ts` — `internal.notes` keeps full `notes` array for visual score display
- [X] T007 Implement `setPlaybackStaffFilter` callback (sets state) and add no-op `setPlaybackStaffFilter: (_: number | null) => {}` to `createNoOpScorePlayer` in `frontend/src/plugin-api/scorePlayerContext.ts`

**Checkpoint**: `T002` contract tests now pass. Foundational phase complete — user story phases can begin.

---

## Phase 3: User Story 1 — Right-Hand-Only Playback in Train Plugin (Priority: P1) 🎯 MVP

**Goal**: When the student selects "Right hand" in the Train plugin's score-preset config, only treble-staff notes produce audio; bass-staff notes are completely silent.

**Independent Test**: Load Arabesque in Train plugin → Score preset → select "Right hand" → start exercise → confirm only treble-staff notes are heard; verify `context.scorePlayer.setPlaybackStaffFilter` was called with `0`.

### Tests for User Story 1 ⚠️ Write first — verify FAIL before implementing

- [X] T008 [P] [US1] Write Train plugin tests: hand-mode control renders when `staffCount >= 2` and preset is `'score'`; hidden when `staffCount < 2`; hidden when preset is `'scales'`; "Right hand" click calls `setPlaybackStaffFilter(0)` — add to `frontend/plugins/train-view/TrainPlugin.test.tsx`; verify tests **FAIL**

### Implementation for User Story 1

- [X] T009 [US1] Add `HandMode = 'both' | 'right' | 'left'` type to `frontend/plugins/train-view/trainTypes.ts` and add optional `handMode?: HandMode` field to `ExerciseConfig` (backward-compatible — defaults to `'both'` when absent)
- [X] T010 [US1] Add `handMode` state (`HandMode`, default `'both'`) to `TrainPlugin` in `frontend/plugins/train-view/TrainPlugin.tsx`; import `HandMode` from `../../src/plugin-api/index`
- [X] T011 [US1] Render three-button segmented control (Both / Right hand / Left hand) in Train plugin sidebar config section — visible only when `config.preset === 'score' && scorePlayerState.staffCount >= 2` — in `frontend/plugins/train-view/TrainPlugin.tsx`
- [X] T012 [US1] Wire "Right hand" button: on select, set `handMode('right')` and call `context.scorePlayer.setPlaybackStaffFilter(0)` in `frontend/plugins/train-view/TrainPlugin.tsx`
- [X] T013 [US1] Add CSS for `.train-hand-mode` segmented control (three-button toggle, active state highlight) to `frontend/plugins/train-view/TrainPlugin.css`

**Checkpoint**: Right-hand-only audio works in Train plugin score-preset mode. T008 tests pass. Deliver as MVP if needed.

---

## Phase 4: User Story 2 — Left-Hand-Only Playback in Train Plugin + Practice View Plugin (Priority: P1)

**Goal**: "Left hand" button in Train plugin silences treble staff; full one-hand filtering also works in the Practice View plugin (both directions, FR-006).

**Independent Test (Train)**: Load Arabesque → Score preset → select "Left hand" → start exercise → confirm only bass-staff notes are heard; `setPlaybackStaffFilter(1)` called.
**Independent Test (PracticeView)**: Load any two-stave score in Practice View → select Right / Left hand → start playback → confirm only selected staff is audible.

### Tests for User Story 2 ⚠️ Write first — verify FAIL before implementing

- [X] T014 [P] [US2] Write Train plugin left-hand test: "Left hand" click calls `setPlaybackStaffFilter(1)`; both-hand-mode and left-hand-mode active-state classes apply correctly — add to `frontend/plugins/train-view/TrainPlugin.test.tsx`; verify **FAIL**
- [X] T015 [P] [US2] Write Practice toolbar tests: hand-mode control renders when `staffCount >= 2`; hidden when `staffCount < 2`; each button triggers correct `onHandModeChange` callback — add to `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`; verify **FAIL**
- [X] T016 [P] [US2] Write PracticeViewPlugin integration test: selecting "Right hand" calls `setPlaybackStaffFilter(0)`; selecting "Left hand" calls `setPlaybackStaffFilter(1)` — add to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`; verify **FAIL**

### Implementation for User Story 2

- [X] T017 [US2] Wire "Left hand" button: on select, set `handMode('left')` and call `context.scorePlayer.setPlaybackStaffFilter(1)` in `frontend/plugins/train-view/TrainPlugin.tsx`
- [X] T018 [US2] Add `handMode: HandMode`, `onHandModeChange: (mode: HandMode) => void`, and `staffCount` props to `PracticeToolbarProps` in `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`
- [X] T019 [US2] Render three-button hand-mode segmented control (Both / Right / Left) in Practice View toolbar — visible only when `staffCount >= 2` — in `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`
- [X] T020 [US2] Add `handMode` state (`HandMode`, default `'both'`) to `PracticeViewPlugin` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`; wire each button to `context.scorePlayer.setPlaybackStaffFilter(staffIndexForMode)` on change
- [X] T021 [US2] Pass `handMode`, `onHandModeChange`, and `staffCount` from `PracticeViewPlugin` into `PracticeToolbar` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: Left-hand filtering works in Train plugin; both-direction filtering works in Practice View plugin. T014–T016 tests pass.

---

## Phase 5: User Story 3 — Hand Mode Persists Across Exercise Rounds (Priority: P2)

**Goal**: Selected hand mode survives exercise completion → results → restart without requiring reselection.

**Independent Test**: In Train plugin, select "Right hand" → complete exercise → view results → restart without changing settings → confirm "Right hand" is still active and `setPlaybackStaffFilter(0)` is called again.

### Tests for User Story 3 ⚠️ Write first — verify FAIL before implementing

- [X] T022 [P] [US3] Write persistence tests: on mount with `scopedGetItem('train-hand-mode') === 'right'`, plugin restores `handMode = 'right'` and calls `setPlaybackStaffFilter(0)`; on change, `scopedSetItem('train-hand-mode', ...)` is called — add to `frontend/plugins/train-view/TrainPlugin.test.tsx`; verify **FAIL**
- [X] T023 [P] [US3] Write PracticeView persistence test: hand mode restored from `scopedGetItem('practice-hand-mode')` on mount — add to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`; verify **FAIL**

### Implementation for User Story 3

- [X] T024 [US3] On `TrainPlugin` mount, read `scopedGetItem('train-hand-mode')` and restore `handMode` state; on change, write `scopedSetItem('train-hand-mode', mode)` — in `frontend/plugins/train-view/TrainPlugin.tsx`; call `setPlaybackStaffFilter` immediately when score is ready and restored mode is non-`'both'`
- [X] T025 [US3] On `PracticeViewPlugin` mount, read `scopedGetItem('practice-hand-mode')` and restore `handMode`; on change, write `scopedSetItem('practice-hand-mode', mode)` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: Hand mode survives exercise rounds and navigating away/returning within session. T022–T023 tests pass.

---

## Phase 6: User Story 4 — Both-Hands Mode Is Unaffected (Priority: P1)

**Goal**: Default both-hands playback is entirely unchanged — no notes are filtered unless the user explicitly selected a single-hand mode.

**Independent Test**: Load any score with default settings → confirm all notes from all staves are audible → switch from one-hand mode back to both-hands → confirm full playback restored immediately on next exercise.

### Tests for User Story 4 ⚠️ Write first — verify FAIL before implementing

- [X] T026 [P] [US4] Write regression test: when `playbackStaffFilter = null`, all notes from all staves are scheduled; `filteredNotes === notes` (full array) — add to `frontend/src/plugin-api/scorePlayerContext.test.ts`; verify **FAIL**
- [X] T027 [P] [US4] Write Train plugin regression test: "Both hands" button calls `setPlaybackStaffFilter(null)`; default initial state has no filter active — add to `frontend/plugins/train-view/TrainPlugin.test.tsx`; verify **FAIL**

### Implementation for User Story 4

- [X] T028 [US4] Wire "Both hands" button: on select, call `context.scorePlayer.setPlaybackStaffFilter(null)` in `frontend/plugins/train-view/TrainPlugin.tsx` and `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T029 [US4] On `TrainPlugin` unmount, call `context.scorePlayer.setPlaybackStaffFilter(null)` to clear filter and prevent leaking into subsequent plugins — in `frontend/plugins/train-view/TrainPlugin.tsx`
- [X] T030 [US4] On `PracticeViewPlugin` unmount, call `context.scorePlayer.setPlaybackStaffFilter(null)` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T031 [US4] When Train plugin switches from score preset to scales preset, call `context.scorePlayer.setPlaybackStaffFilter(null)` — in `frontend/plugins/train-view/TrainPlugin.tsx`

**Checkpoint**: Both-hands default is confirmed unchanged. All T026–T027 tests pass. All four user stories are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and acceptance check

- [ ] T032 [P] Run full vitest suite (`cd frontend && npx vitest run`) and confirm total passing count equals or exceeds baseline from T001
- [ ] T033 Manual acceptance check per `quickstart.md`: load Arabesque → Right hand → verify only treble notes audible; Left hand → only bass notes; Both → full playback; single-stave score → control hidden; persist across page refresh

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Foundational (Phase 2)
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) + US1 UI base in Train plugin (T011–T012)
- **US3 (Phase 5)**: Depends on US1 (Phase 3) + US2 (Phase 4) — both plugin state machines must exist before persistence is layered in
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) — regression tests and cleanup can proceed as soon as the host filter exists
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational — T002–T007)
             ├── Phase 3 (US1 — right-hand Train)
             │       └── Phase 4 (US2 — left-hand + PracticeView)  [needs US1 UI]
             │               └── Phase 5 (US3 — persistence)        [needs both plugin states]
             └── Phase 6 (US4 — both-hands regression)              [independent of US2–US3]
```

### Within Each User Story

- Test tasks must be written and **verified failing** before paired implementation tasks
- `HandMode` type (T009) before state (T010) before UI render (T011) before wiring (T012)
- Foundational phase tasks T003/T004 are parallel (different files); T005/T006/T007 are sequential (same file, depend on T003)

### Parallel Opportunities Per Story

**Phase 2 parallel set**: T002, T003, T004 (independent files)

**Phase 3 parallel**: T008 (test) runs concurrently with T009 (type addition in different file)

**Phase 4 parallel**: T014, T015, T016 (tests in 3 different files, all independent)

**Phase 5 parallel**: T022 and T023 (tests in different plugin folders)

**Phase 6 parallel**: T026 and T027 (tests in different files)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Run in parallel — 3 independent files
agent1: T002 → scorePlayerContext.test.ts (contract tests — fails)
agent2: T003 → types.ts (HandMode type + method signature)
agent3: T004 → index.ts (re-export HandMode)

# Sequential after T003 is done — same file
agent1: T005 → scorePlayerContext.ts (state + filteredNotes memo)
agent1: T006 → scorePlayerContext.ts (usePlayback/useNoteHighlight use filteredNotes)
agent1: T007 → scorePlayerContext.ts (callback impl + no-op stub)
# Verify: T002 tests now pass
```

## Parallel Example: Phase 4 (US2 — 3 different plugin files)

```bash
# Run in parallel
agent1: T014 → TrainPlugin.test.tsx (left-hand test — fails)
agent2: T015 → practiceToolbar.test.tsx (toolbar test — fails)
agent3: T016 → PracticeViewPlugin.test.tsx (integration test — fails)

# Sequential after tests written
agent1: T017 → TrainPlugin.tsx (left-hand wiring)
agent2: T018+T019 → practiceToolbar.tsx (props + control render)
agent3: T020+T021 → PracticeViewPlugin.tsx (state + prop pass-through)
# Verify: T014–T016 tests now pass
```

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1 — right-hand filtering in Train plugin)  
After Phase 3, right-hand-only playback is independently demonstrable and deployable.

**Recommended delivery order**: US1 → US4 (regression) → US2 (left-hand + PracticeView) → US3 (persistence)  
This ensures both-hands regression tests are validated before expanding to the second plugin.

---

## Summary

| Phase | User Story | Task Count | Priority |
|-------|-----------|-----------|---------|
| Phase 1 | Setup | 1 | — |
| Phase 2 | Foundational (Plugin API) | 6 | Blocking |
| Phase 3 | US1 — Right-hand Train | 6 | P1 🎯 MVP |
| Phase 4 | US2 — Left-hand + PracticeView | 8 | P1 |
| Phase 5 | US3 — Persistence | 4 | P2 |
| Phase 6 | US4 — Both-hands regression | 6 | P1 |
| Phase 7 | Polish | 2 | — |
| **Total** | | **33** | |

**Parallel opportunities identified**: 5 sets of parallel tasks (T002/T003/T004, T008/T009, T014/T015/T016, T022/T023, T026/T027)

**Independent test criteria per story**:
- **US1**: Right-hand button calls `setPlaybackStaffFilter(0)` → only treble notes in `filteredNotes`
- **US2**: Left-hand button calls `setPlaybackStaffFilter(1)` → only bass notes; Practice View plugin wires both directions
- **US3**: Persisted `'right'` in localStorage → `setPlaybackStaffFilter(0)` called on mount when score ready
- **US4**: `playbackStaffFilter = null` → `filteredNotes === notes` (full unfiltered array)

**Format validation**: All 33 tasks have ✅ checkbox `- [ ]`, ✅ sequential T-ID, ✅ `[P]` only on independent tasks, ✅ `[USn]` label only on user-story phases, ✅ file paths in every implementation task description.
