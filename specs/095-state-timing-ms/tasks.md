# Tasks: Practice Report Timing Labels

**Input**: Design documents from `/specs/095-state-timing-ms/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/status-label-contract.md, quickstart.md

**Tests**: The spec and the constitution (Principle V, Test-First NON-NEGOTIABLE) require tests for the changed rendering. Test tasks are included and MUST be written to fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/` (React PWA), under the feature worktree `/Users/alvaro.delcastillo/devel/graditone/.worktrees/095-state-timing-ms/`
- Primary change site: `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`
- Contracts: `specs/095-state-timing-ms/contracts/status-label-contract.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the isolated worktree and test environment before any change

- [x] T001 Verify the feature worktree: confirm current directory is `/Users/alvaro.delcastillo/devel/graditone/.worktrees/095-state-timing-ms/`, branch `095-state-timing-ms` (run `git branch --show-current`), and working tree is clean
- [x] T002 [P] Confirm frontend test/lint tooling in `frontend/package.json`: `test` = `vitest`, `lint` = `eslint .`; verify `node_modules` present (run `npm test -- --run practice-view-plugin` once to confirm the harness works on an unmodified checkout)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the change surface is exactly one render site shared by live and saved reports

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Confirm single render site: verify the State column cell at `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` (lines 378-389) is the ONLY place rendering per-note state labels for the notes table; confirm both live (`practiceState.noteResults`) and saved (`performanceRecord.noteResults`) records resolve through the same `practiceReport.results` path (lines 209-211). Grep `practice.results.status` and `outcome ===` across `frontend/plugins/` and record that the Train overlay uses separate keys (`train.results.status_*`) and is out of scope.
- [x] T004 [P] Inventory strings touched by the change: hardcoded `'Held too short'` at `ResultsOverlay.tsx:387`; i18n keys `practice.results.off_beat` (`frontend/src/i18n/locales/en.json`
:314, `es.json`:313). Note: keys MUST NOT be deleted (backward safety); the hardcoded string is superseded by the ms label. Record findings in the branch notes/PR description.

**Checkpoint**: Foundation confirmed — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Out-of-time State label shows signed ms (Priority: P1) 🎯 MVP

**Goal**: In a completed practice's final report, the notes table State column shows the exact signed deviation in ms (`+120 ms`, `-80 ms`, `0 ms`) for out-of-time notes (`correct-late` and `early-release`), keeping the existing icon; `Correct` and `Wrong` labels are unchanged.

**Independent Test**: Component test renders the complete overlay with an injected `correct-late` note (`relativeDeltaMs=120`) and asserts the State cell shows `+120 ms`; manual scenario VS-04 in `quickstart.md`.

### Tests for User Story 1 (test-first — MUST fail before implementation) ⚠️

- [x] T005 [P] [US1] Unit tests for the new formatter in `frontend/plugins/practice-view-plugin/stateLabel.test.ts`: `formatStateLabel(120) === '+120 ms'`, `formatStateLabel(-80) === '-80 ms'`, `formatStateLabel(0) === '0 ms'` (imports a module that does not exist yet — the test fails until T007)
- [x] T006 [P] [US1] Component tests in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx` (extend `makeCompleteOverlayProps`): complete overlay with `noteResults` containing (a) `correct-late` / `relativeDeltaMs: 120` → State cell text `+120 ms` with ⏱️ icon, (b) `early-release` / `relativeDeltaMs: -80` → `-80 ms` with ⏱️ icon, (c) `correct-late` / `relativeDeltaMs: 0` → `0 ms`, (d) `correct` → text `Correct`, (e) `wrong` → text `Wrong`

### Implementation for User Story 1

- [x] T007 [US1] Create `frontend/plugins/practice-view-plugin/stateLabel.ts` exporting `formatStateLabel(relativeDeltaMs: number): string` implementing the contract in `specs/095-state-timing-ms/contracts/status-label-contract.md`: `> 0` → `+{n} ms`; `< 0` → `-{n} ms`; `=== 0` → `0 ms`
- [x] T008 [US1] Wire the formatter into the State cell in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` (lines 378-389): for `correct-late` and `early-release` render the existing icon (`practice-results__status-icon`) followed by `formatStateLabel(r.relativeDeltaMs)`; keep `✅ Correct` for `correct` and `❌ Wrong` for other outcomes; leave the Timing Δ column (lines 391-395) untouched
- [x] T009 [US1] Update regression guards in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` (T030 lines 1174-1265, T030b lines 1220-1275): the removed "Held too short" wording checks must be replaced with assertions on the new ms label (`+{n} ms`) for `early-release` rows; keep all other practice-engine assertions unchanged
- [x] T010 [US1] Run `npm test -- --run practice-view-plugin` in `frontend/` — all plugin tests pass, including T005/T006 now green

**Checkpoint**: User Story 1 fully functional — live completed report shows signed ms in the State column

---

## Phase 4: User Story 2 - Same deviation labels when reviewing a saved practice (Priority: P2)

**Goal**: A report restored from a saved practice renders State labels identical to the live report.

**Independent Test**: Component test renders the complete overlay from the saved-record path (`practiceState.mode === 'inactive'` with `performanceRecord` set — line 261) and asserts the ms label; manual scenario VS-05 in `quickstart.md`.

### Tests for User Story 2 (test-first — MUST fail if the saved path diverges) ⚠️

