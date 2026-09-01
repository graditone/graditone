# Tasks: Live Timing Feedback Overlay

**Input**: Design documents from `/specs/096-timing-feedback-overlay/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/timing-feedback-contract.md, quickstart.md

**Tests**: The spec and the constitution (Principle V, Test-First NON-NEGOTIABLE) require tests for the overlay rendering and lifecycle. Test tasks are included and MUST be written to fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Path Conventions

- Web app: `frontend/`, under the feature worktree `/Users/alvaro.delcastillo/devel/graditone/.worktrees/095-state-timing-ms/`
- Feature 095 code required: `frontend/plugins/practice-view-plugin/stateLabel.ts` (`formatStateLabel`) already exists in this worktree
- Primary change sites: `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`, `.css`, + new `TimingFeedbackOverlay.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and the 095 dependency

- [x] T001 Verify worktree `/Users/alvaro.delcastillo/devel/graditone/.worktrees/095-state-timing-ms/` on branch `095-state-timing-ms` and that `frontend/plugins/practice-view-plugin/stateLabel.ts` exists (exports `formatStateLabel`) — the 095 label source this feature reuses
- [x] T002 [P] Confirm frontend harness: `node_modules` present in `frontend/`, `npx vitest run plugins/practice-view-plugin` passes on the current checkout (baseline)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pin down the trigger/render model

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Confirm the noteResults-watch model: study the existing `auto-advanced` flash effect in `PracticeViewPlugin.tsx` (lines 352-367) — an effect observing the last element of `practiceState.noteResults` drives a transient UI with a `setTimeout` ref (`errorFlashTimerRef`); confirm the same pattern can drive the timing overlay (note the `errorFlashTimerRef` declaration at line 150). Record that the overlay must NOT use `errorNoteIds`/`setErrorNoteIds` (reserved for the red wrong-pitch flash).
- [x] T004 [P] Inventory theme tokens: confirm `--ls-accent`, `--ls-success` are declared on `body[data-landing-theme]` in `frontend/src/themes/landing-themes.css` (lines ~43-149, several theme variants) and that `body[data-landing-theme]` is always set by `frontend/src/App.tsx` (line 116); confirm `--color-danger` fallback used elsewhere (`PracticeViewPlugin.css:85`). Record that the overlay must use these vars with fallbacks (FR-002/SC-006).

**Checkpoint**: Foundation confirmed — implementation can begin

---

## Phase 3: User Story 1 - Live ±ms overlay on out-of-time notes (Priority: P1) 🎯 MVP

**Goal**: During a live score-based practice, a large theme-styled `±ms` overlay flashes on each out-of-time note, fading in and out within ~1s, updating in place on rapid misses, and never appearing for correct/wrong notes, replay, free practice, or the results stage.

**Independent Test**: Component test renders `TimingFeedbackOverlay` with `correct-late`/`early-release` values; integration test drives a live session and asserts the overlay appears then auto-dismisses.

### Tests for User Story 1 (test-first — MUST fail before implementation) ⚠️

