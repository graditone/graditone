# Tasks: Sessions Plugin Tabs Reorder

**Input**: Design documents from `/specs/073-sessions-tabs-order/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

> ⚠️ **Separate repository**: All source changes are made in the **`graditone-pro-plugins`** repo,
> located at `plugins-external/sessions-plugin/` inside the graditone root (gitignored there).
> File paths below are relative to the `graditone-pro-plugins` repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- File paths are relative to the `graditone-pro-plugins` repo root

---

## Phase 1: User Story 1 - Tabs Display in Correct Order (Priority: P1) 🎯 MVP

**Goal**: Sessions plugin tab bar renders in the order Goals → Calendar → Sessions.

**Independent Test**: Render `<SessionsPlugin />` in the test suite and assert `getAllByRole('tab')` returns `['Goals', 'Calendar', 'Sessions']` in that order.

### Tests for User Story 1

> **Write this test FIRST and verify it FAILS before touching the component.**

- [x] T001 [US1] Add failing tab-order test asserting Goals → Calendar → Sessions via `getAllByRole('tab')` in `SessionsPlugin.test.tsx`

### Implementation for User Story 1

- [x] T002 [US1] Reorder the three tab `<button>` elements in the `sessions-plugin__tab-bar` div to Goals, Calendar, Sessions in `SessionsPlugin.tsx`

**Checkpoint**: `T001` test now passes. All pre-existing tests in `sessions-plugin.test.tsx` continue to pass. Tab bar visually shows Goals | Calendar | Sessions left to right.

---

## Phase 2: Polish & Cross-Cutting Concerns

- [x] T003 [P] Update the inline JSX comment on the tab bar from `{/* Tab bar: Sessions | Calendar | Goals */}` to `{/* Tab bar: Goals | Calendar | Sessions */}` in `SessionsPlugin.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (US1): No prior setup or foundational phase needed — start immediately.
- **Phase 2** (Polish): Depends on Phase 1 completion.

### Within User Story 1

- **T001** must be written and confirmed **red** before T002.
- **T002** makes T001 green.
- **T003** is independent of T001/T002 (comment-only change), but logically belongs after T002.

### Parallel Opportunities

- T003 has `[P]` marker — can be done alongside any other work once T002 is complete.

---

## Implementation Strategy

**MVP scope**: Phase 1 entirely — T001 + T002 are the complete deliverable. Total: 2 files touched, 2 meaningful changes.

**Suggested sequence**:
1. Write T001 (failing test) → confirm red
2. Implement T002 (JSX reorder) → confirm T001 goes green, all existing tests still pass
3. Apply T003 (comment cleanup)

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 3 |
| Tasks for US1 | 2 |
| Parallel tasks | 1 (T003) |
| Files modified | 2 (`SessionsPlugin.tsx`, `sessions-plugin.test.tsx`) — in `graditone-pro-plugins` repo |
| New files | 0 |
| MVP scope | Phase 1 (T001 + T002) |
