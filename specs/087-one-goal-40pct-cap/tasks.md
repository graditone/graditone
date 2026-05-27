# Tasks: One-Goal 40% Session Time Cap

**Input**: Design documents from `/specs/087-one-goal-40pct-cap/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · quickstart.md ✅
**Branch**: `087-one-goal-40pct-cap`
**Plugin repo**: `plugins-external/sessions-plugin/` (clone into worktree before starting — see quickstart.md)

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Owning user story — [US1], [US2], [US3]
- All paths are relative to `plugins-external/sessions-plugin/` unless noted

---

## Phase 1: Setup

**Purpose**: Clone external plugin repo into worktree and create feature branch.

- [X] T001 Clone `graditone-pro-plugins` into `plugins-external/` and checkout branch `087-one-goal-40pct-cap` per quickstart.md §Prerequisites

---

## Phase 2: Foundational — Type & Interface Changes

**Purpose**: Add new types (`GoalPhraseGroup`, `DistributedSession.goalIds`, `Session.goalIds`, `SessionIndexEntry.goalIds`) that all three user stories depend on. These compile-level changes must land before any implementation or test tasks.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `GoalPhraseGroup` interface extending `PhraseGroup` with `goalId: string` to `sessionDistribution.ts`
- [X] T003 Add `goalIds?: string[]` field to `DistributedSession` interface in `sessionDistribution.ts`
- [X] T004 [P] Add `readonly goalIds?: readonly string[]` field to `Session` interface in `sessionTypes.ts`
- [X] T005 [P] Add `goalIds?: string[]` field to `SessionIndexEntry` interface in `sessionTypes.ts`

**Checkpoint**: TypeScript types compile with no errors — all downstream tasks can begin.

---

## Phase 3: User Story 1 — Balanced Session from Multiple Goals (Priority: P1) 🎯 MVP

**Goal**: When 2+ active `learn-score-phrase` goals exist, no single goal contributes more than 40% of available session time per session.

**Independent Test**: Create 3 active goals with different task volumes, trigger session generation, verify no goal exceeds 40% of `totalEstimatedDurationSecs` in any session. All three goals appear across the sessions.

### Tests for User Story 1

> **Write these tests FIRST — verify they FAIL before implementing T012 / T013**

- [X] T006 [P] [US1] Add `distributeMultiGoalTasks` test: two goals, each capped at 40% of `availableTime` per session — in `sessionDistribution.test.ts`
- [X] T007 [P] [US1] Add `distributeMultiGoalTasks` test: oversized first phrase group of a goal is always admitted (best-effort, FR-005) — in `sessionDistribution.test.ts`
- [X] T008 [P] [US1] Add `distributeMultiGoalTasks` test: three goals simultaneously balanced in a session (each ≤ 40%) — in `sessionDistribution.test.ts`
- [X] T009 [P] [US1] Add `distributeMultiGoalTasks` test: `DistributedSession.goalIds` is populated with the correct goal IDs per session; **also assert that when two goals reference different scores, every session spanning both scores carries a composite `name` equal to the sorted score titles joined by `' · '`** — in `sessionDistribution.test.ts` (reopened — BUG-002: test never asserted composite session title; naming defect passed undetected)
- [X] T010 [P] [US1] Add `distributeMultiGoalTasks` test: zero-duration tasks (no `estimatedDurationSecs`) do not consume any goal budget and are placed freely — in `sessionDistribution.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implement `distributeMultiGoalTasks(groups: GoalPhraseGroup[], availableTime: number): DistributedSession[]` in `sessionDistribution.ts` — greedy round-robin algorithm with per-goal FIFO queues and `goalBudget = availableTime * 0.4` (see research.md Q4 and data-model.md §5)
- [X] T012 [US1] Export `GOAL_CAP_FRACTION = 0.4` constant from `sessionDistribution.ts` (used in `distributeMultiGoalTasks` and exposed for tests)

**Checkpoint**: All T006–T010 tests pass. `distributeMultiGoalTasks` correctly limits each goal to 40% per session.

---

## Phase 4: User Story 2 — Single-Goal Session Is Unaffected (Priority: P2)

**Goal**: A student with exactly one active goal continues to receive sessions that use up to 100% of available time; the 40% cap is not applied.

**Independent Test**: With only one active goal, generate a session and verify tasks fill up to `availableTime` with no artificial cutoff. Task count and duration coverage matches pre-feature baseline.

