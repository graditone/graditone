# Tasks: Practice Note Duration Validation

**Input**: Design documents from `/specs/042-practice-note-duration/`  
**Branch**: `042-practice-note-duration`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/plugin-api-v7.md ✅, quickstart.md ✅  
**Tests**: Included per Test-First mandate (Constitution Principle V).  
**Organization**: Tasks grouped by user story. All stories depend on Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable with other [P] tasks at the same phase (different files, no blocking dependencies)
- **[Story]**: User story label (US1 – US4 from spec.md)
- All file paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Verify baseline before changes land.

- [X] T001 Verify full frontend test suite passes before any changes: `cd frontend && pnpm vitest run`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions and data population that ALL user stories depend on. No story work can begin until this phase is complete.

**⚠️ CRITICAL**: T002–T006 must all be complete before any Phase 3+ task begins.

- [X] T002 [P] Add `durationTicks: number` field to `PluginPracticeNoteEntry` interface in `frontend/src/plugin-api/types.ts` per contract in `contracts/plugin-api-v7.md`
- [X] T003 [P] Extend `NoteOutcome` with `'early-release'` and `PracticeMode` with `'holding'` in `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`
- [X] T004 Add `HOLD_COMPLETE` and `EARLY_RELEASE` to the `PracticeAction` discriminated union in `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` (depends on T003, same file)
- [X] T005 Add `holdStartTimeMs: number` and `requiredHoldMs: number` fields to `PracticeState`; add `holdDurationMs: number` and `requiredHoldMs: number` fields to `PracticeNoteResult`; update `INITIAL_PRACTICE_STATE` in `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` (depends on T004, same file)
- [X] T006 Populate `durationTicks` from `note.duration_ticks` in `extractPracticeNotes` in `frontend/src/plugin-api/scorePlayerContext.ts` (depends on T002); use `Math.max` across chord notes as described in `data-model.md` section 4

**Checkpoint**: Type definitions complete. TypeScript compiles. Existing tests may fail until reducer is updated — expected.

---

## Phase 3: User Story 1 — Hold Whole Note for Full Measure (Priority: P1) 🎯 MVP

**Goal**: Session does not advance when a correct pitch is released too early. Session advances only after the user holds for ≥90% of the note's written duration.

**Independent Test**: Load `scores/Pachelbel_CanonD.mxl`, start practice on the upper staff. Press the correct pitch for a whole note and release immediately. Verify the session stays on the same note. Press again and hold for the full measure. Verify the session advances.

### Tests for User Story 1

> **Write these tests FIRST — verify they FAIL before running any implementation tasks below**

- [X] T007 [P] [US1] Write test: `CORRECT_MIDI` with `durationTicks > 0` transitions engine to `mode='holding'`, sets `holdStartTimeMs > 0` and `requiredHoldMs > 0`, does NOT advance `currentIndex` — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T008 [P] [US1] Write test: `CORRECT_MIDI` with `durationTicks === 0` transitions engine to `mode='active'` immediately and advances `currentIndex` (unchanged v6 behaviour) — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T009 [P] [US1] Write test: `HOLD_COMPLETE` while `mode='holding'` records a `correct` or `correct-late` result (matching `relativeDeltaMs > LATE_THRESHOLD_MS` logic), advances `currentIndex`, clears `holdStartTimeMs` and `requiredHoldMs` — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T010 [P] [US1] Write test: `EARLY_RELEASE` while `mode='holding'` records an `early-release` result, stays on same `currentIndex`, clears `holdStartTimeMs` and `requiredHoldMs`, mode stays `'holding'` — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T011 [P] [US1] Write test: `CORRECT_MIDI` after `EARLY_RELEASE` (retry) re-enters `mode='holding'` without adding a new pitch-result entry (only the early-release result remains) — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T012 [P] [US1] Write test: `HOLD_COMPLETE` or `EARLY_RELEASE` while `mode !== 'holding'` is a no-op (returns same state reference) — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement `CORRECT_MIDI → 'holding'` transition in `frontend/plugins/practice-view-plugin/practiceEngine.ts`: when `entry.durationTicks > 0`, set `mode='holding'`, `holdStartTimeMs`, `requiredHoldMs`; otherwise advance as before (depends on T007–T012 failing)
- [X] T014 [US1] Implement `HOLD_COMPLETE` case in `frontend/plugins/practice-view-plugin/practiceEngine.ts`: advance `currentIndex`, record result with `correct`/`correct-late` outcome, clear hold state fields (depends on T013)
- [X] T015 [US1] Implement `EARLY_RELEASE` case in `frontend/plugins/practice-view-plugin/practiceEngine.ts`: record `early-release` result, clear `holdStartTimeMs`/`requiredHoldMs`, stay on same index; handle retry `CORRECT_MIDI` without adding duplicate result entry (depends on T014)
- [X] T016 [US1] Extend MIDI release handler in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: when `mode='holding'` and `event.midiNote` is in `currentEntry.midiPitches`, compute `holdDurationMs` and dispatch `EARLY_RELEASE` (depends on T015)
- [X] T017 [US1] Add `requestAnimationFrame` hold timer in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: start loop when engine enters `'holding'`, compute `holdProgress = elapsed / requiredHoldMs`; dispatch `HOLD_COMPLETE` when `holdProgress ≥ 0.90`; cancel loop on `EARLY_RELEASE` or mode change (depends on T016)

