# musicore Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-06

## Active Technologies
- TypeScript 5.0+, React 18+ + React, TypeScript, Bravura font (SMuFL), existing Score API clien (002-staff-notation-view)
- N/A (frontend-only feature, reads from existing backend API) (002-staff-notation-view)
- Backend: Rust (latest stable 1.75+), Frontend: TypeScript 5.0+, React 18+ + Backend: serde (existing), Frontend: Tone.js 14.7+ (new), React, TypeScript (existing) (003-music-playback)
- Backend uses existing in-memory Score repository with ScoreRepository trait (no changes needed) (003-music-playback)
- TypeScript 5.9, React 19 (frontend only - no backend changes) + Browser File API (native), existing Score type definitions (004-save-load-scores)
- Client-side browser file system via download/upload (no server-side storage) (004-save-load-scores)
- TypeScript 5.9 (frontend), Rust 1.82+ (backend) + React 19, Vite bundler (frontend); Axum web framework, Tokio async runtime (backend) (005-chord-symbols)
- In-memory (no database persistence for chords) (005-chord-symbols)
- Rust 1.82+ (backend/parsing engine), TypeScript 5.9 (frontend UI) + quick-xml or roxmltree (Rust XML parsing), zip crate (Rust .mxl decompression), React 19, Axum web framework (006-musicxml-import)
- In-memory repository (existing), file system for uploaded MusicXML files (temporary) (006-musicxml-import)
- TypeScript 5.9 (frontend), Rust 1.82+ (backend API - minimal changes) + React 19.2, Bravura music font (SMuFL), Vite 7.2 bundler; backend: Axum 0.7, serde (007-clef-notation)
- N/A (display-only feature; clef data already stored in domain model via Feature 006) (007-clef-notation)
- N/A (no data persistence - scroll/highlight state is ephemeral playback state) (009-playback-scroll-highlight)
- TypeScript 5.9, React 19.2 + React, Vite (bundler), Vitest (testing), Tone.js (audio playback) (010-stacked-staves-view)
- N/A (frontend only, uses existing backend API) (010-stacked-staves-view)
- TypeScript 5.9 (frontend), JavaScript ES2022 (service worker), JSON (manifest) (012-pwa-distribution)
- Cache Storage API (browser native), IndexedDB (already implemented in Feature 011 for scores) (012-pwa-distribution)
- TypeScript 5.9 (frontend), Rust 1.75+ (backend WASM module - limited changes) (013-demo-onboarding)
- Browser Local Storage (for first-run flag and view mode preference), IndexedDB (for demo score storage, already implemented in Feature 011) (013-demo-onboarding)
- TypeScript ~5.9.3, React 19.2.0 + React 19.2.0, Vite 7.2.4, WASM music engine (backend Rust compiled via wasm-pack) (014-remove-edit-ui)
- IndexedDB for offline score storage (already implemented) (014-remove-edit-ui)
- TypeScript 5.9, React 19 + React (UI), Vitest (testing), Bravura font (SMuFL notation) (001-staff-display-refinement)
- N/A (visual presentation only) (001-staff-display-refinement)
- Rust 1.93+ (backend/WASM), TypeScript 5.9+ (frontend) + quick-xml (XML parsing), wasm-bindgen (JS interop), serde (serialization), JSZip (frontend .mxl decompression) (015-musicxml-error-handling)
- N/A (parser operates in-memory; storage handled by existing score persistence layer) (015-musicxml-error-handling)
- Rust 1.93+ + serde 1.0+, serde_json 1.0+, wasm-bindgen 0.2+ (016-rust-layout-engine)
- N/A (stateless layout computation, output cached in IndexedDB by frontend) (016-rust-layout-engine)
- TypeScript 5.0+, React 19 + Canvas 2D API (browser native), Feature 016 WASM bindings (musicore_backend), layoutUtils.ts (47 unit tests) (017-layout-renderer)
- N/A (stateless rendering, layout cached in IndexedDB by parent component) (017-layout-renderer)
- Rust 1.75+ (stable), Edition 2021 (018-rust-layout-engraving)
- N/A (stateless computation - inputs via WASM, outputs as JSON) (018-rust-layout-engraving)
- Rust (latest stable) for backend/WASM, TypeScript/React 19+ for frontend + React 19.2, Tone.js 14.9, wasm-bindgen 0.2, Vite (bundler) (019-playback-note-highlight)
- N/A (feature uses in-memory state, no persistence) (019-playback-note-highlight)
- Rust (latest stable) for backend layout engine; TypeScript + React for frontend renderer + serde/serde_json (Rust serialization), wasm-bindgen/wasm-pack (WASM compilation), React 18+ (frontend) (020-measure-numbering)
- N/A — computed at layout time, no persistence required (020-measure-numbering)
- Rust (latest stable) for backend/layout engine; TypeScript + React 18 for frontend + `quick-xml` (MusicXML parsing), `wasm-bindgen`/`wasm-pack` (WASM bridge), `serde`/`serde_json` (serialization), Bravura SMuFL font (glyph rendering) (021-note-beaming)
- N/A (in-memory layout computation; scores loaded from MusicXML files) (021-note-beaming)
- Rust (stable), TypeScript 5.x, React 18+ + React, Tone.js (playback), wasm-pack/wasm-bindgen (WASM bindings), Vite (022-display-improvements)
- N/A (all state is in-memory React state/context) (022-display-improvements)
- Rust (latest stable) + TypeScript 5.x / React 18+ + wasm-pack, wasm-bindgen, serde, serde_json (backend); Vite, Tone.js (frontend) (023-multi-instrument-play)
- IndexedDB (offline-first PWA, no changes needed for this feature) (023-multi-instrument-play)
- TypeScript 5.x (frontend), React 18+ (UI framework) + Tone.js (audio engine), React (rendering), SMuFL/Bravura (music font), WASM layout engine (Rust backend) (024-playback-performance)
- N/A (no persistence changes) (024-playback-performance)
- TypeScript 5.x (frontend), Rust 1.75+ (backend WASM module, no changes expected) + React 18+, vite-plugin-pwa, Workbox (service worker), IndexedDB (via custom wrapper), WASM music engine (already compiled), Tone.js (audio playback) (025-offline-mode)
- IndexedDB for score persistence, Service Worker cache for assets (app shell, WASM module, demo MusicXML), network-first with fallback for score data (currently unused) (025-offline-mode)
- TypeScript 5.x strict mode + React 18+, Vite 7.3.1, Tone.js, Vitest 4.0.18 (026-playback-ui-fixes)
- N/A (no storage changes — all in-memory/UI state) (026-playback-ui-fixes)
- TypeScript (React 18 + Hooks), Rust stable ≥1.79 + React, Vite, Vitest, Playwright, Tone.js, wasm-bindgen, History API, Fullscreen API (027-demo-flow-ux)
- N/A — no new or changed storage (027-demo-flow-ux)
- TypeScript 5.9 / React 19.2 / Vite 7.x + Web Audio API (`AudioWorklet`, `getUserMedia`), `pitchy` (MPM pitch detection, ~33 kB, zero-dependency), Canvas 2D API (001-recording-view)
- N/A — in-memory React state only; no IndexedDB, no backend (001-recording-view)
- TypeScript 5 / React 18, Node 22 + Vite 6, Vitest 2, @testing-library/react, pitchy (already installed), existing `NotationLayoutEngine` + `NotationRenderer` WASM modules (001-piano-practice)
- N/A — all state is in-memory, ephemeral (001-piano-practice)
- TypeScript (strict), React 18, Vite + `computeLayout` / `GlobalLayout` (`wasm/layout.ts`), `LayoutRenderer` (`components/LayoutRenderer.tsx`), `buildSourceToNoteIdMap` pattern from `services/highlight/sourceMapping.ts` (001-practice-rust-layout)
- N/A — all data is in-memory per practice session (001-practice-rust-layout)
- TypeScript 5.9 / React 19.2 / Vite 7.x + Web MIDI API (`navigator.requestMIDIAccess` — no npm library), existing `useAudioRecorder` hook pattern (029-midi-input)
- TypeScript 5.x, React 18, Vite + React 18 (error boundary API), `fflate` (ZIP extraction, ~8 KB gz), `idb` v8 (IndexedDB, ~1.7 KB gz), ESLint flat config (`no-restricted-imports`) (030-plugin-architecture)
- IndexedDB (plugin registry — manifests + asset blobs; persists across PWA sessions) (030-plugin-architecture)
- TypeScript 5.x, React 18 + Vite (bundler), Vitest + React Testing Library (tests), ToneAdapter (audio scheduling), AudioWorklet + `pitchDetection.ts` (mic pitch), `fflate` / `idb` (plugin infrastructure from 030, unchanged), ESLint flat config `no-restricted-imports` (plugin boundary enforcement) (031-practice-view-plugin)
- N/A — no new persistence; existing plugin registry (IndexedDB via `idb`) used unchanged (031-practice-view-plugin)
- TypeScript 5 + React 19 (JSX; same stack as existing plugins) + Plugin API v2 (`frontend/src/plugin-api/index.ts`); esbuild (bundler → single ESM `index.js`); bash `zip` (packaging); Vitest + `@testing-library/react` (tests) (032-virtual-keyboard-pro)
- None — plugin state is session-only; ZIP persistence handled by host IndexedDB (032-virtual-keyboard-pro)
- TypeScript 5 (React 18), Rust stable + wasm-pack (WASM; no new Rust changes in this feature) + React 18, Vite, wasm-pack/wasm-bindgen, Tone.js (audio), Vitest + React Testing Library, Playwrigh (033-play-score-plugin)
- N/A — scores are bundled static assets (6 MXL files); `<input type="file">` for user scores; no database (033-play-score-plugin)
- TypeScript 5 (React 18), Rust stable + wasm-pack (no new Rust changes) + React 18, Vite, Vitest + React Testing Library, Playwrigh (034-practice-from-score)
- N/A — preloaded scores are bundled static assets; `<input type="file">` for user files; no database (034-practice-from-score)
- TypeScript 5.9, React 19, Vite 7 + Vitest 4, Playwright 1.58 — no new npm packages required (001-practice-complexity-levels)
- `localStorage` key `practice-complexity-level-v1` (browser, cross-restart) (001-practice-complexity-levels)
- TypeScript 5.x, React 18 + React, Plugin API v4 (`context.playNote`, `context.midi.subscribe`, `context.recording.subscribe`), Vitest (unit), Playwright (e2e) (001-practice-virtual-keyboard)
- N/A — toggle state is session-only, no persistence (FR-009) (001-practice-virtual-keyboard)
- TypeScript 5, React 18 + Tone.js v14.9.17 (`MembraneSynth` + `Synth`), Web Audio API (via Tone.js Transport), React rAF loop (`ITickSource`) (035-metronome)
- N/A (no persistence; metronome state is transient per view) (035-metronome)

