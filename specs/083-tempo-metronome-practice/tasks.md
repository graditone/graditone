# Tasks: Tempo Slider Range Extension & Practice Metronome Deferred Start

**Branch**: `083-tempo-metronome-practice` | **Date**: 2026-04-25  
**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelizable with other [P]-marked tasks in the same phase
- **[US1/US2/US3]**: Which user story this task delivers
- All paths relative to worktree root

---

## Phase 1: Setup

**Purpose**: Confirm the development baseline is green before any changes.

- [ ] T001 Run existing unit and E2E test suites to confirm green baseline — `cd frontend && npm run test && npm run test:e2e`

**Checkpoint**: All pre-existing tests pass. Safe to begin implementation.

---

## Phase 2: Foundational — Shared Slider Precision Improvements

**Purpose**: The step size (0.05→0.01), snap zone (±0.05→±0.03), float normalisation, and 100% datalist tick mark are **shared prerequisites** for both User Story 1 (10% min) and User Story 2 (200% max validation). These changes MUST be complete before story-specific slider work begins.

**⚠️ CRITICAL**: T002–T005 must be complete before Phase 3 or Phase 5 slider tasks.

- [ ] T002 [P] Write failing tests for step=0.01, snap zone ±0.03, float normalisation, and datalist in `frontend/plugins/play-score/playbackToolbar.test.tsx` — confirm RED before proceeding to T004
- [ ] T003 [P] Write failing tests for step=0.01, snap zone ±0.03, float normalisation, and datalist in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` — confirm RED before proceeding to T005
- [ ] T004 Update `frontend/plugins/play-score/playbackToolbar.tsx`: change `step` from `0.05` to `0.01`; update snap condition from `<= 0.05` to `<= 0.03`; wrap `parseFloat(e.target.value)` with `Math.round(raw * 100) / 100` normalisation; add `<datalist id="play-score-tempo-ticks"><option value="1.0" /></datalist>` and `list="play-score-tempo-ticks"` on the range input — verify T002 tests pass GREEN
- [ ] T005 [P] Update `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`: same changes as T004 (step, snap, normalisation, datalist with id `"practice-tempo-ticks"`) — verify T003 tests pass GREEN

**Checkpoint**: Both toolbars use 1% steps and ±3 pp snap zone. Existing snap tests updated and passing.

---

## Phase 3: User Story 1 — Ultra-Slow Tempo for Difficult Passages (Priority: P1) 🎯 MVP

**Goal**: Students can drag the tempo slider all the way down to 10% (or to the BPM-floor-enforced minimum for very slow scores), giving them the extreme slow-practice range they need.

**Independent Test**: Open any score in play-score view → drag the tempo slider to its leftmost stop → verify the display reads "10%" and playback is audibly slow. Fully testable without the metronome feature.

### Tests for User Story 1

> **Write these tests FIRST and confirm they FAIL before writing any implementation.**

- [ ] T006 [P] [US1] Write failing unit tests in `frontend/src/utils/tempoCalculations.test.ts`:
  - `MIN_TEMPO_MULTIPLIER` equals `0.1`
  - `ABSOLUTE_BPM_FLOOR` equals `10`
  - `computeEffectiveMinMultiplier(120)` returns `0.1` (floor not triggered)
  - `computeEffectiveMinMultiplier(40)` returns `0.25` (10/40, floor triggered)
  - `computeEffectiveMinMultiplier(0)` returns `0.1` (defensive fallback)
  - `clampTempoMultiplier(0.05)` returns `0.1` (clamped to new min)
  - `clampTempoMultiplier(0.3)` returns `0.3` (within new range)
  Confirm RED before proceeding to T007
- [ ] T007 [P] [US1] Write failing component tests in `frontend/plugins/play-score/playbackToolbar.test.tsx`:
  - Slider `min` attribute equals `computeEffectiveMinMultiplier(bpm)` when `bpm >= 100`
  - Slider `min` attribute is clamped above `0.1` when `bpm` yields floor (e.g., bpm=40 → min=0.25)
  - `title` tooltip is present on slider when effective min > `MIN_TEMPO_MULTIPLIER`
  Confirm RED
- [ ] T008 [P] [US1] Write failing component tests in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` — same min/tooltip assertions as T007. Confirm RED

### Implementation for User Story 1

