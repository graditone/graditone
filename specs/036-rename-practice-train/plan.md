# Implementation Plan: Rename Practice Plugin to Train & Add Plugin Order Field

**Branch**: `036-rename-practice-train` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/036-rename-practice-train/spec.md`

## Summary

Rename the built-in Practice plugin (`frontend/plugins/practice-view/`) to Train (`frontend/plugins/train-view/`), updating all user-visible text, code identifiers, CSS class names, file names, plugin id, and storage keys. In parallel, extend `PluginManifest` with an optional `order: number` field and add navigation-sort logic in `App.tsx` so plugins render in ascending `order` order (Play Score: 1, Train: 2), with unordered plugins trailing alphabetically by id. A one-time localStorage key migration (`practice-*` → `train-*`) preserves user settings across the update.

## Technical Context

**Language/Version**: TypeScript 5 + React 18 (frontend only; no backend change)
**Primary Dependencies**: React, Vite, Vitest, Testing Library — no new dependencies introduced
**Storage**: localStorage (`practice-complexity-level-v1` → `train-complexity-level-v1`), sessionStorage (`practice-tips-v1-dismissed` → `train-tips-v1-dismissed`); IndexedDB not affected (built-in plugins are held in-memory only, never written to IndexedDB)
**Testing**: Vitest + React Testing Library; all existing Practice plugin tests updated in-place
**Target Platform**: Tablet PWA (iPad/Surface/Android) — Chrome 57+, Safari 11+
**Project Type**: Web application (frontend-only change)
**Performance Goals**: Navigation sort: O(n log n) over a handful of plugins — negligible
**Constraints**: Zero functional regression; all existing tests must pass after rename; offline-first PWA service worker cache invalidation happens via normal Vite asset hash rotation
**Scale/Scope**: ~15 files renamed/edited in `frontend/plugins/practice-view/`, ~5 files in `frontend/src/`, 4 spec annotation files in `specs/031-practice-view-plugin/`, 1 `PLUGINS.md` update, 1 `FEATURES.md` update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | "Train" replaces "Practice" as the ubiquitous-language name for this plugin. No domain concept changes — purely a naming change. |
| II. Hexagonal Architecture | ✅ PASS | No architecture changes. Plugin remains isolated behind Plugin API boundary. |
| III. PWA Architecture | ✅ PASS | No service worker or manifest.json changes. Asset hash rotation invalidates cache automatically via Vite. |
| IV. Precision & Fidelity | ✅ PASS | No music timing or notation logic touched. |
| V. Test-First Development | ⚠️ REQUIRED | Rename itself is refactoring (no new behaviour), so existing test-first coverage is sufficient. However, the two NEW behaviours — `order` field sort and storage key migration — MUST have tests written before implementation. |
| VI. Layout Engine Authority | ✅ PASS | No coordinate calculations added or changed. |
| VII. Regression Prevention | ⚠️ REQUIRED | Any bug found during rename must get a regression test before fixing. The rename must leave the test suite green. |

**Gate result**: PASS with obligations — Principles V and VII impose test-first requirements for the two new behaviours tracked in tasks.

## Project Structure

### Documentation (this feature)

```text
specs/036-rename-practice-train/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/
│   └── plugin-manifest-order.ts   ← updated PluginManifest shape
└── tasks.md         ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── plugins/
│   ├── practice-view/            ← DELETED (renamed to train-view/)
│   └── train-view/               ← NEW (rename of practice-view/)
│       ├── plugin.json           ← id: "train-view", name: "Train", order: 2
│       ├── index.tsx             ← import renamed; export renamed
│       ├── TrainPlugin.tsx       ← renamed from PracticePlugin.tsx
│       ├── TrainPlugin.css       ← renamed from PracticePlugin.css; class prefixes practice- → train-
│       ├── TrainPlugin.test.tsx  ← renamed from PracticePlugin.test.tsx
│       ├── TrainVirtualKeyboard.tsx       ← renamed from PracticeVirtualKeyboard.tsx
│       ├── TrainVirtualKeyboard.css       ← renamed from PracticeVirtualKeyboard.css
│       ├── TrainVirtualKeyboard.test.tsx  ← renamed from PracticeVirtualKeyboard.test.tsx
│       ├── trainTypes.ts         ← renamed from practiceTypes.ts; COMPLEXITY_LEVEL_STORAGE_KEY → 'train-complexity-level-v1'; TRAIN_TIPS_KEY → 'train-tips-v1-dismissed'
│       ├── exerciseGenerator.ts  ← no filename change; internal identifiers updated
│       ├── exerciseGenerator.test.ts  ← storage key assertion updated
│       ├── exerciseScorer.ts     ← no filename change
│       ├── matchRawNotesToSlots.ts  ← no filename change
│       └── migrateStorageKeys.ts    ← NEW: one-time migration util + tests
│
└── src/
    ├── plugin-api/
    │   └── types.ts              ← MODIFIED: PluginManifest gains `readonly order?: number`
    ├── services/plugins/
    │   ├── builtinPlugins.ts     ← MODIFIED: import from train-view/; id: "train-view"
    │   └── sortPlugins.ts        ← NEW: sortPluginsByOrder() pure utility + tests
    └── App.tsx                   ← MODIFIED: call sortPluginsByOrder(entries) before setAllPlugins

# ─── Docs ───────────────────────────────────────────────────────────────────
FEATURES.md                   ← MODIFIED: Practice View → Train View
PLUGINS.md                    ← MODIFIED: PluginManifest schema + practice-view reference section

# ─── Spec annotations ───────────────────────────────────────────────────────
specs/031-practice-view-plugin/
├── spec.md        ← MODIFIED: rename notice header
├── plan.md        ← MODIFIED: rename notice header
├── tasks.md       ← MODIFIED: rename notice header
└── quickstart.md  ← MODIFIED: rename notice header
```

**Structure Decision**: Web application (frontend only). The rename spans `frontend/plugins/` (plugin code), `frontend/src/` (manifest type + sort utility + builtinPlugins), and documentation files. No backend or WASM changes.

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design. All gates confirmed.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `sortPluginsByOrder` uses `manifest.id` and `manifest.order` — manifest fields, not internal data structures. `TrainPlugin`, `TrainPhase`, `TrainExercise` carry domain-consistent naming. |
| II. Hexagonal Architecture | ✅ PASS | `sortPlugins.ts` is a pure utility that operates on manifest data only. No port/adapter boundary crossed. |
| III. PWA Architecture | ✅ PASS | Asset hash rotation in Vite invalidates PWA cache automatically. No service worker code changes. |
| IV. Precision & Fidelity | ✅ PASS | No music timing/notation logic changed. |
| V. Test-First Development | ✅ PASS with obligations | New behaviours (`sortPluginsByOrder` and `migrateStorageKeys`) have explicit test-first phases in quickstart (B1, E1). Rename of existing files reuses existing tests with identifier updates — no new untested behaviour introduced. |
| VI. Layout Engine Authority | ✅ PASS | No coordinate calculations added anywhere. `sortPluginsByOrder` operates on manifest primitives only. |
| VII. Regression Prevention | ✅ PASS with obligations | All existing Practice plugin tests are carried forward to Train — no tests deleted. If any bug is discovered during rename, a failing test is created before fixing (per constitution). |

**Post-design gate result**: PASS — no violations. Test-first obligations are tracked in quickstart phases B1 and E1.

