# Tasks: Practice View Plugin (External)

**Feature**: `037-practice-view-plugin`  
**Input**: Design documents from `/specs/037-practice-view-plugin/`  
**Branch**: `037-practice-view-plugin`  
**Date**: 2026-03-03

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies on in-progress tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every description

## User Stories Summary

| Story | Priority | Title |
|-------|----------|-------|
| US4 | P1 | Plugin is structured as an external plugin |
| US1 | P1 | Load a score and see the Practice toolbar button |
| US2 | P1 | Start Practice mode: MIDI step-by-step note pressing |
| US3 | P2 | Practice resumes from a specific position via seek |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `plugins-external/practice-view-plugin/` package — mirroring `plugins-external/virtual-keyboard-pro/` in every structural detail.

- [X] T001 Create `plugins-external/practice-view-plugin/` directory layout and `dev/`, `scripts/`, `dist/` subdirectories per plan.md Project Structure
- [X] T002 [P] Create `plugins-external/practice-view-plugin/package.json` — copy structure from `plugins-external/virtual-keyboard-pro/package.json` and adapt name to `practice-view-plugin`, keeping React, Vite 5, Vitest 2, TypeScript 5.5 dependencies
- [X] T003 [P] Create `plugins-external/practice-view-plugin/plugin.json` manifest with `"id": "practice-view-plugin"`, `"pluginApiVersion": "6"`, `"type": "common"`, `"view": "window"` (mirrors virtual-keyboard-pro structure)
- [X] T004 [P] Create `plugins-external/practice-view-plugin/tsconfig.json` — mirroring `plugins-external/virtual-keyboard-pro/tsconfig.json` with path alias for plugin API import from `../../frontend/src/plugin-api/index`
- [X] T005 [P] Create `plugins-external/practice-view-plugin/vite.config.ts` — production bundle producing a single JS file in `dist/` (mirrors virtual-keyboard-pro vite config)
- [X] T006 [P] Create `plugins-external/practice-view-plugin/vite.config.dev.mts` — dev mode with HMR (mirrors `plugins-external/virtual-keyboard-pro/vite.config.dev.mts`)
- [X] T007 [P] Create `plugins-external/practice-view-plugin/build.sh` build script mirroring `plugins-external/virtual-keyboard-pro/build.sh`
- [X] T008 [P] Create `plugins-external/practice-view-plugin/vitest.setup.ts` test setup (mirrors virtual-keyboard-pro)
- [X] T009 [P] Create `plugins-external/practice-view-plugin/scripts/dev-import.mjs` dev import helper (mirrors virtual-keyboard-pro)
- [X] T010 Run `npm install` in `plugins-external/practice-view-plugin/` to install all declared dependencies (depends on T002)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the Plugin API to v6. This phase is the **critical blocker** — no plugin code can compile or run correctly until the host-side type changes and implementation are complete. Also migrates the existing Train view plugin for v6 compatibility.

**⚠️ CRITICAL**: All user story phases depend on this phase being complete.

- [X] T011 Add `PluginPracticeNoteEntry` interface to `frontend/src/plugin-api/types.ts` per `specs/037-practice-view-plugin/contracts/plugin-api-v6.ts` — fields: `midiPitches: ReadonlyArray<number>`, `noteIds: ReadonlyArray<string>`, `tick: number`
- [X] T012 Update `PluginScorePitches.notes` array item type in `frontend/src/plugin-api/types.ts` from `{ midiPitch: number }` to `PluginPracticeNoteEntry` (depends on T011)
- [X] T013 Update `extractPracticeNotes` method signature in `frontend/src/plugin-api/types.ts` from `(maxCount: number)` to `(staffIndex: number, maxCount?: number): PluginScorePitches | null` (depends on T012)
- [X] T014 [P] Add `staffCount: number` field to `ScorePlayerState` in `frontend/src/plugin-api/types.ts` — default `0` when status is `idle`/`loading`/`error`, populated when `status === 'ready'`
- [X] T015 Bump `PLUGIN_API_VERSION` constant from `'5'` to `'6'` in `frontend/src/plugin-api/types.ts` (depends on T013, T014)
- [X] T016 Implement new `extractPracticeNotes(staffIndex, maxCount?)` in `frontend/src/plugin-api/scorePlayerContext.ts`: extract all chord pitches into `midiPitches[]`, parallel `noteIds[]`, and `tick` per entry; exclude rests; group simultaneous notes at same tick into one `PluginPracticeNoteEntry` (depends on T013)
- [X] T017 Populate `staffCount` in `ScorePlayerState` subscription in `frontend/src/plugin-api/scorePlayerContext.ts` — read staff count from score data on load (depends on T014)
- [X] T018 Migrate `frontend/plugins/train-view/` from v5 `.midiPitch` references to v6 `.midiPitches[0]` throughout all files that access `extractPracticeNotes` results (depends on T012)
- [X] T019 [P] Verify `frontend/plugins/train-view/` unit tests pass after the v6 migration in T018 — run `vitest run` scoped to train-view (depends on T018)

