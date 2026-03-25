# Quickstart: Score Difficulty Rate for Note Density

**Branch**: `055-score-difficulty-density` | **Date**: 2026-03-25

This guide walks through the implementation in dependency order. Each step is independently verifiable.

---

## Prerequisites

```bash
cd /path/to/graditone
git checkout 055-score-difficulty-density

# Verify backend compiles cleanly
cd backend && cargo check && cd ..

# Verify frontend compiles cleanly
cd frontend && npm run build && cd ..
```

---

## Step 1 — Rust domain: DifficultyLevel and DifficultyRating

Create the new `difficulty` module in the Rust domain layer.

**Files to create:**
- `backend/src/domain/difficulty/mod.rs`
- `backend/src/domain/difficulty/level.rs`
- `backend/src/domain/difficulty/density.rs`

**Add to** `backend/src/domain/mod.rs`:
```rust
pub mod difficulty;
```

### level.rs — DifficultyLevel enum

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum DifficultyLevel {
    Easy = 1,
    Medium = 2,
    Hard = 3,
}

impl DifficultyLevel {
    pub fn from_density_rate(rate: f64) -> Self {
        if rate < 2.0 { DifficultyLevel::Easy }
        else if rate <= 4.0 { DifficultyLevel::Medium }
        else { DifficultyLevel::Hard }
    }
}
```

**Write tests first** (`backend/tests/difficulty_test.rs`):
```rust
#[test]
fn test_level_easy() { assert_eq!(DifficultyLevel::from_density_rate(1.9), DifficultyLevel::Easy); }
#[test]
fn test_level_medium_lower() { assert_eq!(DifficultyLevel::from_density_rate(2.0), DifficultyLevel::Medium); }
#[test]
fn test_level_medium_upper() { assert_eq!(DifficultyLevel::from_density_rate(4.0), DifficultyLevel::Medium); }
#[test]
fn test_level_hard() { assert_eq!(DifficultyLevel::from_density_rate(4.01), DifficultyLevel::Hard); }
#[test]
fn test_level_zero_density_is_easy() { assert_eq!(DifficultyLevel::from_density_rate(0.0), DifficultyLevel::Easy); }
```

---

## Step 2 — Rust domain: density computation

### density.rs — bar density and score density rate

```rust
use super::level::{DifficultyLevel, DifficultyRating};
use crate::domain::score::Score;
use crate::layout::extraction::{actual_start, actual_end};

const DEFAULT_BPM: u16 = 120;
const PPQ: f64 = 960.0;

pub fn compute_difficulty(score: &Score) -> Option<DifficultyRating> {
    // Must have at least one instrument
    if score.instruments.is_empty() { return None; }

    // Number of measures = measure_end_ticks.len() or derive from max tick
    let measure_count = score.measure_end_ticks.len();
    if measure_count == 0 { return None; }

    let max_level = score.instruments.iter()
        .filter_map(|instrument| compute_instrument_density(score, instrument, measure_count))
        .max()?;   // None if no instrument produced a rating (all bars excluded)

    Some(max_level)
}

fn compute_instrument_density(score: &Score, instrument: &Instrument, measure_count: usize)
    -> Option<DifficultyRating>
{
    // Determine ticks_per_measure from first time signature (fallback: 4/4)
    // Note: time sig can change mid-score; handle per-bar below

    let mut bar_densities: Vec<f64> = Vec::with_capacity(measure_count);

    for measure_index in 0..measure_count {
        let bar_start = actual_start(measure_index, &score.measure_end_ticks,
                                     score.pickup_ticks, ticks_per_measure_at(score, measure_index));
        let bar_end   = actual_end(measure_index, &score.measure_end_ticks,
                                   score.pickup_ticks, ticks_per_measure_at(score, measure_index));
        let bar_duration_ticks = bar_end.saturating_sub(bar_start);
        if bar_duration_ticks == 0 { continue; }  // guard: skip degenerate bars

        let bpm = score.get_tempo_at(bar_start)
            .map(|e| e.bpm.value())
            .unwrap_or(DEFAULT_BPM);
        let bar_duration_s = (bar_duration_ticks as f64 * 60.0) / (PPQ * bpm as f64);
        if bar_duration_s <= 0.0 { continue; }  // guard: divide-by-zero

        let pitch_count = count_pitches_in_bar(instrument, bar_start, bar_end);
        bar_densities.push(pitch_count as f64 / bar_duration_s);
    }

    if bar_densities.is_empty() { return None; }

    let avg = bar_densities.iter().copied().sum::<f64>() / bar_densities.len() as f64;
    let peak = bar_densities.iter().copied().fold(f64::NAN, f64::max);
    let density_rate = 0.7 * avg + 0.3 * peak;

    Some(DifficultyRating {
        density_rate,
        level: DifficultyLevel::from_density_rate(density_rate),
    })
}

