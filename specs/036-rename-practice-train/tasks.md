# Tasks: Rename Practice Plugin to Train & Add Plugin Order Field

**Input**: Design documents from `specs/036-rename-practice-train/`
**Branch**: `036-rename-practice-train`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies on in-progress tasks)
- **[US#]**: Which user story this task belongs to
- Exact file paths included in every description

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm the starting state is green before beginning the rename.

- [X] T001 Verify baseline — run `cd frontend && npx vitest run` and confirm all tests pass before any changes

**Checkpoint**: Test suite green — rename can begin safely

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Extend `PluginManifest` with the `order` field. This is the type-level prerequisite that **must** be complete before US2 (sort utility) and US3 (documentation) can be implemented correctly.

**⚠️ CRITICAL**: US2 and US3 work cannot begin until this phase is complete.

- [X] T002 Add `readonly order?: number` with full JSDoc to `PluginManifest` interface in `frontend/src/plugin-api/types.ts` (after `readonly icon?: string`) per quickstart Phase A

**Checkpoint**: `PluginManifest` has `order` field — US2 sort utility and US3 docs can now proceed

---

## Phase 3: User Story 1 — User Sees "Train" in Navigation and Plugin UI (Priority: P1) 🎯 MVP

**Goal**: Every user-visible label that called this plugin "Practice" now reads "Train". No code or file renames yet — just the manifest `name` field and any visible UI strings inside the plugin.

**Independent Test**: Open the app → navigation entry reads "Train" → open plugin → header reads "Train" → scan entire plugin UI for any remaining "Practice" label.

### Implementation for User Story 1

- [X] T003 [US1] Update `name: "Practice"` → `name: "Train"` in `frontend/plugins/practice-view/plugin.json` (FR-001)
- [X] T004 [US1] Replace all user-visible "Practice" strings in JSX/aria-labels inside `frontend/plugins/practice-view/PracticePlugin.tsx` with "Train" (headings, titles, tooltips, screen-reader labels) (FR-002)

**Checkpoint**: US1 done — navigation reads "Train", plugin header reads "Train", no "Practice" labels visible in app UI. Independently verifiable before US2/US3/US4.

---

## Phase 4: User Story 2 — Navigation Entries Appear in Defined Order (Priority: P2)

**Goal**: Built-in plugins render Play Score then Train in the navigation, determined by `manifest.order`. Unordered plugins trail all ordered ones, with stable alphabetical tiebreak by `id`.

**Independent Test**: Open the app with default plugins → confirm "Play Score" renders before "Train" in the nav bar. Add `"order": 99` to `virtual-keyboard/plugin.json`, reload → virtual keyboard moves to end.

**Depends on**: Phase 2 (T002 — `PluginManifest.order` type must exist)

### Tests for User Story 2 ⚠️ Write FIRST — must FAIL before T006

- [X] T005 [US2] Write `frontend/src/services/plugins/sortPlugins.test.ts` — cover all 7 cases from quickstart B1: ascending order, unordered trailing, tiebreak by id, NaN/non-finite warns + treated as absent, negative values valid, no input mutation, empty array returns empty (FR-009, FR-012, FR-013)

### Implementation for User Story 2

- [X] T006 [US2] Implement `frontend/src/services/plugins/sortPlugins.ts` — export `sortPluginsByOrder(entries: BuiltinPluginEntry[]): BuiltinPluginEntry[]` using spread+sort, `effectiveOrder()` guard with `console.warn` for non-finite values (FR-009, FR-013) — tests from T005 must pass
- [X] T007 [US2] In `frontend/src/App.tsx` `loadPlugins()`: import `sortPluginsByOrder` from `./services/plugins/sortPlugins` and replace `setAllPlugins(entries)` → `setAllPlugins(sortPluginsByOrder(entries))` (FR-009)
- [X] T008 [P] [US2] Add `"order": 1` to `frontend/plugins/play-score/plugin.json` (FR-010)
- [X] T009 [P] [US2] Add `"order": 2` to `frontend/plugins/practice-view/plugin.json` (already has `name: "Train"` from T003) (FR-011)

**Checkpoint**: US2 done — Play Score renders before Train on every page load; reload is stable; unordered plugins trail. Independently testable without US3/US4.

---

## Phase 5: User Story 3 — Developer Assigns Order to Any Plugin (Priority: P3)

**Goal**: The Plugin API documentation includes the `order` field in the manifest schema section so any contributor can read how to assign navigate position without reading source code.

**Independent Test**: Read `PLUGINS.md` → find manifest schema section → `order` field is present with type, default behaviour, and usage example showing Play › Train › Practice › Performance order values 1–4.

**Depends on**: Phase 2 (T002 — type must exist before documenting it)

### Implementation for User Story 3

- [X] T010 [US3] Update `PLUGINS.md`: (1) add `readonly order?: number` entry with description to `PluginManifest` schema table; (2) update Table of Contents entry from "Practice View plugin" → "Train plugin"; (3) retitle `## Reference: Practice View plugin` → `## Reference: Train plugin` and update path `frontend/plugins/practice-view/` → `frontend/plugins/train-view/` (FR-014)

**Checkpoint**: US3 done — `PLUGINS.md` documents `order` field with type, default, and usage example. Developer can set `order` on any plugin with no source code knowledge.

---

## Phase 6: User Story 4 — All Code and Documentation Reflects the New Name (Priority: P4)

**Goal**: Zero current identifiers, file names, CSS selectors, or storage keys reference "practice" in the plugin's own files. The directory is `train-view/`, all file names use `Train`, all TypeScript exports use `Train`, storage keys use `train-`, and `builtinPlugins.ts` imports from `train-view/`.

**Independent Test**: After all tasks below, run `grep -ri "practice" frontend/plugins/train-view/` — only migration-history comments are permitted; zero current identifiers.

**Depends on**: T003 (plugin.json already has `name: "Train"`), T009 (plugin.json already has `order: 2`)

### File renames (must complete before content edits)

- [X] T011 [US4] Rename plugin directory: `git mv frontend/plugins/practice-view frontend/plugins/train-view` (FR-003)
- [X] T012 [US4] Rename 7 files inside `frontend/plugins/train-view/` with git mv: `PracticePlugin.tsx→TrainPlugin.tsx`, `PracticePlugin.css→TrainPlugin.css`, `PracticePlugin.test.tsx→TrainPlugin.test.tsx`, `PracticeVirtualKeyboard.tsx→TrainVirtualKeyboard.tsx`, `PracticeVirtualKeyboard.css→TrainVirtualKeyboard.css`, `PracticeVirtualKeyboard.test.tsx→TrainVirtualKeyboard.test.tsx`, `practiceTypes.ts→trainTypes.ts` (FR-003)
- [X] T013 [US4] Update `frontend/plugins/train-view/plugin.json`: set `id: "train-view"` (name and order already set in T003/T009) (FR-006b)

### Storage migration — test-first ⚠️ Write T014 FIRST — must FAIL before T015

- [X] T014 [US4] Write `frontend/plugins/train-view/migrateStorageKeys.test.ts` — cover all 5 cases from quickstart E1: localStorage migrate when new absent, no-op when new already present, graceful when both absent, sessionStorage migrate, idempotent second call (FR-007)
- [X] T015 [US4] Implement `frontend/plugins/train-view/migrateStorageKeys.ts` — export `migrateStorageKeys()` with KEY_MAP covering both `practice-complexity-level-v1→train-complexity-level-v1` (localStorage) and `practice-tips-v1-dismissed→train-tips-v1-dismissed` (sessionStorage); idempotent; tests from T014 must pass (FR-007)

### Content updates inside renamed files (parallelisable after T011+T012)

- [X] T016 [US4] Update `frontend/plugins/train-view/trainTypes.ts`: rename exported types (`PracticeMode→TrainMode`, `PracticePhase→TrainPhase`, `PracticeExercise→TrainExercise`); update `COMPLEXITY_LEVEL_STORAGE_KEY = 'practice-complexity-level-v1'` → `'train-complexity-level-v1'`; add `TRAIN_TIPS_KEY = 'train-tips-v1-dismissed'` constant (FR-004)
- [X] T017 [US4] Update `frontend/plugins/train-view/TrainPlugin.tsx`: rename component export `PracticePlugin→TrainPlugin`; update imports (`trainTypes`, `TrainVirtualKeyboard`); replace all CSS class refs `.practice-plugin`→`.train-plugin` and `.practice-`→`.train-`; replace inline sessionStorage key `'practice-tips-v1-dismissed'`→`'train-tips-v1-dismissed'` at lines 134 and 971 (FR-004, FR-005)
- [X] T018 [P] [US4] Update `frontend/plugins/train-view/TrainPlugin.css`: global replace `.practice-plugin`→`.train-plugin` and `.practice-`→`.train-` throughout all selectors (FR-005)
- [X] T019 [P] [US4] Update `frontend/plugins/train-view/TrainVirtualKeyboard.tsx`: rename component export `PracticeVirtualKeyboard→TrainVirtualKeyboard`; replace all `.practice-` CSS class refs with `.train-` (FR-004, FR-005)
- [X] T020 [P] [US4] Update `frontend/plugins/train-view/TrainVirtualKeyboard.css`: global replace `.practice-`→`.train-` throughout all selectors (FR-005)
- [X] T021 [P] [US4] Update `frontend/plugins/train-view/exerciseGenerator.ts`: update import `from './practiceTypes'` → `from './trainTypes'`; update type references (`PracticeExercise→TrainExercise`, etc.) (FR-004)
- [X] T022 [P] [US4] Update `frontend/plugins/train-view/exerciseScorer.ts`: update import `from './practiceTypes'` → `from './trainTypes'`; update type references (FR-004)
- [X] T023 [P] [US4] Update `frontend/plugins/train-view/matchRawNotesToSlots.ts`: update import `from './practiceTypes'` → `from './trainTypes'`; update type references (FR-004)
- [X] T024 [US4] Update `frontend/plugins/train-view/index.tsx`: update import `PracticePlugin→TrainPlugin` from `./TrainPlugin`; rename plugin variable `practiceViewPlugin→trainViewPlugin`; call `migrateStorageKeys()` in `init()` (import from `./migrateStorageKeys`) (FR-006, FR-007 — E3)
- [X] T025 [P] [US4] Update `frontend/plugins/train-view/TrainPlugin.test.tsx`: update all imports (`TrainPlugin`, `trainTypes`); update describe-block titles referencing "Practice" → "Train"; update localStorage key assertions `'practice-complexity-level-v1'`→`'train-complexity-level-v1'` (FR-004)
- [X] T026 [P] [US4] Update `frontend/plugins/train-view/TrainVirtualKeyboard.test.tsx`: update all imports and component references from Practice to Train variants (FR-004)
- [X] T027 [P] [US4] Update `frontend/plugins/train-view/exerciseGenerator.test.ts`: update storage key assertion at line ~134 to `'train-complexity-level-v1'` (FR-004)

### Host registration update

- [X] T028 [US4] Update `frontend/src/services/plugins/builtinPlugins.ts`: replace `import practiceViewPlugin from '../../../plugins/practice-view/index'` and `import practiceViewManifestJson from '../../../plugins/practice-view/plugin.json'` with `train-view` equivalents; rename variable `practiceViewPlugin→trainViewPlugin`; update BUILTIN_PLUGINS manifest spread (FR-006)

**Checkpoint**: US4 done — `grep -ri "practice" frontend/plugins/train-view/` returns zero current identifiers; app builds with `npx tsc --noEmit`; full test suite passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation completeness (FR-015) and final validation across all user stories.

- [X] T029 [P] Add rename notice header to `specs/031-practice-view-plugin/spec.md` (FR-015)
- [X] T030 [P] Add rename notice header to `specs/031-practice-view-plugin/plan.md` (FR-015)
- [X] T031 [P] Add rename notice header to `specs/031-practice-view-plugin/tasks.md` (FR-015)
- [X] T032 [P] Add rename notice header to `specs/031-practice-view-plugin/quickstart.md` (FR-015)
- [X] T033 [P] Update `FEATURES.md`: change `**Practice View** built-in plugin (v2)` → `**Train** built-in plugin (v2)` in plugin architecture bullet
- [X] T034 Run `cd frontend && npx tsc --noEmit` — confirm zero TypeScript compilation errors (SC-004)
- [X] T035 Run `cd frontend && npx vitest run` — confirm all tests pass (SC-004)
- [X] T036 Manual smoke test: open app → confirm "Train" in navigation → open Train plugin → confirm header reads "Train" → confirm no "Practice" labels visible → confirm Play Score renders before Train (SC-001, SC-002)

---

## Phase 8: Post-Spec Improvements

**Purpose**: Three improvements identified during implementation and added to the same branch.

- [X] T037 [FR-016] Scale exercise staff to fill available width in `frontend/src/plugin-api/PluginStaffViewer.tsx`: add `wasmContainerRef` + `wasmContainerWidth` (ResizeObserver), compute `max_system_width = max(400, wasmContainerWidth × 2 − LABEL_MARGIN)` and pass to `computeLayout`; merge loading/loaded render paths into single `<div ref={wasmContainerRef}>` with `overflow-x: hidden`; remove `min-height: 80px` floor from `.train-staff-wrapper` in `TrainPlugin.css`
- [X] T038 [FR-017/FR-018] Release mic on Train view unmount: (1) add public `stop()` method to `PluginMicBroadcaster` that clears all handlers and calls `stopMic()`; (2) add `stop(): void` to `PluginRecordingContext` interface in `frontend/src/plugin-api/types.ts`; (3) wire `stop: () => pluginMicBroadcaster.stop()` in context object in `frontend/src/App.tsx`; (4) call `context.recording.stop()` in unmount cleanup effect in `frontend/plugins/train-view/TrainPlugin.tsx`; (5) update all recording mocks in test files to include `stop: vi.fn()`; (6) add two new tests in `PluginMicBroadcaster.test.ts` — stop force-closes mic, stop safe when inactive
- [X] T039 [FR-019] Rename `play-score` display name: set `"name": "Play"` in `frontend/plugins/play-score/plugin.json`; no test assertions reference the old "Play Score" string in DOM queries

**Checkpoint**: All phases complete — feature ready for review

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup / T001)
  └── Phase 2 (Foundational / T002) ─── BLOCKS US2 + US3
        ├── Phase 3 (US1 / T003–T004)         — no dependency on T002
        ├── Phase 4 (US2 / T005–T009)         — depends on T002 ✋
        ├── Phase 5 (US3 / T010)              — depends on T002 ✋
        └── Phase 6 (US4 / T011–T028)
              ├── T011 (git mv dir) → T012 (git mv files) → T013–T027
              ├── T014 (test) → T015 (impl) → T024 (index.tsx calls it)
              └── T016 (trainTypes) → T017 (TrainPlugin.tsx) → T025 (test)