**Checkpoint**: Plugin API v6 is live, Train view is migrated — user story phases can now begin.

---

## Phase 3: User Story 4 — External Plugin Structure (Priority: P1)

**Goal**: A developer can confirm the plugin lives at `plugins-external/practice-view-plugin/` as a standalone package, builds with its build script, and uses zero Play Score / internal host imports.

**Independent Test**: Navigate to `plugins-external/practice-view-plugin/` → find `package.json`, `plugin.json`, `build.sh` → run build → verify `dist/` bundle appears → confirm no imports from `frontend/plugins/play-score/` in source.

- [X] T020 [US4] Create `plugins-external/practice-view-plugin/index.tsx` — minimal `MusicorePlugin` entry point exporting `init(context)`, `dispose()`, and a placeholder `Component` (depends on Phase 1 and Phase 2)
- [X] T021 [US4] Build the plugin by running `npm run build` in `plugins-external/practice-view-plugin/` and verify that a bundle file exists in `dist/` (depends on T020)
- [X] T022 [P] [US4] Audit all files in `plugins-external/practice-view-plugin/` to confirm zero imports from `frontend/plugins/play-score/`, `frontend/src/components/`, `frontend/src/services/`, or `frontend/src/wasm/` — only Plugin API imports are allowed (depends on T020)

**Checkpoint**: US4 acceptance criteria verified — plugin is a self-contained external package.

---

## Phase 4: User Story 1 — Load Score and See Practice Toolbar Button (Priority: P1)

**Goal**: A user launches the plugin, selects a score, and sees a full-screen score view with the familiar playback toolbar extended by a **Practice** button.

**Independent Test**: Install plugin → open app → launch Practice View plugin → select a preloaded score → verify score renders full-screen and toolbar shows Play/Pause, Stop, Timer, Tempo, and a **Practice** button in its inactive state.

- [X] T023 [US1] Create `plugins-external/practice-view-plugin/practiceEngine.types.ts` with `PracticeNoteEntry` (alias for `PluginPracticeNoteEntry`), `PracticeState` (mode, notes, currentIndex, selectedStaffIndex), and `SelectedStaff` (index, label) type definitions
- [X] T024 [P] [US1] Create `plugins-external/practice-view-plugin/PracticeViewPlugin.css` with base layout styles (full-screen container, toolbar positioning)
- [X] T025 [US1] Implement `plugins-external/practice-view-plugin/practiceToolbar.tsx` — renders: Back button (`context.close()`), score title, Play/Pause, Stop, elapsed timer display, Tempo control, Staff selector (hidden when `staffCount <= 1`), Practice button (inactive visual state) — no practice logic wired yet (depends on T023)
- [X] T026 [US1] Implement `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` root component: subscribe to `context.scorePlayer` state; show `context.components.ScoreSelector` when `status === 'idle'`; show `context.components.ScoreRenderer` + `practiceToolbar` when `status === 'ready'`; call `context.stopPlayback()` on unmount (depends on T025)
- [X] T027 [P] [US1] Write `plugins-external/practice-view-plugin/practiceToolbar.test.tsx` unit tests: Practice button is visible when score is loaded; Practice button shows inactive state when `practiceActive={false}`; Staff selector is hidden when `staffCount === 1`; Staff selector is visible when `staffCount === 2`
- [X] T028 [P] [US1] Write `plugins-external/practice-view-plugin/PracticeViewPlugin.test.tsx` unit tests: `ScoreSelector` rendered when `status === 'idle'`; `ScoreRenderer` rendered when `status === 'ready'`; Back button calls `context.close()`; `context.stopPlayback()` called on unmount (SC-006)

