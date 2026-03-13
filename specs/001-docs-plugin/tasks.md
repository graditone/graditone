# Tasks: Graditone Documentation Plugin

**Input**: Design documents from `/specs/001-docs-plugin/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- All paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Create the plugin directory — required before any file can be created inside it

- [X] T001 Create plugin directory `frontend/plugins/guide/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plugin manifest and entry-point skeleton — required before any user story can be independently tested

**⚠️ CRITICAL**: The Vite glob in `builtinPlugins.ts` auto-discovers any directory under `frontend/plugins/` that has both an `index.{ts,tsx}` and a `plugin.json`. Both files must exist before the plugin appears in the nav bar.

- [X] T002 [P] Create plugin manifest in `frontend/plugins/guide/plugin.json` with `id: "guide"`, `name: "Guide"`, `icon: "📖"`, `type: "common"`, `view: "window"`, `pluginApiVersion: "1"`, `order: 99`
- [X] T003 Create entry-point skeleton in `frontend/plugins/guide/index.tsx` — exports a valid `GraditonePlugin` object with `init`, `dispose` and a stub `Component` that renders `null` (Vite discoverable; replaced in T007)

**Checkpoint**: `npm run dev` — "Guide" entry should now appear rightmost in the Graditone nav bar; tapping it shows a blank window with a host "← Back" button

---

## Phase 3: User Story 1 — First-Time User Orientation (Priority: P1) 🎯 MVP

**Goal**: User opens Graditone, sees the Guide entry (📖) as the rightmost nav item, taps it, and is shown a clear "What is Graditone?" overview.

**Independent Test**: Open the app → tap the Guide entry (rightmost in nav bar) → verify overview section renders with a description of Graditone. Verifiable without any other user story being complete.

> **⚠️ TDD**: Write T004 first and verify tests FAIL before implementing T005–T007.

- [X] T004 [US1] Write `frontend/plugins/guide/GuidePlugin.test.tsx` with:
  - Smoke test: `GuidePlugin` component renders without crashing
  - Test: `plugin.json` declares `type: "common"` (nav bar placement — FR-001)
  - Test: `plugin.json` declares `order: 99` (rightmost placement — FR-002)
  - Test: `plugin.json` declares `icon: "📖"` and `name: "Guide"` (FR-002)
  - Test: rendered output contains heading "What is Graditone?" (FR-005)
  - Test: exported `guidePlugin` has `init` function and `Component` property (GraditonePlugin contract)
- [X] T005 [US1] Create `frontend/plugins/guide/GuidePlugin.tsx` — stateless React component rendering a `<div className="guide-plugin">` containing a `<section>` with `<h2>What is Graditone?</h2>` and a paragraph describing Graditone as a tablet-native app for interactive music scores, designed for practice and performance (FR-005)
- [X] T006 [US1] Create `frontend/plugins/guide/GuidePlugin.css` — base layout styles using `--color-*` CSS custom properties (same theming as `TrainPlugin.css`): `.guide-plugin` with `padding: 24px`, `max-width: 720px`, `margin: 0 auto`, `overflow-y: auto`, `background: var(--color-surface, #fff)`, `color: var(--color-text-secondary, #555)`; `.guide-section` with `margin-bottom: 2.5rem`
- [X] T007 [US1] Replace the stub `Component` in `frontend/plugins/guide/index.tsx` with `GuidePluginWithContext` (imports `GuidePlugin` from `./GuidePlugin`; only `../../src/plugin-api/index` permitted as host import)

**Checkpoint**: All T004 tests pass. Guide entry visible in nav bar; tapping opens view with "What is Graditone?" section; "← Back" returns to previous screen. **This is the MVP.**

---

## Phase 4: User Story 2 — Feature Discovery by Section (Priority: P2)

**Goal**: Guide view displays all five required sections on a single scrollable page — app overview, score playback, practice mode, train mode, and MusicXML loading — each with accurate, actionable instructions.

**Independent Test**: Open the Guide plugin → verify five section headings are present on the single scrollable page → scroll to each section and verify it contains at least one instruction.

> **⚠️ TDD**: Write T008 first and verify new test cases FAIL before implementing T009–T013.

