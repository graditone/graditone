> **Renamed** — The plugin described in this document was renamed to **Train** in feature 036.
> Canonical plugin path: `frontend/plugins/train-view/`
> See [specs/036-rename-practice-train/](../036-rename-practice-train/) for the rename spec.

---

# Implementation Plan: Practice View Plugin & Plugin API Recording Extension

**Branch**: `031-practice-view-plugin` | **Date**: 2026-02-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/031-practice-view-plugin/spec.md`

## Summary

Convert the existing internal `PracticeView` into a built-in plugin at `frontend/plugins/practice-view/`. To make this possible without breaking the Plugin API boundary, extend the Plugin API with: `context.recording` (always-on pitch-detection subscription, pitch-events only, shared mic stream), `offsetMs` on `PluginNoteEvent` (scheduled playback), and `context.stopPlayback()` (cancel per-plugin pending notes). The Plugin API version increments from `"1"` to `"2"`. The old `PracticeView.tsx` and its internal wiring are removed after the migration. The Practice plugin is available in production navigation to all users.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: Vite (bundler), Vitest + React Testing Library (tests), ToneAdapter (audio scheduling), AudioWorklet + `pitchDetection.ts` (mic pitch), `fflate` / `idb` (plugin infrastructure from 030, unchanged), ESLint flat config `no-restricted-imports` (plugin boundary enforcement)  
**Storage**: N/A — no new persistence; existing plugin registry (IndexedDB via `idb`) used unchanged  
**Testing**: Vitest + React Testing Library; existing patterns from `VirtualKeyboard.test.tsx` and `PracticeView.test.tsx`  
**Target Platform**: PWA on tablet devices (iPad, Surface, Android tablets); Chrome 57+, Safari 11+; offline-capable  
**Project Type**: Web application (frontend-only change; no backend modifications)  
**Performance Goals**: Pitch events delivered to plugin handlers ≤ 50 ms after detection; `stopPlayback()` completes ≤ 10 ms; exercise playback note offset accuracy matches existing ToneAdapter scheduling  
**Constraints**: Plugin code must import exclusively from `src/plugin-api/`; no raw audio access; mic stream shared across all subscribers (max one `getUserMedia` call); `offsetMs` addition to `PluginNoteEvent` must be backward-compatible  
**Scale/Scope**: Frontend-only; one new built-in plugin; Plugin API v2; all existing plugin tests and `PracticeView` tests must continue passing or be replaced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | `PluginPitchEvent` uses musical domain terms (midiNote, hz, confidence). No implementation leakage into entity names. |
| II. Hexagonal Architecture | ✅ PASS | Plugin API remains the port; `PluginMicBroadcaster` is a new backend service (adapter); plugins interact only through the port. |
| III. PWA Architecture | ✅ PASS | Mic access is a browser API — offline-capable. No new network dependencies. |
| IV. Precision & Fidelity | ✅ PASS | MIDI pitch values in `PluginPitchEvent` remain integer midiNote (0–127). No float precision issues introduced. |
| V. Test-First Development | ⚠️ REQUIRED | New API surface (`recording` namespace, `offsetMs`, `stopPlayback`) and Practice plugin must have tests written before implementation. Existing `PracticeView.test.tsx` must be ported to the plugin test suite before deletion. |
| VI. Layout Engine Authority | ✅ PASS | Practice plugin uses two `StaffViewer` instances from `context.components`. Zero coordinate math in plugin code. `PluginPitchEvent` carries only musical data, no geometry. |
| VII. Regression Prevention | ⚠️ REQUIRED | Removing `PracticeView.tsx` requires all its tests to be migrated first. Any bug found during migration must get a regression test before fixing. |

**Gate result**: PASS with obligations — Principles V and VII impose test-first and test-migration requirements tracked in tasks.

## Project Structure

### Documentation (this feature)

```text
specs/031-practice-view-plugin/
├── plan.md              ← this file
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
├── contracts/
│   └── plugin-api-v2.ts ← Phase 1 (updated Plugin API contract)
└── tasks.md             ← Phase 2 (created by /speckit.tasks)
```

### Source Code

```text
frontend/
├── src/
│   ├── plugin-api/
│   │   ├── types.ts              ← MODIFIED: add PluginPitchEvent, recording namespace,
│   │   │                           offsetMs on PluginNoteEvent, stopPlayback, bump PLUGIN_API_VERSION
│   │   ├── index.ts              ← MODIFIED: export PluginPitchEvent, PluginRecordingContext
│   │   └── plugin-api.test.ts    ← MODIFIED: add tests for new API surface
│   ├── services/
│   │   ├── plugins/
│   │   │   └── builtinPlugins.ts ← MODIFIED: add practice-view plugin to BUILTIN_PLUGINS
│   │   └── recording/
│   │       └── PluginMicBroadcaster.ts  ← NEW: singleton mic pitch broadcast service
│   └── App.tsx                   ← MODIFIED: wire recording namespace + offsetMs + stopPlayback
│                                    into PluginContext; remove PracticeView routing/import
│
├── plugins/
│   └── practice-view/            ← NEW: self-contained built-in plugin
│       ├── plugin.json           ← manifest (pluginApiVersion: "2")
│       ├── index.tsx             ← plugin entry point (MusicorePlugin)
│       ├── PracticePlugin.tsx    ← main component (replaces PracticeView.tsx)
│       ├── PracticePlugin.css    ← styles
│       ├── PracticePlugin.test.tsx ← tests (replaces PracticeView.test.tsx)
│       ├── exerciseGenerator.ts  ← plugin-internal (copied/adapted from services/practice/)
│       ├── exerciseScorer.ts     ← plugin-internal (copied/adapted)
│       ├── practiceTypes.ts      ← plugin-internal type definitions
│       └── components/           ← plugin-internal sub-components if needed
│
├── src/components/practice/      ← DELETED after migration
│   ├── PracticeView.tsx
│   ├── PracticeView.test.tsx
│   └── PracticeView.css
└── src/components/ScoreViewer.tsx ← MODIFIED: remove onShowPractice prop and debug button
```

**Structure Decision**: Web application (frontend only). Plugin follows the same `frontend/plugins/[name]/` layout established for `virtual-keyboard`. Host-side service (`PluginMicBroadcaster`) lives in `frontend/src/services/recording/` — the same directory as `usePracticeRecorder`. App.tsx remains the single place where `PluginContext` is built.

## Complexity Tracking

> No constitution violations. No unjustified complexity introduced.
