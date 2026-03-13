# Implementation Plan: Graditone Documentation Plugin

**Branch**: `001-docs-plugin` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-docs-plugin/spec.md`

## Summary

A new built-in "Guide" plugin (`📖`) that appears as the rightmost entry in the Graditone navigation bar and renders a single scrollable documentation page covering: app overview, score playback gestures, practice mode, and MusicXML import. The plugin is preloaded automatically via the existing Vite glob resolver — no manual registration is needed. It declares `type: "common"` to appear in the nav bar (not as a landing screen button), `view: "window"` so the host provides back navigation, and `order: 99` to guarantee rightmost placement. Content is static inline JSX requiring no network access.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18+ (existing frontend stack)
**Primary Dependencies**: React (existing), Vitest + Testing Library (existing test stack)
**Storage**: None — content is static inline JSX; no IndexedDB or network required
**Testing**: Vitest + @testing-library/react (existing pattern)
**Target Platform**: Tablet devices (iPad/Android) and desktop; PWA (all Plugin API targets)
**Project Type**: Web application (frontend-only change to existing monorepo)
**Performance Goals**: Plugin load must match existing core plugin load time; content renders within a single paint cycle (<16 ms)
**Constraints**: Must not import any Graditone internal modules — only `../../src/plugin-api/index` (ESLint-enforced boundary); fully offline; no scroll-jank on long content
**Scale/Scope**: Single new plugin directory (`frontend/plugins/guide/`) + one-line sort fix in `builtinPlugins.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | No domain model changes; plugin is presentation-only |
| II. Hexagonal Architecture | ✅ PASS | Plugin imports only from `plugin-api/index` (the designated boundary); no internal module access |
| III. PWA Architecture | ✅ PASS | Static content; fully offline-capable; no network dependency |
| IV. Precision & Fidelity | ✅ PASS | No music timeline logic involved |
| V. Test-First Development | ✅ PASS | Component rendering tests required before implementation |
| VI. Layout Engine Authority | ✅ PASS | No coordinate calculation; no layout engine interaction |
| VII. Regression Prevention | ✅ PASS | Any discovered bugs during implementation must produce a test before a fix |

**Gate result**: No violations. No Complexity Tracking section needed.

## Architecture Decision: Plugin Type Correction

> **IMPORTANT**: The spec clarification session (Q3) recommended `"type": "core"` based on an incorrect understanding that core plugins appear in the top nav bar. Research shows that `type: "core"` plugins appear exclusively on the **landing screen** as large launch buttons and — when activated — replace the entire app viewport via early-return rendering (no nav bar visible). The top navigation bar renders only `type: "common"` plugins that are not hidden.
>
> **Correction**: The Guide plugin MUST be declared `"type": "common"` to appear in the top nav bar, as originally required by the user. The spec's Assumptions and FR-001 must be updated accordingly (done in this plan).

**Final manifest decisions:**

| Field | Value | Reason |
|-------|-------|--------|
| `type` | `"common"` | Only common plugins appear in the top nav bar |
| `view` | `"window"` | Host provides a back button; Guide does not need to own back navigation |
| `pluginApiVersion` | `"1"` | Guide uses only the base `GraditonePlugin` interface (init/dispose/Component); declaring v1 activates the host-provided back-button bar, keeping the plugin implementation minimal |
| `icon` | `"📖"` | Confirmed in clarification Q1 |
| `name` | `"Guide"` | Confirmed in clarification Q1 |
| `order` | `99` | Confirmed in clarification Q4; `sortPluginsByOrder` in App.tsx sorts all plugins by order — Guide at 99 appears after the three core plugins (1/2/3) in the sorted list; since core plugins are filtered from the nav bar, Guide is the first (and rightmost) nav entry |

## Architectural Constraint: Access from Core Plugins (US3)

When a core plugin (Play, Practice, Train) is active, the entire app is replaced via early-return rendering — the header, nav bar, and all overlays are not rendered. The Guide cannot be reached directly from within a core plugin.

**Resolution**: US3 acceptance criteria hold as written for the non-core nav context: when the user is on the landing screen (no plugin active), the Guide is accessible from the right of the nav bar. Navigation back to any other plugin is achieved by:
1. Inside the Guide view: tap the host-provided "← Back" button → returns to landing screen
2. From landing screen: tap any plugin launch button to resume

For a future improvement, a floating "?" button persisted inside core plugin views would enable inline access — but this is out of scope for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/001-docs-plugin/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created here)
```

### Source Code

```text
frontend/plugins/guide/          ← NEW plugin directory
├── plugin.json                  ← Manifest (type: common, view: window, order: 99)
├── index.tsx                    ← Plugin entry (GraditonePlugin contract)
├── GuidePlugin.tsx              ← React content component (scrollable sections)
├── GuidePlugin.css              ← Scoped styles for typography and sections
└── GuidePlugin.test.tsx         ← Vitest unit tests

frontend/src/services/plugins/
└── builtinPlugins.ts            ← MODIFIED: extend common-plugin sort to respect `order` field
                                    (currently only core plugins use order; common sorts alphabetically)
```

**Structure Decision**: Frontend-only change. No backend modifications. Single new directory under `frontend/plugins/` following the established pattern (index.tsx + plugin.json + component + tests). One targeted modification to `builtinPlugins.ts` to honour `order` for common plugins, enabling `order: 99` to position Guide rightmost in the nav bar among common plugins.

