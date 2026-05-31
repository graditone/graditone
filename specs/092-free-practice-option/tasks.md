# Tasks: Free Practice Option

**Input**: Design documents from `/specs/092-free-practice-option/`  
**Branch**: `092-free-practice-option`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are relative to `frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new i18n keys and extend shared type definitions that all subsequent phases depend on.

**⚠️ CRITICAL**: These tasks MUST complete before any Phase 2+ work begins.

- [ ] T001 Add i18n keys `score_selector.free_practice`, `practice.free.title`, `practice.free.note_count`, `practice.results.free_elapsed` to `src/i18n/locales/en.json`
- [ ] T002 Extend `ScoreRef.type` union with `'free'` value in `src/services/savedPractice.types.ts`
- [ ] T003 Add `FreeMidiEvent` and `FreeMidiRecord` interface types to `src/services/savedPractice.types.ts`
- [ ] T004 Add optional `freeMidiRecord?: FreeMidiRecord` field to `SavedPractice` interface in `src/services/savedPractice.types.ts`
- [ ] T005 Add `generateFreePracticeName(date: Date): string` pure function to `src/services/savedPracticeStorage.ts` — format: `FreePractice-{YYYYMMDDTHHmmss}` local time
- [ ] T006 Add unit tests for `generateFreePracticeName` in `src/services/savedPracticeStorage.test.ts` — verify format, local time, no score/hand/scope segments
- [ ] T007 Re-export `generateFreePracticeName` from `src/plugin-api/index.ts`
- [ ] T008 Add optional `onFreePractice?: () => void` prop to `PluginScoreSelectorProps` interface in `src/plugin-api/types.ts` with JSDoc: only Practice plugin may pass this; Play plugin must not

**Checkpoint**: Type foundations ready — all downstream tasks can now start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the host-provided `ScoreSelectorPlugin` component and the `PracticeToolbar` and `ResultsOverlay` internal components with the new optional props. These are pure additions with no behaviour change when props are absent.

**⚠️ These tasks block US1 implementation but are independently testable on their own.**

- [ ] T009 Accept `onFreePractice` prop in `ScoreSelectorPlugin` in `src/components/plugins/ScoreSelectorPlugin.tsx` — render a `"🎹 Free Practice"` button in the footer row (beside "Load from file") only when the prop is defined; clicking calls `onFreePractice()`
- [ ] T010 Style the Free Practice button in `src/components/plugins/ScoreSelectorPlugin.css` — visually distinct from the "Load from file" button (e.g., primary/accent colour)
- [ ] T011 Add unit tests for `ScoreSelectorPlugin` in `src/components/plugins/ScoreSelectorPlugin.test.tsx` — (a) button absent when `onFreePractice` is undefined; (b) button present and calls callback when prop is provided; (c) button visible when `isLoading === true` and when catalogue is empty
- [ ] T012 Add `isFreePractice?: boolean`, `freeNoteCount?: number`, and `freeElapsedDisplay?: string` props to `PracticeToolbarProps` in `plugins/practice-view-plugin/practiceToolbar.tsx`
- [ ] T013 Implement free-practice toolbar rendering in `plugins/practice-view-plugin/practiceToolbar.tsx` — when `isFreePractice`: show `t('practice.free.title')` as title, hide play/pause buttons, hide staff picker, replace `X / N` progress with `{freeElapsedDisplay} · {t('practice.free.note_count', { n: freeNoteCount })}` (no `/`)
- [ ] T014 Add unit tests for free-practice toolbar in `plugins/practice-view-plugin/practiceToolbar.test.tsx` — (a) title shows "Free Practice"; (b) elapsed + note count rendered without "/"; (c) play/pause absent; (d) staff picker absent; (e) metronome and tempo controls still present
- [ ] T015 Add `isFreePractice?: boolean` and `freeMidiRecord?: FreeMidiRecord` props to `ResultsOverlayProps` in `plugins/practice-view-plugin/ResultsOverlay.tsx`
- [ ] T016 Implement free-practice results overlay rendering in `plugins/practice-view-plugin/ResultsOverlay.tsx` — when `isFreePractice`: hide score-ring, grade, accuracy breakdown, timing deviation graph, note-by-note table; show elapsed time (from `freeMidiRecord.elapsedMs`) and note count; keep Save/Replay/Repractice buttons unchanged
- [ ] T017 Add unit tests for free-practice results overlay in `plugins/practice-view-plugin/ResultsOverlay.test.tsx` — (a) accuracy sections absent; (b) elapsed time rendered; (c) note count rendered; (d) Save/Replay/Repractice buttons present; (e) existing score-based tests unaffected

**Checkpoint**: All component shells ready — `PracticeViewPlugin` orchestration can now be implemented.

---

## Phase 3: User Story 1 — Start a Free Practice Session (Priority: P1) 🎯 MVP

**Goal**: User clicks "Free Practice" in the Practice plugin's score selector and enters a score-less practice view at 4/4, 80 BPM with full toolbar controls.

**Independent Test**: Open Practice plugin → score selector shows "🎹 Free Practice" button → click it → practice view opens with "Free Practice" title, 80 BPM, metronome available, play/pause hidden, staff picker hidden → Back returns to score selector.

- [ ] T018 [US1] Add state variables to `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: `isFreePractice` (boolean, initial `false`), `freeNoteCount` (number, initial `0`), `freeElapsedDisplay` (string, initial `'00:00'`), `freeMidiRecord` (`FreeMidiRecord | null`, initial `null`)
- [ ] T019 [US1] Add refs to `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: `freeMidiEventsRef` (`FreeMidiEvent[]`), `freeElapsedMsRef` (number), `freeElapsedIntervalRef` (interval handle)
- [ ] T020 [US1] Implement `handleFreePractice()` callback in `plugins/practice-view-plugin/PracticeViewPlugin.tsx` — sets `isFreePractice = true`, resets `freeMidiEventsRef.current = []`, `freeElapsedMsRef.current = 0`, `freeNoteCount = 0`, `freeMidiRecord = null`, `isSaved = false`
- [ ] T021 [US1] Wire `onFreePractice={handleFreePractice}` prop into the `<ScoreSelector>` render call in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [ ] T022 [US1] Extend render logic in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `isFreePractice && !resultsOverlayVisible`, skip `ScoreSelector` and render the toolbar + empty content area directly (no `ScoreRenderer`)
- [ ] T023 [US1] Start 1-second wall-clock interval when free practice running (`isFreePractice && practiceState.mode === 'active'` or `'waiting'` or `'holding'`): increment `freeElapsedMsRef.current` by 1000 ms and update `freeElapsedDisplay` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`; clear interval on stop, repractice, or back
- [ ] T024 [US1] Extend MIDI subscription in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `isFreePractice` and practice toggle is active, push each MIDI note-attack event to `freeMidiEventsRef.current` and call `setFreeNoteCount(n => n + 1)`
- [ ] T025 [US1] Pass `isFreePractice`, `freeNoteCount`, `freeElapsedDisplay` to `<PracticeToolbar>` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [ ] T026 [US1] Handle Back during free practice in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: `handleBack` when `isFreePractice` calls `setIsFreePractice(false)`, clears interval, resets accumulators, dispatches `STOP` — returns to `ScoreSelector`
- [ ] T027 [US1] Add integration tests in `plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`: (a) "Free Practice" button visible in score selector; (b) click transitions to practice view (no ScoreSelector rendered); (c) toolbar shows "Free Practice" title; (d) Back returns to score selector; (e) play/pause buttons absent in free mode; (f) ScoreSelector in Play plugin context does NOT receive `onFreePractice` prop (verify in `plugins/play-score/PlayScorePlugin.test.tsx`)