- [x] T011 [P] [US2] Component test in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`: render complete overlay with `practiceState.mode: 'inactive'` + `performanceRecord.noteResults` containing `correct-late` / `relativeDeltaMs: 120` — assert the State cell shows `+120 ms` (this exercises the saved-record branch; if it fails, the saved path is diverging from live)

### Implementation for User Story 2

- [x] T012 [US2] (no code change required — T011 passed on first run, confirming the shared render site) If T011 exposed divergence between live and saved rendering, fix the data resolution in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` (lines 206-226) so `practiceReport.results` carries identical `PracticeNoteResult` values for both paths; if T011 passes on first run, record that no code change is required (US1 wiring already covers the shared render site)
- [ ] T013 [US2] Manual verification (quickstart VS-05): save the practice from US1, reload it from the saved-practices list, open the report, and confirm the State column labels match the live report exactly

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety, lint, and documentation currency (Constitution: Documentation Currency)

- [x] T014 [P] Run the full frontend unit suite (`npm test -- --run` in `frontend/`) and confirm zero regressions — specifically the report's score block, summary stats, time comparison, delay graph, and Timing Δ column remain unchanged (spec FR-009)
- [x] T015 [P] Run `npm run lint` in `frontend/` on the changed files (`ResultsOverlay.tsx`, `ResultsOverlay.test.tsx`, `stateLabel.ts`, `stateLabel.test.ts`, `PracticeViewPlugin.test.tsx`) and fix any findings
- [x] T016 Update the Practice View plugin bullet in `FEATURES.md` (line 81) to document that the final report's per-note State column shows the signed timing deviation in ms for out-of-time notes
- [x] T017 Run the quickstart validation scenarios VS-01 through VS-06 in `frontend/` (and manually for VS-04/05/06) and record outcomes in this spec's branch notes. Outcome: VS-01/02/03 automated and PASSING (82 tests: stateLabel unit + State-cell component + T030/T030b regression). VS-04/05/06 remain manual browser checks for the user (live report, saved report, tablet width).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — the MVP
- **User Story 2 (Phase 4)**: Depends on Foundational and involves the same render site as US1; implement after US1 (sequential, not parallel) because US2's saved-path branch resolution is only meaningful once the live path is wired
- **Polish (Phase 5)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — complete MVP on its own
- **User Story 2 (P2)**: Reuses US1's wiring via the shared `practiceReport.results` render path; independently testable via the saved-record branch (T011)

### Within Each User Story

- Tests (marked in the phases above) MUST be written and FAIL before implementation
- Formatter module (T007) before wiring (T008)
- Component wiring before regression-guard updates
- Story complete before moving to the next phase

### Parallel Opportunities

- T002 and T001 can run in parallel
- T003 and T004 (Foundational) are independent — both mark [P]
- Within US1, T005 and T006 are independent (different test files)
- T014, T015, T016 are independent within Polish
- US1 and US2 are intentionally sequential (shared render site) — do NOT run in parallel to avoid same-file conflicts on `ResultsOverlay.test.tsx`

---

## Parallel Example: User Story 1

```bash
# Launch the two test tasks for User Story 1 together (both must FAIL first):
Task: "Write unit tests for formatStateLabel in frontend/plugins/practice-view-plugin/stateLabel.test.ts"
Task: "Write component tests for the State column labels in frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx"

# After the formatter module exists, wire it and update regression guards:
Task: "Create frontend/plugins/practice-view-plugin/stateLabel.ts"
Task: "Wire formatStateLabel into the State cell in frontend/plugins/practice-view-plugin/ResultsOverlay.tsx"
```

---

## Bug Fixes and Regression Prevention

**Purpose**: Document bugs discovered and ensure they never recur

**Constitution Requirement**: Principle VII (Regression Prevention) REQUIRES creating a test that reproduces the error BEFORE implementing the fix.

No bugs recorded yet. If one is discovered during implementation (e.g., the saved-path branch at ResultsOverlay.tsx:261 producing different labels than live), follow the template below:

- [ ] [BUG] Document error: [Brief description]
  - **Symptom**: [What went wrong]
  - **Root Cause**: [Why it happened]
  - **Affected Area**: [e.g., "Unit tests", "ResultsOverlay saved-path branch"]

- [ ] [BUG] Create regression test that reproduces the error (e.g., add a saved-path case in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`)
  - **CRITICAL**: Test MUST fail before fix is applied

- [ ] [BUG] Implement fix in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` and verify the regression test passes

- [ ] [BUG] Verify all existing tests still pass (`npm test -- --run` in `frontend/`)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (T005-T010)
4. **STOP and VALIDATE**: Test User Story 1 independently (component tests + quickstart VS-04)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently (T011/T013) → Deploy/Demo
4. Complete Polish (T014-T017) before merge

### Parallel Team Strategy

This feature is a single-component change. It is small enough for one implementer; parallel work applies only to the [P]-marked test/verification tasks within a phase.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to the spec user story for traceability
- The spec's two user stories share one render site; US1 is the complete MVP — US2 is verification of the saved path
- No i18n key deletions: `practice.results.off_beat` stays defined (backward safety); the hardcoded `'Held too short'` string is superseded
- Work only inside the feature worktree; never modify the primary working tree
- Commit after each task or logical group
- Verify tests fail before implementing (T005/T006/T011)