### Tests for User Story 2

> **Write these tests FIRST — verify they FAIL before implementing T017**

- [X] T013 [P] [US2] Add `distributeMultiGoalTasks` test: single-goal input delegates to existing `distributeTasks()` behaviour — sessions use up to 100% of `availableTime` — in `sessionDistribution.test.ts`
- [X] T014 [P] [US2] Add `distributeMultiGoalTasks` test: unlimited mode (`availableTime = 0`) places all tasks in one session regardless of goal count — in `sessionDistribution.test.ts`
- [X] T015 [P] [US2] Add regression test: existing `distributeTasks()` call contract is unchanged (existing test suite still passes) — in `sessionDistribution.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Add single-goal fast path inside `distributeMultiGoalTasks`: when only one distinct `goalId` is present in `groups`, delegate to `distributeTasks()` and annotate result with `goalIds` — in `sessionDistribution.ts`
- [X] T017 [US2] Add unlimited fast path inside `distributeMultiGoalTasks`: when `availableTime <= 0`, aggregate all tasks into one `DistributedSession` with `goalIds` set — in `sessionDistribution.ts`

**Checkpoint**: All T013–T015 tests pass. Single-goal sessions are byte-for-byte equivalent to pre-feature behaviour.

---

## Phase 5: User Story 3 — Excess Tasks Deferred to Future Sessions (Priority: P2)

**Goal**: When a goal's tasks exceed its 40% budget for a session, excess tasks spill into future sessions; no tasks are dropped.

**Independent Test**: Create two goals each with 60+ minutes of tasks in a 60-minute session budget. Verify all tasks appear across 2+ sessions, no session violates the 40% cap, and zero tasks are silently dropped.

### Tests for User Story 3

> **Write these tests FIRST — verify they FAIL before implementing T021–T024**

- [X] T018 [P] [US3] Add `distributeMultiGoalTasks` test: excess phrase groups from a capped goal roll to the next session (all groups appear in output, none dropped) — in `sessionDistribution.test.ts`
- [X] T019 [P] [US3] Add `distributeMultiGoalTasks` test: two large goals each with tasks > 40% of session each; across multiple output sessions every input group appears exactly once — in `sessionDistribution.test.ts`
- [X] T020 [P] [US3] Add `reconstructPhraseGroupsFromTasks` tests: correct grouping by `(goalId, startMeasure, endMeasure)`, totalDuration summing, startMeasure ordering, warmup-task exclusion, non-todo-task exclusion — in `goalEngine.test.ts`

### Implementation for User Story 3

- [X] T021 [US3] Implement `reconstructPhraseGroupsFromTasks(tasks: readonly SessionTask[]): GoalPhraseGroup[]` in `goalEngine.ts` — groups tasks by `(goalId, startMeasure, endMeasure)`, sorts by `startMeasure`, excludes warmup and non-todo tasks (see data-model.md §6)
- [X] T022 [US3] Update `GoalsView.tsx` `handleGoalSubmit` to detect other active `learn-score-phrase` goals via `listGoalsIndex()` and select the multi-goal redistribution path when `otherActiveGoalIds.length > 0`
- [X] T023 [US3] Implement `redistributeWithMultiGoalCap` orchestration in `GoalsView.tsx`: (1) load other active goals from IndexedDB, (2) load their `scheduled` sessions, (3) extract pending tasks, (4) cancel those sessions (delete IndexedDB + remove index), (5) call `reconstructPhraseGroupsFromTasks` for each goal, (6) annotate new goal's phrase groups with `goalId`, (7) call `distributeMultiGoalTasks`, (8) create new sessions with `goalIds` field, (9) assign free days via `findFreeDays`, (10) update each contributing goal's `sessionIds`, **(11) compute each new session's `name` as `[...new Set(distributedSession.goalIds.map(gid => goalMap[gid]?.scoreTitle ?? gid))].sort().join(' · ')` — MUST NOT reuse prior session name** (reopened — BUG-002: step 11 was missing; sessions were named after only the creating goal's score title)
- [X] T024 [US3] Update session creation in `redistributeWithMultiGoalCap` to populate `Session.goalIds` and `SessionIndexEntry.goalIds` from `DistributedSession.goalIds` — in `GoalsView.tsx`

**Checkpoint**: All T018–T020 tests pass. Multi-goal redistribution creates balanced sessions and every task from every goal appears in exactly one scheduled session.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, edge-case hardening, and validation.

- [X] T025 [P] Run full `sessions-plugin` test suite (`npx vitest run --reporter=verbose`) and confirm all tests pass with no regressions
- [X] T026 [P] Update `FEATURES.md` at repo root to reflect the 40% per-goal cap as a new balancing behaviour of the Goals system
- [X] T027 Run the quickstart.md §Verification Scenario manually (Goal A then Goal B) and confirm balanced distribution and no dropped tasks
- [X] T028 [P] [US3] Add regression test: create two goals linked to different scores (e.g. Arabesque and Bach Invention No. 1), trigger `redistributeWithMultiGoalCap`, and assert that every `DistributedSession` whose `goalIds` spans both scores has `name === 'Arabesque · Bach: Invention No. 1'` (sorted, joined by `' · '`) — in `plugins-external/sessions-plugin/GoalsView.test.tsx` or `sessionDistribution.test.ts` (added — BUG-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2; can start in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 2; can start in parallel with Phase 3 and Phase 4
- **Phase 6 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)** — `distributeMultiGoalTasks` core algorithm: no dependency on US2 or US3
- **US2 (P2)** — fast paths inside `distributeMultiGoalTasks`: no dependency on US1 implementation (can extend same function), but logically sequential with US1
- **US3 (P2)** — `reconstructPhraseGroupsFromTasks` + `GoalsView` orchestration: depends on US1 (`distributeMultiGoalTasks` must exist to call from GoalsView)

### Within Each User Story

1. Tests → written first and confirmed failing
2. Pure function implementation → `sessionDistribution.ts` / `goalEngine.ts`
3. Integration/orchestration → `GoalsView.tsx` (last, after pure functions are tested)

### Parallel Opportunities per User Story

**US1 parallel block** (T006–T010): All five test cases are independent — different `describe` blocks in the same file. Write all before implementing T011.

**US2 parallel block** (T013–T015): Independent test cases, write all before T016–T017.

**US3 parallel block** (T018–T020): T018/T019 (distribution tests) and T020 (`reconstructPhraseGroupsFromTasks` tests) can be written in parallel — different files.

---

## Parallel Execution Example: User Story 1

```bash
# After Phase 2 completes (types land):