- [ ] T009 [US1] Update `frontend/src/utils/tempoCalculations.ts`:
  - Change `MIN_TEMPO_MULTIPLIER` from `0.5` to `0.1`
  - Add `export const ABSOLUTE_BPM_FLOOR = 10`
  - Add `export function computeEffectiveMinMultiplier(originalBpm: number): number` per data-model.md spec — verify T006 tests pass GREEN
- [ ] T010 [US1] Update `frontend/plugins/play-score/playbackToolbar.tsx`:
  - Import `computeEffectiveMinMultiplier` from `../../src/utils/tempoCalculations`
  - Compute `const effectiveMin = computeEffectiveMinMultiplier(bpm)` using the `bpm` prop
  - Set slider `min={effectiveMin}` (was hardcoded `0.5`)
  - Add `title` attribute on the slider or its wrapper: `"Minimum tempo limited to 10 BPM for this score"` — shown only when `effectiveMin > MIN_TEMPO_MULTIPLIER`
  Verify T007 tests pass GREEN
- [ ] T011 [P] [US1] Update `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`:
  - Same changes as T010: import `computeEffectiveMinMultiplier`, compute `effectiveMin` from the `bpm` prop, set dynamic `min`, conditional `title` tooltip
  Verify T008 tests pass GREEN
- [ ] T012 [US1] Create `frontend/e2e/tempo.spec.ts` with E2E test T001: load a score in play-score view → drag tempo slider to minimum → assert displayed percentage is `"10%"` (or BPM-floor label when applicable); assert playback starts without errors — confirm GREEN

**Checkpoint**: Slider minimum is 10% in both toolbars. BPM floor applies for slow scores. All US1 tests pass. US2 can be validated independently.

---

## Phase 4: User Story 3 — Metronome Starts on First Note in Practice Mode (Priority: P1)

**Goal**: When a student enters practice mode with the metronome enabled, it stays silent (but shows an "armed" pulsing state) until they play their first note, at which point it fires as beat 1. Behaviour outside practice mode is unchanged.

**Independent Test**: Enter practice view → load any score → enable the metronome → wait 5 seconds without playing → verify no audio clicks and the metronome button is pulsing amber → play any MIDI note → verify the metronome starts immediately. Fully testable without any tempo slider changes.

### Tests for User Story 3

> **Write these tests FIRST and confirm they FAIL before writing any implementation.**

- [ ] T013 [P] [US3] Write failing component tests in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`:
  - When `metronomeArmed=true` and `metronomeActive=false`: button has class `practice-plugin__metro-btn--armed` and does NOT have `practice-plugin__metro-btn--active`
  - When `metronomeArmed=false` and `metronomeActive=false`: button has neither `--armed` nor `--active`
  - When `metronomeArmed=false` and `metronomeActive=true`: button has `--active` and NOT `--armed`
  - Invariant: `metronomeArmed=true` and `metronomeActive=true` simultaneously → armed class absent (active wins; the armed state resets the instant the engine starts)
  Confirm RED
- [ ] T014 [P] [US3] Write failing integration test in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` (create file if absent):
  - Toggle metronome while practice is in `'waiting'` mode → `context.metronome.toggle` is NOT called; `metronomeArmed` becomes true
  - Simulate first MIDI attack (call `onFirstNoteAttack`) → `context.metronome.toggle` IS called once; `metronomeArmed` becomes false
  - Toggle metronome again while armed → `metronomeArmed` becomes false (disarm without calling toggle)
  - Toggle metronome outside practice mode → `context.metronome.toggle` IS called immediately (normal behaviour)
  Confirm RED

### Implementation for User Story 3

- [ ] T015 [US3] Update `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`:
  - Add `metronomeArmed: boolean` to `PracticeToolbarProps`
  - Extend `metronomeBtnClass` derivation: append `'practice-plugin__metro-btn--armed'` when `metronomeArmed === true`
  Verify T013 tests pass GREEN
- [ ] T016 [US3] Add CSS for armed state in the practice plugin stylesheet (locate with `grep -r "metro-btn--active" frontend/ --include="*.css" -l`):
  ```css
  .practice-plugin__metro-btn--armed {
    color: var(--color-metro-armed, #c8a000);
    animation: metro-armed-pulse 0.5s ease-in-out infinite alternate;
  }
  @keyframes metro-armed-pulse {
    from { opacity: 0.4; }
    to   { opacity: 1.0; }
  }
  ```
