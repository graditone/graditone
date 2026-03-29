# Contracts: Score Phrase Detection

**Feature**: 062-score-phrase-detection  
**Date**: 2026-03-29

This feature uses **WASM bindings** as the contract layer between backend and frontend (no REST/GraphQL API). The backend computes phrases during import and serializes them as part of the ScoreDto JSON payload via `serde-wasm-bindgen`.

## WASM Contract

### Entry Point

**Function**: `parse_musicxml(xml_content: &str) -> Result<JsValue, JsValue>`  
**File**: `backend/src/adapters/wasm/bindings.rs`

No new WASM function is needed. The existing `parse_musicxml()` entry point is extended:

```
parse_musicxml flow (updated):
  1. MusicXMLParser::parse() → MusicXMLDocument
  2. MusicXMLConverter::convert() → Score
  3. compute_difficulty(&score) → Option<DifficultyRating>  [existing]
  4. detect_phrases(&score) → Vec<PhraseRegion>              [NEW]
  5. score.phrases = detected_phrases                        [NEW]
  6. ScoreDto::from(&score) → ScoreDto (includes phrases)
  7. serde_wasm_bindgen::to_value(&result) → JsValue
```

### Serialized Payload (additions to ScoreDto JSON)

```json
{
  "score": {
    "schema_version": 11,
    "phrases": [
      {
        "instrument_index": 0,
        "start_measure": 0,
        "end_measure": 3,
        "start_tick": 0,
        "end_tick": 15360
      },
      {
        "instrument_index": 0,
        "start_measure": 4,
        "end_measure": 7,
        "start_tick": 15360,
        "end_tick": 30720
      }
    ]
  }
}
```

### Schema Version

**Old**: `SCORE_SCHEMA_VERSION = 10`  
**New**: `SCORE_SCHEMA_VERSION = 11`

This triggers automatic IndexedDB cache invalidation on the frontend. Pre-v11 cached scores will be re-parsed from source MusicXML, which will now include phrase detection.

### Backward Compatibility

- `phrases` uses `#[serde(default, skip_serializing_if = "Vec::is_empty")]` in Rust
- `phrases?: PhraseRegion[]` (optional) in TypeScript
- Pre-v11 scores deserialize with `phrases = []` (empty vec via serde default)
- Frontend treats missing/empty `phrases` as "no phrases detected" (no overlay shown)

## Frontend Plugin Contract

### Practice Plugin Integration

The practice plugin uses `PluginContext.scorePlayer` to set loop regions:

```typescript
// When user taps a phrase to practice:
context.scorePlayer.setPinnedStart(phrase.start_tick);
context.scorePlayer.setLoopEnd(phrase.end_tick);
```

No new plugin API methods are needed. The existing `setPinnedStart` / `setLoopEnd` methods on `ScorePlayerContext` are sufficient for phrase-to-practice-region conversion.

### Toolbar Integration

The Phrases toggle button uses the existing toolbar pattern in `ScoreViewer.tsx`:

```typescript
// Toolbar button contract:
// - Icon: segmented bar icon or similar
// - Toggle state: boolean (phrases visible / hidden)
// - Disabled when: score has no phrases (score.phrases is empty/undefined)
```

No new props or callbacks are defined at the contract level; this is a component-internal concern.
