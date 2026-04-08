# Tasks: E2E Test Coverage Review

**Feature**: `076-review-e2e-tests`  
**Input**: Design documents from `/specs/076-review-e2e-tests/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

---

## Phase 1: Setup

**Purpose**: Shared infrastructure required before any user story work.

- [X] T001 Record baseline CI e2e timing run and commit duration to `frontend/e2e/AUDIT.md` (create file with Baseline section — see data-model.md §2) *Run: `cd frontend && time npx playwright test --workers=1`*
- [X] T002 [P] Create `frontend/e2e/fixtures/` directory and add `frontend/e2e/fixtures/webMidiMock.ts` (exports `buildNoMidiScript()` and `buildMidiConnectedScript(name?)` as inline JS strings for use with `page.addInitScript()`)

---

## Phase 2: Foundational

**Purpose**: Infrastructure that must exist before individual user stories can be implemented independently.

**⚠️ CRITICAL**: T001 (AUDIT.md baseline) must be committed before any test file is deleted or added.

- [X] T003 Add `data-testid="practice-plugin-root"` to the root `<div>` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (aligns with project convention; required by US1 tests)

**Checkpoint**: Baseline recorded, webMidiMock fixture created, practice plugin testid added — US1, US2, US3 can now begin.

---

## Phase 3: User Story 1 — Practice Plugin E2E Smoke Coverage (Priority: P1) 🎯 MVP

**Goal**: 4 passing e2e scenarios covering the `practice-view-plugin` primary user journeys without a MIDI device — launch from landing, score pre-selection, back navigation, console cleanliness, and no-MIDI notice.

**Independent Test**: `cd frontend && PLAYWRIGHT_TEST=1 npx playwright test e2e/practice-view-plugin.spec.ts` — all 4 tests pass without a physical MIDI device.

### Implementation for User Story 1

- [X] T004 [US1] Create `frontend/e2e/practice-view-plugin.spec.ts` with 4 test cases:
  - **SC-001** `Practice button is visible on the landing screen` — `page.getByRole('button', { name: /practice/i })` is visible
  - **SC-002** `Clicking Practice navigates to the practice plugin view` — click Practice button, assert `.practice-plugin` or `[data-testid="practice-plugin-root"]` is visible; uses `buildNoMidiScript()` in `beforeEach`
  - **SC-003** `Back button in Practice view returns to landing screen` — load a preloaded score in ScoreSelector, assert practice main view renders, click toolbar back button (aria-label `back`), assert landing screen restored and `.practice-plugin` gone
  - **SC-004** `No-MIDI notice shown when practice started with no MIDI device` — after score loaded, click Practice/Start button (`.practice-plugin__toolbar-btn--practice`), assert `[role="alert"].practice-plugin__no-midi-notice` is visible

**Checkpoint**: `practice-view-plugin.spec.ts` passes in CI — US1 complete and independently verifiable.

---

## Phase 4: User Story 2 — E2E Test Audit and Rationalisation (Priority: P2)

**Goal**: All 65 existing test cases classified (KEEP / CONVERT / REMOVE) in `frontend/e2e/AUDIT.md`; 4 CONVERT e2e files replaced by Rust/unit equivalents and deleted.

**Independent Test**: `cd frontend && PLAYWRIGHT_TEST=1 npx playwright test` — suite passes; 4 spec files no longer exist; `AUDIT.md` has 100% coverage of original 65 tests; Rust `cargo test` includes new layout regression tests.

### Implementation for User Story 2

- [X] T005 [P] [US2] Complete `frontend/e2e/AUDIT.md` with full classification table: add all 65 test cases under `### KEEP (57 tests)` and `### CONVERT (8 tests)` sections per the classification in `research.md §R-001`; include `migration_target` column for CONVERT rows
- [X] T006 [P] [US2] Write Rust backend unit test for `nocturne-m2-staccato` CONVERT: in `backend/tests/` (or existing `nocturne` test module), assert `notation_dots[*].y < notehead.y` for M2 LH staff in Nocturne Op.9 No.2 layout output — run `cargo test` to verify it passes
- [X] T007 [P] [US2] Write Rust backend unit test for `nocturne-m29-m37` CONVERT: assert glyph char code `U+E264` (double flat) present and 8va bracket field populated in M29–M37 layout output — run `cargo test` to verify it passes
- [X] T008 [P] [US2] Write Rust backend unit test for `nocturne-m36-stem` CONVERT: assert `stem_up: true` for notes 8–15 of M36 in Nocturne layout output — run `cargo test` to verify it passes
- [X] T009 [US2] Write frontend unit test for `m21-flat-check` CONVERT: in `frontend/src/` (closest test file to `convertScoreToLayoutFormat`, e.g. `frontend/src/components/` or `frontend/src/services/`), assert that given a mock `LayoutJSON` with `has_explicit_accidental: true` on a note, `convertScoreToLayoutFormat()` preserves the field in the WASM input — run `npx vitest run` to verify it passes
- [X] T010 [US2] Delete the 4 CONVERT e2e spec files after confirming their replacement tests pass:
  - `frontend/e2e/nocturne-m2-staccato-verify.spec.ts`
  - `frontend/e2e/nocturne-m29-m37-layout.spec.ts`
  - `frontend/e2e/nocturne-m36-stem-verify.spec.ts`
  - `frontend/e2e/m21-flat-check.spec.ts`
- [X] T011 [US2] Run the full e2e suite after deletions and confirm all remaining tests pass and total runtime does not exceed baseline recorded in `AUDIT.md`: `cd frontend && PLAYWRIGHT_TEST=1 npx playwright test`

