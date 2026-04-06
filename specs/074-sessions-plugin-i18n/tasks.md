# Tasks: Sessions Plugin i18n (074)

**Branch**: `074-sessions-plugin-i18n` | **Date**: 2026-04-06
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

---

## Phase 1: Setup

**Purpose**: Clone the external plugin repo into the feature worktree and create the feature branch, per the constitution's External Plugin Repositories workflow.

- [X] T001 Clone `graditone-pro-plugins` into `plugins-external/` inside the worktree, create branch `074-sessions-plugin-i18n`, and `npm install` in `plugins-external/sessions-plugin/`

**Checkpoint**: `plugins-external/sessions-plugin/` exists with all dependencies installed; `git status` inside `plugins-external/` shows the new feature branch.

---

## Phase 2: Foundational (i18n Module + Catalogs)

**Purpose**: Create the self-contained i18n infrastructure that all user stories depend on. No component work can begin until these files exist and tests pass.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

> Tests must be written first (red), then implementation (green) per Constitution Principle V.

- [X] T002 Write failing tests in `plugins-external/sessions-plugin/i18n.test.ts` covering: (a) `resolveLocale()` maps `"es"`, `"es-MX"`, `"fr"`, `undefined` correctly, and (d) Spanish catalog has every key in the English catalog with no extras
- [X] T003 [P] Create `plugins-external/sessions-plugin/locales/en.json` with all 202 keys from `data-model.md` (full English catalog)
- [X] T004 [P] Create `plugins-external/sessions-plugin/locales/es.json` with all 202 Spanish translations matching every key in `en.json`
- [X] T005 Implement `plugins-external/sessions-plugin/i18n.ts` with `SUPPORTED_LOCALES`, `resolveLocale()`, `LocaleProvider`, `useTranslation()` hook, and `TranslationKey` type per `data-model.md` interface
- [X] T006 Run `vitest run i18n.test.ts` and verify all tests pass (T002 red → green via T005)

**Checkpoint**: `i18n.ts` compiles without errors, `i18n.test.ts` passes, both catalogs are exhaustive and TypeScript-validated.

---

## Phase 3: User Story 1 — Locale Wiring + Core Sessions UI (Priority: P1) 🎯 MVP

**Goal**: End-to-end locale detection works — a Spanish-browser user opens the Sessions plugin and sees Spanish in the toolbar, loading state, tabs, session list, empty state, and confirmation dialog.

**Independent Test**: Set `LocaleProvider locale="es"` in a test, render `SessionsPlugin`, and assert Spanish strings appear for all core UI elements.

### Tests for User Story 1

> **Write these first, verify they FAIL before implementing T008–T009**

- [X] T007 Write failing tests in `plugins-external/sessions-plugin/sessions-plugin.test.tsx` asserting Spanish text renders for: loading state, toolbar title ("Sessions"), tab labels (Sessions/Calendar/Goals), empty-state message, confirm-delete dialog, and "New Session" button — using `<LocaleProvider locale="es">`

### Implementation for User Story 1

- [X] T008 [US1] Wrap the plugin root in `LocaleProvider` in `plugins-external/sessions-plugin/index.tsx` and replace all hardcoded strings in `plugins-external/sessions-plugin/SessionsPlugin.tsx` with `t()` calls (toolbar titles, tab labels, loading text, status badges, action button labels, confirm dialog copy, empty state, meta format strings, aria-labels)
- [X] T009 [US1] Run `vitest run sessions-plugin.test.tsx` and verify all T007 tests pass (red → green)

**Checkpoint**: US1 independently verifiable — Spanish browser sees Spanish text in the core sessions view. MVP is complete.

---

## Phase 4: User Story 2 — All Remaining Surfaces Translated (Priority: P1)

**Goal**: 100% string coverage — every component in the plugin renders translated text. No hardcoded English remains anywhere.

**Independent Test**: Run `vitest run` with `locale="es"` and assert Spanish output from GoalsView, CalendarView, TaskBuilder, TaskRow, forms, overlays, guide. Run `tsc --noEmit` to confirm TypeScript enforces catalog exhaustiveness.

### Tests for User Story 2

> **Write these first, verify they FAIL before the parallel implementation tasks**