```

### User Story Dependencies

- **US1 (P1)**: Independent — can start immediately after T001 (no foundational dependency)
- **US2 (P2)**: Depends on T002 (PluginManifest type) — can start in parallel with US1 after T002
- **US3 (P3)**: Depends on T002 (type must exist to document it) — can run in parallel with US2
- **US4 (P4)**: No dependency on US2/US3 — but T028 (builtinPlugins) must import from `train-view/` which requires T011/T012 first

### Within Phase 6 (US4) — Critical Sequence

```
T011 (git mv dir) → T012 (git mv files) → all content edits
                                          ├── T013 (plugin.json id)
                                          ├── T016 (trainTypes)
                                          │     └── T017 (TrainPlugin.tsx)
                                          │           └── T025 (TrainPlugin.test.tsx)
                                          ├── T014 [TEST FIRST] → T015 → T024 (index.tsx)
                                          ├── T018, T019, T020 [P] (CSS files)
                                          ├── T021, T022, T023 [P] (util .ts files)
                                          ├── T026, T027 [P] (test files)
                                          └── T028 (builtinPlugins.ts)
```

---

## Parallel Opportunities

### Phase 4 (US2) — After T005→T006→T007 complete:

```
T008 [P]  Add "order": 1 to frontend/plugins/play-score/plugin.json
T009 [P]  Add "order": 2 to frontend/plugins/practice-view/plugin.json
```

### Phase 6 (US4) — After T011+T012 complete:

```
T018 [P]  TrainPlugin.css          (CSS selector renames)
T019 [P]  TrainVirtualKeyboard.tsx (component rename + CSS refs)
T020 [P]  TrainVirtualKeyboard.css (CSS selector renames)
T021 [P]  exerciseGenerator.ts     (import update)
T022 [P]  exerciseScorer.ts        (import update)
T023 [P]  matchRawNotesToSlots.ts  (import update)
T025 [P]  TrainPlugin.test.tsx     (after T017 done)
T026 [P]  TrainVirtualKeyboard.test.tsx
T027 [P]  exerciseGenerator.test.ts
```

### Phase 7 (Polish) — All parallelisable:

```
T029 [P]  specs/031-practice-view-plugin/spec.md    (rename notice)
T030 [P]  specs/031-practice-view-plugin/plan.md    (rename notice)
T031 [P]  specs/031-practice-view-plugin/tasks.md   (rename notice)
T032 [P]  specs/031-practice-view-plugin/quickstart.md (rename notice)
T033 [P]  FEATURES.md                               (bullet update)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Baseline check (T001)
2. Complete Phase 2: PluginManifest type (T002) — fast, one file edit
3. Complete Phase 3: US1 — manifest `name` + visible UI strings (T003–T004)
4. **STOP and VALIDATE**: Open app, confirm "Train" label everywhere in UI
5. Deploy/demo if ready — user-visible rename is live

