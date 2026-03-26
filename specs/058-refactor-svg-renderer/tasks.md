# Tasks: Refactor SVG Renderer

**Input**: Design documents from `/specs/058-refactor-svg-renderer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No new tests requested. Existing tests must pass unchanged (barrel re-exports preserve all import paths).

**Organization**: Tasks grouped by user story. US1 (identical rendering) and US2 (highlight responsiveness) are both P1 and share foundational work. US3 (interaction), US4 (developer experience), US5 (loop overlay) follow in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Establish baseline and create module file structure

- [X] T001 Run full test suite to establish pre-refactor baseline (`cd frontend && npx vitest run`)
- [X] T002 Run type checker to confirm clean state (`cd frontend && npx tsc --noEmit`)
- [X] T003 Create renderer module directory at `frontend/src/components/renderer/`

---

## Phase 2: Foundational (renderUtils.ts Decomposition)

**Purpose**: Split the utility file into focused modules. This MUST complete before renderer extraction since the new renderer modules will import from the split utilities.

**⚠️ CRITICAL**: No renderer extraction (Phase 3+) can begin until barrel re-exports are in place and all tests pass.

- [X] T004 [P] Extract SVG element factories (`svgNS`, `createSVGElement`, `createSVGGroup`) from `frontend/src/utils/renderUtils.ts` into `frontend/src/utils/svgHelpers.ts`
- [X] T005 [P] Extract viewport query functions (`createViewportFromSVG`, `intersectsViewport`, `getViewportArea`, `validateViewport`, `getVisibleSystems`) from `frontend/src/utils/renderUtils.ts` into `frontend/src/utils/viewportUtils.ts`
- [X] T006 [P] Extract config factory functions (`createDefaultConfig`, `createDarkModeConfig`, `validateRenderConfig`, `isValidCSSColor`) from `frontend/src/utils/renderUtils.ts` into `frontend/src/utils/renderConfigUtils.ts`
- [X] T007 [P] Extract SMuFL codepoint mappings and glyph metadata from `frontend/src/utils/renderUtils.ts` into `frontend/src/utils/smuflGlyphs.ts` (skipped: no SMuFL data in renderUtils.ts — codepoint logic lives in LayoutRenderer.tsx and moves with RenderingPipeline)
- [X] T008 Replace `frontend/src/utils/renderUtils.ts` body with barrel re-exports from `svgHelpers`, `viewportUtils`, `renderConfigUtils`, and `smuflGlyphs`
- [X] T009 Run full test suite to confirm barrel re-exports preserve all existing imports (`npx vitest run && npx tsc --noEmit`)

**Checkpoint**: renderUtils.ts split complete — all tests pass, all consumers resolve imports unchanged

---

## Phase 3: User Story 1 — Maintain identical score rendering (Priority: P1) 🎯 MVP

**Goal**: Extract the glyph rendering pipeline from LayoutRenderer.tsx into a dedicated RenderingPipeline class while producing pixel-identical SVG output

**Independent Test**: Load any preloaded score and verify all existing rendering tests pass. SVG output must be visually identical to pre-refactor baseline.

### Implementation for User Story 1

- [X] T010 [US1] Create `RenderingPipeline` class skeleton with `init(svg)`, `renderAll(layout, config, viewport, options)`, and `dispose()` methods in `frontend/src/components/renderer/RenderingPipeline.ts` per contract spec
- [X] T011 [US1] Move rendering pipeline methods (`renderSVG`, `renderSystem`, `renderStaffGroup`, `renderStaff`, `renderGlyphRun`, `renderBarLines`, `renderStaffLines`, `renderLedgerLines`) from `frontend/src/components/LayoutRenderer.tsx` into `RenderingPipeline` class
- [X] T012 [US1] Move annotation rendering methods (`renderNotationDots`, `renderTieArcs`, `renderSlurArcs`, `renderFingeringGlyphs`, `renderMeasureNumbers`, `renderVoltaBrackets`, `renderOttavaBrackets`) from `frontend/src/components/LayoutRenderer.tsx` into `RenderingPipeline` class
- [X] T013 [US1] Update `frontend/src/components/LayoutRenderer.tsx` to instantiate `RenderingPipeline` in constructor, call `init(svg)` in `componentDidMount`, delegate `renderSVG()` calls to `pipeline.renderAll()`, and call `dispose()` in `componentWillUnmount`
- [X] T014 [US1] Update `RenderingPipeline` imports to use new utility modules (`svgHelpers`, `viewportUtils`, `smuflGlyphs`) instead of `renderUtils`
- [X] T015 [US1] Run full test suite and type checker to confirm zero rendering regressions (`npx vitest run && npx tsc --noEmit`)

**Checkpoint**: Score rendering works identically via the extracted RenderingPipeline. All rendering tests pass.

---

## Phase 4: User Story 2 — Maintain playback highlight responsiveness (Priority: P1)

**Goal**: Extract the highlight rAF loop, DOM application, and highlight state from LayoutRenderer.tsx into a dedicated HighlightController class

**Independent Test**: Play back a score and verify highlights appear in time with audio. Pinned/error/expected highlights work correctly. Frame budget degradation is preserved.

### Implementation for User Story 2

- [X] T016 [US2] Create `HighlightController` class skeleton with `init(svg)`, `buildIndex(notes, sourceToNoteIdMap)`, `startLoop(tickSourceRef)`, `stopLoop()`, `updatePinned(ids)`, `updateError(ids)`, `updateExpected(ids)`, and `dispose()` methods in `frontend/src/components/renderer/HighlightController.ts` per contract spec
- [X] T017 [US2] Move highlight state fields (`highlightIndex`, `frameBudgetMonitor`, `rafId`, `prevHighlightedIds`, `prevPinnedIds`, `prevErrorIds`, `prevExpectedIds`) from `frontend/src/components/LayoutRenderer.tsx` into `HighlightController` class
- [X] T018 [US2] Move highlight methods (`startHighlightLoop`, `stopHighlightLoop`, `highlightTick`, `applyHighlightClasses`, `updatePinnedHighlights`, `updateErrorHighlights`, `updateExpectedHighlights`, `buildHighlightIndex`) from `frontend/src/components/LayoutRenderer.tsx` into `HighlightController` class
- [X] T019 [US2] Update `frontend/src/components/LayoutRenderer.tsx` to instantiate `HighlightController` in constructor, call `init(svg)` in `componentDidMount`, delegate highlight operations to `highlightCtrl`, and call `dispose()` in `componentWillUnmount`
- [X] T020 [US2] Preserve two-tier model in `shouldComponentUpdate()`: keep the gate logic in `LayoutRenderer.tsx` that decides between full re-render (Tier 1) and letting the rAF loop handle highlight-only changes (Tier 2)
- [X] T021 [US2] Run full test suite and type checker to confirm zero highlight regressions (`npx vitest run && npx tsc --noEmit`)

**Checkpoint**: Highlight rAF loop runs via HighlightController. Two-tier model preserved. All tests pass.

---

## Phase 5: User Story 3 — Preserve note interaction and selection (Priority: P2)

**Goal**: Extract click event delegation from LayoutRenderer.tsx into a dedicated InteractionHandler class

**Independent Test**: Click on notes across different staves and instruments. Verify correct note identification and callback firing.

### Implementation for User Story 3

- [X] T022 [US3] Create `InteractionHandler` class skeleton with `init(svg)`, `setCallback(onNoteClick)`, and `dispose()` methods in `frontend/src/components/renderer/InteractionHandler.ts` per contract spec
- [X] T023 [US3] Move `handleSVGClick` method and DOM-walking logic from `frontend/src/components/LayoutRenderer.tsx` into `InteractionHandler` class
- [X] T024 [US3] Update `frontend/src/components/LayoutRenderer.tsx` to instantiate `InteractionHandler` in constructor, call `init(svg)` in `componentDidMount`, update callback via `interaction.setCallback()` on prop changes, and call `dispose()` in `componentWillUnmount`
- [X] T025 [US3] Run full test suite and type checker to confirm zero interaction regressions (`npx vitest run && npx tsc --noEmit`)

**Checkpoint**: Click interaction works via InteractionHandler. All tests pass.

---

## Phase 6: User Story 4 — Improve developer experience (Priority: P2)

**Goal**: Verify module sizes, ensure LayoutRenderer is a thin orchestrator, and confirm the modular structure meets maintainability goals

**Independent Test**: Count lines in each file. Verify no module exceeds 400 lines. Verify LayoutRenderer orchestrator is ≤ 200 lines.

### Implementation for User Story 4

- [X] T026 [US4] Remove all dead code from `frontend/src/components/LayoutRenderer.tsx` — verify only lifecycle orchestration, delegation calls, and the `render()` method remain
- [X] T027 [US4] Verify `frontend/src/components/LayoutRenderer.tsx` exports `LayoutRenderer` component and `LayoutRendererProps` type (preserving public interface for consumers)
- [X] T028 [US4] Verify no file in `frontend/src/components/renderer/` exceeds 400 lines and `LayoutRenderer.tsx` is ≤ 200 lines (`wc -l frontend/src/components/renderer/*.ts frontend/src/components/LayoutRenderer.tsx`)
- [X] T029 [US4] Verify no circular dependencies exist (`npx madge --circular frontend/src/components/LayoutRenderer.tsx` or manual import path review)
- [X] T030 [US4] Run full test suite, type checker, and linter to confirm final state is clean (`npx vitest run && npx tsc --noEmit && npx eslint frontend/src/components/LayoutRenderer.tsx frontend/src/components/renderer/ frontend/src/utils/`)

**Checkpoint**: All modules are focused and small. Developer can locate any concern in ≤ 1 file.

---

## Phase 7: User Story 5 — Preserve loop region overlay rendering (Priority: P3)

**Goal**: Extract loop overlay rendering from LayoutRenderer.tsx into a dedicated LoopOverlayRenderer class

**Independent Test**: Set a loop region and verify the overlay renders at correct boundaries across visible systems.

### Implementation for User Story 5

- [X] T031 [US5] Create `LoopOverlayRenderer` class skeleton with `renderOverlay(svg, layout, loopRegion, notes, viewport)` and `clear(svg)` methods in `frontend/src/components/renderer/LoopOverlayRenderer.ts` per contract spec
- [X] T032 [US5] Move `renderLoopOverlay` method and `tickToX` helper from `frontend/src/components/LayoutRenderer.tsx` into `LoopOverlayRenderer` class
- [X] T033 [US5] Update `frontend/src/components/LayoutRenderer.tsx` to instantiate `LoopOverlayRenderer` in constructor and delegate loop overlay calls
- [X] T034 [US5] Run full test suite and type checker to confirm zero loop overlay regressions (`npx vitest run && npx tsc --noEmit`)

**Checkpoint**: Loop overlay renders via LoopOverlayRenderer. All tests pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final line-count verification, documentation, and cleanup

- [X] T035 [P] Run quickstart.md validation checklist from `specs/058-refactor-svg-renderer/quickstart.md`
- [X] T036 [P] Verify all preloaded scores render correctly: Bach Invention, Beethoven Fur Elise, Burgmuller Arabesque, Chopin Nocturne, Pachelbel Canon
- [X] T037 Update project documentation if any README references to file locations need updating

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all renderer extraction
- **US1 Rendering (Phase 3)**: Depends on Foundational — can start first (MVP)
- **US2 Highlights (Phase 4)**: Depends on Foundational — can start in parallel with US1 (different code regions)
- **US3 Interaction (Phase 5)**: Depends on Foundational — can start in parallel with US1/US2 (different code region)
- **US5 Loop Overlay (Phase 7)**: Depends on Foundational — can start in parallel with US1/US2/US3 (different code region)
- **US4 Developer Experience (Phase 6)**: Depends on US1 + US2 + US3 + US5 completion (verification phase)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1) — Rendering**: Independent. Extract rendering pipeline first as MVP.
- **US2 (P1) — Highlights**: Independent of US1. Can proceed in parallel. Different methods/fields.
- **US3 (P2) — Interaction**: Independent. Different methods (~80 lines, no overlap with US1/US2).
- **US4 (P2) — Developer Experience**: Depends on US1 + US2 + US3 + US5. Verification only.
- **US5 (P3) — Loop Overlay**: Independent. Different methods (~120 lines, no overlap with US1/US2/US3).

### Within Each User Story

1. Create class skeleton per contract specification
2. Move methods and state from LayoutRenderer.tsx
3. Update LayoutRenderer.tsx to delegate to new class
4. Run tests to verify zero regressions

### Parallel Opportunities

Within Phase 2 (Foundational):
- T004, T005, T006, T007 can all run in parallel (different files, no dependencies)

After Phase 2 completes:
- US1 (Phase 3), US2 (Phase 4), US3 (Phase 5), US5 (Phase 7) can all start in parallel since they extract different, non-overlapping code regions from LayoutRenderer.tsx

Within Phase 8 (Polish):
- T035, T036 can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# All four utility extractions can run in parallel:
Task T004: Extract SVG factories → svgHelpers.ts
Task T005: Extract viewport queries → viewportUtils.ts
Task T006: Extract config factories → renderConfigUtils.ts
Task T007: Extract SMuFL data → smuflGlyphs.ts

# Then barrel re-export (depends on T004-T007):
Task T008: Replace renderUtils.ts with barrel re-exports

# Then verify (depends on T008):
Task T009: Run full test suite
```

## Parallel Example: Renderer Extraction (Phases 3-7)

```
# After Phase 2, all renderer extractions can proceed in parallel:
Stream A (US1): T010 → T011 → T012 → T013 → T014 → T015
Stream B (US2): T016 → T017 → T018 → T019 → T020 → T021
Stream C (US3): T022 → T023 → T024 → T025
Stream D (US5): T031 → T032 → T033 → T034

# After all streams complete:
Stream E (US4): T026 → T027 → T028 → T029 → T030
```

---

## Implementation Strategy

### MVP Scope

**User Story 1 only** (Phase 3) delivers the core value: the rendering pipeline extracted into a focused module. Even if no other extraction is done, this reduces LayoutRenderer.tsx by ~600 lines and creates the precedent for the remaining extractions.

### Incremental Delivery

1. **Phase 1-2**: Setup + utility split (foundation)
2. **Phase 3**: US1 — Rendering pipeline extraction (MVP, reduces monolith by ~600 lines)
3. **Phase 4**: US2 — Highlight controller extraction (reduces monolith by ~400 more lines)
4. **Phase 5**: US3 — Interaction handler extraction (reduces monolith by ~80 more lines)
5. **Phase 7**: US5 — Loop overlay extraction (reduces monolith by ~120 more lines)
6. **Phase 6**: US4 — Verification that all module sizes meet targets
7. **Phase 8**: Polish and final validation

### Risk Mitigation

Each extraction is followed by a full test suite run (T015, T021, T025, T030, T034). If any test fails, the extraction can be reverted independently since each phase modifies only its target code region.