- [X] T010 [P] Write failing tests in `plugins-external/sessions-plugin/GoalsView.test.tsx` asserting Spanish text renders for: "No goals yet", "Create Goal" button, goal status labels, confirm-delete dialog, and error messages — using `<LocaleProvider locale="es">`
- [X] T011 [P] Write failing tests in `plugins-external/sessions-plugin/TaskRow.test.tsx` asserting Spanish text renders for: difficulty labels (Easy/Medium/Hard), practice/retry button text, "No practices yet" empty state — using `<LocaleProvider locale="es">`
- [X] T010b [P] Write failing tests for form components: add a test file (or extend existing) asserting Spanish text renders for `GoalCreationForm` (form title, field labels, select options, action buttons) and `WarmUpGoalCreationForm` (availability messages, field labels, action buttons) — using `<LocaleProvider locale="es">`
- [X] T010c [P] Write failing tests for calendar and guide components: add tests asserting Spanish text renders in `CalendarView` (view tabs, empty state), `CalendarWeekView` / `CalendarMonthView` (day-name headers), `CalendarDayOverlay` / `CalendarScheduledOverlay` (overlay labels), and `SessionsGuide` (section headings) — using `<LocaleProvider locale="es">`

### Implementation for User Story 2

- [X] T012 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/GoalsView.tsx` with `t()` calls (empty state, header, status labels, delete confirmation, error messages, warm-up summary, aria-labels)
- [X] T013 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/GoalCreationForm.tsx` with `t()` calls (form title, field labels, select options, validation messages, buttons)
- [X] T014 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx` with `t()` calls (field labels, availability messages including singular/plural forms, action buttons)
- [X] T015 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/TaskRow.tsx` with `t()` calls (difficulty badges, score-not-found warning, aria-labels, button labels, empty state, round prefix)
- [X] T016 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/TaskBuilder.tsx` with `t()` calls (titles, subtitles, field labels, select options, placeholders, error messages, button labels, time-bar copy)
- [X] T017 [P] [US2] Replace hardcoded strings and convert `MONTH_NAMES`, `SHORT_MONTH_NAMES`, day-name arrays to catalog-driven arrays in `plugins-external/sessions-plugin/CalendarView.tsx` (view tabs, navigation aria-labels, period label, empty state)
- [X] T018 [P] [US2] Replace hardcoded day-name arrays and strings in `plugins-external/sessions-plugin/CalendarWeekView.tsx` and `plugins-external/sessions-plugin/CalendarMonthView.tsx` with catalog-driven lookups
- [X] T019 [P] [US2] Replace hardcoded `MONTH_NAMES` array and strings in `plugins-external/sessions-plugin/CalendarYearView.tsx` and `plugins-external/sessions-plugin/CalendarPeriodSummary.tsx` with catalog-driven lookups
- [X] T020 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/CalendarDayOverlay.tsx` and `plugins-external/sessions-plugin/CalendarScheduledOverlay.tsx` with `t()` calls (overlay aria-labels, score display, task prefix, status variants, navigation link)
- [X] T021 [P] [US2] Replace all hardcoded strings in `plugins-external/sessions-plugin/CalendarPeriodReport.tsx` and `plugins-external/sessions-plugin/DatePicker.tsx` with catalog-driven lookups (day/month abbreviation arrays, legend labels, chart tooltips, date picker aria-labels)
- [X] T022 [US2] Replace all hardcoded guide prose in `plugins-external/sessions-plugin/SessionsGuide.tsx` with `t()` calls using `dangerouslySetInnerHTML` for keys containing inline HTML (`<strong>`, `<code>`) per the `data-model.md` guide HTML rendering pattern
- [X] T023 [US2] Run `vitest run` (all tests), run `npx tsc --noEmit`, and confirm: T010 and T011 tests pass, zero TypeScript errors, zero hardcoded English strings remain in any component

**Checkpoint**: US2 independently verifiable — full Spanish string coverage confirmed by TypeScript and tests.

---

## Phase 5: User Story 3 — Fallback Behavior (Priority: P2)

**Goal**: Unsupported locales show English; missing Spanish catalog keys fall back to English rather than raw key or blank.

**Independent Test**: Render plugin with `locale="en"` (or an unsupported `locale="fr"`), assert only English text appears. Test missing-key fallback inline in `i18n.test.ts`.

### Tests for User Story 3

> **Write these first, verify they FAIL before T025**

- [X] T024 Add failing test cases to `plugins-external/sessions-plugin/i18n.test.ts` for: (b) a component wrapped in `<LocaleProvider locale="en">` renders English text, (c) `resolveLocale("fr") === "en"` and a component wrapped in `<LocaleProvider>` with `navigator.language` mocked to `"fr"` (via `vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr')`) renders English text, and a missing-key scenario where `useTranslation().t()` is called with a key absent from the Spanish catalog and the English fallback value is returned

### Implementation for User Story 3