- [X] T008 [US2] Add section heading tests to `frontend/plugins/guide/GuidePlugin.test.tsx`:
  - Test: heading "Playing a Score" present in rendered output (FR-006)
  - Test: heading "Practice Mode" present in rendered output (FR-007)
  - Test: heading "Train" present in rendered output (FR-008)
  - Test: heading "Loading a Score" present in rendered output (FR-009)
  - Test: exactly five `<section>` elements rendered (FR-004)
- [X] T009 [P] [US2] Add "Playing a Score" section to `frontend/plugins/guide/GuidePlugin.tsx` — `<section>` with `<h2>Playing a Score</h2>`, a `<ul>` documenting all four gestures: tap to seek, long-press to pin, long-press second note to loop, tap inside loop to clear (FR-006)
- [X] T010 [P] [US2] Add "Practice Mode" section to `frontend/plugins/guide/GuidePlugin.tsx` — `<section>` with `<h2>Practice Mode</h2>`, an `<ol>` listing: open Practice plugin, connect MIDI keyboard, tap Practice, play highlighted note to advance, continue to end (FR-007)
- [X] T011 [P] [US2] Add "Train" section to `frontend/plugins/guide/GuidePlugin.tsx` — `<section>` with `<h2>Train</h2>` covering: (a) three complexity levels (Low — 8 notes/step/40 BPM, Mid — 16 notes/step/80 BPM, High — 20 notes/flow/100 BPM); (b) two modes (Flow — play all notes in time; Step — wait for correct note before advancing); (c) three exercise presets (Random, C4 Scale, Score — notes extracted from loaded score); (d) input sources (MIDI keyboard auto-detected or device microphone); (e) that the complexity level is remembered across sessions (FR-008)
- [X] T012 [P] [US2] Add "Loading a Score" section to `frontend/plugins/guide/GuidePlugin.tsx` — `<section>` with `<h2>Loading a Score</h2>` covering: (a) what MusicXML is and supported extensions (.mxl, .musicxml, .xml); (b) how to export from MuseScore (free), Sibelius, Finale, or Dorico; (c) the bundled preloaded demo scores (Bach, Beethoven, Burgmuller, Chopin, Pachelbel) available without uploading; (d) how to load a file from the device via the score picker; (e) that uploaded scores are stored in the browser and persist across sessions (FR-009)
- [X] T013 [US2] Add section typography styles to `frontend/plugins/guide/GuidePlugin.css` — `.guide-section h2` with `font-size: 1.25rem`, `color: var(--color-text, #222)`, `border-bottom: 2px solid var(--color-accent, #4a90e2)` accent line; `.guide-section p`, `.guide-section li` spacing with `color: var(--color-text-secondary, #555)`; `ul`/`ol` left padding (all tokens from `--color-*` system, Contract 5, SC-006 readability)

**Checkpoint**: All T008 tests pass. Five sections visible and scrollable; "Playing a Score" gesture list, "Practice Mode" numbered steps, "Train" complexity/mode/preset table, "Loading a Score" MusicXML instructions — all present.

---

## Phase 5: User Story 3 — Access from Any App State (Priority: P3)

**Goal**: The Guide is persistently reachable from the nav bar; back navigation returns to the previous screen without losing state.

**Independent Test**: From the landing screen, tap Guide → verify content loads → tap "← Back" → verify landing screen returns. Tap Guide again from the nav bar → verify Guide re-opens.

> **⚠️ TDD**: Write T014 first; verify FAIL before implementing T015.

- [X] T014 [US3] Add back-navigation contract tests to `frontend/plugins/guide/GuidePlugin.test.tsx`:
  - Test: `plugin.json` declares `view: "window"` (host renders back button — R-002)
  - Test: `plugin.json` declares `pluginApiVersion: "1"` (activates v1/v2 host back-button path — R-002)
- [X] T015 [US3] Add defensive context guard to `frontend/plugins/guide/index.tsx` — `GuidePluginWithContext` returns `<div className="guide-plugin">Guide: context not initialised</div>` when `_context` is null (matches existing plugin pattern; prevents blank crash if host calls Component before init)

