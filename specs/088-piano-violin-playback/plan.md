# Implementation Plan: Piano and Violin Playback Support

**Branch**: `088-piano-violin-playback` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/088-piano-violin-playback/spec.md`

## Summary

Extend the audio playback layer to support multi-instrument scores: each instrument part plays through a dedicated `PlaybackChannel` (piano → Salamander sampler; all others → Tone.js PolySynth with instrument-appropriate ADSR). Per-instrument mute toggles appear inline with instrument name labels in the Play view (using the layout engine's `name_label` positions). Per-instrument volume sliders persist to profile-scoped localStorage. Backward compatibility with single-instrument scores is fully maintained.

## Technical Context

**Language/Version**: Rust (stable 1.75+), TypeScript 5, React 18  
**Primary Dependencies**: Tone.js (existing), wasm-pack/wasm-bindgen (existing), React 18, Vite  
**Storage**: localStorage (profile-scoped via `scopedSetItem`) — per-instrument volumes only  
**Testing**: `cargo test` (Rust unit tests), Vitest (frontend unit tests), Playwright (E2E)  
**Target Platform**: Tablet PWA (iPad, Surface, Android tablets) — offline-capable, Chrome 57+, Safari 11+  
**Project Type**: Web application (monorepo: `backend/` Rust + `frontend/` React PWA)  
**Performance Goals**: Mute effect within 1 audio processing frame (~20 ms); no audio glitches at any tempo 10–200%; offline-safe (all timbres bundled or synthesised client-side)  
**Constraints**: No new runtime dependencies; all timbres offline-safe; piano uses existing Salamander samples; other instruments use Tone.js synthesisers only; Train plugin audio MUST NOT be touched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — results below.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Domain-Driven Design** | ✅ PASS | `instrument_type` classification moved to domain layer (`classify_instrument_type` in `instrument.rs`). `InstrumentMixerState` uses domain terminology. |
| **II. Hexagonal Architecture** | ✅ PASS | Backend classification logic is domain-pure (no framework deps). `PlaybackChannel` is an infrastructure adapter. Core domain (`Instrument`) has no audio framework coupling. |
| **III. PWA Architecture** | ✅ PASS | All timbres offline-safe: piano uses bundled Salamander samples, violins/others use client-side Tone.js synthesis. No new CDN or network fetches. |
| **IV. Precision & Fidelity** | ✅ PASS | Timing unchanged (960 PPQ, integer arithmetic). Multi-channel routing adds no timing jitter — all channels share the single `Tone.Transport`. |
| **V. Test-First Development** | ✅ PASS | Tests defined before implementation: `PlaybackChannel.test.ts`, `InstrumentTimbres.test.ts`, `useInstrumentMixer.test.ts`, `classify_instrument` Rust inline tests. SC-002 verified by unit test. |
| **VI. Layout Engine Authority** | ✅ PASS | Mute overlay reads `name_label.position` from layout engine output — does not compute or derive any spatial geometry. No modifications to SVG coordinates. |
| **VII. Regression Prevention** | ✅ PASS | Single-instrument test suite passes unchanged (SC-004). `_partIndex` defaults to 0 for backward compatibility. |
| **VIII. User Profile Awareness** | ✅ PASS | All per-instrument localStorage keys use `scopedSetItem` — scoped to active profile. |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/088-piano-violin-playback/
├── plan.md              # This file
├── research.md          # Phase 0 — architecture decisions
├── data-model.md        # Phase 1 — entities and types
├── quickstart.md        # Phase 1 — dev setup and test guide
├── contracts/
│   └── internal-contracts.md   # Phase 1 — TypeScript interface contracts
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT YET CREATED)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── instrument.rs                          # MODIFY: classify_instrument_type()
│   │   └── importers/
│   │       └── musicxml/
│   │           └── converter/
│   │               └── mod.rs                     # MODIFY: use classify_instrument_type
│   └── adapters/
│       └── dtos.rs                                # no change needed
└── src/domain/importers/musicxml/
    └── (tests inline in instrument.rs)

frontend/
├── src/
│   ├── types/
│   │   └── playback.ts                            # MODIFY: add InstrumentChannelConfig,
│   │                                              #          InstrumentMixerEntry, InstrumentMixerState,
│   │                                              #          TaggedNote
│   ├── services/
│   │   └── playback/
│   │       ├── PlaybackChannel.ts                 # NEW: audio channel per instrument
│   │       ├── PlaybackChannel.test.ts            # NEW: unit tests
│   │       ├── InstrumentTimbres.ts               # NEW: timbre registry
│   │       ├── InstrumentTimbres.test.ts          # NEW: unit tests (SC-002)
│   │       ├── ToneAdapter.ts                     # MODIFY: multi-channel API
│   │       ├── ToneAdapter.test.ts                # MODIFY: add multi-channel tests
│   │       └── PlaybackScheduler.ts               # MODIFY: route by _partIndex
│   │   └── hooks/
│   │       └── useInstrumentMixer.ts              # NEW: mixer state + persistence
│   │       └── useInstrumentMixer.test.ts         # NEW: unit tests
│   ├── components/
│   │   └── notation/
│   │       ├── InstrumentMixerOverlay.tsx         # NEW: mute/volume UI overlay
│   │       └── InstrumentMixerOverlay.css         # NEW: styles
│   │   └── layout/
│   │       └── LayoutView.tsx                     # MODIFY: mount InstrumentMixerOverlay
│   └── plugin-api/
│       └── scorePlayerContext.ts                  # MODIFY: tag notes with _partIndex,
│                                                  #          init mixer on score load
└── e2e/
    └── playback-multi-instrument.spec.ts          # NEW: E2E tests
```

**Structure Decision**: Web application monorepo (Option 2). Backend provides domain classification; frontend provides all audio rendering and UI. No new top-level directories.

## Complexity Tracking

No constitution violations — this section is not applicable.