- [ ] T017 [US3] Update `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`:
  - Add `onFirstNoteAttack?: () => void` to the params interface
  - Inside the MIDI attack handler: when `practiceStateRef.current.mode === 'waiting'`, call `onFirstNoteAttack?.()` exactly once (the `'waiting'` → `'active'` transition naturally prevents re-entry; no additional guard ref needed since `mode` changes immediately)
- [ ] T018 [US3] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`:
  - Add `const [metronomeArmed, setMetronomeArmed] = useState<boolean>(false)` alongside existing `metronomeState`
  - Add `const metronomeArmedRef = useRef<boolean>(false)` for stale-closure safety in callbacks
  - Modify `handleMetronomeToggle`: implement the armed/disarm/normal logic per data-model.md §2 (toggle table)
  - Define `onFirstNoteAttack` callback: `setMetronomeArmed(false); metronomeArmedRef.current = false; context.metronome.toggle().catch(...)` 
  - Pass `onFirstNoteAttack` to `usePracticeMidi`
  - Reset `metronomeArmed` and `metronomeArmedRef` in `handlePracticeToggle` (session START and STOP)
  - Add `useEffect` watching `practiceState.mode`: reset armed when `mode === 'complete'`
  - Pass `metronomeArmed={metronomeArmed}` to `<PracticeToolbar />`
  Verify T014 integration tests pass GREEN
- [ ] T019 [US3] Add E2E test T024 in `frontend/e2e/metronome.spec.ts`:
  - Enter practice view with a loaded score
  - Enable metronome → assert NO audio (mock or observe no beat events) and button has `--armed` class
  - Simulate first MIDI note → assert metronome starts (engine `active`, clicks heard or beat state changes)
  - Stop practice → start again → assert metronome re-arms (deferred start resets)
- [ ] T020 [P] [US3] Add E2E test T025 in `frontend/e2e/metronome.spec.ts`:
  - Enable metronome in practice mode (armed) → take screenshot / check CSS → assert button is visually different from both the OFF state (no practice) and the ACTIVE state (mid-session)

**Checkpoint**: Metronome deferred start is complete. Armed visual state renders. Deferred start fires exactly once on first note. Outside practice mode, metronome still starts immediately (regression safe).

---

## Phase 5: User Story 2 — High-Speed Challenge Practice (Priority: P2)

**Goal**: Students can drag the slider all the way to 200% for a double-speed challenge. With the new 1% steps (from Phase 2), the upper range is smoother and the display always shows an exact integer.

**Independent Test**: Open any score → drag tempo slider to its rightmost stop → verify display reads "200%". Independently testable from US1 and US3 — the upper bound (2.0) was already present; this phase validates the full range with the new step size and confirms no regressions.

### Tests for User Story 2

- [ ] T021 [P] [US2] Add/update tests in `frontend/plugins/play-score/playbackToolbar.test.tsx`:
  - Slider `max` attribute is `2.0`
  - When `tempoMultiplier=2.0`, displayed label shows `"200%"`
  - Drag from 1.95 → snap does NOT snap (snap zone only near 1.0); display shows "195%"
  Confirm GREEN (these validate existing code + Phase 2 changes; they should pass after T004)
- [ ] T022 [P] [US2] Add/update tests in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`:
  - Same max=2.0 and 200% display assertions
  Confirm GREEN (validates T005 changes)

### Implementation for User Story 2

- [ ] T023 [US2] Add E2E test T003 in `frontend/e2e/tempo.spec.ts`:
  - Load a score → drag slider to rightmost position → assert displayed percentage is `"200%"`
  - Assert playback runs without JavaScript errors at 200%
  - Assert slider does NOT snap at 197%–200% (only snaps near 100%)

**Checkpoint**: All three user stories are independently functional and tested. US1 (10% min), US2 (200% max precision), and US3 (deferred metronome) are all green.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T024 Update `FEATURES.md` — add entry for tempo range extension (10%–200%, 1% steps, 100% snap) and metronome deferred start in practice mode
- [ ] T025 Run the full test suite to confirm all tests pass: `cd frontend && npm run test && npm run test:e2e` — fix any regressions before marking the feature complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 ✓ — BLOCKS Phase 3 and Phase 5 slider work
- **Phase 3 (US1)**: Depends on Phase 2 — can run in parallel with Phase 4
- **Phase 4 (US3)**: Depends on Phase 2 — can run in parallel with Phase 3 (touches different files)
- **Phase 5 (US2)**: Depends on Phase 2 — can start after Phase 2; does not depend on Phase 3 or 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, and 5 all complete

