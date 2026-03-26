# Quickstart: Refactor SVG Renderer

**Feature**: 058-refactor-svg-renderer  
**Date**: 2026-03-26

## Prerequisites

- Node.js 18+ and npm/pnpm
- Frontend dev dependencies installed (`cd frontend && npm install`)

## Verify Current State (Before Refactoring)

```bash
# Run all existing tests to establish baseline
cd frontend
npx vitest run

# Run just the renderer-related tests
npx vitest run src/components/LayoutRenderer.test.tsx tests/unit/LayoutRenderer.test.tsx tests/unit/renderUtils.test.ts tests/performance/Virtualization.test.tsx
```

All tests must pass before starting any refactoring work.

## Development Workflow

### Step 1: Split renderUtils.ts into focused modules

```bash
# Create new utility files
touch src/utils/svgHelpers.ts
touch src/utils/viewportUtils.ts
touch src/utils/renderConfigUtils.ts
touch src/utils/smuflGlyphs.ts
```

Move functions to their respective modules, then update `renderUtils.ts` to be a barrel re-export. Run tests after each move:

```bash
npx vitest run tests/unit/renderUtils.test.ts
```

### Step 2: Create renderer module directory and extract classes

```bash
mkdir -p src/components/renderer
touch src/components/renderer/RenderingPipeline.ts
touch src/components/renderer/HighlightController.ts
touch src/components/renderer/InteractionHandler.ts
touch src/components/renderer/LoopOverlayRenderer.ts
```

Extract methods from `LayoutRenderer.tsx` into each class. Run the full test suite after each extraction:

```bash
npx vitest run
```

### Step 3: Verify no regressions

```bash
# Full test suite
npx vitest run

# Type checking
npx tsc --noEmit

# Lint
npx eslint src/components/LayoutRenderer.tsx src/components/renderer/ src/utils/
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/LayoutRenderer.tsx` | Thin orchestrator (edit to delegate) |
| `src/components/renderer/RenderingPipeline.ts` | SVG rendering pipeline (new) |
| `src/components/renderer/HighlightController.ts` | Highlight rAF loop (new) |
| `src/components/renderer/InteractionHandler.ts` | Click delegation (new) |
| `src/components/renderer/LoopOverlayRenderer.ts` | Loop overlay (new) |
| `src/utils/svgHelpers.ts` | SVG factories (new) |
| `src/utils/viewportUtils.ts` | Viewport queries (new) |
| `src/utils/renderConfigUtils.ts` | Config factories (new) |
| `src/utils/smuflGlyphs.ts` | SMuFL codepoints (new) |
| `src/utils/renderUtils.ts` | Barrel re-export (modified) |

## Validation Checklist

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npx eslint src/` — no lint errors
- [ ] No file in `src/components/renderer/` exceeds 400 lines
- [ ] `LayoutRenderer.tsx` is ≤ 200 lines
- [ ] `renderUtils.ts` is a barrel re-export (≤ 20 lines)
- [ ] No circular dependencies (verify with `madge --circular src/components/LayoutRenderer.tsx`)
