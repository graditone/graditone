# Implementation Plan: Metronome for Play and Practice Views

**Branch**: `035-metronome` | **Date**: 2026-03-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/035-metronome/spec.md`

## Summary

Add an audible, visual metronome to the Play Score and Practice View plugins. The metronome is toggled by a button at the rightmost position of each view's toolbar. When active it produces distinct downbeat and upbeat click sounds, synchronized to the score's tempo and time signature. When playback is also running the metronome is phase-locked to the Tone.js Transport clock for sample-accurate alignment. The implementation extends the Plugin API to v5 with a new `context.metronome` namespace, following the existing T006 proxy pattern.

## Technical Context

**Language/Version**: TypeScript 5, React 18  
**Primary Dependencies**: Tone.js v14.9.17 (`MembraneSynth` + `Synth`), Web Audio API (via Tone.js Transport), React rAF loop (`ITickSource`)  
**Storage**: N/A (no persistence; metronome state is transient per view)  
**Testing**: Vitest (unit — MetronomeEngine, beat math, API contracts), Playwright (E2E — toolbar button, visual pulse, audio lifecycle)  
**Target Platform**: Tablet + desktop browsers (Chrome 57+, Safari 11+, Edge 16+); offline-capable (Tone.js + Web Audio are fully local)  
**Project Type**: Web application — frontend-only change (no backend/Rust/WASM changes required)  
**Performance Goals**: Click audio latency ≤ 10 ms (Transport-scheduled, pre-buffered); visual beat flash ≤ 16.7 ms (rAF); FC on toggle ≤ 50 ms  
**Constraints**: BPM range 20–300 (clamped); no Tone.js or Web Audio direct imports in plugin code (plugin API only); offline-first; no new backend API calls

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Assessment |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | Metronome and TempoDefinition are first-class domain entities (see data-model.md). Beat position uses integer 960-PPQ tick arithmetic. |
| II. Hexagonal Architecture | ✅ PASS | `MetronomeEngine` is a service in `src/services/metronome/`. Plugins access it only via `PluginContext.metronome` port. |
| III. PWA Architecture | ✅ PASS | All audio generated client-side via Tone.js; fully offline. No network calls per beat. |
| IV. Precision & Fidelity | ✅ PASS | Beat position derived from 960-PPQ integer tick arithmetic throughout. `Math.floor(tick / beatIntervalTicks)` — no floating-point accumulation. |
| V. Test-First Development | ✅ PASS (enforced) | Every new file requires a failing test before implementation. See task list. |
| VI. Layout Engine Authority | ✅ PASS | No spatial/coordinate calculations. Toolbar icon placement is CSS-only. |
| VII. Regression Prevention | ✅ PASS | No existing bugs to address. Pattern applied to any bugs found during implementation. |

**No violations.** Constitution Check passed at both Pre-Phase-0 and Post-Phase-1 stages.

## Project Structure

### Documentation (this feature)

```text
specs/035-metronome/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── plugin-api-v5.ts ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── services/
│   │   └── metronome/
│   │       ├── MetronomeEngine.ts         # NEW — click synthesis + Transport scheduling
│   │       ├── MetronomeEngine.test.ts    # NEW — unit tests (TDD: write first)
│   │       ├── useMetronome.ts            # NEW — React hook wrapping MetronomeEngine
│   │       └── useMetronome.test.ts       # NEW — hook tests
│   └── plugin-api/
│       ├── types.ts                       # EXTEND — PluginMetronomeContext, ScorePlayerState.timeSignature, PLUGIN_API_VERSION='5'
│       ├── index.ts                       # EXTEND — export PluginMetronomeContext, MetronomeState
│       ├── metronomeContext.ts            # NEW — useMetronomeBridge, createNoOpMetronome, createMetronomeProxy
│       ├── metronomeContext.test.ts       # NEW — unit tests for metronome context
│       └── scorePlayerContext.ts          # EXTEND — extractTimeSignature(), timeSignature in ScorePlayerState
├── components/
│   └── plugins/
│       └── PluginView.tsx                 # EXTEND — metronomeRef in V3ProxyRefs, V3PluginWrapper hook call
├── App.tsx                                # EXTEND — metronomeRef per plugin, injected into PluginContext
└── plugins/
    ├── play-score/
    │   ├── playbackToolbar.tsx            # EXTEND — metronome toggle button (rightmost) + beat indicator
    │   ├── playbackToolbar.test.tsx       # EXTEND — metronome button tests
    │   └── PlayScorePlugin.tsx            # EXTEND — subscribe to context.metronome, pass state to toolbar
    └── practice-view/
        ├── PracticePlugin.tsx             # EXTEND — metronome button in header + subscribe to context.metronome
        └── PracticePlugin.test.tsx        # EXTEND — metronome button tests

frontend/tests/
└── metronome.spec.ts                      # NEW — Playwright E2E test (play view + practice view)
```

**Structure Decision**: Frontend-only, web application structure. All changes are within `frontend/`. No backend changes. New service in `src/services/metronome/` follows the `playback/`, `highlight/`, `recording/` service module pattern.

## Complexity Tracking

> No Constitution violations. No complexity justifications required.