### Incremental Delivery

1. T001 → T002 → T003–T004 → **Demo US1** (navigation reads "Train")
2. T005–T009 → **Demo US2** (Play Score before Train in nav)
3. T010 → **Demo US3** (PLUGINS.md documents order field)
4. T011–T028 → **Demo US4** (zero `practice` identifiers in codebase)
5. T029–T036 → **Final polish and validation**

### Single-Developer Sequence (Recommended)

```
T001 → T002 → T003 → T004                     # US1 complete (~5 min)
→ T005 → T006 → T007 → T008+T009              # US2 complete (~20 min)
→ T010                                          # US3 complete (~10 min)
→ T011 → T012 → T013 → T014 → T015            # US4 storage migration (test-first)
→ T016 → T017 → T018+T019+T020                # US4 component + CSS renames
→ T021+T022+T023 → T024 → T025+T026+T027      # US4 utils + tests
→ T028                                          # US4 builtinPlugins
→ T029+T030+T031+T032+T033                     # Polish (parallel)
→ T034 → T035 → T036                           # Validation
```

---

## Summary

| Phase  | Story | Tasks       | Count |
|--------|-------|-------------|-------|
| 1      | —     | T001        | 1     |
| 2      | —     | T002        | 1     |
| 3      | US1   | T003–T004   | 2     |
| 4      | US2   | T005–T009   | 5     |
| 5      | US3   | T010        | 1     |
| 6      | US4   | T011–T028   | 18    |
| 7      | Polish| T029–T036   | 8     |
| **Total** |     |             | **36** |

**Test-first obligations** (Constitution Principle V):
- T005 must be written and **failing** before T006 implemented (`sortPluginsByOrder`)
- T014 must be written and **failing** before T015 implemented (`migrateStorageKeys`)

**Parallel opportunities**: 15 tasks marked `[P]` — primarily CSS files, utility files, and documentation updates in Phase 6 and Phase 7.
