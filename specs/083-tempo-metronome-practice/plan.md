# Implementation Plan: Tempo Slider Range Extension & Practice Metronome Deferred Start

**Branch**: `083-tempo-metronome-practice` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)  
**Worktree**: `/Users/alvaro.delcastillo/devel/graditone/.worktrees/feature/083-tempo-metronome-practice`  
**Input**: Feature specification from `/specs/083-tempo-metronome-practice/spec.md`

## Summary

Two independent improvements to the practice and playback experience. First, widen the tempo slider range from 50%–200% to **10%–200%** with 1% integer steps, a snap-to-100% zone of ±3 pp, a visual 100% tick mark, and an absolute BPM floor of 10 BPM for unusually slow scores. Second, add a **deferred metronome start** in practice mode: when the metronome is toggled on at session start it enters an "armed" visual state and remains silent until the first MIDI note attack, which fires the metronome at beat 1. Outside practice mode the metronome starts immediately as today.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Rust 1.x WASM (no backend changes required)  
**Primary Dependencies**: React 19.2, Tone.js 14.9, Vite 6.x, Vitest 3.x, @testing-library/react, Playwright  
**Storage**: React component state (transient); `SavedPractice.tempoMultiplier` in IndexedDB (persisted — clamped on load)  
**Testing**: Vitest + @testing-library/react (unit/component), Playwright (E2E)  
**Target Platform**: Tablet PWA — Chrome 57+, Safari 11+, Edge 16+ (iPad, Surface, Android tablets)  
**Project Type**: Monorepo — frontend-only changes (`frontend/`); no Rust/WASM modifications  
**Performance Goals**: 60 fps UI feedback; metronome timing accuracy ±10 ms; offline-capable  
**Constraints**: Offline-first; no new network calls; WASM boundary respected; no TypeScript spatial calculations (Principle VI — not applicable); no new IndexedDB schemas  
**Scale/Scope**: ~10 frontend files changed, ~5 new/updated test files; no backend changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate Question | Status | Notes |
|---|-----------|---------------|--------|-------|
| I | DDD | Are tempo multiplier bounds and the BPM floor modeled as domain rules? | ✅ PASS | New `ABSOLUTE_BPM_FLOOR = 10` constant lives in `tempoCalculations.ts` alongside other domain constants |
| II | Hexagonal | Does deferred metronome start bypass the plugin-API boundary? | ✅ PASS | `MetronomeEngine` in `src/services/metronome/` untouched; armed state and first-note trigger live in the plugin layer |
| III | PWA | Are all changes client-side and offline-capable? | ✅ PASS | No network calls; Tone.js Web Audio is offline |
| IV | Precision | Does 1% step avoid float accumulation in the display? | ✅ PASS | `Math.round(raw * 100) / 100` normalises slider output; `multiplierToPercentage` already uses `Math.round` |
| V | Test-First | Are tests written before implementation? | ⚠️ REQUIRED | All tasks follow red-green-refactor; failing tests committed first |
| VI | Layout Authority | Any new spatial calculations in renderer? | ✅ N/A | No geometry involved |
| VII | Regression | Do existing metronome E2E tests T021–T023 and toolbar unit tests stay green? | ✅ PASS | Additive changes; snap zone tolerance update requires corresponding test adjustment |
| VIII | Profile Awareness | Are new user-state values profile-scoped? | ✅ PASS | `tempoMultiplier` in `SavedPractice` is already scoped by practice ID; armed state is transient React state (not persisted) |

**Gate result**: No violations. Proceed to Phase 0.

**Post-design re-check**: Confirmed after Phase 1 — no new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/083-tempo-metronome-practice/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── PracticeToolbarProps.ts
│   └── tempoCalculations-api.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── utils/
│   │   ├── tempoCalculations.ts          # MIN 0.5→0.1, ABSOLUTE_BPM_FLOOR=10, computeEffectiveMinMultiplier()
│   │   └── tempoCalculations.test.ts     # updated + new BPM-floor tests
│   └── services/
│       └── metronome/
│           └── MetronomeEngine.ts        # No changes — API already supports deferred start
│
└── plugins/
    ├── play-score/
    │   ├── playbackToolbar.tsx           # min 0.5→0.1, step 0.05→0.01, snap ±0.03, 100% tick mark
    │   └── playbackToolbar.test.tsx      # update snap zone test
    └── practice-view-plugin/
        ├── PracticeViewPlugin.tsx        # metronomeArmed state, modified toggle, first-note callback
        ├── practiceToolbar.tsx           # metronomeArmed prop → armed CSS class; slider min/step/snap; 100% tick
        ├── practiceToolbar.test.tsx      # armed state rendering test
        └── usePracticeMidi.ts           # onFirstNoteAttack?: () => void parameter

frontend/e2e/
└── metronome.spec.ts                    # add T024 (deferred start), T025 (armed visual state)
```

**Structure Decision**: Frontend-only monorepo change. All new state is transient React state — no new IndexedDB schemas. No Rust/WASM modifications required.
