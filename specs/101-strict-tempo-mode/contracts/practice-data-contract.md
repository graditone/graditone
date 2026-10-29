# Contract: Practice Data and Scoring

**Feature**: `101-strict-tempo-mode`  
**Applies to**: `practiceEngine.types.ts`, `savedPractice.types.ts`, `computePracticeScore.ts`, saved-practice save/load paths

This contract is additive and backward compatible. No new `NoteOutcome` value is introduced, so external consumers that switch on outcomes do not need a new branch.

---

## 1. Per-note result

```ts
export type NoteOutcome =
  | 'correct'
  | 'correct-late'
  | 'wrong'
  | 'pending'
  | 'early-release'
  | 'auto-advanced'; // unchanged

export interface PracticeNoteResult {
  // ...existing required fields unchanged...

  /** Signed deviation from the strict tempo grid. Present only for strict-mode results. */
  readonly beatDeltaMs?: number;

  /** True when this attempt is one of the three consecutive strict timing failures. */
  readonly strictFailure?: boolean;
}
```

### Semantics

| Strict state | Outcome | `strictFailure` | `beatDeltaMs` |
|--------------|---------|-----------------|---------------|
| Grace note | `correct` | `false`/absent | `0` |
| In-time strict note | `correct` | `false`/absent | signed delta |
| Off-beat strict note | `correct-late` | `true` | signed delta |
| Early-release strict note | `early-release` | `true` | signed onset delta (if an anchor existed), else `0` |
| Non-strict result | existing outcome | absent | absent |

- A strict onset failure is `correct-late` even when the legacy `relativeDeltaMs` is within 500 ms. The result’s status is determined by `strictFailure`/`beatDeltaMs`, not by the legacy threshold.
- A grace note is `correct` even if its legacy `relativeDeltaMs` is large (for example, the first note after a tempo change or mid-session metronome activation).
- Existing consumers that only look at `outcome` still see a recognized value. They will treat a strict onset failure as a late note (reasonable) and a strict early release as an early release (correct).
- `strictFailure` is optional so old saved records and test fixtures remain valid.

---

## 2. Partial and saved records

```ts
export type PracticeStopReason = 'manual' | 'tempo';

export interface PartialPerformanceRecord {
  // ...existing fields unchanged...
  readonly stopReason?: PracticeStopReason;
}

export interface SavedPerformanceData {
  // ...existing fields unchanged...
  readonly stopReason?: PracticeStopReason;
}
```

- `stopReason` is set to `'tempo'` only by the third-failure orchestrator path.
- Manual stops may omit it or set `'manual'`; the overlay treats both as the existing “Stopped at note X of Y” presentation.
- The load path copies the saved value into `PartialPerformanceRecord`; old records without it load as manual/unknown.
- No new IndexedDB store, localStorage key, or migration is required. The existing profile-scoped saved-practice record carries the new optional field.

---

## 3. Scoring

```ts
export interface ScorableNoteResult {
  readonly outcome: string;
  readonly wrongAttempts: number;
  /** NEW: strict timing failure flag. Optional for backward compatibility. */
  readonly strictFailure?: boolean;
}

export interface PracticeScoreBreakdown {
  readonly totalNotes: number;
  readonly correctCount: number;
  readonly lateCount: number;              // all correct-late, including strict failures
  readonly earlyReleaseCount: number;      // all early-release, including strict failures
  readonly totalWrongAttempts: number;
  readonly score: number;                  // 0–100, clamped
  readonly tempoMultiplier: number;
  readonly strictFailureCount: number;     // NEW
}
```

### Formula

```text
strictFailureCount = count(results where strictFailure === true)
strictHalfCreditExcluded = count(results where strictFailure === true)
lateHalfCredit = count(outcome === 'correct-late' && !strictFailure)
earlyHalfCredit = count(outcome === 'early-release' && !strictFailure)

raw = ((correctCount + (lateHalfCredit + earlyHalfCredit) * 0.5) / totalNotes) * 100
      - min(totalWrongAttempts * 2, 30)
score = clamp(round(raw), 0, 100)
```

- `correctCount` remains the count of `outcome === 'correct'`.
- `lateCount` and `earlyReleaseCount` keep their existing “all rows with this outcome” meaning, so existing consumers see no semantic change.
- `strictFailureCount` makes the strict subset visible to the results UI.
- A strict failure earns 0 credit. A legacy late/early result without the flag keeps 0.5 credit.
- Empty input returns `null` (existing behavior).
- A session with only in-time notes still scores 100.
- The `tempoMultiplier` is informational and does not affect the score (existing behavior).

---

## 4. Public plugin API impact

- `SavedPerformanceData` is exported from the plugin API. The additions are optional fields and an unchanged outcome union, so the change is additive.
- The `onPracticeSaved` event’s `practiceScore`, `correctCount`, and `totalNotes` are computed by the shared `computePracticeScore`; a strict failure lowers the score and is not counted as correct.
- The `PracticeScoreBreakdown` gains one field. Consumers that only read existing fields are unaffected.
- No plugin API version bump is required for additive optional data. If the implementation discovers an external consumer that exhaustively switches on `PracticeNoteResult` keys, document it in the PR and bump the API version at that time.

---

## 5. Compatibility tests

- Load an old complete saved practice without `beatDeltaMs`/`strictFailure`: score and table unchanged.
- Load an old partial saved practice without `stopReason`: existing stopped-at badge, no tempo banner.
- Save a tempo-stop partial and reload: `stopReason: 'tempo'`, tempo banner, three failing notes, table/chart.
- Save a manual partial after 1–2 strict failures: `stopReason` is manual/absent, the strict rows still score as errors but the overlay is a normal partial.
- `computePracticeScore` with mixed strict and legacy results: strict zero credit, legacy half credit, correct full credit, wrong penalty unchanged.
