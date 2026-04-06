# Implementation Plan: Complete i18n for Internal Core Plugins

**Branch**: `075-core-plugins-i18n` | **Worktree**: `../worktrees/075-core-plugins-i18n` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/075-core-plugins-i18n/spec.md`

## Summary

Replace all hardcoded user-facing English strings across the five internal builtin plugins (play-score, train-view, practice-view-plugin, guide, virtual-keyboard) with calls to the host app's `useTranslation()` hook, and add the corresponding translation keys to both `en.json` and `es.json` locale files. Also add missing plugin navigation name keys (`plugin.name.sessions-plugin`, `plugin.name.virtual-keyboard`).

**Scope clarification**: The spec lists six plugins, but `sessions-plugin` does not exist as a builtin in `frontend/plugins/` — it is an external plugin in `plugins-external/` handled by feature 074. This plan covers the five actual builtin plugins plus the two missing plugin name keys in the locale catalogs.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+
**Primary Dependencies**: React, Vite, host i18n module (`frontend/src/i18n/index.tsx`)
**Storage**: N/A (no data model changes)
**Testing**: Vitest (existing frontend test infrastructure)
**Target Platform**: Tablet devices (iPad/Surface/Android) via PWA — Chrome 57+, Safari 11+, Edge 16+
**Project Type**: Web (monorepo — `frontend/` directory)
**Performance Goals**: N/A (i18n adds no critical-path latency — JSON catalogs imported at build time)
**Constraints**: Plugins are builtin — they import `useTranslation` directly from the host `frontend/src/i18n/` module
**Scale/Scope**: ~15 component files across 5 plugins, ~117 existing keys in locale, ~150-180 new keys needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | PASS | i18n is a UI concern — no domain entities changed |
| II. Hexagonal Architecture | PASS | Translation is a rendering/UI concern, not backend domain |
| III. PWA Architecture | PASS | JSON catalogs bundled at build time; offline capability unaffected |
| IV. Precision & Fidelity | N/A | No timing or musical calculations involved |
| V. Test-First Development | PASS | Locale key parity test to be added |
| VI. Layout Engine Authority | N/A | No spatial geometry changes |
| VII. Regression Prevention | PASS | Key parity test prevents missing translations going forward |
| Git Worktree Workflow | PASS | Work in `../worktrees/075-core-plugins-i18n` |
| Documentation Currency | PASS | Locale files are the deliverable; no doc updates beyond code |

All gates pass. No violations need justification.

## Project Structure

### Documentation (this feature)

```text
specs/075-core-plugins-i18n/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (affected files)

```text
frontend/
├── src/
│   └── i18n/
│       └── locales/
│           ├── en.json              # Add ~150-180 new keys
│           └── es.json              # Add ~150-180 new Spanish translations
│
├── plugins/
│   ├── play-score/
│   │   ├── PlayScorePlugin.tsx      # Replace hardcoded loading text with t()
│   │   ├── playbackToolbar.tsx      # Replace all toolbar labels/aria with t()
│   │   └── scoreSelectionScreen.tsx # Replace headings/buttons with t()
│   │
│   ├── train-view/
│   │   ├── TrainPlugin.tsx          # Replace ~50+ hardcoded strings with t()
│   │   ├── TrainResultsOverlay.tsx  # Replace all result labels/buttons with t()
│   │   ├── TrainVirtualKeyboard.tsx # Replace aria labels with t()
│   │   ├── trainTypes.ts            # Replace preset descriptions (may need restructuring)
│   │   ├── exerciseGenerator.ts     # Replace scale display names
│   │   └── savedTrainStorage.ts     # Replace generated label fragments
│   │
│   ├── practice-view-plugin/
│   │   ├── PracticeViewPlugin.tsx   # Replace loading/error/feedback text with t()
│   │   ├── practiceToolbar.tsx      # Replace all toolbar labels/aria with t()
│   │   └── ResultsOverlay.tsx       # Replace all result labels/buttons with t()
│   │
│   ├── guide/
│   │   └── GuidePlugin.tsx          # Already uses t() — audit for gaps
│   │
│   └── virtual-keyboard/
│       └── VirtualKeyboard.tsx      # Replace title/labels/aria with t()
```

**Structure Decision**: No new directories. All work modifies existing files. Builtin plugins import `useTranslation` from the host's `frontend/src/i18n/` module (unlike external plugins which bundle their own).

## Complexity Tracking

No constitution violations — table not applicable.
