# Implementation Plan: E2E Test Coverage Review

**Branch**: `076-review-e2e-tests` | **Worktree**: `../worktrees/076-review-e2e-tests` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/076-review-e2e-tests/spec.md`

## Summary

Add e2e smoke coverage for the `practice-view-plugin` (zero tests today, core differentiating feature), audit and rationalise the existing 65 test cases across 16 Playwright spec files, and establish an e2e testing approach for external plugins (`sessions-plugin`, `virtual-keyboard-pro`) with each plugin owning its own Playwright config under `plugins-external/<name>/e2e/`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (`.nvmrc`)  
**Primary Dependencies**: Playwright 1.x (e2e), Vitest (unit), React 18, Vite; existing `mockMidi.ts` utility for Web MIDI API stubbing  
**Storage**: N/A (tests are stateless; IndexedDB state reset between tests via `page.goto('/')`)  
**Testing**: Playwright (`frontend/playwright.config.ts`) for e2e; Vitest for unit/integration; each external plugin runs its own Playwright config under `plugins-external/<name>/e2e/`  
**Target Platform**: Chromium (Desktop Chrome) — single browser in CI per existing config; plain HTTP (`PLAYWRIGHT_TEST=1`) on port 5174  
**Project Type**: Web (monorepo: `frontend/` PWA + `plugins-external/` dynamic plugins)  
**Performance Goals**: Total CI e2e runtime must not exceed the pre-audit baseline recorded in `frontend/e2e/AUDIT.md`  
**Constraints**: No physical MIDI hardware in CI — Web MIDI API injected as `page.addInitScript` mock; external plugin tests require plugin `dist/` to be pre-built before test run; Playwright workers=1 in CI (existing config)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Tests operate at the user-story level; no domain model changes |
| II. Hexagonal Architecture | ✅ PASS | No backend ports/adapters changed; MIDI mock is test-only infrastructure |
| III. PWA Architecture | ✅ PASS | Tests run against the existing PWA build; no architecture changes |
| IV. Precision & Fidelity | ✅ PASS | N/A — no timing or music engine changes |
| V. Test-First Development | ✅ PASS | This feature IS the test work; new practice e2e and plugin smoke tests are written before any associated code changes |
| VI. Layout Engine Authority | ✅ PASS | CONVERT candidates (staccato, stem, flat checks) are moved to backend unit tests — reinforces this principle |
| VII. Regression Prevention | ✅ PASS | Audit catalogue captures rationale for every REMOVE to prevent regressions resurfacing silently |

**Gate result**: PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/076-review-e2e-tests/
├── plan.md              # This file
├── research.md          # Phase 0 output — audit, patterns, MIDI mock strategy
├── data-model.md        # Phase 1 output — test taxonomy, AUDIT.md schema
├── quickstart.md        # Phase 1 output — how to add/run e2e tests
├── contracts/           # Phase 1 output — external plugin e2e approach guide
└── tasks.md             # Phase 2 output (speckit.tasks — NOT created by speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── e2e/
│   ├── AUDIT.md                         # NEW: 65-test classification catalogue + baseline timing
│   ├── practice-view-plugin.spec.ts     # NEW: 4 scenarios (launch, no-MIDI, back nav, console errors)
│   ├── [existing 16 spec files]         # KEEP as-is or deleted based on audit
│   └── fixtures/
│       └── webMidiMock.ts               # NEW: Playwright initScript helper wrapping Web MIDI mock
└── playwright.config.ts                 # unchanged

plugins-external/
├── sessions-plugin/
│   ├── e2e/
│   │   ├── playwright.config.ts         # NEW: sessions plugin Playwright config
│   │   └── sessions-plugin.smoke.spec.ts # NEW: smoke test (panel renders, no errors)
│   └── [existing source files]
└── virtual-keyboard-pro/
    ├── e2e/
    │   ├── playwright.config.ts         # NEW: virtual-keyboard-pro Playwright config
    │   └── virtual-keyboard-pro.smoke.spec.ts # NEW: smoke test (panel renders, basic interaction)
    └── [existing source files]
```

**Structure Decision**: Web application (Option 2). All e2e work is purely within `frontend/e2e/` for core tests and `plugins-external/<name>/e2e/` for plugin smoke tests. No backend or WASM changes. No new `src/` files except `frontend/e2e/fixtures/webMidiMock.ts`.

## Complexity Tracking

No constitution violations.