fn count_pitches_in_bar(instrument: &Instrument, bar_start: u32, bar_end: u32) -> u32 {
    instrument.staves.iter()
        .flat_map(|staff| staff.voices.iter())
        .flat_map(|voice| voice.interval_events.iter())
        .filter(|note| {
            !note.is_tie_continuation
            && !note.is_grace.unwrap_or(false)
            && note.start_tick >= bar_start
            && note.start_tick < bar_end
        })
        .count() as u32
}
```

**Write tests first** (in `backend/tests/difficulty_test.rs`):
```rust
// Tests with helper fixtures: single bar with known note count and tempo
#[test]
fn test_single_bar_single_pitch_easy() { /* 1 note in 1s bar = 1.0/s = Easy */ }
#[test]
fn test_chord_counts_each_pitch() { /* 4 simultaneous notes = 4 pitches */ }
#[test]
fn test_tie_continuation_excluded() { /* tied note continuation not counted */ }
#[test]
fn test_grace_note_excluded() { /* grace note not counted */ }
#[test]
fn test_rest_bar_contributes_zero_density() { /* bar with only rests: density = 0 */ }
#[test]
fn test_default_bpm_120_used_when_no_tempo() { /* no tempo event → 120 BPM */ }
#[test]
fn test_multi_instrument_uses_max_level() { /* instrument A=Easy, B=Hard → score=Hard */ }
```

---

## Step 3 — Schema: DifficultyRatingDto and ScoreDto v10

**File**: `backend/src/adapters/dtos.rs`

```rust
// 1. Bump schema version
pub const SCORE_SCHEMA_VERSION: u32 = 10;

// 2. Add DTO struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRatingDto {
    pub density_rate: f64,
    pub level: u8,   // 1 = Easy, 2 = Medium, 3 = Hard
}

impl From<&DifficultyRating> for DifficultyRatingDto {
    fn from(r: &DifficultyRating) -> Self {
        Self { density_rate: r.density_rate, level: r.level as u8 }
    }
}

// 3. Add field to ScoreDto
pub struct ScoreDto {
    // ... existing fields ...
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub difficulty_rating: Option<DifficultyRatingDto>,
}

// 4. Update From<&Score> for ScoreDto
impl From<&Score> for ScoreDto {
    fn from(score: &Score) -> Self {
        Self {
            // ... existing fields ...
            difficulty_rating: score.difficulty_rating.as_ref().map(DifficultyRatingDto::from),
        }
    }
}
```

**Verify** stale-cache detection still works:
```bash
cd backend && cargo test -- schema 2>&1 | grep -E 'ok|FAILED'
```

---

## Step 4 — Integration: compute difficulty in parse pipeline

**File**: `backend/src/adapters/wasm/bindings.rs` (inside `parse_musicxml` function)

After `MusicXMLConverter::convert()` produces the `Score`, call:
```rust
use crate::domain::difficulty::density::compute_difficulty;

let difficulty = compute_difficulty(&score);
let mut score_with_difficulty = score;
score_with_difficulty.difficulty_rating = difficulty;

let score_dto = ScoreDto::from(&score_with_difficulty);
// ... rest of WasmImportResult assembly unchanged
```

**Test**: Load `scores/Beethoven_FurElise.mxl` via WASM and assert `score.difficulty_rating` is `Some` with level `1` (Easy).

---

## Step 5 — TypeScript: types and label helper

**File**: `frontend/src/types/score.ts`

```typescript
export type DifficultyLevel = 1 | 2 | 3;

export interface DifficultyRating {
  density_rate: number;
  level: DifficultyLevel;
}

