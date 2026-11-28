# Tasks: Rapid Demo Flow Generation from a Goal

**Feature Branch**: `102-demo-flow-generation`
**Input**: Design documents from `/specs/102-demo-flow-generation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included. The project constitution (Principle V) and `plan.md` require test-first development for the index builder, lookup, flow assembly, generation report, the annotation guard, and the CLI tools. Every test task below is written before the implementation task it covers; regression coverage protects the two existing flows.

**Organization**: Tasks are grouped by user story so each story has its own goal, independent test, implementation slice, and checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with the other tasks in the same group (different files, no dependency on an incomplete peer task).
- **[Story]**: `[US1]`, `[US2]`, or `[US3]`; setup, foundational, and polish tasks have no story label.
- Every task includes an exact file path in backticks.

## Path Conventions

This feature spans the demo harness and the app's markup. All paths are relative to the repository root:

- Harness/tooling: `demos/src/` (new: `catalog/`, `generate/`, `tools/`), `demos/package.json`, `demos/catalog/` (generated)
- App annotations: `frontend/src/components/`, `frontend/src/components/plugins/`, `frontend/plugins/play-score/`, `frontend/src/i18n/locales/`, `frontend/e2e/`, `frontend/scripts/`
- Workflow doc: `.agents/skills/graditone-demo-authoring/`
- Documentation: `specs/102-demo-flow-generation/`, `demos/README.md`, `FEATURES.md`, `DEBT.md`
- No Rust/WASM, backend, database, or new storage key is touched.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing toolchains and create the new harness directories and scripts. No runtime dependency is added.

- [X] T001 Establish the pre-change baseline: from `demos/` run `npm ci` and `npm run typecheck`; from `frontend/` run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test -- --run`; record any pre-existing failures here. Paths: `demos/package.json`, `frontend/package.json`.
  - Do not add a runtime dependency; the harness uses Node's built-in test runner and the existing Playwright/`yaml`.
- [X] T002 [P] Create `demos/src/catalog/` and `demos/src/generate/` directories and add `catalog:build`, `catalog:find`, and `test` scripts to `demos/package.json` (`"test": "node --test \"src/**/*.test.ts\""`). Confirm `demos/tsconfig.json` compiles the new directories. Path: `demos/package.json`.

**Checkpoint**: Baseline recorded; new directories and scripts exist; no dependency added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The derived element index, the unambiguous-only lookup, and their CLIs. Every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Define the index types — `Catalog` and `Control Index Entry` — in `demos/src/catalog/schema.ts`. Cite `data-model.md` §1–2: entry identity is a unique `Control Index Entry.id` (prefer `testid`, else `(screen, role, name)`); `Control Index Entry.source` ∈ `annotation|e2e|snapshot`; `name` and `testid` are nullable; `role` and `screen` are required non-empty; `Catalog.entries` is sorted (`screen`, `testid`, `name`); `Catalog` carries `builtAt`, `sourceRevision`, `sources`.
- [X] T004 [P] Write the failing builder tests in `demos/src/catalog/build.test.ts` (new file). Cases: testid extraction; role + `aria-label` pairing; screen attribution; duplicate-label entries retained with distinct `screen`; a control with neither testid nor name is reported as a gap, not indexed; output is sorted and byte-stable across runs. Conforms to `contracts/element-index-contract.md` §1–2.
- [X] T005 Implement `demos/src/catalog/build.ts`: scan the demo-relevant components in `frontend/src/components/`, `frontend/src/components/plugins/`, and `frontend/plugins/play-score/` for `data-testid`, `aria-label`, and `role`, and read selector patterns from `frontend/e2e/*.spec.ts`; emit the `Catalog` with `sourceRevision` and `sources` counts. Depends on T003–T004; cites `data-model.md` §1–2.
- [X] T006 [P] Write the failing lookup tests in `demos/src/catalog/lookup.test.ts` (new file). Cases: exact `testid` hit resolves; `role`+`name` hit resolves; no match returns empty `entry`, non-empty nearest `candidates`, reason `missing`; two same-name controls on different screens return `resolved: false`, reason `ambiguous`, both candidates; `--screen` narrows to one and resolves. Conforms to `contracts/element-index-contract.md` §3.
- [X] T007 Implement `demos/src/catalog/lookup.ts`: return ranked candidates and set `resolved` to `true` only when exactly one entry matches after any `--screen` filter. Cite `data-model.md` `Element Binding.resolved` (true ⟺ exactly one match) and `Element Binding.reason` ∈ `missing|ambiguous|name-only-localized`. Depends on T003, T005–T006.
- [X] T008 Implement the CLI tools `demos/src/tools/build-index.ts` and `demos/src/tools/find-element.ts`; `find-element` prints the lookup JSON and exits `0` when resolved, `1` when unresolved. Wire the `catalog:build` / `catalog:find` scripts from T002. Conforms to `contracts/element-index-contract.md` §1, §3. Depends on T005, T007.
- [X] T009 [P] Implement the optional snapshot enrichment in `demos/src/catalog/snapshot.ts`: drive the running app with the existing Playwright dependency, read its accessibility tree, and add/refresh entries with `source: 'snapshot'` for controls the static scan cannot see (research D2). Depends on T003.