**Checkpoint**: All US3 tests pass. Guide is always reachable from the nav bar on the landing screen. Back navigation works using the host-provided "← Back" button. Plugin state is cleanly reset via `dispose()`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Responsive layout validation, documentation currency

- [X] T016 [P] Add responsive CSS breakpoints to `frontend/plugins/guide/GuidePlugin.css` — ensure `.guide-plugin` content does not overflow or truncate on screen widths 375 px–1366 px (SC-006); `max-width: 720px` + `box-sizing: border-box` on root + `word-wrap: break-word` on text
- [X] T017 [P] Update `FEATURES.md` to document the Guide plugin under a "Help & Documentation" section
- [X] T018 [P] Update `PLUGINS.md` to list the Guide plugin (id: guide, type: common, order: 99) with its purpose and manifest fields

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (directory must exist) — **blocks all user stories**
- **US1 (Phase 3)**: Depends on T002 + T003 (manifest + entry point must exist)
- **US2 (Phase 4)**: Depends on T005 (GuidePlugin.tsx must exist to add sections to)
- **US3 (Phase 5)**: Depends on T003 + T007 (index.tsx complete); US1 and US2 should be complete for meaningful validation
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — independently testable ✅
- **US2 (P2)**: Depends on US1 (GuidePlugin.tsx and GuidePlugin.css must exist); independently testable after US1 ✅
- **US3 (P3)**: Depends on US1 + US2 for meaningful end-to-end validation; manifest contract tests (T014) are independently testable ✅

### Parallel Opportunities

- T002 and T003 can be written in parallel (plugin.json and index.tsx are independent files)
- T009, T010, T011, T012 can all be written in parallel (each adds a separate `<section>` to `GuidePlugin.tsx`, all touching the same file — coordinate to avoid merge conflicts; safest to do sequentially)
- T016, T017, T018 can all run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# Both can be done simultaneously (different files):
Task T002: Create frontend/plugins/guide/plugin.json
Task T003: Create frontend/plugins/guide/index.tsx (skeleton)
```

## Parallel Example: User Story 2 (Section Content)

```
# T008 must complete first (tests), then sections can be written in parallel
# (same file — coordinate to avoid conflicts, or do sequentially):
Task T009: "Playing a Score" section in GuidePlugin.tsx
Task T010: "Practice Mode" section in GuidePlugin.tsx
Task T011: "Train" section in GuidePlugin.tsx
Task T012: "Loading a Score" section in GuidePlugin.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T003)
3. Complete Phase 3: User Story 1 (T004–T007)
4. **STOP and VALIDATE**: Guide entry visible in nav bar; overview section readable
5. Demo / deploy if ready — this is a useful, working documentation plugin

### Incremental Delivery

1. Setup + Foundational → Plugin auto-discovered ✅
2. US1 → Overview section live → **MVP** ✅
3. US2 → All five sections → Full reference guide ✅
4. US3 → Back-nav contract validated → Robustness confirmed ✅
5. Polish → Responsive layout + docs updated → Feature complete ✅

---

## Summary

| Phase | Tasks | User Story | Files Touched |
|-------|-------|-----------|---------------|
| 1 — Setup | T001 | — | `frontend/plugins/guide/` (dir) |
| 2 — Foundational | T002–T003 | — | `plugin.json`, `index.tsx` |
| 3 — US1 (P1) 🎯 | T004–T007 | US1 | `GuidePlugin.test.tsx`, `GuidePlugin.tsx`, `GuidePlugin.css`, `index.tsx` |
| 4 — US2 (P2) | T008–T013 | US2 | `GuidePlugin.test.tsx`, `GuidePlugin.tsx`, `GuidePlugin.css` |
| 5 — US3 (P3) | T014–T015 | US3 | `GuidePlugin.test.tsx`, `index.tsx` |
| 6 — Polish | T016–T018 | — | `GuidePlugin.css`, `FEATURES.md`, `PLUGINS.md` |

**Total tasks**: 18 | **Parallelizable**: T002, T003, T009, T010, T011, T012, T016, T017, T018 | **New files**: 5 | **Existing files modified**: 0 (plugin auto-discovered via Vite glob)