### User Story Dependencies

- **US1 (Phase 3)**: Independent — only shares Phase 2 foundation. No dependency on US3.
- **US3 (Phase 4)**: Independent — zero overlap with US1 code. `practiceToolbar.tsx` is shared but US1 changes the slider and US3 changes the metro button — tasks are parallelizable at the file level.
- **US2 (Phase 5)**: Depends on Phase 2 (step/snap changes). All implementation tasks are GREEN-only (verifying existing behaviour + Phase 2 changes) — no new code in toolbars.

### Within Each Phase

- `[P]`-marked test tasks can run in parallel before their paired implementation tasks
- Test tasks MUST be RED before the corresponding implementation task starts
- Implementation tasks must be run in order within a phase when dependencies are noted

### Files Touched (change surface map)

| File | Phases |
|------|--------|
| `frontend/src/utils/tempoCalculations.ts` | Phase 3 (T009) |
| `frontend/src/utils/tempoCalculations.test.ts` | Phase 3 (T006) |
| `frontend/plugins/play-score/playbackToolbar.tsx` | Phase 2 (T004), Phase 3 (T010) |
| `frontend/plugins/play-score/playbackToolbar.test.tsx` | Phase 2 (T002), Phase 3 (T007), Phase 5 (T021) |
| `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` | Phase 2 (T005), Phase 3 (T011), Phase 4 (T015) |
| `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` | Phase 2 (T003), Phase 3 (T008), Phase 4 (T013) |
| `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` | Phase 4 (T017) |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | Phase 4 (T018) |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` | Phase 4 (T014) |
| `frontend/plugins/practice-view-plugin/*.css` (metro-btn styles) | Phase 4 (T016) |
| `frontend/e2e/tempo.spec.ts` (new file) | Phase 3 (T012), Phase 5 (T023) |
| `frontend/e2e/metronome.spec.ts` | Phase 4 (T019, T020) |
| `FEATURES.md` | Phase 6 (T024) |

---

## Parallel Execution Examples

### Parallel Example: Phase 2 (Foundational)

```bash
# Both can run simultaneously (different test files):
# Agent A: T002 — write failing tests in playbackToolbar.test.tsx
# Agent B: T003 — write failing tests in practiceToolbar.test.tsx

# Then (both need T002/T003 to be RED first):
# Agent A: T004 — fix playbackToolbar.tsx
# Agent B: T005 — fix practiceToolbar.tsx
```

### Parallel Example: Phase 3 + Phase 4 (Both P1 Stories)

```bash
# After Phase 2 is complete, both stories can be worked simultaneously:
# Stream A — US1 (Tempo min 10%):
#   T006 (tempoCalculations tests RED) → T009 (tempoCalculations impl) →
#   T007+T008 (toolbar tests RED) → T010+T011 (toolbar impl) → T012 (E2E)

# Stream B — US3 (Metronome deferred start):
#   T013+T014 (toolbar+integration tests RED) → T015+T016 (CSS+props) →
#   T017 (usePracticeMidi) → T018 (PracticeViewPlugin) → T019+T020 (E2E)
```

### Parallel Example: Phase 4 test tasks

```bash
# T013 and T014 can be written simultaneously (different files):
# T013 → practiceToolbar.test.tsx
# T014 → PracticeViewPlugin.test.tsx
```

---

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1 — 10% tempo min) = independently shippable.

- Phase 3 (US1) delivers the most-requested practice improvement (slow-practice range) with no risk to metronome behaviour
- Phase 4 (US3) is independently executable in parallel with US1; both are P1 priority
- Phase 5 (US2) requires only validation tasks (200% max already existed) — lowest risk
- Phase 6 (Polish) is additive only; no production risk

**TDD reminder** (Principle V — NON-NEGOTIABLE):  
For every numbered test task, the tests MUST be committed while still RED. Only then should the corresponding implementation task begin.
