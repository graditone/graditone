# Implementation Plan: MIDI Volume Control

**Branch**: `063-midi-volume-control` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/063-midi-volume-control/spec.md`

## Summary

Add expressive dynamics to score playback and live MIDI input. The feature spans three layers: (1) backend Rust MusicXML importer parses `<dynamics>` and `<wedge>` elements, exposing per-note velocity data through the WASM interface; (2) frontend playback pipeline applies velocity-based gain (logarithmic curve) to scheduled and live-played notes, with MIDI CC7/CC11 support; (3) a vertical master volume slider in the playback toolbar scaled through `Tone.Destination.volume`, persisted to localStorage.

## Technical Context

**Language/Version**: Rust stable (backend/WASM) + TypeScript 5.x (frontend React)  
**Primary Dependencies**: wasm-bindgen, wasm-pack (backend→WASM); Tone.js, React 18+ (frontend)  
**Storage**: localStorage for master volume preference (follows existing `graditone:tempo:{scoreId}` pattern)  
**Testing**: `cargo test` (Rust), Vitest (frontend unit), Playwright (e2e)  
**Target Platform**: Tablet devices (iPad/Surface/Android) via PWA, modern browsers  
**Project Type**: Web application (monorepo: `backend/` Rust + `frontend/` React)  
**Performance Goals**: <100ms WASM parse time preserved; audio gain changes within 16ms (60fps); no audible glitches on volume changes  
**Constraints**: Offline-first (all dynamics logic client-side via WASM); WASM bundle size increase <10KB gzipped; tablet-optimized UI (44×44px touch targets)  
**Scale/Scope**: Scores up to 10,000+ events; 8 dynamic levels (ppp→fff); MIDI velocity 1–127

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Domain-Driven Design** | ✅ PASS | Dynamic markings and gradual dynamics modelled as first-class domain entities with ubiquitous language (DynamicMarking, GradualDynamic, velocity). All new types use music domain terminology. |
| **II. Hexagonal Architecture** | ✅ PASS | Dynamics parsing lives in the Rust core domain (importer); WASM bindings act as adapter. Frontend playback is infrastructure. No domain logic leaks into UI. |
| **III. PWA Architecture** | ✅ PASS | All processing runs client-side in WASM + Web Audio. No server dependency. Offline-capable. localStorage for persistence. |
| **IV. Precision & Fidelity** | ✅ PASS | Dynamic positions anchored to exact tick positions (integer PPQ). Velocity values are integers 1–127. No floating-point timing. Gain calculation is real-time audio only. |
| **V. Test-First Development** | ✅ PASS | Plan includes unit tests for Rust dynamics parsing, frontend velocity→gain conversion, MIDI CC handling, and e2e playback dynamics verification. |
| **VI. Layout Engine Authority** | ✅ PASS | No layout or spatial geometry changes. Dynamics data flows through the data model, not the layout pipeline. Frontend does not calculate positions. |
| **VII. Regression Prevention** | ✅ PASS | Existing playback behaviour for scores without dynamics must remain unchanged (mf default). Regression tests verify no-dynamics scores play at consistent volume. |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/063-midi-volume-control/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── wasm-dynamics-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── events/
│   │   │   ├── note.rs               # Add velocity field to Note
│   │   │   └── dynamics.rs           # NEW: DynamicMarking, GradualDynamic types
│   │   └── importers/musicxml/
│   │       ├── parser/
│   │       │   └── structure.rs      # Extend parse_direction() for <dynamics>, <wedge>
│   │       ├── converter/
│   │       │   └── (mod.rs/notes.rs)  # Velocity assignment during note conversion
│   │       └── types.rs              # Add Dynamics/Wedge variants to MeasureElement
│   └── adapters/wasm/
│       └── bindings.rs               # Expose dynamics in ScoreDto serialization
└── tests/
    └── dynamics_parsing/             # NEW: Unit tests for dynamics extraction

frontend/
├── src/
│   ├── services/
│   │   ├── playback/
│   │   │   ├── ToneAdapter.ts        # Add velocity param to playNote(); master volume gain node
│   │   │   ├── PlaybackScheduler.ts  # Forward velocity to playNote()
│   │   │   ├── DynamicsResolver.ts   # NEW: Resolve active dynamic at any tick position
│   │   │   └── volumeUtils.ts        # NEW: Logarithmic velocity→gain curve, CC scaling
│   │   └── recording/
│   │       ├── useMidiInput.ts       # Add CC7/CC11 handler
│   │       └── midiUtils.ts          # Add parseMidiCC()
│   ├── components/
│   │   └── ScoreViewer.tsx           # Add VolumeSlider to playback bar
│   ├── types/
│   │   ├── score.ts                  # Add velocity to Note; add DynamicMarking/GradualDynamic types
│   │   └── playback.ts              # Add velocity to ScheduledNote
│   └── wasm/
│       └── layout.ts                 # Extend types to carry dynamics data from WASM
└── tests/
    ├── unit/
    │   ├── volumeUtils.test.ts       # NEW: Logarithmic curve tests
    │   ├── DynamicsResolver.test.ts  # NEW: Dynamic lookup + interpolation tests
    │   └── midiUtils.test.ts         # Extend: CC parsing tests
    └── e2e/
        └── dynamics-playback.spec.ts # NEW: End-to-end dynamics playback verification
```

**Structure Decision**: Web application monorepo (existing `backend/` + `frontend/` structure). Changes span both sides: Rust domain model + MusicXML parser, and frontend playback pipeline + UI.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