**Checkpoint**: US1 independently testable — plugin loads, score renders, toolbar with Practice button is visible.

---

## Phase 5: User Story 2 — Practice Mode: MIDI Step-by-Step (Priority: P1)

**Goal**: Pressing Practice enters step-by-step mode. Each correct MIDI note press advances the target highlight to the next note. Incorrect presses are ignored. Mode ends silently when last note is pressed.

**Independent Test**: Load score → connect MIDI → press Practice → first note highlighted → play correct MIDI note → highlight advances → repeat for several notes → correct behavior confirmed.

**⚠️ Principle V GATE**: T029 (`practiceEngine.test.ts`) MUST be written with **all tests FAILING (RED)** before T030 (`practiceEngine.ts`) is created. No `practiceEngine.ts` code until the RED test file exists.

- [X] T029 [US2] Write `plugins-external/practice-view-plugin/practiceEngine.test.ts` RED tests (failing — no implementation yet) covering all state machine transitions: `START` → mode becomes `active`, `currentIndex = 0`; `CORRECT_MIDI` when not last note → `currentIndex++`; `CORRECT_MIDI` on last note → mode becomes `complete`; `WRONG_MIDI` → no state change; `STOP` → mode `inactive`, `currentIndex = 0`; `DEACTIVATE` → mode `inactive`, `currentIndex` preserved; chord notes — any pitch in `midiPitches[]` passes `isCorrect`; wrong pitch-class in wrong octave returns `false` from `isCorrect`; `SEEK(index)` repositions `currentIndex` in active mode
- [X] T030 [US2] Implement `plugins-external/practice-view-plugin/practiceEngine.ts` pure state machine with `isCorrect(midiNote, entry)` and `reduce(state, action)` to make all T029 RED tests pass (GREEN) — no side effects; no API calls; no coordinates (Principle VI) (depends on T029)
- [X] T031 [US2] Wire practice mode activation in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx`: Practice button press calls `context.scorePlayer.extractPracticeNotes(selectedStaffIndex)` → populates practice notes → dispatches `START`; pass `new Set(currentEntry.noteIds)` to `ScoreRenderer.highlightedNoteIds` when `practiceState.mode === 'active'`; pass `ScorePlayerState.highlightedNoteIds` otherwise (depends on T026, T030)
- [X] T032 [US2] Wire MIDI subscription in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx`: `context.midi.subscribe(handler)` on mount; handler ignores non-`attack` events and ignores events when practice mode is not `active`; dispatches `CORRECT_MIDI` when `midiNote ∈ currentEntry.midiPitches`, else `WRONG_MIDI`; unsubscribes on unmount (depends on T031)
- [X] T033 [US2] Implement Practice mode deactivation paths in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx`: Practice button re-press → dispatch `DEACTIVATE`; Stop button → dispatch `STOP` + `context.scorePlayer.stop()`; auto-detect `practiceState.mode === 'complete'` and clear highlight / return Practice button to inactive state (depends on T031)
- [X] T034 [US2] Implement staff selection flow in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` and `practiceToolbar.tsx`: when `staffCount > 1` and no staff selected when Practice pressed, show inline staff picker in toolbar; once staff chosen, proceed to `START`; when `staffCount === 1`, auto-select index 0 and skip picker (depends on T025, T031)
- [X] T035 [US2] Implement no-MIDI-device notice in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx`: when Practice mode activates and no MIDI device is connected, display an inline toolbar notice "Connect a MIDI device to practice" per FR-012; note advance still works if a device connects later (depends on T031)

**Checkpoint**: US2 independently testable — full MIDI step-by-step practice is functional.

---

## Phase 6: User Story 3 — Practice Resumes from Seek Position (Priority: P2)

**Goal**: When the user taps a note before or during Practice mode, the practice target begins at (or resets to) that tick position rather than always starting from note 0.

**Independent Test**: Load score → short-tap a note at measure 6 → press Practice → verify the highlighted target note is at that position (not note 1); also verify that tapping during active practice repositions without deactivating mode.

- [X] T036 [US3] Implement initial practice position from seek in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` `START` dispatch: find the first `PracticeNoteEntry` with `tick >= scorePlayerState.currentTick` and use that index as the starting `currentIndex` (FR-010, spec US3 AC-1) (depends on T031)
- [X] T037 [US3] Implement seek-while-active handler in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` `onNoteShortTap`: when `practiceState.mode === 'active'`, find the note entry with tick nearest to the tapped tick → dispatch `SEEK(index)` without exiting practice mode; when practice mode is not active, fall through to `context.scorePlayer.seekToTick(tick)` (FR-010, spec US3 AC-2) (depends on T031)
- [X] T038 [P] [US3] Write tests in `plugins-external/practice-view-plugin/PracticeViewPlugin.test.tsx` for seek behavior: (a) when Practice is activated after a tap-seek, first highlighted note has tick ≥ the sought tick; (b) tapping a note during active practice calls `SEEK` and keeps `mode === 'active'`; (c) tapping during inactive practice calls `seekToTick` not `SEEK` (depends on T036, T037)

**Checkpoint**: All user stories (US4, US1, US2, US3) are independently functional and testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, Principle compliance verification, and final build validation.

- [X] T039 [P] Principle VI compliance audit — search all files in `plugins-external/practice-view-plugin/` for any coordinate calculations (x, y, bounding box, pixel, offset arithmetic); confirm only integer `currentIndex`, MIDI pitch integers (0-127), opaque `noteId` strings, and integer `tick` values are used in practice logic; any violation is a PR blocker
- [X] T040 Run full `vitest run` test suite in `plugins-external/practice-view-plugin/` and confirm all unit tests pass (green) — `practiceEngine.test.ts`, `practiceToolbar.test.tsx`, `PracticeViewPlugin.test.tsx`
- [X] T041 Run production build via `plugins-external/practice-view-plugin/build.sh` and verify: (a) bundle appears in `dist/`; (b) bundle size is ≤ 50 KB (SC-005 performance goal from plan.md)
- [X] T042 [P] Verify teardown assertions from `PracticeViewPlugin.test.tsx`: `context.stopPlayback()` and MIDI unsubscribe are called on component unmount (SC-006 clean teardown)
- [X] T043 [P] Run through `specs/037-practice-view-plugin/quickstart.md` validation checklist — confirm Principle V gate (RED test written first confirmed in T029), Principle VI gate (no coordinates confirmed in T039), and PR checklist items
- [X] T044 [P] Update `plugins-external/README.md` to document the `practice-view-plugin` package — add entry with short description, API version, and build instructions

---

## Phase 8: Chord Detection — All-Notes-Required (Amendment 2026-03-03)

**Context**: The initial spec allowed any single note in a chord to advance the target (FR-015). The user clarified that **all** chord notes must be pressed simultaneously (within a ≤ 80 ms inaudible window). This phase adds a reusable `ChordDetector` class to the host platform and wires it into the practice plugin.

**Scope**:
- Platform utility `frontend/src/utils/chordDetector.ts` — canonical, framework-agnostic implementation.
- Plugin copy `plugins-external/practice-view-plugin/chordDetector.ts` — self-contained mirror (external plugins cannot import host internals).
- Both copies are kept in sync; any future change to chord detection logic must land in both files.

- [X] T045 [P] Create `frontend/src/utils/chordDetector.ts` — `ChordDetector` class with `reset(requiredPitches)`, `press(midiNote, timestamp): ChordResult`, and `ChordResult` interface (`complete`, `collected`, `missing`); configurable `windowMs` option (default 80); evicts presses older than `windowMs` on each call; accepts only pitches in the required set; reports `complete: true` only when all required pitches have been pressed within the window; single-note entries trivially complete on the first press.

- [X] T046 [P] Write `frontend/src/utils/chordDetector.test.ts` unit tests (Vitest):
  - single-note: `press(60, 0).complete === true` immediately.
  - chord (C-E-G, [60,64,67]): pressing all three within window → `complete: true`.
  - chord: pressing only two → `complete: false`, `missing` contains the third.
  - chord: pressing all three but first press expired (> windowMs ago) → `complete: false`.
  - chord: pressing a pitch not in the required set → ignored (no effect on `collected`/`missing`).
  - `reset()`: clears prior presses and sets new required pitches.
  - `reset([])`: empty set never reports `complete`.

- [X] T047 [P] ~~Create `plugins-external/practice-view-plugin/chordDetector.ts` mirror~~ **SUPERSEDED**: `ChordDetector` is now re-exported via the Plugin API barrel (`frontend/src/plugin-api/index.ts`). External plugins import it from `../../frontend/src/plugin-api/index` — no mirror copy needed.

- [X] T048 [P] ~~Write `plugins-external/practice-view-plugin/chordDetector.test.ts`~~ **SUPERSEDED**: mirror copy and its tests deleted; canonical tests in `frontend/src/utils/chordDetector.test.ts` provide full coverage.

- [X] T049 Update MIDI handler in `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx`:
  - `import { ChordDetector } from './chordDetector'`.
  - Create `const chordDetectorRef = useRef<ChordDetector>(new ChordDetector())`.
  - Add `useEffect` that calls `chordDetectorRef.current.reset(currentEntry.midiPitches)` each time `practiceState.currentIndex` or `practiceState.mode` changes (reset detector when target advances or mode exits active).
  - In the MIDI attack handler: replace the `isCorrect(event.midiNote, currentEntry)` call with `chordDetectorRef.current.press(event.midiNote, event.timestamp).complete`; dispatch `CORRECT_MIDI` (or loop-wrap `SEEK`) only when the result is `complete`.
  - Wrong-note detection: any attack that is not in `currentEntry.midiPitches` is still dispatched as `WRONG_MIDI` (no state change, but keeps the wrong-note path alive).
  - `isCorrect` from `practiceEngine` is no longer called from the MIDI handler (it remains for use by tests).
  - Depends on T047.

- [X] T050 [P] Update `plugins-external/practice-view-plugin/practiceEngine.test.ts` chord section:
  - Add test: pressing only one note of a chord does NOT dispatch `CORRECT_MIDI` — the engine state stays at the same `currentIndex`.
  - Add test: pressing all chord notes within window → `CORRECT_MIDI` → `currentIndex` advances.
  - (Both tests validate the integration contract between `ChordDetector` and the engine reducer, using the new wiring from T049.)

- [X] T051 Run `vitest run` in both `frontend/` and `plugins-external/practice-view-plugin/`, confirm all tests pass; run production build in `plugins-external/practice-view-plugin/` and verify bundle size ≤ 50 KB.

- [X] T052 [US2] Add "Both Clefs" staff option: add `value={-1}` option to `practiceToolbar.tsx` staff `<select>` (shown when `staffCount >= 2`); add `mergePracticeNotesByTick` helper to `PracticeViewPlugin.tsx` that merges entries from all staves by tick (union of pitches at the same tick); update `handlePracticeToggle` to extract from all staves and merge when `staffIndex === -1`; update toolbar tests (options count: `staffCount + 1`; new tests for Both Clefs presence and `-1` dispatch).

---

## Phase 9: Results Overlay & MIDI Gate (Amendment 2026-03-04)

**Context**: After completing the core practice loop (T029–T052), two post-MVP enhancements were requested: (1) disable the Practice button when no MIDI device is known to be connected, and (2) show a rich results overlay when the user finishes all notes — including per-note outcome tracking, timing analytics, and a collapsible detail table.

- [X] T053 [US2] Disable Practice button when MIDI disconnected: change `midiConnected` type in `PracticeViewPlugin.tsx` from `boolean` to `boolean | null` (null = pending check); disable the toolbar Practice button when `midiConnected === false`; wrap disabled button in a `<span title="…">` for native tooltip; update `practiceToolbar.tsx` and `practiceToolbar.test.tsx` to cover disabled state (FR-016).

- [X] T054 [US2] Add per-note result tracking to practice engine: extend `practiceEngine.types.ts` with `NoteOutcome` (`'correct' | 'correct-late' | 'wrong' | 'pending'`) and `PracticeNoteResult` interface (`noteIndex`, `outcome`, `playedMidi`, `expectedMidi`, `responseTimeMs`, `expectedTimeMs`, `wrongAttempts`); add `noteResults: ReadonlyArray<PracticeNoteResult>` and `currentWrongAttempts: number` to `PracticeState` and `INITIAL_PRACTICE_STATE`; extend `CORRECT_MIDI` action with `midiNote`, `responseTimeMs`, `expectedTimeMs` and `WRONG_MIDI` with `midiNote`; update `practiceEngine.ts` reducer: `LATE_THRESHOLD_MS = 500`, `CORRECT_MIDI` appends a `PracticeNoteResult` and resets `currentWrongAttempts`, `WRONG_MIDI` increments `currentWrongAttempts`, `START`/`STOP` reset both; export `LATE_THRESHOLD_MS` for test use.

- [X] T055 [US2] Implement results overlay in `PracticeViewPlugin.tsx` and `PracticeViewPlugin.css`: add `practiceStartTimeRef` (set to `Date.now()` on START) and `tempoMultiplierRef`; add `midiToLabel()` helper (MIDI number → pitch name e.g. "C4"); add `practiceReport` useMemo computing `totalNotes`, `correctCount`, `lateCount`, `totalWrongAttempts`, numeric `score` per FR-017 formula, grade label, `practiceTimeMs`, `scoreTimeMs`; render results overlay when `mode === 'complete'` with backdrop, score ring, grade, 4-stat row (Notes / Correct / Late / Wrong), time comparison, and `<details>` collapsible per-note table; add all CSS including colour-coded row backgrounds (green = correct, amber = correct-late, red = wrong); pass enriched action payloads from the MIDI handler (`midiNote`, `responseTimeMs`, `expectedTimeMs` on `CORRECT_MIDI`; `midiNote` on `WRONG_MIDI`) (FR-017).

- [X] T056 [P] [US2] Update `practiceEngine.test.ts` for amended action shapes: fix `activeState()` helper to include `noteResults: []` and `currentWrongAttempts: 0`; update all `CORRECT_MIDI` dispatches to include `midiNote`, `responseTimeMs`, `expectedTimeMs`; update all `WRONG_MIDI` dispatches to include `midiNote`; fix `WRONG_MIDI` suite (now tests that `currentWrongAttempts` increments, not that state is unchanged); add 11 new tests covering `noteResults` accumulation, late-note classification at/above `LATE_THRESHOLD_MS`, wrong-attempt recording, results preserved in `complete` mode, cleared on `START`/`STOP`, and graceful handling of zero `expectedTimeMs`.

## Phase 10: Deferred Start, Phantom Highlights, Delay Graph, Hotplug Fix & Scroll Fix (Amendment 2026-03-04)

**Context**: Post-results-overlay UX polish: (1) defer the practice timer until the user first plays a note; (2) show an amber "phantom" highlight that advances at the configured tempo while the user's target stays green — giving a visual tempo reference without scrolling away; (3) add a timing-delta SVG graph to the results overlay; (4) fix a MIDI hotplug regression caused by multiple `requestMIDIAccess()` calls overwriting the same singleton's `onstatechange`; (5) make auto-scroll follow the user's target note instead of the phantom.

- [X] T057 [US2] Deferred start — practice timer pauses on `'waiting'` mode until the first correct MIDI note: add `'waiting'` to `PracticeMode` union in `practiceEngine.types.ts`; update reducer so `START` enters `'waiting'` (timer not running) and first `CORRECT_MIDI` while in `'waiting'` advances to `'active'`; add 3 new tests in `practiceEngine.test.ts` covering `START → waiting`, `CORRECT_MIDI waiting → active`, and `STOP from waiting → inactive`; update `PracticeViewPlugin.tsx` to surface "Waiting for first note…" copy in the toolbar status display.

- [X] T058 [US2] Phantom tempo highlights — amber 50% opacity overlay that advances at BPM while practice is active: in `PracticeViewPlugin.tsx` add `phantomIndexRef` and a `setInterval` that advances a `phantomIndex` state variable at the current BPM tempo (`60000 / (bpm × noteValue)`); derive `highlightedNoteIds` (amber) from the phantom position while live practice target uses `pinnedNoteIds` (green); add CSS rule `.practice-plugin--phantom .layout-glyph.highlighted { opacity: 0.5; color: var(--color-amber) }` to `PracticeViewPlugin.css`; clear the interval on deactivation and mode change.

- [X] T059 [US2] Delay evolution graph — SVG chart in the results overlay showing timing delta per note: add `delayDeltaMs` field to `PracticeNoteResult`; compute `delayDeltaMs = responseTimeMs - expectedTimeMs`; render an SVG bar/dot chart inside the results overlay beneath the per-note table, with X-axis = note index, Y-axis = delay in ms, noting early (negative) vs. late (positive) bars with green/amber colour; add CSS for the chart container.

- [X] T060 Fix MIDI hotplug — `onstatechange` singleton overwrite: `navigator.requestMIDIAccess()` returns the same `MIDIAccess` singleton; multiple hook instances calling it and assigning `onstatechange` silently overwrote each other, causing dropped `statechange` events on plug/unplug; fix by switching `frontend/src/services/recording/useMidiInput.ts` and `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` from `midiAccess.onstatechange = handler` to `midiAccess.addEventListener('statechange', handler)` / `removeEventListener` in the cleanup; update `frontend/src/test/mockMidi.ts` to support `addEventListener`/`removeEventListener`; update `useMidiInput.test.ts` cleanup assertion.

- [X] T061 Auto-scroll follows user target note — add `scrollTargetNoteIds` prop pipeline: during practice, `highlightedNoteIds` holds the phantom tempo position (amber) so `ScoreViewer.scrollToHighlightedSystem()` scrolled to the wrong note; add optional `scrollTargetNoteIds?: ReadonlySet<string>` to `PluginScoreRendererProps` in `frontend/src/plugin-api/types.ts`; thread it through `ScoreRendererPlugin.tsx` → `LayoutView.tsx` → `ScoreViewer.tsx`; in `ScoreViewer.componentDidUpdate` prefer `scrollTargetNoteIds` over `highlightedNoteIds` for scroll triggering and system-index lookup; in `PracticeViewPlugin.tsx` pass `scrollTargetNoteIds={practiceActive ? targetNoteIds : undefined}` to `<ScoreRenderer />`.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └──► Phase 2 (Foundational — Plugin API v6 + Train view migration)
         └──► Phase 3 (US4 — External plugin structure)
         └──► Phase 4 (US1 — Toolbar)
                └──► Phase 5 (US2 — Practice engine + MIDI)
                       └──► Phase 6 (US3 — Seek)
                              └──► Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends On | Blocking |
|-------|------------|---------|
| US4 (P1) | Phase 1 + Phase 2 | Nothing downstream |
| US1 (P1) | Phase 2 (for `staffCount` type) | US2 |
| US2 (P1) | US1 (`PracticeViewPlugin.tsx` root) | US3 |
| US3 (P2) | US2 (practice activation wiring) | None |

### Within Each User Story

1. Types (`practiceEngine.types.ts`) before services/components
2. Tests (marked `[P]`) MUST be written and confirmed FAILING before implementation for Phase 5 (US2) — Principle V gate
3. Core state machine (`practiceEngine.ts`) before wiring
4. Toolbar before root component
5. Root component before integration paths

### Parallel Opportunities

- All `[P]` tasks within Phase 1 can run simultaneously (different files, T001 must be done first)
- T014 (staffCount) can be worked in parallel with T011-T013 (PluginPracticeNoteEntry changes) within Phase 2
- T018 (Train view migration) can start as soon as T012 is done
- Within Phase 4 (US1): T027 and T028 (tests) can be written in parallel with T025 and T026 (implementation)
- T039, T042, T043, T044 in Phase 7 can all run in parallel

---

## Parallel Example: Phase 5 (US2)

```
Day 1 (morning):
  Agent A: T029 — write practiceEngine.test.ts RED (must finish first — gate)