**Checkpoint**: `npm run catalog:build` writes a sorted index, and `npm run catalog:find -- "raise the tempo"` resolves to `tempo-plus`, while `"press play"` is flagged ambiguous.

---

## Phase 3: User Story 1 — Get a runnable flow draft from a described goal, in seconds (Priority: P1) 🎯 MVP

**Goal**: Turn a plain-language single-plugin goal into a `demos/flows/<id>.yaml` that the existing video command accepts, using the index/lookup from Phase 2.

**Independent Test**: Supply one resolved goal, produce the flow through the documented workflow, and confirm the file parses as a `Flow`, lists via `node demos/src/run.ts --list`, and the two existing flows still list.

### Tests for User Story 1

- [X] T010 [P] [US1] Write the failing flow-assembly tests in `demos/src/generate/flow.test.ts` (new file). Cases: a resolved step set becomes a `Flow Document` with a non-colliding `id`, `title`, `description`, and ordered `steps`; a `click`/`waitFor` step without a resolved `selector` is rejected; a content wait is inserted before acting on async content; caption/hold are attached where a state change should be seen; the emitted YAML parses back through the existing `yaml` loader as `Flow`. Cite `data-model.md` `Flow Document` and `Flow Step`.

### Implementation for User Story 1

- [X] T011 [US1] Implement `demos/src/generate/flow.ts`: assemble a `Flow Document` from resolved bindings, deriving `id`/`title`/`description` from the goal and staying within the existing step vocabulary. Cite `data-model.md` `Flow Document.id` (default derived from the goal; MUST NOT collide with an existing flow, FR-012) and `Flow Step.selector` (required for every `click`/`waitFor` that targets a control, FR-005). Depends on T007, T010.
- [X] T012 [US1] Author `.agents/skills/graditone-demo-authoring/SKILL.md`: the reproducible workflow — restate the goal, resolve each phrase with `npm run catalog:find`, order steps with the required waits/captions/holds, write `demos/flows/<id>.yaml`, and hand off to `graditone-demo-videos` for capture. Depends on T008.
- [X] T013 [US1] Produce the first goal end-to-end: use the skill to generate a new single-plugin flow `demos/flows/<new-id>.yaml`, then verify `node demos/src/run.ts --list` shows it alongside `play-a-score` and `play-a-score-tempo` (regression: existing flows still list, FR-014/SC-007). Depends on T011–T012.

**Checkpoint**: A resolved goal yields a runnable flow file; the existing flows are unaffected.

---

## Phase 4: User Story 2 — Trust that each step points at a real control (Priority: P2)

