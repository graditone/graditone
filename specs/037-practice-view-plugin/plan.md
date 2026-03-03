# Implementation Plan: Practice View Plugin (External)

**Branch**: `037-practice-view-plugin` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/037-practice-view-plugin/spec.md`

## Summary

Build a self-contained external plugin at `plugins-external/practice-view-plugin/` that extends the Play Score experience with MIDI-driven step-by-step note practice. The plugin owns its full toolbar (built from Plugin API primitives), renders the score via `context.components.ScoreRenderer`, and enters a Practice mode where the user presses each target note on a MIDI device one at a time — exact pitch match including octave. A Plugin API v6 extension is required to support staff-aware note extraction with note IDs (needed to drive `ScoreRenderer.highlightedNoteIds` for target-note highlighting).

## Technical Context

**Language/Version**: TypeScript 5.5, React 19  
**Primary Dependencies**: Plugin API (`frontend/src/plugin-api/index.ts`), Vite 5, Vitest 2 — mirrors `plugins-external/virtual-keyboard-pro/` package structure  
**Storage**: N/A — no persistence; all state is session-local within the plugin  
**Testing**: Vitest + Testing Library (React), following `virtual-keyboard-pro` pattern  
**Target Platform**: Tablet PWA (iPad Pro, Surface Pro, Android tablets) — same as all Musicore plugins  
**Project Type**: External plugin sub-package under `plugins-external/`  
**Performance Goals**: MIDI note match → highlight advance ≤ 100 ms (SC-002); Practice mode activation instantaneous (SC-004)  
**Constraints**: Zero internal imports (`frontend/src/components/`, `src/services/`, `src/wasm/`, `frontend/plugins/play-score/`); Plugin API boundary only; Principle VI — no coordinate calculations inside plugin  
**Scale/Scope**: Single external plugin package; ~8–10 source files, ~12–15 test files

### Key API Surfaces Used by This Plugin

| API | Used for |
|-----|----------|
| `context.components.ScoreRenderer` | Full-screen score rendering; note tap/long-press events; target note highlight via `highlightedNoteIds` |
| `context.components.ScoreSelector` | Score selection screen (pre-built host component) |
| `context.scorePlayer.getCatalogue()` | Populate score selection |
| `context.scorePlayer.loadScore()` | Load catalogue or file score |
| `context.scorePlayer.subscribe()` | React to state changes (status, tick, BPM, staffCount) |
| `context.scorePlayer.play/pause/stop` | Playback control from toolbar |
| `context.scorePlayer.seekToTick()` | Note tap seek; Practice mode seek |
| `context.scorePlayer.setTempoMultiplier()` | Tempo control from toolbar |
| `context.scorePlayer.extractPracticeNotes(staffIndex, maxCount?)` | **(v6 new)** Staff-aware note extraction with IDs |
| `context.midi.subscribe` | MIDI note-on events; match against practice target |
| `context.close()` | Back button → return to host |
| `context.stopPlayback()` | Teardown on unmount |

**Plugin API v6 extension required** — see `research.md` R-001 and R-002 for rationale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Plugin uses music domain terms throughout: note, pitch, staff, tick, MIDI, Practice mode. `PracticeNoteEntry`, `TargetNote`, `PracticePosition` are first-class domain concepts. No technical abstractions leak into the domain layer. |
| II. Hexagonal Architecture | ✅ PASS | Plugin communicates exclusively through the Plugin API (ports). Zero internal Musicore service imports anywhere in the plugin codebase. The plugin is a clean adapter. |
| III. PWA Architecture | ✅ PASS | External plugin outputs a single JS bundle loaded by the PWA host. No network calls required during Practice mode (score loaded; MIDI is hardware). Plugin bundle expected < 50 KB. |
| IV. Precision & Fidelity | ✅ PASS | Tick positions used for score navigation (`seekToTick`). MIDI pitch matching uses integer note numbers (0–127). No floating-point pitch arithmetic required. |
| V. Test-First (NON-NEGOTIABLE) | ⚠️ GATE | All implementation follows red-green-refactor. Practice note matching logic, staff selection, MIDI advance, stop/reset, and chord matching MUST have failing Vitest tests written **before** any corresponding implementation code is written. `practiceEngine.test.ts` is created in Phase 1 Design before `practiceEngine.ts`. |
| VI. Layout Engine Authority | ⚠️ GATE | Plugin MUST NOT perform coordinate calculations. Target note highlight is achieved solely by passing `noteId` to `ScoreRenderer.highlightedNoteIds`. Plugin maintains an ordered index (integer) into `extractPracticeNotes` results — integers and opaque note IDs only. Any (x,y) arithmetic inside the plugin is a Principle VI violation requiring PR rejection. |
| VII. Regression Prevention | ✅ PASS | No bugs found yet; regression section in spec empty — expected at this stage. |

**Pre-Phase-0 gate status**: PASS (with two gates flagged for implementation phase — Principles V and VI).

## Project Structure

### Documentation (this feature)

```text
specs/037-practice-view-plugin/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── plugin-api-v6.ts   ← Phase 1 output
└── tasks.md             ← Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins-external/
└── practice-view-plugin/
    ├── package.json              # Own deps: React, Vitest, Vite, TypeScript
    ├── plugin.json               # { id, pluginApiVersion: '6', type: 'common', view: 'window' }
    ├── tsconfig.json
    ├── vite.config.ts            # Production bundle: single JS output in dist/
    ├── vite.config.dev.mts       # Dev mode with HMR (mirrors VKPro)
    ├── build.sh                  # Build script (mirrors virtual-keyboard-pro/build.sh)
    ├── vitest.setup.ts
    ├── index.tsx                 # MusicorePlugin entry point
    ├── PracticeViewPlugin.tsx    # Root component: score selector, score view, toolbar
    ├── PracticeViewPlugin.test.tsx
    ├── practiceToolbar.tsx       # Toolbar: Back, title, Play/Pause, Stop, Timer, Tempo,
    ├── practiceToolbar.test.tsx  #   Staff selector, Practice button
    ├── practiceEngine.ts         # Pure logic: ordered note list, state machine, MIDI match
    ├── practiceEngine.test.ts    # RED tests written BEFORE practiceEngine.ts (Principle V gate)
    ├── practiceEngine.types.ts   # PracticeNoteEntry, PracticeState, SelectedStaff
    ├── PracticeViewPlugin.css
    ├── scripts/
    │   └── dev-import.mjs            # Dev import helper
    ├── dev/                      # Dev harness HTML
    └── dist/                     # Build output (gitignored)

frontend/src/plugin-api/
├── types.ts                      # v6 additions: staffCount in ScorePlayerState,
│                               #   extractPracticeNotes(staffIndex, maxCount?)
└── scorePlayerContext.ts         # v6 impl: extractPracticeNotes with staffIndex + noteId
```

**Structure Decision**: External plugin sub-package under `plugins-external/`, mirroring `virtual-keyboard-pro/`. No changes to `frontend/plugins/play-score/` or its tests. Plugin API v6 is a minimal additive extension to `frontend/src/plugin-api/types.ts` — two additions only.

## Complexity Tracking

> No constitution violations requiring justification.