# In parallel — write all failing tests:
# Terminal A:
npx vitest run sessionDistribution --reporter=verbose  # verify T006-T010 FAIL

# Terminal B (later):
# Implement T011 + T012
# Then verify:
npx vitest run sessionDistribution --reporter=verbose  # verify T006-T010 PASS
```

## Parallel Execution Example: User Story 3

```bash
# T020 (goalEngine tests) and T018-T019 (distribution tests) in parallel:
# Terminal A: write + verify T018-T019 in sessionDistribution.test.ts
# Terminal B: write + verify T020 in goalEngine.test.ts

# Then T021 (reconstructPhraseGroupsFromTasks) and T022 can start in parallel:
# Terminal A: implement T021 in goalEngine.ts
# Terminal B: implement T022 (detection logic) in GoalsView.tsx

# T023 + T024 are sequential (same file, GoalsView.tsx)
```

---

## Implementation Strategy

**MVP scope**: Complete Phase 3 (US1) alone — delivers the core 40% cap with `distributeMultiGoalTasks`. The GoalsView orchestration (US3) gates real-world use, but the algorithm is independently verifiable via unit tests.

**Incremental delivery**:
1. Phase 1 + 2 (setup + types): ~30 min
2. Phase 3 US1 (algorithm + tests): ~1.5 h — verifiable milestone
3. Phase 4 US2 (fast paths + tests): ~45 min — regression safety
4. Phase 5 US3 (reconstruction + GoalsView wiring): ~2 h — brings feature to end-to-end
5. Phase 6 (polish): ~30 min

**Format validation**:
- All tasks follow `- [ ] TXXX [P?] [Story?] Description with file path` ✅
- Setup/Foundational tasks: no story label ✅
- User story tasks: [US1], [US2], or [US3] label ✅
- Parallelizable tasks: [P] marker ✅
- All tasks include file paths ✅

---

**Bugfix**: 2026-05-22 — BUG-002 Updated from bugfix patch. T009 reopened (missing composite-title assertion). T023 reopened (session `name` derivation step 11 missing). T028 added (regression test: composite title on multi-score sessions). Total tasks: 28 (27 previously, +1 added, 2 reopened).