**Goal**: Make every demo-relevant control self-describing (correct `role` + accessible name + stable `data-testid`) and guard that coverage, so the lookup is grounded and unresolved steps are flagged, never guessed.

**Independent Test**: Run the annotation-coverage guard and the static check; confirm every control in `contracts/annotation-contract.md` §2 resolves by role+name and carries its testid, and removing a handle makes the guard fail.

### Tests for User Story 2

- [X] T014 [P] [US2] Write the failing coverage guard `frontend/e2e/annotation-coverage.spec.ts` (new file) per `contracts/annotation-contract.md` §3: for each listed control, assert it is reachable by `getByTestId(...)`, has the expected `role` and a non-empty accessible name, and is reachable by `getByRole(role, { name })`.
- [X] T015 [P] [US2] Add the static check `frontend/scripts/check-demo-annotations.mjs` (new file) per `contracts/annotation-contract.md` §3: fail when a listed control loses its `data-testid` or its accessible-name binding.

### Implementation for User Story 2

- [X] T016 [P] [US2] Add the missing accessible-name i18n keys to `frontend/src/i18n/locales/en.json` and `es.json` per `contracts/annotation-contract.md` §2, §4; run `frontend/src/i18n/locales.test.ts` so `en`/`es` stay at parity. Depends on T014.
- [X] T017 [US2] Annotate the plugin launcher cards in `frontend/src/components/LandingScreen.tsx`: each card role `button`, accessible name = plugin title, stable `data-testid="plugin-launch-<pluginId>"`. Depends on T014.
- [X] T018 [P] [US2] Annotate the tempo widget in `frontend/src/components/TempoMetronomeControl.tsx`: `tempo-minus`/`tempo-display`/`tempo-plus` keep their testids and gain correct role + accessible names (`play_score.toolbar.tempo_decrease` / `tempo_increase`); the subdivision control exposes name matching `/metronome subdivision/i`. Depends on T016.
- [X] T019 [P] [US2] Annotate the score rows and dialog in `frontend/src/components/plugins/ScoreSelectorPlugin.tsx`: per-row stable `data-testid`, role `button`/`option`, accessible name = score title; the dialog keeps `data-testid="score-selector-dialog"` with role `dialog`. Replaces the class/`:has-text` selector the existing flows used. Depends on T016.
- [X] T020 [P] [US2] Annotate the Play Score toolbar in `frontend/plugins/play-score/playbackToolbar.tsx`: Play/Stop are role `button` with accessible names from `play_score.toolbar.play_aria` / `stop_aria`, within `[role="toolbar"]`. Depends on T016.
- [X] T021 [US2] Wire `frontend/scripts/check-demo-annotations.mjs` into the `frontend` lint/CI path, and add a regression assertion that removing a `data-testid` (or accessible name) from a listed control makes the guard fail. Depends on T014–T015, T017–T020.
- [X] T022 [US2] Verify coverage: rebuild the index (`cd demos && npm run catalog:build`) and confirm it resolves ≥95% of the demo-relevant controls in `contracts/annotation-contract.md` §2 (SC-005); record any residual `name: null` entries as annotation gaps. Depends on T005, T017–T020.

**Checkpoint**: All demo-relevant controls carry role + name + testid; the guard fails on regression; the index resolves the scope.

---

## Phase 5: User Story 3 — Keep authoring fast without producing the video (Priority: P3)

**Goal**: Emit a generation report (time, resolved/unresolved, targets) and keep authoring separate from the slow capture, so drafts can be judged at a glance and reproduced across the representative goal set.

**Independent Test**: Generate several drafts in a row with no video produced; confirm each emits a report listing resolved/unresolved steps and targets; run the existing video command on one draft to confirm capture is unchanged.

### Tests for User Story 3