**Checkpoint**: AUDIT.md complete, 4 deletions done with replacement coverage confirmed, suite still green — US2 complete.

---

## Phase 5: User Story 3 — E2E Approach for External Plugins (Priority: P3)

**Goal**: Both `sessions-plugin` and `virtual-keyboard-pro` have passing e2e smoke tests in their own `e2e/` directories; the e2e approach doc is published to `docs/`.

**Independent Test**: From each plugin directory — `npm run build && npx playwright test --config=e2e/playwright.config.ts` — smoke tests pass. Approach doc readable at `docs/e2e-external-plugins.md`.

### Implementation for User Story 3

- [X] T012 [P] [US3] Create `plugins-external/sessions-plugin/e2e/playwright.config.ts` using the template from `contracts/external-plugin-e2e-approach.md` — `baseURL: 'http://localhost:5174'`, `reuseExistingServer: true`, `workers: 1`
- [X] T013 [P] [US3] Create `plugins-external/virtual-keyboard-pro/e2e/playwright.config.ts` using the same template
- [X] T014 [US3] Create `plugins-external/sessions-plugin/e2e/sessions-plugin.smoke.spec.ts` with 2 test cases:
  - Sessions is a built-in core plugin — no IndexedDB seeding required
  - **Test 1**: `plugin panel renders without critical errors` — click Sessions launch button, assert `.sessions-plugin` visible, no console errors
  - **Test 2**: `back navigation returns to landing screen` — click back button in sessions toolbar, assert landing screen visible
- [X] T015 [US3] Create `plugins-external/virtual-keyboard-pro/e2e/virtual-keyboard-pro.smoke.spec.ts` with 2 test cases using the IndexedDB seeding pattern:
  - Inject no-MIDI mock before `page.goto()` (VKP uses MIDI); seed IndexedDB with VKP manifest + dist/index.js
  - **Test 1**: `plugin panel renders without critical errors` — click Virtual Keyboard Pro nav button, assert `.virtual-keyboard-pro` visible, no console errors
  - **Test 2**: `back navigation returns to landing screen`
- [X] T016 [US3] Add `"test:e2e": "npm run build && npx playwright test --config=e2e/playwright.config.ts"` script to `plugins-external/sessions-plugin/package.json`
- [X] T017 [P] [US3] Add `"test:e2e": "npm run build && npx playwright test --config=e2e/playwright.config.ts"` script to `plugins-external/virtual-keyboard-pro/package.json`
- [X] T018 [US3] Run `npm run test:e2e` in both plugin directories and confirm both smoke suites pass
- [X] T019 [P] [US3] Publish the e2e approach guide: copy `specs/076-review-e2e-tests/contracts/external-plugin-e2e-approach.md` to `docs/e2e-external-plugins.md` (or symlink if repo convention prefers symlinks)

**Checkpoint**: Both plugin smoke suites pass, `docs/e2e-external-plugins.md` exists — US3 complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification and final CI validation.

- [X] T020 [P] Update `FEATURES.md` to note that `practice-view-plugin` now has e2e coverage and e2e approach is documented for external plugins
- [X] T021 [P] Update `docs/` or `README.md` if any existing e2e instructions reference the 4 deleted spec files
- [X] T022 Run the full validation from `quickstart.md`: core e2e suite + both plugin smoke suites pass; total e2e count verified in `AUDIT.md`
- [X] T023 [P] Mark spec complete: update `specs/076-review-e2e-tests/spec.md` status from `Draft` to `Complete`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — T003 can run in parallel with T001/T002
- **US1 (Phase 3)**: Depends on T002 (webMidiMock fixture) and T003 (practice-plugin-root testid)
- **US2 (Phase 4)**: Depends on T001 (AUDIT.md baseline must be committed first); CONVERT replacement tests (T006–T009) can run in parallel; T010 (deletions) depends on T006–T009 all passing
- **US3 (Phase 5)**: Depends on T002 (webMidiMock fixture); T012–T013 and T016–T017 can run in parallel; T014–T015 depend on T012–T013 respectively; T018 depends on T014–T017
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — independently deliverable as MVP
- **US2 (P2)**: Depends on Foundational only — CONVERT targets (T006–T009) run in parallel with US1
- **US3 (P3)**: Depends on T002 (webMidiMock) — can run in parallel with US1 and US2

### Parallel Execution Examples

**US1 + US2 simultaneously**:
- Thread A: T004 (practice-view-plugin.spec.ts)
- Thread B: T005 (AUDIT.md) + T006 + T007 + T008 + T009 (CONVERT replacements, all parallel)
- Merge: T010 (delete CONVERT files, after T006–T009 pass) → T011 (full suite verify)

**US3 alongside US1/US2**:
- Thread C: T012 + T013 (Playwright configs, parallel) → T014 + T015 (smoke tests) → T016 + T017 (package.json scripts, parallel) → T018 → T019

---

## Implementation Strategy

**Deliver MVP first**: US1 alone satisfies the most critical gap (practice plugin has zero e2e tests). It can be completed and merged while US2 and US3 are in progress.

**US2 safeguard**: Never delete a CONVERT e2e file before its replacement passes. The order within US2 is strict: T006–T009 (write replacements) → all pass → T010 (delete) → T011 (verify).

**US3 requires built dist**: Run `npm run build` in each plugin directory before smoke tests. CI scripts use `test:e2e` which does this automatically.
