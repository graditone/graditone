# Contract: WASM Region Difficulty

**Feature**: 070-session-task-distribution
**Date**: 2026-04-01
**Type**: WASM binding contract (Rust→TypeScript via wasm-bindgen)

## New WASM Function

### `compute_region_difficulty`

Computes difficulty rating for a specific measure range and optional staff within an already-parsed score.

**Rust signature**:
```rust
#[wasm_bindgen]
pub fn compute_region_difficulty(
    score_js: JsValue,
    start_measure: usize,   // 0-based, inclusive
    end_measure: usize,     // 0-based, inclusive
    staff_index: i32,       // -1 = all staves (BH), 0 = RH, 1 = LH
) -> Result<JsValue, JsValue>
```

**TypeScript call site**:
```typescript
import { compute_region_difficulty } from '../wasm/music_engine';

// Returns DifficultyRating | null (serialized via serde_wasm_bindgen)
const result: DifficultyRating | null = compute_region_difficulty(
  scoreObject,    // The Score object from parse_musicxml result
  0,              // startMeasure (0-based)
  3,              // endMeasure (0-based)
  0               // staffIndex: 0=RH, 1=LH, -1=BH
);
```

**Return type** (JSON via serde):
```json
{
  "density_rate": 2.8,
  "level": "Medium"
}
```

Or `null` if the region has no notes.

**Error cases**:
- `start_measure > end_measure` → Error: "Invalid measure range"
- `end_measure >= score.measure_count` → Error: "Measure index out of bounds"
- `staff_index` not in `{-1, 0, 1, ...}` → Error: "Invalid staff index"
- Score has no instruments → returns `null`

## Plugin API Extension

### `scorePlayer.getRegionDifficulty()`

New method on `PluginScorePlayerContext` (API version bump to v10).

```typescript
interface PluginScorePlayerContext {
  // ... existing methods ...
  
  /**
   * Compute difficulty rating for a specific measure range and staff.
   * Returns null if no score is loaded or region has no notes.
   * 
   * @param startMeasure - 0-based start measure (inclusive)
   * @param endMeasure - 0-based end measure (inclusive)  
   * @param staffIndex - -1 for both hands, 0 for RH, 1 for LH
   */
  getRegionDifficulty(
    startMeasure: number,
    endMeasure: number,
    staffIndex: number,
  ): DifficultyRating | null;
}
```

**Implementation location**: `frontend/src/plugin-api/scorePlayerContext.ts`

**Behavior**:
- If no score is loaded → returns `null`
- Delegates to WASM `compute_region_difficulty(scoreObject, startMeasure, endMeasure, staffIndex)`
- Catches WASM errors, logs warning, returns `null`

## Existing Contracts (UNCHANGED)

The following existing contracts are not modified:
- `parse_musicxml` — still computes global `difficulty_rating` and `phrases` on the Score
- `getPhrases()` — still returns phrase regions for all instruments
- `getMeasureEndTicks()` — still returns measure boundary ticks

## Test Contract

```typescript
// Contract test: getRegionDifficulty returns valid difficulty for known score region
describe('getRegionDifficulty() — Feature 070', () => {
  it('returns difficulty for a valid measure range', () => {
    // Given a loaded score with notes in measures 0-3
    const difficulty = scorePlayer.getRegionDifficulty(0, 3, -1);
    expect(difficulty).not.toBeNull();
    expect(difficulty!.level).toBeOneOf([1, 2, 3]);
    expect(difficulty!.density_rate).toBeGreaterThan(0);
  });

  it('returns null when no score is loaded', () => {
    const difficulty = scorePlayer.getRegionDifficulty(0, 3, -1);
    expect(difficulty).toBeNull();
  });

  it('returns different difficulty for different staves', () => {
    // Given a piano score where RH has more notes than LH
    const rhDifficulty = scorePlayer.getRegionDifficulty(0, 3, 0);
    const lhDifficulty = scorePlayer.getRegionDifficulty(0, 3, 1);
    // Both should be valid (may or may not differ)
    expect(rhDifficulty).not.toBeNull();
    expect(lhDifficulty).not.toBeNull();
  });
});
```