- [X] T023 [P] [US3] Write the failing report tests in `demos/src/generate/report.test.ts` (new file): the report records `flowId`, `elapsedMs`, `lookupMs`, `stepsProduced`, `resolved[]`, `unresolved[]`, and `gaps[]`; every unresolved phrase appears in `gaps`; `resolved.length + unresolved.length` covers every control-interaction phrase. Cite `data-model.md` `Generation Report`.

### Implementation for User Story 3

- [X] T024 [US3] Implement `demos/src/generate/report.ts` per `data-model.md` `Generation Report`: carry `Generation Report.elapsedMs` (submission → file written, SC-001), `Generation Report.lookupMs` (deterministic lookup time, research D7), and `Generation Report.unresolved`; derive `gaps` from `name: null` entries and unresolved reasons. Depends on T007, T023.
- [X] T025 [US3] Emit the report from the generation workflow and record the two timings; confirm generation starts no capture (no `runFlow`/Playwright page from the authoring path). Depends on T011, T024.
- [X] T026 [US3] Define and run the representative goal set per `quickstart.md`: the two existing flows plus ~3 new single-plugin goals (one resolved, one wait-heavy, one with an unresolvable step); record each generation time and first-attempt outcome as SC-001/SC-002 evidence. Depends on T013, T025.
  - **Evidence (2026-11-28)** — the 4 new goals are authored and asserted by `demos/src/generate/representative.test.ts` (2 tests):
    - **Resolved** `plans/play-score-slow-down.json` → 6 resolved / 0 unresolved, 7 steps.
    - **Wait-heavy** `plans/train-a-session.json` → 3 resolved / 0 unresolved, 5 steps, includes an inserted `waitForFunction` content wait.
    - **Unresolved** `plans/settings-dark-mode.json` → 1 resolved / 2 flagged (`open the display settings`, `enable dark mode`), each listed in `gaps`; only the resolved step is written into the flow.
    - **List-then-select** `plans/play-score-third-phrase.json` → 9 resolved / 0 unresolved, 10 steps: open Play Score → show Phrases → step to the third phrase → Play. This goal drove a new annotated surface (the score-viewer phrase controls, `annotation-contract.md` §2), which the static guard now covers (`check-demo-annotations.mjs`: 5 files, 12 i18n keys).
    - `catalog:build` + `catalog:find` + `flow:author` for one goal completes in **< 0.7 s** end-to-end (lookup ~0.1 s), well under the 10 s budget (SC-001).
    - **First-attempt capture validated (2026-11-28)**: with a manual dev server on 5175 (`DEMO_BASE_URL=http://localhost:5175 DEMO_SKIP_DEMOCLIP=1 node src/run.ts play-score-tenth-phrase`) the flow ran end-to-end with **zero selector failures**, producing `demos/out/play-score-tenth-phrase.webm` (1440×900 VP9 + Opus, 20.1 s, real audio: mean −24.3 dB) — SC-002/SC-006. The built WASM engine is already in `frontend/public/wasm/`, so no WASM rebuild was needed.

**Checkpoint**: Every generation emits a judgeable report; the representative set is measured; capture is only ever the separate command.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation currency and full verification.

- [X] T027 [P] Update `demos/README.md` with the `catalog:build` / `catalog:find` commands and a pointer to the `.agents/skills/graditone-demo-authoring` workflow; add a `FEATURES.md` bullet if the accessibility change is user-visible.
- [X] T028 [P] Note in `DEBT.md` whether the annotation work or the workflow touches `demos-runner-port-detection`, and record any new follow-up debt discovered during implementation.
- [X] T029 Run full verification: `cd demos && npm run typecheck && npm test`; `cd frontend && npm run typecheck && npm run lint && npm test -- --run && npx playwright test e2e/annotation-coverage.spec.ts`; then the `quickstart.md` scenarios with the manual dev-server + `DEMO_BASE_URL` path.
  - **Result (2026-11-28)**: `demos` — `tsc --noEmit` clean, `node --test` **22/22 pass**; `catalog:build` writes 45 entries; `catalog:find` resolves/flags; `flow:author` produces a runner-compatible flow. `frontend` — `npm run typecheck` clean, `npm run lint` 0 errors, `npx vitest run` **2403 pass / 25 skipped**, `npx playwright test e2e/annotation-coverage.spec.ts` **10 pass**, regression e2e (`tempo`, `play-score-plugin`, `metronome`) **21 pass**. The `quickstart.md` capture scenario needs a built WASM engine + an audio device (see T026).
