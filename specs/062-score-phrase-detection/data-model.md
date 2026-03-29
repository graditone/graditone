# Data Model: Score Phrase Detection

**Feature**: 062-score-phrase-detection  
**Date**: 2026-03-29

## Entities

### PhraseRegion (Rust domain)

File: `backend/src/domain/phrases.rs`

```rust
use serde::{Deserialize, Serialize};

/// A detected musical phrase region within a score.
/// Phrases are per-instrument and aligned to measure boundaries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhraseRegion {
    /// 0-based instrument index within the Score
    pub instrument_index: usize,
    /// 0-based start measure (inclusive)
    pub start_measure: usize,
    /// 0-based end measure (inclusive)
    pub end_measure: usize,
    /// Start tick derived from measure boundaries
    pub start_tick: u32,
    /// End tick derived from measure boundaries (end of end_measure)
    pub end_tick: u32,
}
```

**Relationships**:
- `Score.phrases: Vec<PhraseRegion>` — optional, empty for scores with no detected phrases
- Each PhraseRegion references an instrument by index (not by ID) since instruments are stored in a Vec
- start_tick and end_tick are derived from `Score.measure_end_ticks`

**Validation rules**:
- `start_measure <= end_measure`
- `start_tick < end_tick`
- `instrument_index < score.instruments.len()`
- Phrases for the same instrument must not overlap
- Phrases should be sorted by (instrument_index, start_measure)

### PhraseRegionDto (Rust adapter)

File: `backend/src/adapters/dtos.rs`

```rust
/// DTO for phrase region serialization (Feature 062)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhraseRegionDto {
    pub instrument_index: usize,
    pub start_measure: usize,
    pub end_measure: usize,
    pub start_tick: u32,
    pub end_tick: u32,
}

impl From<&PhraseRegion> for PhraseRegionDto {
    fn from(phrase: &PhraseRegion) -> Self {
        Self {
            instrument_index: phrase.instrument_index,
            start_measure: phrase.start_measure,
            end_measure: phrase.end_measure,
            start_tick: phrase.start_tick,
            end_tick: phrase.end_tick,
        }
    }
}
```

Note: PhraseRegion and PhraseRegionDto are structurally identical (no enum → int conversion like DifficultyLevel). The DTO layer is maintained for consistency with existing patterns and to decouple domain evolution from serialization.

### PhraseRegion (TypeScript)

File: `frontend/src/types/score.ts`

```typescript
/** A detected musical phrase region within a score (Feature 062) */
export interface PhraseRegion {
  /** 0-based instrument index */
  instrument_index: number;
  /** 0-based start measure (inclusive) */
  start_measure: number;
  /** 0-based end measure (inclusive) */
  end_measure: number;
  /** Start tick derived from measure boundaries */
  start_tick: number;
  /** End tick (end of end_measure) */
  end_tick: number;
}
```

## Score Modifications

### Rust Score struct

```rust
// In backend/src/domain/score.rs, add to Score struct:
/// Detected phrase regions per instrument (Feature 062)
#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub phrases: Vec<PhraseRegion>,
```

### Rust ScoreDto struct

```rust
// In backend/src/adapters/dtos.rs, add to ScoreDto struct:
/// Detected phrase regions per instrument (Feature 062)
#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub phrases: Vec<PhraseRegionDto>,
```

### ScoreDto From<&Score> impl

```rust
// Add to the From<&Score> for ScoreDto impl:
phrases: score.phrases.iter().map(PhraseRegionDto::from).collect(),
```

### TypeScript Score interface

```typescript
// In frontend/src/types/score.ts, add to Score interface:
/** Detected phrase regions per instrument (Feature 062) */
phrases?: PhraseRegion[];
```

### Schema Version

```rust
// In backend/src/adapters/dtos.rs:
// Bump from 10 to 11
/// v11: phrases added to ScoreDto (062-score-phrase-detection)
pub const SCORE_SCHEMA_VERSION: u32 = 11;
```

## Module Structure

### New Rust module: `backend/src/domain/phrases.rs`

Contains:
- `PhraseRegion` struct (defined above)
- `detect_phrases(score: &Score) -> Vec<PhraseRegion>` — main entry point

### New Rust module: `backend/src/domain/phrases/`

If detection logic grows, split into:
- `mod.rs` — public API (`detect_phrases`, `PhraseRegion`)
- `slur_analyzer.rs` — slur chain walking
- `boundary_detector.rs` — structural boundary detection
- `fallback.rs` — regular grouping fallback

Initial implementation can be a single file `phrases.rs`.

### Registering the module

```rust
// In backend/src/domain/mod.rs, add:
pub mod phrases;
```

## State Transitions

Phrases have no mutable state transitions. They are computed once during import and stored immutably on the Score. Re-importing the same MusicXML always produces the same phrases (deterministic).

## Serialization Flow

```
MusicXML → Score (with phrases: Vec<PhraseRegion>)
         → ScoreDto (with phrases: Vec<PhraseRegionDto>)
         → JSON via serde_json
         → JsValue via serde-wasm-bindgen
         → TypeScript Score (with phrases?: PhraseRegion[])
         → IndexedDB cache (invalidated by schema_version bump to 11)
```