Day 1 (afternoon, after T029 is committed and RED confirmed):
  Agent A: T030 — implement practiceEngine.ts (GREEN)
  Agent B: T027 — practiceToolbar tests (from Phase 4, can already be running)

Day 2:
  Agent A: T031 — wire practice activation in PracticeViewPlugin.tsx
  Agent B: T034 — staff selection flow (practiceToolbar.tsx side)

Day 3:
  Agent A: T032 — MIDI subscription wiring (depends on T031)
  Agent B: T033 — deactivation paths (depends on T031)
  Agent C: T035 — no-MIDI-device notice (depends on T031)
```

---

## Implementation Strategy

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US4) + Phase 4 (US1) + Phase 5 (US2)  
→ Delivers the complete core value: external plugin + MIDI step-by-step practice

**Increment 2**: Phase 6 (US3 — seek-based start)  
→ Adds quality-of-life for focused practice on specific passages

**Phase 2 is the hardest constraint**: The Plugin API v6 extension (T011-T017) must complete before any plugin feature code can compile. All plugin test assumptions rely on the updated types.

**Principle V is non-negotiable**: T029 must exist as a committed RED test file before any line of `practiceEngine.ts` is written. An LLM completing T030 must reference the test IDs from T029 — not invent its own tests.

**Principle VI is a PR blocker**: Any coordinate in `plugins-external/practice-view-plugin/` during review in T039 must be corrected before merge.