- [x] T005 [P] [US1] Create `frontend/plugins/practice-view-plugin/TimingFeedbackOverlay.test.tsx`: import the component (does not exist yet — test fails until T007); assert (a) `value='+120 ms'` → text `+120 ms` visible, (b) `value='-80 ms'` → `-80 ms`, (c) `visible=false` → no overlay element
- [x] T006 [P] [US1] Add integration tests to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`: (a) drive a session with an out-of-time note → `.practice-plugin__timing-overlay` appears with the signed ms text; (b) after fake-timer advance past dismissal → overlay removed; (c) `correct` note → no overlay element; (d) wrong-pitch attempt → no overlay; (e) rapid two out-of-time results → single overlay showing latest text

### Implementation for User Story 1

- [x] T007 [US1] Create `frontend/plugins/practice-view-plugin/TimingFeedbackOverlay.tsx`: `export function TimingFeedbackOverlay({ value, visible, ariaLabel }: { value: string; visible: boolean; ariaLabel?: string })` rendering (when `visible`) a `div.practice-plugin__timing-overlay` with `pointerEvents: none`, `aria-live="polite"`, containing a `span.practice-plugin__timing-overlay-value` with the value text (contract `contracts/timing-feedback-contract.md`)
- [x] T008 [US1] Add classes to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css`: `.practice-plugin__timing-overlay` (absolute, top-center over the score area, `pointer-events: none`, opacity/transform transitions: fade-in ~120ms via a `.practice-plugin__timing-overlay--show` state, hold ~700ms, fade-out ~180ms) and `.practice-plugin__timing-overlay-value` (large display type ≥4rem, `font-weight: bold`, `color: var(--ls-accent, var(--color-danger, #F57F17))`)
- [x] T009 [US1] Wire the trigger into `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: add state `timingFeedback` (`{ value: string; id: number } | null`) + a `timingFeedbackTimerRef` (setTimeout, cleared on unmount); add an effect watching `practiceState.noteResults` last element — when `outcome` is `correct-late` or `early-release`, AND NOT `isReplaying`, AND NOT `freePractice.isFreePractice`, AND `!resultsOverlayVisible`, set `timingFeedback` to `{ value: formatStateLabel(last.relativeDeltaMs), id }` and (re)start the dismissal timer (~1s → clear back to null). Import `formatStateLabel` from `./stateLabel`
- [x] T010 [US1] Render the overlay in `PracticeViewPlugin.tsx` inside the root `div.practice-plugin` (near the score area, ~line 885 block): `{timingFeedback && !isReplaying && !freePractice.isFreePractice && !resultsOverlayVisible && (<TimingFeedbackOverlay value={timingFeedback.value} visible={fading?} ... />)}` — honour a brief fade-out on dismiss per contract (component may manage the opacity state internally via `visible`)
- [x] T011 [US1] Run `npx vitest run plugins/practice-view-plugin` in `frontend/` — all tests pass including T005/T006

**Checkpoint**: User Story 1 fully functional — live out-of-time notes flash the ±ms overlay with fade

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety, lint, typecheck, docs, quickstart validation

- [x] T012 [P] Run the full frontend unit suite (`npx vitest run` in `frontend/`) and confirm zero regressions
- [x] T013 [P] Run `npx eslint` on changed files (`TimingFeedbackOverlay.tsx`, `TimingFeedbackOverlay.test.tsx`, `PracticeViewPlugin.tsx`, `PracticeViewPlugin.test.tsx`) and `npx tsc -b`; fix any findings
- [x] T014 Run quickstart validation VS-01–VS-04 (automated) and record outcomes; note VS-05/06 as manual theme/feel checks
- [x] T015 Update `FEATURES.md` Practice View plugin bullet to document the live timing-feedback overlay (Feature 096)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — the MVP
- **Polish (Phase 4)**: Depends on US1 complete

### Within the Story

- Tests (T005/T006) MUST fail before implementation
- Component (T007) before CSS (T008) before wiring (T009/T010)
- Story complete before moving to Polish

### Parallel Opportunities

- T002 [P] with T001
- T003 [P] with T004
- T005 [P] with T006 (different test files)
- T012/T013 [P] within Polish
- US1/Polish are sequential at a phase level

---

## Parallel Example: User Story 1

```bash
# Launch both test tasks together (both must FAIL first):
Task: "Write TimingFeedbackOverlay.test.tsx (component) in frontend/plugins/practice-view-plugin/"
Task: "Write overlay integration tests in frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx"

# After the component exists, wire + style + integrate:
Task: "Create TimingFeedbackOverlay.tsx"
Task: "Add overlay CSS classes in PracticeViewPlugin.css"
Task: "Wire the trigger effect and render in PracticeViewPlugin.tsx"
```

---

## Bug Fixes and Regression Prevention

**Purpose**: Document bugs discovered and ensure they never recur

**Constitution Requirement**: Principle VII (Regression Prevention) REQUIRES a test that reproduces the error BEFORE implementing the fix.

No bugs recorded yet. If one is discovered during implementation, follow the template below:

- [ ] [BUG] Document error: [Brief description]
  - **Symptom**: [What went wrong]
  - **Root Cause**: [Why it happened]
  - **Affected Area**: [Where it occurred]

- [ ] [BUG] Create regression test that reproduces the error in `frontend/plugins/practice-view-plugin/*.test.tsx`
  - **CRITICAL**: Test MUST fail before fix is applied

- [ ] [BUG] Implement fix in `frontend/plugins/practice-view-plugin/*.ts(x)` and verify the regression test passes

- [ ] [BUG] Verify all existing tests still pass (`npx vitest run` in `frontend/`)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1 (T005-T011)
4. **STOP and VALIDATE**: test US1 independently (component + integration + quickstart VS-01..04)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → test independently → deploy/demo (MVP)
3. Polish (T012-T015) before merge

### Parallel Team Strategy

Single-component feature; parallel work is limited to the [P]-marked test/verification tasks within phases. Implementation tasks are sequential (same files).

---

## Notes

- Work only inside the feature worktree; never modify the primary tree.
- The overlay is presentation-only: no storage, no engine changes, no i18n key additions (numeric + "ms").
- Reuse `formatStateLabel` from 095 — single label source shared with the report.
- Do NOT touch the `errorNoteIds` wrong-pitch red flash (existing behaviour).
- Commit after each task or logical group.
- Verify tests fail before implementing (T005/T006).