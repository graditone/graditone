# Component Contract: DifficultyTag

**Feature**: 055-score-difficulty-density  
**Contract type**: React component interface for difficulty badge  
**File**: `frontend/src/components/load-score/DifficultyTag.tsx`

---

## Props

```typescript
import { DifficultyLevel } from '../../types/score';

interface DifficultyTagProps {
  /**
   * Difficulty level to display.
   * - undefined: renders nothing (score has no rating yet)
   * - 1: renders "Easy" badge
   * - 2: renders "Medium" badge  
   * - 3: renders "Hard" badge
   */
  level: DifficultyLevel | undefined;
}
```

## Rendering Contract

| `level` value | Rendered output |
|--------------|----------------|
| `undefined` | Nothing (null / empty fragment) |
| `1` | Badge element with text "Easy" and Easy styling |
| `2` | Badge element with text "Medium" and Medium styling |
| `3` | Badge element with text "Hard" and Hard styling |

## Behavior Contract

- Component is **presentational only** — no state, no side effects.
- Component does NOT conditionally fetch or compute the rating.
- Level text is static: "Easy", "Medium", "Hard" — no i18n in v1.
- Badge is displayed inline alongside the score title in list items.
- Component MUST render nothing (not a placeholder, not "Unknown") when `level` is `undefined`.

## Integration Points

The `DifficultyTag` is consumed by:

1. `PreloadedScoreList.tsx` — passes `score.difficulty_rating?.level` (from cached/preloaded `Score`)
2. `UserScoreList.tsx` — passes `score.difficulty_rating?.level` (from `Score` loaded from IndexedDB)

Both score lists pass the level directly from the `Score.difficulty_rating` optional field. Neither list is responsible for computing or fetching the rating.
