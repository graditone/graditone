# Quickstart: Score-Defined Tempo Configuration

**Branch**: `001-score-tempo` | **Date**: 2026-03-11

This guide covers how to develop, test, and validate the score tempo feature locally.

---

## Prerequisites

- Rust stable toolchain (`rustup show`)
- `wasm-pack` for WASM compilation
- Node.js 20+ and npm
- The repo checked out on branch `001-score-tempo`

```bash
git checkout 001-score-tempo
```

---

## Repository Layout (changed files)

```
backend/src/domain/importers/musicxml/
  types.rs          ← (possibly) add sound_tempo to MeasureData
  parser.rs         ← extract <sound tempo> at measure level → doc.default_tempo
  converter.rs      ← clamp parsed tempo before BPM::new()

frontend/src/
  plugin-api/
    types.ts                    ← add snapToScoreTempo() to PluginScorePlayerContext
    scorePlayerContext.ts       ← call setOriginalTempo; add snapToScoreTempo impl
    scorePlayerContext.test.ts  ← tests for new behaviour
  components/
    ScoreViewer.tsx             ← call setOriginalTempo on score change
```

---

## Development Workflow

### 1. Rust backend changes

```bash
cd backend

# Run all backend tests (fast — no WASM required)
cargo test

# Run only MusicXML-related tests
cargo test musicxml

# Run with output for debugging
cargo test musicxml -- --nocapture
```

The key test to add/watch: `cargo test tempo_from_musicxml`

### 2. Rebuild WASM after backend changes

```bash
cd backend
wasm-pack build --target web --out-dir ../frontend/src/wasm
```

### 3. Frontend changes

```bash
cd frontend
npm install         # first time only

# Start dev server (hot reload)
npm run dev

# Run all unit tests (Vitest)
npm test

# Run only scorePlayerContext tests
npm test -- scorePlayerContext

# Run TempoStateContext tests
npm test -- TempoStateContext

# Type check
npm run typecheck

# Full validate (typecheck + lint + test)
npm run validate
```

---

## Manual Verification Steps

1. Start the dev server: `cd frontend && npm run dev`
2. Open the app at http://localhost:5173
3. Load the **Chopin Nocturne Op.9 No.2** from the catalogue
4. **Expected**: Tempo indicator shows **60 BPM** (not 120)
5. Change the tempo to 40 BPM using the tempo control
6. Trigger the **snap to score tempo** action
7. **Expected**: Tempo resets to 60 BPM, multiplier resets to 1.0×
8. Load the **Bach Invention No.1** from the catalogue
9. **Expected**: Playback stops; new score loads at its marked tempo; any prior tempo adjustment is cleared

---

## Key Test Scenarios

### Backend (Rust)

| Test | File | Validates |
|------|------|-----------|
| `tempo_from_sound_element` | `backend/tests/musicxml/tempo_from_musicxml.rs` | `<sound tempo="60"/>` at measure level → Score BPM = 60 |
| `tempo_out_of_range_clamped` | same | Tempo 5.0 clamps to 20; tempo 500.0 clamps to 400 |
| `tempo_missing_defaults_to_120` | same | No `<sound>` → Score BPM = 120 (regression guard) |

### Frontend (Vitest)

| Test | File | Validates |
|------|------|-----------|
| `scoreTempo reflects loaded score` | `scorePlayerContext.test.ts` | After `loadScore()`, `state.bpm === score's BPM` |
| `snapToScoreTempo resets to marked BPM` | `scorePlayerContext.test.ts` | `snapToScoreTempo()` sets effective BPM back to score's BPM |
| `score switch stops playback` | `scorePlayerContext.test.ts` | Loading new score while playing transitions to stopped/ready |
| `multiplier reset on snap` | `TempoStateContext.test.tsx` | `resetTempo()` + `setOriginalTempo()` integration |

---

## Debugging Tips

- **Still showing 120?** Check if WASM was rebuilt after parser change: `ls -la frontend/src/wasm/*.wasm` (timestamp should be recent)
- **Score tempo not updating in UI?** Check that `setOriginalTempo` is called in `loadScore()` — add a `console.log(parsedTempo)` to verify the value reaches the hook
- **`BPM::new()` returning Err?** The clamp in converter protects against this; if you see a `ValidationError` for tempo, the clamp code is missing or the value is `NaN`
- **`snapToScoreTempo` no-op?** Ensure `TempoStateContext` has an `originalTempo !== 120` (i.e., `setOriginalTempo` wiring is correct)
