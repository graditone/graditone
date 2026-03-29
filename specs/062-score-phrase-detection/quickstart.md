# Quickstart: Score Phrase Detection

**Feature**: 062-score-phrase-detection

## Prerequisites

- Rust 1.75+ (stable)
- Node.js 18+
- wasm-pack (`cargo install wasm-pack`)

## Backend Development

### Build & test the phrase detection module

```bash
cd backend

# Run all tests (includes new phrase detection tests)
cargo test

# Run only phrase detection tests
cargo test phrases

# Build WASM package for frontend
wasm-pack build --target web --out-dir pkg
```

### Key files to edit

| File | Purpose |
|------|---------|
| `src/domain/phrases.rs` | PhraseRegion struct + `detect_phrases()` |
| `src/domain/mod.rs` | Register `pub mod phrases;` |
| `src/domain/score.rs` | Add `phrases: Vec<PhraseRegion>` field |
| `src/adapters/dtos.rs` | Add PhraseRegionDto, bump SCORE_SCHEMA_VERSION to 11 |
| `src/adapters/wasm/bindings.rs` | Call `detect_phrases()` in `parse_musicxml()` |
| `tests/phrase_detection.rs` | Integration tests with fixture scores |

### Test with preloaded scores

```bash
# Parse a score and inspect phrase output
cargo test --test phrase_detection
```

## Frontend Development

### Start dev server

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Run tests

```bash
npm run test
```

### Key files to edit

| File | Purpose |
|------|---------|
| `src/types/score.ts` | Add `PhraseRegion` interface + `phrases?` on Score |
| `src/components/PhraseOverlay.tsx` | New component: renders color bands |
| `src/components/ScoreViewer.tsx` | Add Phrases toolbar toggle button |
| `src/hooks/usePhrases.ts` | Hook: phrase visibility state + practice integration |

## Validation

1. **Backend**: `cargo test` — all existing + new phrase tests pass
2. **Frontend**: `npm run test` — all existing + new component tests pass
3. **Manual**: Load Burgmuller_Arabesque.mxl → verify phrase color bands appear when toggling Phrases button
4. **Schema**: Confirm IndexedDB cache invalidation (schema v10 → v11) by loading a previously cached score