// In existing Score interface, add:
difficulty_rating?: DifficultyRating;
```

**File**: `frontend/src/services/difficulty/difficultyLabel.ts`

```typescript
import { DifficultyLevel } from '../../types/score';

export function difficultyLabel(level: DifficultyLevel): string {
  switch (level) {
    case 1: return 'Easy';
    case 2: return 'Medium';
    case 3: return 'Hard';
  }
}
```

**Write tests first** (`frontend/tests/unit/difficulty.test.ts`):
```typescript
import { difficultyLabel } from '../../src/services/difficulty/difficultyLabel';

it('maps level 1 to Easy', () => expect(difficultyLabel(1)).toBe('Easy'));
it('maps level 2 to Medium', () => expect(difficultyLabel(2)).toBe('Medium'));
it('maps level 3 to Hard', () => expect(difficultyLabel(3)).toBe('Hard'));
```

---

## Step 6 — DifficultyTag component

**File**: `frontend/src/components/load-score/DifficultyTag.tsx`

```tsx
import React from 'react';
import { DifficultyLevel } from '../../types/score';
import { difficultyLabel } from '../../services/difficulty/difficultyLabel';

interface DifficultyTagProps {
  level: DifficultyLevel | undefined;
}

export function DifficultyTag({ level }: DifficultyTagProps) {
  if (level === undefined) return null;
  return <span className={`difficulty-tag difficulty-tag--${level}`}>{difficultyLabel(level)}</span>;
}
```

**Write tests first** (`frontend/tests/unit/difficulty.test.ts`):
```typescript
import { render, screen } from '@testing-library/react';
import { DifficultyTag } from '../../src/components/load-score/DifficultyTag';

it('renders nothing when level is undefined', () => {
  const { container } = render(<DifficultyTag level={undefined} />);
  expect(container).toBeEmptyDOMElement();
});
it('renders Easy for level 1', () => {
  render(<DifficultyTag level={1} />);
  expect(screen.getByText('Easy')).toBeInTheDocument();
});
it('renders Hard for level 3', () => {
  render(<DifficultyTag level={3} />);
  expect(screen.getByText('Hard')).toBeInTheDocument();
});
```

---

## Step 7 — Load score dialog: display tags

**Files**: `frontend/src/components/load-score/PreloadedScoreList.tsx` and `UserScoreList.tsx`

In each score list item render, add:
```tsx
import { DifficultyTag } from './DifficultyTag';

// In list item:
<DifficultyTag level={score.difficulty_rating?.level} />
```

For **preloaded scores**: the `Score` object is available after loading from cache. The dialog already loads scores via `ScoreCache`. Pass `difficulty_rating` from the cached `Score`.

For **user scores**: `UserScore` (localStorage index) does not store `difficulty_rating`. Retrieve the `Score` from IndexedDB to get the tag, or extend `UserScore` with `difficulty_level?: DifficultyLevel` for O(1) display.

> **Decision needed during implementation**: whether to extend `UserScore` index with the level field for fast display, or always load from IndexedDB. Recommend extending `UserScore` with `difficulty_level?: DifficultyLevel`.

---

## Step 8 — Verify against reference scores

Run the WASM integration test with the bundled scores to validate difficulty levels:

| Score | Expected Level | Rationale |
|-------|---------------|-----------|
| `Burgmuller_Arabesque.mxl` | Medium (2) | Moderate density, steady 16th-note passages |
| `Beethoven_FurElise.mxl` | Easy–Medium (1–2) | Mostly flowing 8th/16th notes, moderate tempo |
| `Chopin_NocturneOp9No2.mxl` | Medium (2) | Moderate density with ornamental runs |
| `Bach_InventionNo1.mxl` | Medium–Hard (2–3) | Continuous 16th-note motion |
| `Pachelbel_CanonD.mxl` | Easy (1) | Quarter/half-note dominated bass + steady arpeggio |

```bash
cd backend && cargo test reference_scores -- --nocapture
```

---

## Validation Commands

```bash
# Rust: all tests
cd backend && cargo test

# TypeScript: unit tests
cd frontend && npx vitest run

# TypeScript: type check
cd frontend && npx tsc --noEmit

# E2E: load score dialog shows tags
cd frontend && npx playwright test --grep "difficulty"
```