---

## Phase 4: User Story 2 — Save, Replay, and Repractice a Free Practice Session (Priority: P2)

**Goal**: Stopping free practice shows a simplified results overlay; Save/Replay/Repractice all work as specified.

**Independent Test**: Start free practice → play notes → Stop → simplified overlay shows duration + note count → Save persists entry → Replay plays back MIDI audio → Repractice restarts free session without dialog.

- [ ] T028 [US2] Extend Stop handler in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `isFreePractice` and practice running, snapshot `FreeMidiRecord` from `freeMidiEventsRef.current` + `freeElapsedMsRef.current` + current BPM into `freeMidiRecord` state; clear interval; call `dispatchPractice({ type: 'STOP' })`; set `resultsOverlayVisible = true`
- [ ] T029 [US2] Pass `isFreePractice` and `freeMidiRecord` to `<ResultsOverlay>` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [ ] T030 [US2] Implement `handleFreeSave()` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: build `SavedPractice` with `scoreRef: { type: 'free', id: '' }`, `scoreTitle: t('practice.free.title')`, `staffIndex: 0`, `loopRegion: null`, `completionStatus: 'complete'`, `performanceData: { notes: [], noteResults: [], wrongNoteEvents: [], bpmAtCompletion: freeMidiRecord.bpm, stoppedAtIndex: null, totalNoteCount: null }`, `freeMidiRecord`; name via `generateFreePracticeName(new Date())`; persist via `savePracticeToIndexedDB` + `addSavedPracticeIndex`; set `isSaved = true`
- [ ] T031 [US2] Wire save: pass `onSave={isFreePractice ? handleFreeSave : (loadedScoreRefRef.current ? handleSave : undefined)}` to `<ResultsOverlay>` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [ ] T032 [US2] Implement `handleFreeReplay()` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: iterate over `freeMidiRecord.events`, schedule `context.playNote()` for each event using `offsetMs: event.timestampMs`; set `isReplaying = true`; schedule cleanup timer after last event + 300 ms; call `onDismiss()` to hide overlay during replay
- [ ] T033 [US2] Wire replay: pass `onReplay` (or extend existing `handleReplay` with free-practice branch) in `ResultsOverlay.tsx` to detect `isFreePractice` and call `handleFreeReplay()` instead of the score-based replay path
- [ ] T034 [US2] Extend `handleRepractice()` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `isFreePractice`, reset accumulators (`freeMidiEventsRef.current = []`, `freeNoteCount = 0`, `freeElapsedDisplay = '00:00'`, `freeMidiRecord = null`, `isSaved = false`), hide results overlay, then toggle practice — do NOT navigate to `ScoreSelector`
- [ ] T035 [US2] Extend `handleSelectSavedPractice` in `plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `saved.scoreRef.type === 'free'`, set `isFreePractice = true`, set `freeMidiRecord` from `saved.freeMidiRecord`, set `resultsOverlayVisible = true` — skip `scorePlayer.loadScore()` entirely
- [ ] T036 [US2] Add integration tests in `plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`: (a) stopping free practice shows simplified results overlay; (b) Save persists a `SavedPractice` with `scoreRef.type === 'free'` and `freeMidiRecord` present; (c) Replay calls `context.playNote` for each captured event; (d) Repractice resets accumulators and restarts without showing ScoreSelector; (e) loading a saved free practice restores the simplified results overlay

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, edge-case guards, and regression test for the Play plugin boundary.

- [ ] T037 [P] Guard `handleFreeSave` against `freeMidiRecord === null` (stop pressed before any MIDI input) in `plugins/practice-view-plugin/PracticeViewPlugin.tsx` — save still works, `freeMidiRecord.events` will be empty, `noteCount = 0`
- [ ] T038 [P] Ensure interval is cleared on plugin unmount (`useEffect` teardown) in `plugins/practice-view-plugin/PracticeViewPlugin.tsx` to prevent memory leaks
- [ ] T039 [P] Verify `SavedPracticeIndexEntry` displayed in `SavedPracticeList` for free practices: `scoreTitle` shows `t('practice.free.title')`, no crash when `scoreRef` is absent in the lightweight index entry — update display logic in `src/components/load-score/SavedPracticeList.tsx` if needed
- [ ] T040 [P] Verify Play plugin's score selection dialog does not show the "Free Practice" button: add regression assertion to `plugins/play-score/PlayScorePlugin.test.tsx` confirming `onFreePractice` is never passed to `ScoreSelector` from Play plugin context
- [ ] T041 [P] Update `FEATURES.md` to document the Free Practice option under the Practice plugin section
- [ ] T042 [P] Update `PLUGINS.md` to document the new `onFreePractice` optional prop on `PluginScoreSelectorProps`

---

## Dependencies

```
T001–T008 (Setup)
    │
    ├──► T009–T017 (Foundational: component shells)
    │        │
    │        └──► T018–T027 (US1: orchestration & entry point)
    │                 │
    │                 └──► T028–T036 (US2: Stop / Save / Replay / Repractice)
    │                           │
    │                           └──► T037–T042 (Polish)
    │
    └──► T006 (unit test for generateFreePracticeName — parallel with T009+)