- Rust (latest stable 1.75+) + serde 1.0+, serde_json 1.0+ (serialization), thiserror 1.0+ (errors); web framework TBD in contracts phase (axum or actix-web) (001-score-model)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cargo test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] cargo clippy

## Code Style

Rust (latest stable 1.75+): Follow standard conventions

## Recent Changes
- 035-metronome: Added TypeScript 5, React 18 + Tone.js v14.9.17 (`MembraneSynth` + `Synth`), Web Audio API (via Tone.js Transport), React rAF loop (`ITickSource`)
- 001-practice-virtual-keyboard: Added TypeScript 5.x, React 18 + React, Plugin API v4 (`context.playNote`, `context.midi.subscribe`, `context.recording.subscribe`), Vitest (unit), Playwright (e2e)
- 001-practice-complexity-levels: Added TypeScript 5.9, React 19, Vite 7 + Vitest 4, Playwright 1.58 — no new npm packages required


<!-- MANUAL ADDITIONS START -->
## Feature 028: Load Score Dialog

**Branch**: `028-load-score-dialog`

**What's changing**:
- Landing screen: single **Load Score** button (removes Demo + Import Score buttons)
- New `<dialog>`-based modal: 2-panel (preloaded list left, file-picker button right)
- Preloaded scores: 6 `.mxl` files served from `frontend/public/scores/` (symlink to `/scores/`)
- Offline: `mxl` added to Workbox `globPatterns` in `vite.config.ts`
- Feature 013 onboarding removed: `useOnboarding.ts`, `services/onboarding/` deleted, `App.tsx` cleaned

**New files**:
- `frontend/src/data/preloadedScores.ts` — `PRELOADED_SCORES` manifest constant
- `frontend/src/components/load-score/LoadScoreButton.tsx` — stateless trigger button
- `frontend/src/components/load-score/LoadScoreDialog.tsx` — modal using `<dialog>` element
- `frontend/src/components/load-score/PreloadedScoreList.tsx` — renders 6 score entries
- `frontend/src/components/load-score/LoadNewScoreButton.tsx` — wraps `useImportMusicXML` for file-picker

**Key integration**:
- Preloaded load: `fetch(score.path)` → `new File([blob], name)` → `useImportMusicXML.importFile()`
- On success: `handleMusicXMLImport(result)` then `setViewMode('layout')` in `ScoreViewer`
- Play view opens **paused at tick 0** — user taps Play

**Deleted**:
- `frontend/src/hooks/useOnboarding.ts`
- `frontend/src/services/onboarding/` (entire directory)
<!-- MANUAL ADDITIONS END -->
