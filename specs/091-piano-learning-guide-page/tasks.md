# Tasks: Piano Learning Guide Page

**Input**: Design documents from `specs/091-piano-learning-guide-page/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅  
**Branch**: `091-piano-learning-guide-page`

**Tests**: Included — Constitution Principle V (Test-First Development) requires tests written and **failing** before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add i18n keys and the test file skeleton — the foundation everything else builds on.

- [X] T001 Add all 30 `guide.piano.*` keys to `frontend/src/i18n/locales/en.json` (full English text per data-model.md)
- [X] T002 [P] Add matching `guide.piano.*` stub keys to `frontend/src/i18n/locales/es.json` (copy EN text; prefix each value with `[ES]` pending translation)

**Checkpoint**: i18n keys compile; `TranslationKey` union type includes all new `guide.piano.*` keys (verified by TypeScript build).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Write ALL tests first (red phase) before any component code exists. Every test must **fail** at this point.

**⚠️ CRITICAL**: Tests must be authored and confirmed failing before Phase 3 begins (Constitution Principle V).

- [X] T003 Create test file `frontend/src/test/components/PianoLearningGuidePage.test.tsx` with scaffold: imports (`vitest`, `@testing-library/react`, `LocaleProvider`), `renderWithLocale` helper (same pattern as `LandingScreen.test.tsx`), and 10 empty `it.todo` stubs for T1–T10
- [X] T004 [P] Implement test T1 (FR-001): `it('renders without throwing')` — renders `<PianoLearningGuidePage onBack={vi.fn()} />` inside `LocaleProvider`; assert no throw
- [X] T005 [P] Implement test T2 (FR-002): assert all 4 feature highlight headings present in DOM (note highlighting, tempo control, loop regions, virtual keyboard) using `screen.getByRole('heading', { name: /.../ })`
- [X] T006 [P] Implement test T3 (FR-002): assert each highlight section contains a `<p>` or description element with benefit text (verify by checking text content of translated keys)
- [X] T007 [P] Implement test T4 (FR-003): assert workflow section (`guide.piano.section_workflow_title`) renders an ordered list with at least 6 items (`screen.getAllByRole('listitem').length >= 6`)
- [X] T008 [P] Implement test T5 (FR-004): assert piano-specific section present; within it, headings for MIDI, stacked staves (grand staff), and dynamics each appear
- [X] T009 [P] Implement test T6 (FR-005): assert tips section present and contains at least 4 list items
- [X] T010 [P] Implement test T7 (FR-006): set `window.innerWidth = 375` before render; assert page root element has no `scrollWidth` overflow (or use `toBeVisible()` on all sections)
- [X] T011 [P] Implement test T8 (FR-008): `userEvent.click(screen.getByRole('button', { name: /back/i }))` then assert `onBack` spy was called once
- [X] T012 [P] Implement test T9 (FR-010): assert there are no raw hardcoded strings in the rendered output outside of what `t()` produces — verify by checking that all visible text nodes correspond to values from `en.json` `guide.piano.*` keys
- [X] T013 [P] Implement test T10 (FR-011): assert the MIDI prerequisite note (`guide.piano.piano_midi_prerequisite`) is present in the DOM when the piano-specific section is rendered
- [X] T014 Run `npm test -- PianoLearningGuidePage` in `frontend/` and confirm **all 10 tests fail** (component does not exist yet) — do not proceed to Phase 3 until this is confirmed

**Checkpoint**: 10 failing tests, 0 passing. Red phase complete.

---

## Phase 3: User Story 1 — Feature Highlight Overview (Priority: P1) 🎯 MVP

**Goal**: A piano learner can open the guide page and read clear, benefit-focused explanations of 4 core Graditone features (note highlighting, tempo control, loop regions, virtual keyboard), each framed specifically for learning piano.

**Independent Test**: Navigate to the guide page from the app header. Confirm the page renders, all 4 feature highlight cards are visible with headings and benefit descriptions, and the back button returns to the score viewer. Verify tests T1–T3 and T8 pass.

### Tests for User Story 1

- [X] T015 [US1] Confirm tests T1, T2, T3, T8 are written and failing (`npm test -- PianoLearningGuidePage`)

### Implementation for User Story 1

- [X] T016 [US1] Create `frontend/src/components/PianoLearningGuidePage.tsx` — functional component with props `{ onBack: () => void }`, imports `useTranslation`, renders outer `<div className="piano-guide">` with page header (`h1` using `guide.piano.page_title`, subtitle `p`) and a "← Back" `<button>` calling `onBack`
- [X] T017 [US1] Add "Core Practice Features" section to `PianoLearningGuidePage.tsx` — render `<section className="piano-guide__highlights">` with heading (`guide.piano.section_highlights_title`) and 4 feature cards (note-highlighting, tempo, loops, virtual-keyboard), each as a `<div>` with `<h3>` (title key) + `<p>` (benefit key)
- [X] T018 [US1] Create `frontend/src/components/PianoLearningGuidePage.css` — base styles scoped to `.piano-guide`: page layout (max-width, padding, font), `.piano-guide__header` (title + subtitle), `.piano-guide__highlights` grid (2-column on tablet, 1-column on mobile ≤ 600px), `.piano-guide__card` (border, radius, padding), back button style
- [X] T019 [US1] Add `showGuide` state and "Learn Piano" header button to `frontend/src/App.tsx`: `const [showGuide, setShowGuide] = useState(false)`; add `<button onClick={() => setShowGuide(true)}>📖 Learn Piano</button>` inside the app header `<nav>` (after the plugin nav entries, before the Plugins manager button); add early-return block that renders `<PianoLearningGuidePage onBack={() => setShowGuide(false)} />` (wrapped in `<ProfileProvider><RenderConfigContext.Provider>`, same pattern as `showRecording`)
- [X] T020 [US1] Run `npm test -- PianoLearningGuidePage` — confirm tests T1, T2, T3, T8 now **pass**; if any fail, fix the component before continuing

**Checkpoint**: Guide page accessible from app header. Feature highlights section visible. Back navigation works. Tests T1, T2, T3, T8 green.

---

## Phase 4: User Story 2 — Practice Workflow Walkthrough (Priority: P2)

**Goal**: A beginner pianist reads a 6-step, action-oriented practice workflow that maps directly to in-app actions (load score → listen → slow down → loop → practice plugin → speed up).

**Independent Test**: Open the guide page and scroll to the workflow section. Verify 6 numbered steps are visible, each starts with a verb and references a UI element. Follow steps 1–3 in the live app and confirm they match. Verify test T4 passes.

### Tests for User Story 2

- [X] T021 [US2] Confirm test T4 is written and failing (`npm test -- PianoLearningGuidePage`)

### Implementation for User Story 2

- [X] T022 [US2] Add "Practice Workflow" section to `frontend/src/components/PianoLearningGuidePage.tsx` — render `<section className="piano-guide__workflow">` with heading (`guide.piano.section_workflow_title`) and an `<ol>` containing 6 `<li>` elements, each using the corresponding `guide.piano.workflow_step1`–`step6` i18n key
- [X] T023 [US2] Add `.piano-guide__workflow` styles to `frontend/src/components/PianoLearningGuidePage.css` — `<ol>` with `counter-reset`, styled list items (large step number, comfortable line-height, clear separation between steps); responsive: full-width single column on all viewports
- [X] T024 [US2] Run `npm test -- PianoLearningGuidePage` — confirm test T4 now **passes**; all previously passing tests still pass

**Checkpoint**: Workflow section visible with 6 ordered steps. Test T4 green. Tests T1–T3, T8 remain green.

---

## Phase 5: User Story 3 — Piano-Specific Feature Highlights (Priority: P2)

**Goal**: A pianist reads about 4 features specific to piano learning (grand staff view, dynamics playback, one-hand playback, MIDI keyboard input), each with a clear benefit and the MIDI prerequisite note displayed.

**Independent Test**: Open the guide page and scroll to the piano-specific section. Verify all 4 feature headings appear, each has a benefit description, and the MIDI prerequisite note is visible below the MIDI card. Verify tests T5 and T10 pass.

### Tests for User Story 3

- [X] T025 [US3] Confirm tests T5 and T10 are written and failing (`npm test -- PianoLearningGuidePage`)

### Implementation for User Story 3

- [X] T026 [US3] Add "Piano-Specific Features" section to `frontend/src/components/PianoLearningGuidePage.tsx` — render `<section className="piano-guide__piano-features">` with heading (`guide.piano.section_piano_title`) and 4 feature cards for: grand staff (`piano_stacked_*`), dynamics (`piano_dynamics_*`), one-hand playback (`piano_onehand_*`), MIDI input (`piano_midi_title` + `piano_midi_benefit`); add a `<p className="piano-guide__prerequisite">` after the MIDI card using `guide.piano.piano_midi_prerequisite`
- [X] T027 [US3] Add `.piano-guide__piano-features` and `.piano-guide__prerequisite` styles to `frontend/src/components/PianoLearningGuidePage.css` — feature cards reuse `.piano-guide__card`; `.piano-guide__prerequisite` styled as a subdued note (smaller font, muted color, italic) below the MIDI card
- [X] T028 [US3] Run `npm test -- PianoLearningGuidePage` — confirm tests T5 and T10 now **pass**; all previously passing tests still pass

**Checkpoint**: Piano-specific section visible with 4 features + MIDI prerequisite note. Tests T5, T10 green. Previous tests remain green.

---

## Phase 6: User Story 4 — Practice Tips (Priority: P3)

**Goal**: A motivated learner reads 4 concise, actionable practice tips, each tied to a specific Graditone feature.

**Independent Test**: Open the guide page and scroll to the tips section. Verify 4 tips are displayed, each is scannable (short, list format), and each references a Graditone feature by name. Verify test T6 passes.

### Tests for User Story 4

- [X] T029 [US4] Confirm test T6 is written and failing (`npm test -- PianoLearningGuidePage`)

### Implementation for User Story 4

- [X] T030 [US4] Add "Practice Tips" section to `frontend/src/components/PianoLearningGuidePage.tsx` — render `<section className="piano-guide__tips">` with heading (`guide.piano.section_tips_title`) and an `<ul>` containing 4 `<li>` elements using `guide.piano.tip1`–`tip4` keys
- [X] T031 [US4] Add `.piano-guide__tips` styles to `frontend/src/components/PianoLearningGuidePage.css` — list with clear bullet markers, comfortable spacing; on mobile the tips stack vertically; scannable layout (no long blocks of prose)
- [X] T032 [US4] Run `npm test -- PianoLearningGuidePage` — confirm test T6 now **passes**; all 10 tests green

**Checkpoint**: Tips section visible with 4 items. All 10 tests green. Full guide page complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Responsiveness, i18n completeness, accessibility, and final validation.

- [ ] T033 [P] Verify mobile responsiveness (375px): open the app in browser DevTools at 375px width, scroll through the complete guide page, confirm no horizontal overflow, no truncated text, and all sections legible
- [ ] T034 [P] Verify tablet responsiveness (768px): repeat T033 at 768px — confirm highlight cards use 2-column grid, all sections correctly spaced
- [ ] T035 [P] Run tests T7 and T9 and confirm both pass — T7 (no overflow at 375px viewport) and T9 (no hardcoded strings)
- [ ] T036 [P] Verify WCAG 2.1 AA color contrast for all text elements on the guide page using browser DevTools Accessibility panel or axe extension — fix any contrast failures in `PianoLearningGuidePage.css`
- [ ] T037 [P] Keyboard navigation check: Tab through the entire guide page; confirm the Back button receives a visible focus ring and is activatable with Enter/Space; confirm no focus traps
- [ ] T038 Run full frontend test suite `npm test` in `frontend/` — confirm all existing tests still pass (no regressions introduced by App.tsx changes)
- [ ] T039 [P] Verify offline availability: open app, load guide page, disable network in DevTools, reload — confirm guide page is served from service worker cache without errors
- [ ] T040 Follow `specs/091-piano-learning-guide-page/quickstart.md` validation steps end-to-end and confirm all steps succeed

**Checkpoint**: All 10 feature tests green; full test suite green; no regressions; guide page accessible, responsive, and offline-capable.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 are parallel
- **Phase 2 (Foundational/Tests)**: Depends on Phase 1 (i18n keys must exist for tests to reference translated strings) — T003 must precede T004–T013; T004–T013 are all parallel; T014 must follow T003–T013
- **Phase 3 (US1)**: Depends on Phase 2 complete (all tests failing). T015 → T016 → T017 → T018 → T019 → T020 (sequential within story)
- **Phase 4 (US2)**: Depends on Phase 3 complete (component scaffold exists). T021 → T022 → T023 → T024
- **Phase 5 (US3)**: Depends on Phase 3 complete. T025 → T026 → T027 → T028. **Can run in parallel with Phase 4.**
- **Phase 6 (US4)**: Depends on Phase 3 complete. T029 → T030 → T031 → T032. **Can run in parallel with Phases 4 & 5.**
- **Phase 7 (Polish)**: Depends on Phases 3–6 complete

### User Story Dependencies

- **US1 (P1)**: Only depends on Foundational phase — no other story dependency
- **US2 (P2)**: Depends on US1 (component scaffold must exist); workflow section added to existing component
- **US3 (P2)**: Depends on US1 (component scaffold must exist); **independent of US2**
- **US4 (P3)**: Depends on US1 (component scaffold must exist); **independent of US2 and US3**

### Parallel Opportunities

- T001 ‖ T002 (i18n files — different files)
- T004–T013 (test implementations — same file but non-overlapping test functions; or split into separate files per story)
- Phases 4, 5, 6 (US2, US3, US4 — all add independent sections to the same `.tsx` file; if working solo, do sequentially; if paired, coordinate file edits)
- T033 ‖ T034 ‖ T036 ‖ T037 ‖ T039 (polish checks — independent verifications)

---

## Parallel Example: Phase 2 (Test Authoring)

```bash
# After T003 (scaffold created), launch all test implementations together:
Task: "Implement test T1 (renders without throwing) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T2 (4 highlight headings present) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T3 (benefit descriptions present) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T4 (workflow 6 steps) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T5 (piano-specific section) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T6 (4 tips) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T7 (375px no overflow) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T8 (back button calls onBack) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T9 (no hardcoded strings) in PianoLearningGuidePage.test.tsx"
Task: "Implement test T10 (MIDI prerequisite note present) in PianoLearningGuidePage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: i18n keys (T001, T002)
2. Complete Phase 2: All 10 tests written and **failing** (T003–T014)
3. Complete Phase 3: US1 implementation (T015–T020)
4. **STOP and VALIDATE**: Tests T1, T2, T3, T8 pass; guide page reachable from app header; feature highlights visible
5. Ship/demo the MVP guide page

### Incremental Delivery

1. Phases 1–3 → MVP guide page with feature highlights (**US1**)
2. Phase 4 → Add practice workflow (**US2**)
3. Phases 5 & 6 → Add piano-specific features + tips (**US3 + US4**, can run in parallel)
4. Phase 7 → Polish, accessibility, regression check

### Notes

- **TDD strictly enforced**: Do not write any component code before the test for that section is written and confirmed failing
- **Commit cadence**: Commit after each completed phase (at minimum after T014, T020, T024, T028, T032, T040)
- **App.tsx edit (T019)**: This is the only edit outside `frontend/src/components/` — make it last within US1 so the component is complete before wiring navigation
- **CSS variables**: Use existing `var(--ls-*)` tokens from the landing theme system where possible so the guide page respects the active theme automatically
