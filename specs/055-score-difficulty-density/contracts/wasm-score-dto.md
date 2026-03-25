# WASM Contract: Difficulty Rating in ScoreDto

**Feature**: 055-score-difficulty-density  
**Contract type**: TypeScript ↔ Rust/WASM data boundary  
**Source of truth**: `backend/src/adapters/dtos.rs` (Rust serializes) → `frontend/src/types/score.ts` (TypeScript deserializes)

---

## ScoreDto Extension (JSON schema, schema_version: 10)

The existing `ScoreDto` gains one new optional field. All prior fields are unchanged.

```json
{
  "id": "string (UUID)",
  "schema_version": 10,
  "global_structural_events": [ "...existing..." ],
  "instruments": [ "...existing..." ],
  "repeat_barlines": [ "...existing..." ],
  "volta_brackets": [ "...existing..." ],
  "pickup_ticks": 0,
  "measure_end_ticks": [ "...existing..." ],
  "octave_shift_regions": [ "...existing..." ],

  "difficulty_rating": {
    "density_rate": 3.14,
    "level": 2
  }
}
```

The `difficulty_rating` field:
- Is **absent** (not serialized, not `null`) when no rating could be computed (e.g., malformed score, all bars excluded).
- Is **present** with a valid `DifficultyRatingDto` value when computation succeeded.

---

## DifficultyRatingDto

### Rust (serialized by `backend/src/adapters/dtos.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRatingDto {
    /// Weighted density: 0.7 * avg(bar_density) + 0.3 * peak(bar_density)
    /// Max across all instrument tracks.
    pub density_rate: f64,

    /// 1 = Easy  (<2.0 notes/sec)
    /// 2 = Medium (2.0–4.0 notes/sec)
    /// 3 = Hard   (>4.0 notes/sec)
    pub level: u8,
}
```

Serialization annotation on `ScoreDto.difficulty_rating`:
```rust
#[serde(skip_serializing_if = "Option::is_none", default)]
pub difficulty_rating: Option<DifficultyRatingDto>,
```

### TypeScript (deserialized by `frontend/src/types/score.ts`)

```typescript
export type DifficultyLevel = 1 | 2 | 3;

export interface DifficultyRating {
  /** Weighted density rate: 0.7 * avg + 0.3 * peak, max across instruments */
  density_rate: number;
  /** 1 = Easy, 2 = Medium, 3 = Hard */
  level: DifficultyLevel;
}

// Added to existing Score interface:
export interface Score {
  // ... existing fields ...
  difficulty_rating?: DifficultyRating;
}
```

---

## Contract Invariants

| Invariant | Description |
|-----------|-------------|
| CI-001 | `schema_version` is exactly `10` for any `ScoreDto` that carries `difficulty_rating` |
| CI-002 | `difficulty_rating` is absent (field not present) when no rating was computed; it is never `null` |
| CI-003 | `level` is always `1`, `2`, or `3` when `difficulty_rating` is present |
| CI-004 | `density_rate` is always ≥ 0.0 when `difficulty_rating` is present |
| CI-005 | `level` is consistent with `density_rate`: 1 iff < 2.0; 2 iff 2.0 ≤ x ≤ 4.0; 3 iff > 4.0 |

---

## Frontend Consumption

### DifficultyTag component contract

```typescript
// frontend/src/components/load-score/DifficultyTag.tsx
interface DifficultyTagProps {
  /** undefined → render nothing; 1/2/3 → render Easy/Medium/Hard badge */
  level: DifficultyLevel | undefined;
}
```

### Label mapping

```typescript
// frontend/src/services/difficulty/difficultyLabel.ts
export function difficultyLabel(level: DifficultyLevel): string {
  switch (level) {
    case 1: return 'Easy';
    case 2: return 'Medium';
    case 3: return 'Hard';
  }
}
```

---

## Schema Compatibility

| Scenario | Behavior |
|----------|----------|
| Cache has v9 schema, current is v10 | Cache is stale → re-parse from raw MXL → `difficulty_rating` computed and stored |
| Cache has v10 schema | Load from cache directly → `difficulty_rating` already present |
| Very old cache (v8 or earlier) | Same stale path → re-parse and compute |

No migration needed — the stale-schema re-parse pipeline handles all older versions automatically.
