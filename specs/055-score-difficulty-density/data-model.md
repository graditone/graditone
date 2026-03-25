# Data Model: Score Difficulty Rate for Note Density

**Branch**: `055-score-difficulty-density` | **Date**: 2026-03-25

## Entities

### DifficultyLevel (Rust enum / TypeScript union)

Discrete classification derived from the score density rate.

| Field | Type | Description |
|-------|------|-------------|
| Easy | variant / `1` | combined_score < 2.5 |
| Medium | variant / `2` | 2.5 ≤ combined_score ≤ 3.5 |
| Hard | variant / `3` | combined_score > 3.5 |

**Rust**:
```rust
// backend/src/domain/difficulty/level.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum DifficultyLevel {
    Easy = 1,
    Medium = 2,
    Hard = 3,
}

impl DifficultyLevel {
    pub fn from_density_rate(rate: f64) -> Self {
        if rate < 2.5 { DifficultyLevel::Easy }
        else if rate <= 3.5 { DifficultyLevel::Medium }
        else { DifficultyLevel::Hard }
    }
}
```

**TypeScript**:
```typescript
// frontend/src/types/score.ts
export type DifficultyLevel = 1 | 2 | 3;  // 1=Easy, 2=Medium, 3=Hard
```

---

### DifficultyRating (Rust struct / TypeScript interface)

The computed difficulty for a score, combining note density and polyphony. Stored in `ScoreDto` / `Score`.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| density_rate | f64 / number | No | Combined score: `0.6 × note_density + 0.4 × polyphony`, max across instruments. `note_density = 0.7×avg + 0.3×peak` (notes/beat, per-staff max). `polyphony = 0.7×avg_poly + 0.3×max_poly` (per-staff max). |
| level | DifficultyLevel / 1\|2\|3 | No | Discrete classification derived from density_rate: < 2.5 Easy, 2.5–3.5 Medium, > 3.5 Hard |

**Rust**:
```rust
// backend/src/domain/difficulty/mod.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRating {
    pub density_rate: f64,
    pub level: DifficultyLevel,
}
```

**TypeScript** (added to `frontend/src/types/score.ts`):
```typescript
export interface DifficultyRating {
  density_rate: number;
  level: DifficultyLevel;
}
```

---

### Score (extended)

The existing `Score` / `ScoreDto` gain one new optional field.

**Rust** — added to `Score` struct (`backend/src/domain/score.rs`):
```rust
pub difficulty_rating: Option<DifficultyRating>,
```

**Rust** — added to `ScoreDto` struct (`backend/src/adapters/dtos.rs`):
```rust
#[serde(skip_serializing_if = "Option::is_none", default)]
pub difficulty_rating: Option<DifficultyRatingDto>,
```

Where `DifficultyRatingDto` is:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRatingDto {
    pub density_rate: f64,
    pub level: u8,   // 1, 2, or 3
}
```

**TypeScript** — added to `Score` interface (`frontend/src/types/score.ts`):
```typescript
difficulty_rating?: DifficultyRating;
```

**Schema version**: 9 → **10**

---

### BarDensity (Rust — intermediate, not persisted)

Ephemeral value computed per bar during density calculation. Not stored.

| Field | Type | Description |
|-------|------|-------------|
| measure_index | usize | Bar number (0-based) |
| pitch_count | u32 | Number of sounding pitches in bar (per-staff max; excl. ties, grace notes) |
| duration_beats | f64 | Bar duration in beats (bar_duration_ticks / PPQ, tempo-independent) |
| density | f64 | pitch_count / duration_beats |

---

### BarPolyphony (Rust — intermediate, not persisted)

Ephemeral value computed per bar. Not stored.

| Field | Type | Description |
|-------|------|-------------|
| avg_polyphony | f64 | Average number of simultaneously sounding notes, sampled at each note onset tick (per-staff max) |
| max_polyphony | f64 | Maximum number of simultaneously sounding notes at any onset tick (per-staff max) |

```rust
// backend/src/domain/difficulty/density.rs (internal struct)
struct BarDensity {
    density: f64,  // only density matters for aggregation
}
```

---

## Relationships

```
Score (1) ──has──> (0..1) DifficultyRating
DifficultyRating ──has──> (1) DifficultyLevel
```

`DifficultyRating` is computed from the `Score`'s instruments, bars, and global structural events (tempo, time signature). It is computed once during the parse pipeline and stored with `ScoreDto`.

---

## Validation Rules

| Rule | Description |
|------|-------------|
| V-001 | `density_rate` MUST be ≥ 0 (zero for score with all rests) |
| V-002 | `level` MUST be 1, 2, or 3 (enforced by `DifficultyLevel` enum) |
| V-003 | A bar with `duration_seconds == 0` (impossible for valid time sig + tempo) MUST be excluded; divide-by-zero guarded |
| V-004 | A bar with no computable duration (missing time signature, cannot fall back to formula) MUST be excluded |
| V-005 | If ALL bars are excluded, `difficulty_rating` MUST be `None` (no tag shown) |
| V-006 | `is_tie_continuation == true` notes MUST NOT be counted |
| V-007 | `is_grace == true` notes MUST NOT be counted |

---

## State Transitions

```
Score loaded (first time)
  → difficulty computed synchronously
  → ScoreDto.difficulty_rating = Some(DifficultyRating { ... })
  → Cached in IndexedDB (schema v10)

Score loaded (subsequent, schema unchanged)
  → ScoreDto loaded from cache
  → difficulty_rating already present (no recomputation)

Score loaded (cache stale: schema v9 or older)
  → Raw MXL blob re-parsed via WASM
  → difficulty recomputed as part of re-parse
  → Cache updated with new ScoreDto (schema v10)

Score cannot be fully parsed (malformed)
  → ScoreDto.difficulty_rating = None
  → No tag shown in dialog
```
