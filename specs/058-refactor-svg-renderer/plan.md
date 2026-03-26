# Implementation Plan: Refactor SVG Renderer

**Branch**: `058-refactor-svg-renderer` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/058-refactor-svg-renderer/spec.md`

## Summary

Decompose the monolithic `LayoutRenderer.tsx` (~1,520 lines) and `renderUtils.ts` (~550 lines) into focused, single-responsibility modules. The renderer currently mixes glyph rendering pipeline, highlight state management (rAF loop + 4 highlight types), interaction handling (click delegation), loop overlay rendering, and utility concerns (config, viewport, SVG factories, SMuFL data) into two large files. Research reveals that highlight infrastructure (`FrameBudgetMonitor`, `computeHighlightPatch`, `HighlightIndex`, `createSourceKey`) is already extracted to `services/highlight/`. The refactoring extracts the remaining interleaved concerns into plain classes with encapsulated state, keeping `LayoutRenderer` as a thin React orchestrator.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+ (class component)
**Primary Dependencies**: React, vitest, @testing-library/react
**Storage**: N/A (frontend-only refactoring)
**Testing**: vitest (6 test files, ~1,680 lines total)
**Target Platform**: Tablet PWA (Chrome 57+, Safari 11+, Edge 16+)
**Project Type**: Web application (monorepo: `frontend/` + `backend/`)
**Performance Goals**: 60fps highlight updates, <200ms initial render, frame budget degradation
**Constraints**: Zero visual regressions, zero public interface changes, existing tests pass with import-path-only updates
**Scale/Scope**: 2 source files → 6-8 focused modules; 6 test files requiring import path updates only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | PASS | Refactoring preserves existing domain terminology (System, Staff, GlyphRun, etc.) |
| II. Hexagonal Architecture | PASS | Renderer remains a pure infrastructure adapter displaying layout engine geometry |
| III. Progressive Web Application | PASS | No PWA/offline changes; frontend-only code reorganization |
| IV. Precision & Fidelity | PASS | No timing or coordinate changes; layout engine output consumed unchanged |
| V. Test-First Development | PASS | All existing tests preserved; import paths updated only |
| VI. Layout Engine Authority | PASS | Renderer continues to consume geometry from Rust/WASM layout engine exclusively; no coordinate calculations introduced |
| VII. Regression Prevention | PASS | Existing test suite detects regressions; any bugs found during refactor will follow test-first protocol |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/058-refactor-svg-renderer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (module dependency graph)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (module interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── LayoutRenderer.tsx          # Thin orchestrator (lifecycle + delegation)
│   │   └── renderer/                   # NEW: extracted rendering modules
│   │       ├── RenderingPipeline.ts    # System→StaffGroup→Staff→GlyphRun SVG traversal
│   │       ├── HighlightController.ts  # Highlight state + rAF loop (uses existing services/highlight/)
│   │       ├── InteractionHandler.ts   # Click delegation + note identification
│   │       └── LoopOverlayRenderer.ts  # Loop region overlay rendering
│   ├── utils/
│   │   ├── renderUtils.ts             # Barrel re-export for backward compat (thin)
│   │   ├── svgHelpers.ts              # NEW: SVG element factories (createSVGElement, createSVGGroup, svgNS)
│   │   ├── viewportUtils.ts           # NEW: Viewport queries (getVisibleSystems, intersectsViewport)
│   │   ├── renderConfigUtils.ts       # NEW: Config factories + validation
│   │   └── smuflGlyphs.ts            # NEW: SMuFL codepoint mappings + glyph metadata
│   ├── services/
│   │   └── highlight/                  # EXISTING (already extracted)
│   │       ├── FrameBudgetMonitor.ts
│   │       ├── computeHighlightPatch.ts
│   │       ├── HighlightIndex.ts
│   │       └── sourceMapping.ts
│   ├── types/
│   │   ├── RenderConfig.ts            # Existing (unchanged)
│   │   └── Viewport.ts               # Existing (unchanged)
│   └── wasm/
│       └── layout.ts                  # Existing layout types (unchanged)
└── tests/
    ├── unit/
    │   ├── LayoutRenderer.test.tsx     # Import paths updated
    │   └── renderUtils.test.ts        # Import paths updated
    └── performance/
        └── Virtualization.test.tsx     # Import paths updated
```

**Structure Decision**: Web application structure. New modules extracted into `frontend/src/components/renderer/` (rendering concerns) and split `frontend/src/utils/` files (utility concerns). Existing `services/highlight/` already extracted — consumed unchanged. Barrel re-export in `renderUtils.ts` provides backward compatibility for external consumers.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