- [X] T030 Confirm the constitution gates still hold: no new runtime dependency, no Rust/WASM or backend diff, and no new profile-scoped storage key (Principle VIII). Record the confirmation here. Paths: `demos/package.json`, `frontend/package.json`, `.specify/memory/constitution.md`.

**Checkpoint**: Docs updated; all suites green; gates confirmed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational.
  - US1 (P1) can start once Phase 2 is done.
  - US2 (P2) and US3 (P3) can start after Phase 2; US3's verification (T026) also leans on US1's workflow (T013).
- **Polish (Phase 6)**: Depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 only. No dependency on US2/US3.
- **US2 (P2)**: Needs Phase 2; independently testable via the guard and the index coverage.
- **US3 (P3)**: Needs Phase 2; T026 additionally uses the US1 workflow.

### Within Each User Story

- Tests (T010, T014–T015, T023) are written and FAIL before their implementation.
- Types before builder; builder before lookup; lookup before flow/report.
- Core implementation before integration; a story is complete before the next priority.

### Parallel Opportunities

- Setup: T002 can run alongside the T001 baseline.
- Foundational: T004 and T006 (tests) in parallel; T009 (snapshot) in parallel with T005/T007.
- US2: T014, T015 in parallel; T018, T019, T020 annotate different files in parallel.
- US3: T023 in parallel with US1/US2 work.

---

## Parallel Example: User Story 2

```bash
# Guard/checks first (different files):
Task: "Write frontend/e2e/annotation-coverage.spec.ts per contracts/annotation-contract.md §3"
Task: "Add frontend/scripts/check-demo-annotations.mjs per contracts/annotation-contract.md §3"

# Then annotate the distinct surfaces together:
Task: "Annotate frontend/src/components/TempoMetronomeControl.tsx (T018)"
Task: "Annotate frontend/src/components/plugins/ScoreSelectorPlugin.tsx (T019)"
Task: "Annotate frontend/plugins/play-score/playbackToolbar.tsx (T020)"
```

---

## Independent Test Criteria Summary

| Story | Independent test |
|-------|------------------|
| US1 | One resolved goal → a `demos/flows/<id>.yaml` that parses as `Flow`, lists via `run.ts --list`, and leaves the two existing flows listing. |
| US2 | The coverage guard + static check pass for every control in `contracts/annotation-contract.md` §2, and fail when a handle is removed; the index resolves ≥95% of them. |
| US3 | Several drafts generate with no capture; each emits a report with resolved/unresolved targets; the existing video command still captures a draft unchanged. |

## Suggested MVP Scope

**User Story 1 only** (Phases 1–3): the derived index, unambiguous lookup, and flow assembly plus the documented workflow, delivering a runnable flow from a resolved goal. US2 hardens trust (annotations + guard) and US3 adds the report and measurement; both layer on without reworking US1.

## Format Validation

All 30 tasks use `- [ ] [TaskID] [P?] [Story?] Description with file path`. Story labels appear only in Phases 3–5; setup, foundational, and polish tasks carry no story label. `[P]` marks only tasks on distinct files with no incomplete dependency.

## Notes

- `[P]` tasks = different files, no dependency on an incomplete peer.
- The flow format, the runner, and the video pipeline are NOT edited by any task (FR-014); the only app change is annotation markup + a guard.
- The generation path must never start a capture; capture remains `node demos/src/run.ts <id>`.
- Regression protection: T013 (existing flows still list), T021 (guard fails on regression), T029 (full suites).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
