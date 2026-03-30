# Tasks: Sessions Calendar View

**Input**: Design documents from `/specs/065-sessions-calendar-view/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as this project follows TDD per Constitution Principle V.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Plugin directory**: `plugins-external/sessions-plugin/`
- All new files created inside the existing sessions plugin directory

---

## Phase 1: Setup

**Purpose**: Utility module with date math, aggregation logic, and formatting — the foundation all views depend on

- [x] T001 [P] Create `toLocalDateKey()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test ISO string to YYYY-MM-DD conversion using local timezone
- [x] T002 [P] Create `formatDuration()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test <1min, minutes, hours+minutes formatting
- [x] T003 [P] Create `averagePracticeScore()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test empty array, single activity, multiple activities averaging
- [x] T004 Create `toLocalDateKey()`, `formatDuration()`, and `averagePracticeScore()` implementations in `plugins-external/sessions-plugin/calendarUtils.ts` — ensure T001–T003 tests pass
- [x] T005 Create `getWeekStart()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test Monday alignment for each day of the week
- [x] T006 Create `getMonthGrid()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test grid generation returns 42 dates (6 weeks × 7 days), Monday-first, with correct prev/next month padding
- [x] T007 Create `getWeekStart()` and `getMonthGrid()` implementations in `plugins-external/sessions-plugin/calendarUtils.ts` — ensure T005–T006 tests pass
- [x] T008 Create `aggregateByDay()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test empty sessions, single session with multiple activities on same/different days, multiple sessions merging
- [x] T009 Create `computePeriodSummary()` tests in `plugins-external/sessions-plugin/calendarUtils.test.ts` — test date range filtering and sum correctness
- [x] T010 Create `aggregateByDay()` and `computePeriodSummary()` implementations in `plugins-external/sessions-plugin/calendarUtils.ts` — ensure T008–T009 tests pass

**Checkpoint**: All utility functions tested and implemented. Calendar views can now be built.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared calendar shell component and tab toggle — must be complete before any user story view work

**⚠️ CRITICAL**: No user story view work can begin until this phase is complete

- [x] T011 Create `CalendarPeriodSummary` component in `plugins-external/sessions-plugin/CalendarPeriodSummary.tsx` — renders period label, total activities, and formatted total time using PeriodSummary props
- [x] T012 Create `CalendarView` orchestrator component in `plugins-external/sessions-plugin/CalendarView.tsx` — manages CalendarViewState (grouping + referenceDate), computes aggregateByDay from sessions prop, renders view selector (week/month/year buttons), navigation controls (prev/next), CalendarPeriodSummary, and placeholder content for sub-views
- [x] T013 Add Sessions/Calendar tab toggle to `plugins-external/sessions-plugin/SessionsPlugin.tsx` — add two-button tab bar at top of panel with aria-selected, toggle between existing sessions list and CalendarView; load all sessions via `loadAllSessionsFromIndexedDB()` when Calendar tab is activated and pass to CalendarView
- [x] T014 Add calendar CSS styles to `plugins-external/sessions-plugin/SessionsPlugin.css` — tab toggle styles (bottom-border active indicator per DesignNavbar pattern), view selector buttons, navigation controls, period summary line, calendar grid layout, all using `--ls-` CSS variables and `.calendar-` class prefix

**Checkpoint**: Tab toggle works, CalendarView shell renders with view switcher, navigation, and period summary. Sub-views show placeholders.

---

## Phase 3: User Story 1 — Monthly Calendar Overview (Priority: P1) 🎯 MVP

**Goal**: Display a monthly calendar grid where each day cell shows activity count and total practice time. Includes month navigation and period summary.

**Independent Test**: Open Calendar tab → see current month grid → verify day cells show correct activity count + time → navigate months → verify period summary updates.

### Tests for User Story 1

- [x] T015 [P] [US1] Create CalendarMonthView component test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test renders 42 day cells in 6×7 grid, Monday-first; day cells with activities show count + formatted time; empty days render without badge; month/year header is correct
- [x] T016 [P] [US1] Create CalendarMonthView navigation test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test prev/next month changes referenceDate; period summary updates with new month's aggregated data

### Implementation for User Story 1

- [x] T017 [US1] Create `CalendarMonthView` component in `plugins-external/sessions-plugin/CalendarMonthView.tsx` — render 6×7 grid using `getMonthGrid()`, look up each date in daySummaries map, display activity count + `formatDuration()` in cells with data, apply distinct style for empty vs active days, call `onDayClick` on cell click
- [x] T018 [US1] Wire CalendarMonthView into CalendarView in `plugins-external/sessions-plugin/CalendarView.tsx` — replace month placeholder with CalendarMonthView, connect daySummaries, referenceDate, and onDayClick handler; compute month period summary using `computePeriodSummary()` with month date range
- [x] T019 [US1] Add month grid CSS to `plugins-external/sessions-plugin/SessionsPlugin.css` — 7-column grid layout, day cell sizing (≥44×44px touch targets), active day cell badge styling, weekday header row, current-day highlight, empty cell styling
- [x] T020 [US1] Handle empty state in CalendarMonthView in `plugins-external/sessions-plugin/CalendarMonthView.tsx` — when no activities exist for any day in the month, display a message indicating no practice data is available

**Checkpoint**: Monthly calendar is fully functional — day cells show correct data, navigation works, period summary is accurate, empty state handled. MVP is usable.

---

## Phase 4: User Story 2 — Day Detail Overlay (Priority: P2)

**Goal**: Click a day cell to open an overlay showing a summary header (total activities, total time, average score) and scrollable list of individual activity details.

**Independent Test**: Click a day with activities → overlay opens showing summary header + activity list with all fields → click close or outside → overlay dismisses → clicking empty day does nothing.

### Tests for User Story 2

- [x] T021 [P] [US2] Create CalendarDayOverlay component test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test summary header shows date, total activities, total time, average practice score; activity list shows score title, practice name, practice score, note accuracy (correct/total), duration, completion status for each activity; scrollable container renders
- [x] T022 [P] [US2] Create CalendarDayOverlay dismissal test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test close button calls onClose; clicking backdrop calls onClose; Escape key calls onClose

### Implementation for User Story 2

- [x] T023 [US2] Create `CalendarDayOverlay` component in `plugins-external/sessions-plugin/CalendarDayOverlay.tsx` — modal overlay with backdrop; summary header showing date, total activities, `formatDuration(totalTimeMs)`, `averagePracticeScore(activities)`; scrollable activity list rendering each activity's scoreTitle, practiceName, practiceScore, correctCount/totalNotes, `formatDuration(practiceTimeMs)`, completionStatus, and optional task name (resolved via `taskNameMap` prop); close button; click-outside-to-dismiss
- [x] T024 [US2] Wire CalendarDayOverlay into CalendarView in `plugins-external/sessions-plugin/CalendarView.tsx` — manage DayOverlayState; on day click, look up DaySummary and open overlay if activities exist (ignore clicks on empty days); compute `buildTaskNameMap(sessions)` and pass as `taskNameMap` prop along with onClose to dismiss
- [x] T025 [US2] Add overlay CSS to `plugins-external/sessions-plugin/SessionsPlugin.css` — backdrop with semi-transparent background, centered overlay panel, summary header styling, scrollable activity list with max-height, activity card layout, close button positioning, responsive sizing for tablet

**Checkpoint**: Day detail overlay is functional — opens with correct data, shows summary + activity list, dismisses correctly. Works with month view from US1.

---

## Phase 5: User Story 3 — Week Grouping View (Priority: P3)

**Goal**: Show 7-day columns (Monday–Sunday) for the selected week with activity count and total time per day. Supports navigation and day click overlay.

**Independent Test**: Switch to week view → see 7 day columns for current week → verify activity data per day → navigate weeks → click day opens overlay.

### Tests for User Story 3

- [x] T026 [P] [US3] Create CalendarWeekView component test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test renders 7 day columns Monday–Sunday; each column shows day name, date, activity count + formatted time; week period summary is correct; navigation shifts by 7 days

### Implementation for User Story 3

- [x] T027 [US3] Create `CalendarWeekView` component in `plugins-external/sessions-plugin/CalendarWeekView.tsx` — render 7 day columns using `getWeekStart()` to find Monday, iterate 7 days; look up each date in daySummaries map; display day name, date number, activity count + `formatDuration()`; call `onDayClick` on column click
- [x] T028 [US3] Wire CalendarWeekView into CalendarView in `plugins-external/sessions-plugin/CalendarView.tsx` — replace week placeholder; compute week period summary using week start/end date range; connect navigation to shift by 7 days
- [x] T029 [US3] Add week view CSS to `plugins-external/sessions-plugin/SessionsPlugin.css` — 7-column equal-width layout, day column styling, date header, touch-friendly column sizing

**Checkpoint**: Week view is functional — 7-day columns, correct data, navigation, overlay integration work.

---

## Phase 6: User Story 4 — Year Grouping View (Priority: P4)

**Goal**: Show 12 month cells in a grid for the selected year with aggregated activity count and total time per month. Click a month to navigate to month view.

**Independent Test**: Switch to year view → see 12 month cells → verify per-month aggregates → click a month → navigates to month view for that month → navigate years.

### Tests for User Story 4

- [x] T030 [P] [US4] Create CalendarYearView component test in `plugins-external/sessions-plugin/calendarView.test.tsx` — test renders 12 month cells (4×3 grid); each cell shows month name, total activity count + formatted time; year period summary is correct; clicking month calls onMonthClick with correct date

### Implementation for User Story 4

- [x] T031 [US4] Create `CalendarYearView` component in `plugins-external/sessions-plugin/CalendarYearView.tsx` — render 4×3 grid of month cells; for each month, aggregate all DaySummary entries within that month's date range; display month name, activity count + `formatDuration()`; call `onMonthClick` on cell click
- [x] T032 [US4] Wire CalendarYearView into CalendarView in `plugins-external/sessions-plugin/CalendarView.tsx` — replace year placeholder; on month click, set grouping to 'month' and referenceDate to first day of clicked month; compute year period summary
- [x] T033 [US4] Add year view CSS to `plugins-external/sessions-plugin/SessionsPlugin.css` — 3-column or 4×3 grid layout, month cell sizing with touch-friendly targets, hover/active states

**Checkpoint**: Year view is functional — 12 month cells with correct aggregates, month-click navigation, year period summary. All 4 user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T034 [P] Add keyboard accessibility to CalendarView in `plugins-external/sessions-plugin/CalendarView.tsx` — ensure tab toggle, view selector, navigation, and day/month cells are keyboard-navigable with proper aria attributes
- [x] T035 [P] Add empty calendar state to `plugins-external/sessions-plugin/CalendarView.tsx` — when no sessions exist at all, show a helpful message across all views
- [x] T036 Run quickstart.md validation — follow steps in `specs/065-sessions-calendar-view/quickstart.md` end-to-end to verify dev setup, test commands, and implementation order work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (calendarUtils) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — delivers MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 but integrates after
- **User Story 3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on Phase 2 — can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Monthly Calendar)**: Independent after Phase 2 — core MVP
- **US2 (Day Detail Overlay)**: Independent after Phase 2 — but uses onDayClick from US1/US3 views
- **US3 (Week View)**: Independent after Phase 2 — shares CalendarView shell
- **US4 (Year View)**: Independent after Phase 2 — month click navigates to month view (US1)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component creation before wiring into CalendarView
- Wiring before CSS styling
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 can run in parallel (independent test files for different functions)
- **Phase 1**: T005, T006 can run in parallel after T004
- **Phase 1**: T008, T009 can run in parallel after T007
- **Phase 2**: T011 can run in parallel with T012 (different files)
- **Phase 3+**: All test tasks marked [P] within a story can run in parallel
- **Cross-story**: US1 and US2 tests (T015–T016 and T021–T022) can be written in parallel
- **Cross-story**: US3 and US4 can be implemented in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch tests for US1 together:
Task T015: "CalendarMonthView component test in calendarView.test.tsx"
Task T016: "CalendarMonthView navigation test in calendarView.test.tsx"

# After tests fail, implement sequentially:
Task T017: "Create CalendarMonthView component"
Task T018: "Wire CalendarMonthView into CalendarView"
Task T019: "Add month grid CSS"
Task T020: "Handle empty state"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (calendarUtils — T001–T010)
2. Complete Phase 2: Foundational (CalendarView shell + tab toggle — T011–T014)
3. Complete Phase 3: User Story 1 (Monthly Calendar — T015–T020)
4. **STOP and VALIDATE**: Test monthly calendar independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Shell ready
2. Add User Story 1 (Month view) → Test → Deploy/Demo (MVP!)
3. Add User Story 2 (Day overlay) → Test → Deploy/Demo
4. Add User Story 3 (Week view) → Test → Deploy/Demo
5. Add User Story 4 (Year view) → Test → Deploy/Demo
6. Polish → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Month view)
   - Developer B: User Story 2 (Day overlay)
3. After US1+US2 integrate:
   - Developer A: User Story 3 (Week view)
   - Developer B: User Story 4 (Year view)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All CSS uses `--ls-` variables and `.calendar-` class prefix
- Touch targets must be ≥44×44px for tablet compliance