**Checkpoint**: User Story 1 fully functional. Session holds on note, advances after 90% duration. Existing random-note/scale sessions unaffected (`durationTicks === 0` path).

---

## Phase 4: User Story 4 — Duration Checking Applies to Chords (Priority: P2)

**Goal**: Releasing any one pitch of a whole-note chord while holding terminates the chord hold and records an early-release.

**Independent Test**: Load a score with a whole-note chord. Press all pitches. Release one pitch after ~50% of the measure. Verify session stays. Press all pitches again and hold all of them past 90%. Verify session advances.

### Tests for User Story 4

> **Write these tests FIRST**

- [X] T018 [P] [US4] Write test: pressing all chord pitches and releasing one while `mode='holding'` dispatches `EARLY_RELEASE` (component-level, mock MIDI events) — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T019 [P] [US4] Write test: pressing all chord pitches, holding past 90%, `HOLD_COMPLETE` fires and session advances — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T020 [P] [US4] Write test: releasing a MIDI pitch that is NOT in `currentEntry.midiPitches` while `mode='holding'` does NOT dispatch `EARLY_RELEASE` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for User Story 4

- [X] T021 [US4] Confirm the chord membership check (`currentEntry.midiPitches.includes(event.midiNote)`) in the MIDI release handler covers multi-pitch chords correctly; add guard so that non-chord-pitch releases are ignored during hold — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (T016 may already implement this; verify and adjust if needed)

**Checkpoint**: Chord duration enforcement working. Single notes and chords both enforce 90% hold threshold.

---

## Phase 5: User Story 2 — Duration Feedback During Hold (Priority: P2)

**Goal**: A progress indicator fills on screen while the user holds a note that requires a duration longer than one quarter note.

**Independent Test**: Start a session with a whole note target. Press and hold the correct pitch. Verify a progress bar appears and fills. Release at 50% — verify the bar disappears and the note is not accepted.

### Tests for User Story 2

> **Write these tests FIRST**

- [X] T022 [P] [US2] Write test: `holdProgress > 0` while `mode='holding'` and `requiredHoldMs > quarterNoteMs`; hold indicator element is present in the DOM — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T023 [P] [US2] Write test: after `EARLY_RELEASE`, `holdProgress` resets to `0` and hold indicator element is removed from the DOM — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T024 [P] [US2] Write test: when `durationTicks <= 960` (≤ quarter note at current BPM), indicator is never rendered even when `mode='holding'` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for User Story 2

- [X] T025 [US2] Add `holdProgress` state (`useState(0)`) and connect to rAF loop output in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (depends on T017; `holdProgress` is already updated in the rAF timer — expose it to the render tree)
- [X] T026 [US2] Render hold indicator in JSX: conditionally show a progress bar when `holdProgress > 0` and `requiredHoldMs > quarterNoteMs`; bind bar width to `holdProgress * 100 + '%'` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T027 [US2] Add hold indicator CSS styles (progress bar container + fill) in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css`

**Checkpoint**: Visual feedback working. Progress bar appears for whole/half notes, not for quarter notes and shorter.

---

## Phase 6: User Story 3 — Duration Affects Practice Score (Priority: P3)

**Goal**: `early-release` outcomes contribute 0.5 credit in the session score. The results screen labels them distinctly.

**Independent Test**: Complete a session with all early-releases. Verify the score is lower than a session with identical pitch accuracy but full holds. Verify each early-release note shows the `early-release` label on the results screen.

### Tests for User Story 3

> **Write these tests FIRST**

- [X] T028 [P] [US3] Write test: score formula produces `((correct + (late + earlyRelease) × 0.5) / total) × 100 − penalty` — verify with a fixture session where some notes are `early-release` — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T029 [P] [US3] Write test: a session with all `early-release` results produces a lower score than an identical session with all `correct` results — in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T030 [P] [US3] Write test: results screen renders `'early-release'` label for notes where `outcome === 'early-release'` — in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for User Story 3

- [X] T031 [US3] Update score calculation in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: add `earlyRelease` count to the `(late + earlyRelease) × 0.5` term in the existing score formula (depends on T028–T030 failing)
- [X] T032 [US3] Update results screen note outcome rendering in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to display a distinct label for `'early-release'` outcomes (e.g., "held too short")

**Checkpoint**: Score and results screen reflect early-release outcomes. Session improvement signal visible to learner.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, docs, and validation across all stories.

- [X] T033 [P] Run TypeScript type-check across all modified files: `cd frontend && pnpm tsc --noEmit` — verify zero new type errors
- [X] T034 [P] Run full frontend test suite and confirm all tests pass: `cd frontend && pnpm vitest run`
- [X] T035 Update `FEATURES.md` to document note-duration checking in the Practice view (score-based sessions only; 90% hold threshold; visual indicator for notes > quarter note)
- [X] T036 Update `PLUGINS.md` to document plugin API v7 addition (`durationTicks` on `PluginPracticeNoteEntry`) and the new `'holding'` practice mode

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational) — blocks all stories
            ├── Phase 3 (US1 P1) — MVP
            ├── Phase 4 (US4 P2) — depends on US1 complete
            ├── Phase 5 (US2 P2) — depends on US1 complete (rAF loop must exist)
            └── Phase 6 (US3 P3) — depends on US1 complete (early-release outcome must exist)
                        └── Phase 7 (Polish)
```