```

**Strictly sequential within a phase**: T002 → T003 → T004 (type extensions build on each other)  
**Parallelisable across phases**: T006 can run alongside T009+; T011/T014/T017 can run alongside each other

---

## Parallel Execution Examples

**Phase 1 parallelism**:
- T001 (i18n keys) can be done concurrently with T002–T004 (type changes) — different files

**Phase 2 parallelism**:
- T009–T011 (`ScoreSelectorPlugin`) ‖ T012–T014 (`practiceToolbar`) ‖ T015–T017 (`ResultsOverlay`) — all different files

**Phase 4 parallelism**:
- T030–T031 (save path) ‖ T032–T033 (replay path) — independent features, same file but non-overlapping code regions

**Phase 5 parallelism**:
- T037–T042 are all marked `[P]` — fully independent

---

## Implementation Strategy

**MVP scope** (deliver US1 first, independently shippable):

1. Complete Phase 1 (Setup) — T001–T008
2. Complete T009–T017 (component shells — needed for US1 render)
3. Complete T018–T027 (US1 orchestration)
4. **US1 demo-able**: Free Practice button → enter practice view → Back

**Full feature** (add US2):

5. Complete T028–T036 (US2: Stop/Save/Replay/Repractice)
6. Complete T037–T042 (Polish)

---

## Task Summary

| Phase | Tasks | Parallelisable | Story |
|-------|-------|----------------|-------|
| Phase 1: Setup | T001–T008 | T001 ‖ T002–T004 | — |
| Phase 2: Foundational | T009–T017 | T009–T011 ‖ T012–T014 ‖ T015–T017 | — |
| Phase 3: US1 | T018–T027 | T018–T026 sequential; T027 at end | US1 |
| Phase 4: US2 | T028–T036 | T030–T031 ‖ T032–T033 | US2 |
| Phase 5: Polish | T037–T042 | All [P] | — |
| **Total** | **42 tasks** | | |
