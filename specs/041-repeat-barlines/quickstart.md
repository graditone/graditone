# Quickstart: Repeat Barlines (041)

**Branch**: `041-repeat-barlines`
**Date**: 2026-06-25

## Scope

Full-stack change across the Rust backend domain and layout engine, MusicXML importer, WASM bridge, and TypeScript frontend. The feature touches three layers in sequence: domain model → layout engine → playback pre-processing → rendering.

## Files Changed

| File | Change Type | Description |
|---|---|---|
| `backend/src/domain/repeat.rs` | New | `RepeatBarline` domain entity + `RepeatBarlineType` enum |
| `backend/src/domain/score.rs` | Modified | Add `repeat_barlines: Vec<RepeatBarline>` field with `#[serde(default)]` |
| `backend/src/domain/importers/musicxml/types.rs` | Modified | Add `start_repeat: bool`, `end_repeat: bool` to `MeasureData` |
| `backend/src/domain/importers/musicxml/parser.rs` | Modified | Parse `<barline><repeat direction="forward\|backward"/></barline>` |
| `backend/src/domain/importers/musicxml/converter.rs` | Modified | Populate `Score.repeat_barlines` from parsed flags |
| `backend/src/layout/types.rs` | Modified | `BarLineType` += 3 repeat variants; `BarLine` += `dots`; new `RepeatDotPosition` |
| `backend/src/layout/breaker.rs` | Modified | `MeasureInfo` += `start_repeat`, `end_repeat` flags |
| `backend/src/layout/mod.rs` | Modified | `compute_layout` reads repeat markers; `create_bar_lines` generates repeat types + dot geometry |
| `backend/tests/repeat_barlines_integration.rs` | New | Integration: import La Candeur → 3 repeat_barlines, 3 repeat barline types in layout |
| `frontend/src/types/score.ts` | Modified | Add `RepeatBarline`, `RepeatBarlineType`; extend `Score` |
| `frontend/src/wasm/layout.ts` | Modified | Extend `BarLineType`; add `RepeatDot`; extend `BarLine` |
| `frontend/src/services/playback/RepeatNoteExpander.ts` | New | `expandNotesWithRepeats()` pure expansion function |
| `frontend/src/services/playback/RepeatNoteExpander.test.ts` | New | Unit tests: identity, single end-repeat, start+end, La Candeur 39 measures |
| `frontend/src/components/LayoutRenderer.tsx` | Modified | Render dots from `barLine.dots` |
| `frontend/src/components/ScoreViewer.tsx` | Modified | Expand notes via `RepeatNoteExpander` before `usePlayback` |
| `frontend/plugins/score-player/scorePlayerContext.ts` | Modified | Expand notes via `RepeatNoteExpander` before `usePlayback` |

## Dev Setup

### Backend (Rust)

```bash
cd backend
cargo build
```

### Frontend (TypeScript)

```bash
cd frontend
npm install   # only if not already done
npm run dev   # Vite dev server on http://localhost:5173
```

### WASM rebuild (after Rust layout changes)

```bash
cd backend
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/music.wasm --out-dir pkg --target web
cp -r pkg ../frontend/src/wasm/
```

## Running Tests

### Rust unit + integration tests

```bash
cd backend

# Run all tests
cargo test

# Run only repeat barline tests
cargo test repeat

# Run integration test specifically
cargo test --test repeat_barlines_integration
```

### TypeScript unit tests

```bash
cd frontend

# Run RepeatNoteExpander unit tests only
npx vitest run src/services/playback/RepeatNoteExpander.test.ts

# Run all frontend unit tests
npm test
```

### E2E test

```bash
cd frontend
npx playwright test tests/e2e/repeat-barlines.spec.ts
```

## Verification Steps

### Step 1 — Import: La Candeur has 3 repeat barlines

After implementing the MusicXML parser changes, load `scores/Burgmuller_LaCandeur.mxl` and verify:

```typescript
// In browser console after importing the score
score.repeat_barlines.length === 3
score.repeat_barlines[0]  // { measure_index: 7, start_tick: 26880, end_tick: 30720, barline_type: 'End' }
score.repeat_barlines[1]  // { measure_index: 8, start_tick: 30720, end_tick: 34560, barline_type: 'Start' }
score.repeat_barlines[2]  // { measure_index: 15, start_tick: 57600, end_tick: 61440, barline_type: 'End' }
```

### Step 2 — Layout: 3 repeat barline visuals in La Candeur

Open La Candeur in the score viewer. Verify visually:
- End of measure 8: a `RepeatEnd` barline (thick-thin with two dots on the left).
- Start of measure 9: a `RepeatStart` barline (thin-thick with two dots on the right).
- End of measure 16: a `RepeatEnd` barline (thick-thin with two dots on the left).

Programmatically (browser DevTools):
```
document.querySelectorAll('[data-bar-type="RepeatEnd"]').length === 2
document.querySelectorAll('[data-bar-type="RepeatStart"]').length === 1
```

### Step 3 — Playback: 39 sounded measures for La Candeur

Play La Candeur from the beginning and verify it plays to completion. The playback duration should correspond to 39 measures at the score tempo.

Unit test assertion (in `RepeatNoteExpander.test.ts`):
```typescript
const expanded = expandNotesWithRepeats(lacandeurNotes, lacandeurRepeatBarlines);
const lastNote = expanded[expanded.length - 1];
expect(lastNote.end_tick).toBeLessThanOrEqual(39 * 3840);  // 149,760 ticks
```

### Step 4 — Regression: All other scores unaffected

Run the full test suite. All 5 fixture scores (Bach Invention, Beethoven Für Elise, Burgmuller Arabesque, Chopin Nocturne, Pachelbel Canon) must load and play without change.

```bash
cd backend && cargo test
cd frontend && npm test && npx playwright test
```

Expected: all tests green, no new failures compared to `main` branch.

## Known Constraints

- Volta brackets (first/second endings) are out of scope (FR not included in spec).
- Nested repeats are out of scope.
- Legacy saved scores with `repeat_barlines` absent deserialise cleanly to `[]` — no data migration needed.
- Mid-score playback always resets repeat state (playback always starts fresh from tick 0 — FR-013).