- [X] T025 [US3] Verify `useTranslation()` fallback logic in `plugins-external/sessions-plugin/i18n.ts` correctly returns `enCatalog[key]` when the Spanish catalog value is absent; run `vitest run i18n.test.ts` to confirm T024 tests pass (red → green)

**Checkpoint**: US3 independently verifiable — unsupported locales and missing keys always fall back to English with no raw keys or blank fields visible.

---

## Phase 6: User Story 4 — Plugin Developer Documentation (Priority: P3)

**Goal**: PLUGINS.md contains a complete, self-contained i18n section that a developer can follow without any other source.

**Independent Test**: Follow the PLUGINS.md i18n section instructions from scratch in a new plugin and verify the implemented i18n works with locale switching.

### Implementation for User Story 4

- [X] T026 [US4] Add a new "Internationalizing a Plugin (i18n)" section to `PLUGINS.md` in the graditone repo root, covering all 7 steps from `quickstart.md`: creating `i18n.ts`, EN catalog, ES catalog, wrapping root in `LocaleProvider`, replacing hardcoded strings, writing tests, and adding a third language
- [X] T027 [US4] Add "Internationalizing a Plugin (i18n)" to the PLUGINS.md table of contents and verify all internal links resolve correctly

**Checkpoint**: US4 independently verifiable — a developer can implement plugin i18n using only PLUGINS.md.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T028 [P] Run `npm run build` (Vite) in `plugins-external/sessions-plugin/` and verify zero TypeScript compilation errors and a clean production bundle
- [X] T029 [P] Update `plugins-external/sessions-plugin/plugin.json` version (minor bump) and commit both the sessions plugin repo (`plugins-external/`) and the main graditone repo (PLUGINS.md change) with Conventional Commit messages

---

## Dependencies

```
T001
 └─► T002, T003, T004          (setup unlocks foundational work)
      T003 + T004 ──► T005     (catalogs required to compile i18n.ts)
      T002 ──► T005             (tests written before implementation)
      T005 ──► T006             (verify foundational tests pass)
      T005 ──► T007, T008       (i18n module needed for component work)
      T007 ──► T008             (write test before implementing)
      T008 ──► T009             (implement before verifying)
      T005 ──► T010, T011       (i18n needed before component tests)
      T010 ──► T012             (test before implement)
      T010b ──► T013, T014, T016 (test before implement)
      T010c ──► T017, T018, T019, T020, T021, T022 (test before implement)
      T011 ──► T015             (test before implement)
      T012..T022 ──► T023       (all components done before full verify)
      T023 ──► T024             (US2 complete before US3 test pass is meaningful)
      T024 ──► T025             (test before implement)
      T025 ──► T026             (implementation done before docs)
      T026 ──► T027             (section added before ToC update)
      T023 + T027 ──► T028, T029
```

## Parallel Execution Opportunities

**Phase 2**: T003 ‖ T004 (independent JSON files)

**Phase 3 → 4 overlap**: T010, T011, T010b, and T010c (test writing) can all begin as soon as T005 passes — no need to wait for T009

**Phase 4 implementation**: T012 ‖ T013 ‖ T014 ‖ T015 ‖ T016 ‖ T017 ‖ T018 ‖ T019 ‖ T020 ‖ T021 (all different files)

**Final phase**: T028 ‖ T029

## Implementation Strategy

**MVP** (minimum to deliver US1 value): T001 → T002 → T003 + T004 → T005 → T006 → T007 → T008 → T009 (9 tasks)

At the end of Phase 3, the plugin is usable in Spanish for the core sessions view. All remaining phases add coverage breadth (US2), robustness (US3), and developer enablement (US4).

**Incremental delivery order**: US1 (core locale detection) → US2 (full coverage) → US3 (fallback robustness) → US4 (documentation)

## Summary

| Phase | Stories | Tasks | Parallel? |
|-------|---------|-------|-----------|
| 1: Setup | — | T001 | — |
| 2: Foundational | — | T002–T006 | T003 ‖ T004 |
| 3: US1 Core | P1 | T007–T009 | — |
| 4: US2 All Surfaces | P1 | T010–T010c, T011–T023 | T010 ‖ T011 ‖ T010b ‖ T010c; T012–T021 all parallel |
| 5: US3 Fallback | P2 | T024–T025 | — |
| 6: US4 Docs | P3 | T026–T027 | — |
| Final: Polish | — | T028–T029 | T028 ‖ T029 |

**Total tasks**: 31  
**Tasks by story**: US1: 3 · US2: 15 · US3: 2 · US4: 2 · Shared foundation: 7 · Polish: 2  
**Parallel opportunities**: 3 distinct parallel stages  
**MVP scope**: T001–T009 (Phases 1–3, 9 tasks)