### User Story Dependencies

| Story | Priority | Depends on | Independently testable after |
|-------|----------|-----------|------------------------------|
| US1 — Hold enforcement | P1 | Foundational (Phase 2) only | Phase 3 complete |
| US4 — Chord hold | P2 | US1 complete (T013–T017) | Phase 4 complete |
| US2 — Visual indicator | P2 | US1 complete (T017, rAF loop) | Phase 5 complete |
| US3 — Scoring | P3 | US1 complete (T015, early-release action) | Phase 6 complete |

### Parallel Opportunities Within Each Phase

**Phase 2 (Foundational)**:
- T002 (types.ts) and T003 (practiceEngine.types.ts) can run in parallel — different files

**Phase 3 (US1) — tests phase**:
- T007, T008, T009, T010, T011, T012 can all be written in parallel — same file, independent test cases

**Phase 4 (US4) — tests phase**:
- T018, T019, T020 can be written in parallel — same file, independent test cases

**Phase 5 (US2) — tests phase**:
- T022, T023, T024 can be written in parallel — same file, independent test cases

**Phase 6 (US3) — tests phase**:
- T028, T029 (engine tests) and T030 (component test) can run in parallel — different files

**Phase 7 (Polish)**:
- T033, T034 can run in parallel
- T035, T036 can run in parallel

---

## Parallel Execution Example: User Story 1 (P1)

If two developers are available after Phase 2 completes:

**Developer A** (engine tests + impl):
- T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015

**Developer B** (component integration — starts after T015):
- T016 → T017

Or single developer sequential order:
T001 → T002 ∥ T003 → T004 → T005 → T006 → [T007–T012 in parallel] → T013 → T014 → T015 → T016 → T017

---

## Implementation Strategy

### MVP Scope (Phase 3 only — US1)

Implementing US1 alone delivers:
- Session no longer advances on early-release (correct pitches, wrong duration)
- Hold-based advance at 90% threshold
- Both single notes AND chords covered (chord check is part of T016)
- Random/scale practice modes unaffected (`durationTicks === 0`)

US2 (indicator), US4 (explicit chord tests), and US3 (scoring) are enhancements on top of the core behaviour and can ship incrementally.

### Key Formula Reminder

```
requiredHoldMs  = (entry.durationTicks / ((bpm / 60) * 960)) * 1000
holdThresholdMs = requiredHoldMs * 0.90
quarterNoteMs   = (960 / ((bpm / 60) * 960)) * 1000  // for indicator visibility check
```

`bpm = playerStateRef.current.bpm` (session BPM slider value including tempo multiplier)

### Invariants to Verify (from contracts/plugin-api-v7.md)

| ID | Invariant |
|----|-----------|
| V-001 | `durationTicks >= 0` for all `PluginPracticeNoteEntry` objects |
| V-002 | `durationTicks === 0` → CORRECT_MIDI advances immediately |
| V-003 | `durationTicks > 0` → CORRECT_MIDI sets `mode='holding'`, `holdStartTimeMs > 0` |
| V-004 | HOLD_COMPLETE outside `mode='holding'` → no-op |
| V-005 | EARLY_RELEASE outside `mode='holding'` → no-op |
| V-006 | After EARLY_RELEASE: `holdStartTimeMs === 0`, `requiredHoldMs === 0`, `currentIndex` unchanged |
| V-007 | After HOLD_COMPLETE: `holdStartTimeMs === 0`, `requiredHoldMs === 0`, `currentIndex` incremented |
| V-008 | WRONG_MIDI while `mode='holding'` → increment `currentWrongAttempts`, stay in `'holding'` |
