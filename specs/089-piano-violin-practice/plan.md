# Implementation Plan: Piano Practice with Violin Accompaniment Playback

**Branch**: `089-piano-violin-practice` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/089-piano-violin-practice/spec.md`

## Summary

When a violin+piano score is loaded in the Practice plugin, the violin (and all non-piano parts) play back automatically as accompaniment during practice sessions. An independent volume slider in the Practice plugin's toolbar controls accompaniment gain (default 70%), persisting across runs within the same page session. The implementation extends the Plugin API with two new methods — `getInstruments()` and `setPartVolume()` — and adds a `useAccompaniment` hook plus an `AccompanimentVolumeSlider` component in the Practice plugin. No backend or WASM changes required; the feature routes through the existing per-instrument `ToneAdapter` channels introduced in Feature 088.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18+); no Rust/WASM changes  
**Primary Dependencies**: React 18+, Vite, Tone.js, Plugin API (`PluginScorePlayerContext`), `ToneAdapter`/`PlaybackChannel` (Feature 088)  
**Storage**: Page-session module state only — no `localStorage`, no `IndexedDB`  
**Testing**: Vitest + `@testing-library/react` (frontend unit/component tests); no new Playwright e2e tests  
**Target Platform**: Tablet PWA (iPad, Surface, Android tablets) — Chrome 57+, Safari 11+, Edge 16+  
**Project Type**: Web application (frontend only)  
**Performance Goals**: Volume slider audio feedback ≤16ms; no new scheduling overhead on score playback  
**Constraints**: No new synthesis engine; accompaniment uses existing ToneAdapter channels; volume is page-session transient (not profile-scoped)  
**Scale/Scope**: ~6 modified/created source files, 2 new Plugin API methods, 1 new hook, 1 new component

## Constitution Check (Pre-Design Gate)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Entities named in music domain: `AccompanimentPart`, `AccompanimentVolume` |
| II. Hexagonal Architecture | ✅ PASS | Plugin API is the port; `ToneAdapter` channel is the adapter; no domain logic leaks into UI |
| III. PWA / Offline | ✅ PASS | Entirely local; no network calls introduced |
| IV. Precision & Fidelity | ✅ PASS | No tick/timing changes; volume is a gain node scalar, not schedule manipulation |
| V. Test-First (NON-NEGOTIABLE) | ✅ REQUIRED | Tests written before implementation. Red-green-refactor enforced in tasks. |
| VI. Layout Engine Authority | ✅ PASS | No coordinate calculations; volume slider is a CSS-positioned toolbar element |
| VII. Regression Prevention | ✅ REQUIRED | Explicit regression tests for FR-008 (piano-only scores unaffected), FR-007 (staff filter coexistence), SC-005 (note detection accuracy) |
| VIII. User Profile Awareness | ⚠️ JUSTIFIED EXEMPTION | Accompaniment volume is page-session transient state (spec: "resets on full page reload"). Not a persisted user preference — equivalent to current playback position or MIDI routing. No new `localStorage` keys introduced. `ProfileIcon` already present in Practice toolbar (Feature 080). |

**Gate result: PASS** — Principle VIII exemption is justified. The volume setting is transient (page-session only), not a user-profile-scoped preference, so no `localStorage` scoping is required.

### Documentation (this feature)

```text
specs/089-piano-violin-practice/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── plugin-api-v11.ts  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   └── plugin-api/
│       ├── types.ts                               # MODIFY: PluginInstrumentInfo, extend PluginScorePlayerContext (v11)
│       └── scorePlayerContext.ts                  # MODIFY: implement getInstruments(), setPartVolume()
├── plugins/
│   └── practice-view-plugin/
│       ├── PracticeViewPlugin.tsx                 # MODIFY: wire useAccompaniment hook
│       ├── practiceToolbar.tsx                    # MODIFY: add AccompanimentVolumeSlider to toolbar
│       ├── useAccompaniment.ts                    # CREATE: accompaniment detection + volume hook
│       ├── useAccompaniment.test.ts               # CREATE: unit tests (TDD — written first)
│       ├── AccompanimentVolumeSlider.tsx          # CREATE: volume slider component
│       └── AccompanimentVolumeSlider.test.tsx     # CREATE: component tests (TDD — written first)
└── tests/
    └── integration/
        └── accompaniment.test.ts                  # CREATE: integration test with score player mock
```

**Structure Decision**: Frontend-only web application. All source changes are in `frontend/`. No backend or WASM changes.

## Complexity Tracking

No constitution violations that require complexity justification.

---

## Constitution Check (Post-Design Re-evaluation)

*Re-checked after Phase 1 design. All findings consistent with pre-design gate.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. DDD | ✅ PASS | `PluginInstrumentInfo`, `AccompanimentState`, `AccompanimentVolume` — all music-domain language |
| II. Hexagonal | ✅ PASS | `useAccompaniment` hook calls only Plugin API methods; `ToneAdapter` never imported in plugin code |
| III. PWA / Offline | ✅ PASS | No network calls; module-level state works offline |
| IV. Precision & Fidelity | ✅ PASS | `setVolume(linear)` → `linearToDb()` → Tone.Volume dB — no integer pulse manipulation |
| V. Test-First | ✅ REQUIRED | `useAccompaniment.test.ts` and `AccompanimentVolumeSlider.test.tsx` must be written **before** implementation files |
| VI. Layout Engine | ✅ PASS | `AccompanimentVolumeSlider` is a CSS flex slider with no spatial geometry computations |
| VII. Regression Prevention | ✅ REQUIRED | Regression tests: FR-008 (no slider on piano-only score), FR-007 (staff filter unchanged), SC-005 (note detection accuracy) |
| VIII. Profile Awareness | ⚠️ JUSTIFIED | Post-design: confirmed no `localStorage` keys added. Module-level singleton `pageSessionVolume` is analogous to playback position — correct scope for this preference. |

**Post-design gate: PASS** — design is consistent with all constitution principles.

