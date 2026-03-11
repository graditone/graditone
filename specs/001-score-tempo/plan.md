# Implementation Plan: Score-Defined Tempo Configuration

**Branch**: `001-score-tempo` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-score-tempo/spec.md`

## Summary

Every score carries a tempo marking (e.g. 60 BPM for the Chopin Nocturne) stored in `global_structural_events`. Currently the app ignores this and plays everything at 120 BPM because the MusicXML parser silently drops `<sound tempo="..."/>` elements at measure level, and the frontend never feeds the score's tempo back into `TempoStateContext`. This feature fixes the full chain: MusicXML → Score → Playback Engine → UI, and adds a `snapToScoreTempo()` API that resets the active tempo (base BPM + multiplier) to the score's marked tempo.

## Technical Context

**Language/Version**: Rust (stable, 1.75+) — backend domain & importer; TypeScript 5 / React 18 — frontend  
**Primary Dependencies**: `quick-xml` (Rust MusicXML streaming parser); `usePlayback` / `MusicTimeline.ts` (Tone.js playback); `TempoStateContext` (React Context for multiplier); `useScorePlayerBridge` (plugin API bridge)  
**Storage**: N/A — no persistence changes; score data lives in WASM memory during session  
**Testing**: `cargo test` (Rust unit + integration); Vitest (TypeScript unit); Playwright (E2E — not required for this feature)  
**Target Platform**: Tablet-first PWA (iPad/Surface/Android); Rust compiled to WASM via wasm-pack; served by Nginx  
**Project Type**: Web application (backend/ + frontend/ monorepo)  
**Performance Goals**: Tempo update visible in UI ≤500ms of score finishing load (per SC-002); no observable latency added to `loadScore()` — tempo extraction is a trivial O(n) scan of global_structural_events  
**Constraints**: BPM valid range 20–400 (enforced by `BPM::new()` in Rust value object); tempo multiplier range 0.5–2.0 (enforced by `clampTempoMultiplier()`); must not regress existing tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | `TempoEvent` is a first-class domain event on the Score aggregate; no raw BPM numbers leak into infrastructure |
| II. Hexagonal Architecture | ✅ PASS | Parser fix is inside the importer adapter; Score domain model unchanged; frontend changes are in the plugin API adapter layer |
| III. PWA Architecture | ✅ PASS | No network calls added; tempo extraction purely client-side within existing WASM/React boundary |
| IV. Precision & Fidelity | ✅ PASS | BPM is an integer value object (u16); `f64` → `u16` cast in converter is guarded by `BPM::new()` range check; no floating-point accumulation |
| V. Test-First Development | ✅ PASS | Tests written before implementation for each changed unit |
| VI. Layout Engine Authority | ✅ PASS | Feature touches tempo only; zero spatial/layout coordinate changes |
| VII. Regression Prevention | ✅ PASS | The root-cause bug (ignored `<sound>` at measure level) will gain a dedicated integration test |

**Gate result: ALL PASS — proceed to Phase 0**

## Project Structure

### Documentation (this feature)

```text
specs/001-score-tempo/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── plugin-api-delta.md
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── domain/
│       └── importers/
│           └── musicxml/
│               ├── types.rs          ← add sound_tempo field to MeasureData
│               ├── parser.rs         ← extract <sound tempo> at measure level
│               └── converter.rs      ← use first sound_tempo as Score BPM
└── tests/
    └── musicxml/                     ← new integration test: tempo_from_musicxml

frontend/
├── src/
│   ├── plugin-api/
│   │   ├── types.ts                  ← add snapToScoreTempo() to PluginScorePlayerContext
│   │   ├── scorePlayerContext.ts     ← call setOriginalTempo; implement snapToScoreTempo
│   │   └── scorePlayerContext.test.ts ← tests for tempo extraction + snap
│   └── components/
│       └── ScoreViewer.tsx           ← call setOriginalTempo when score changes
```

## Complexity Tracking

> No constitution violations — section left blank.
