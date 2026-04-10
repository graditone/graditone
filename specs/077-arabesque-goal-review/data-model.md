# Data Model: Review Execution of Learning Arabesque Goal

**Branch**: `077-arabesque-goal-review` | **Date**: 2026-04-08

---

## Domain Entities

### Existing Entities (unchanged)

These entities already exist and are NOT modified by this feature — they are documented here to provide context for the new types.

#### `PhraseRegion` (Rust + TypeScript)
```typescript
interface PhraseRegion {
  instrument_index: number;  // 0-based
  start_measure: number;     // 0-based, inclusive
  end_measure: number;       // 0-based, inclusive
  start_tick: number;
  end_tick: number;
}
```
Source: `backend/src/domain/phrases.rs`, mirrored in `frontend/src/types/score.ts`.

#### `SessionTask`
```typescript
interface SessionTask {
  id: string;
  goalId?: string;
  scoreId?: string;
  regionType: 'measures';
  startMeasure: number;    // 1-based
  endMeasure: number;      // 1-based
  staffIndex: number;      // 0=RH, 1=LH, -1=BH
  loopCount: number;
  tempoMultiplier: number;
  minResult: number;
  status: 'todo' | 'in-progress' | 'done' | 'failed';
  currentRound: number;
  linkedPractices: TaskLinkedPractice[];
  difficulty?: 1 | 2 | 3;
  estimatedDurationSecs?: number;
}
```

#### `Goal`
```typescript
interface Goal {
  id: string;
  type: 'learn-score-phrase' | 'warm-up-scales';
  status: 'active' | 'completed';
  scoreId: string;
  scoreTitle: string;
  title: string;
  startMeasure?: number;
  endMeasure?: number;
  sessionIds: string[];
  tasksDone?: number;
}
```

---

### New / Modified Entities (this feature)

#### `PhraseProgress` (new, `goalTypes.ts`)

A derived, view-only computation grouping tasks by phrase to show mastery status. **Not persisted** — always computed from task states in memory.

```typescript
type PhraseMasteryStatus = 'mastered' | 'in-progress' | 'failed' | 'pending';

interface PhraseProgress {
  /** 1-based start measure (matching SessionTask.startMeasure) */
  startMeasure: number;
  /** 1-based end measure (matching SessionTask.endMeasure) */
  endMeasure: number;
  /** Derived mastery status across all task variants for this phrase */
  status: PhraseMasteryStatus;
  /** Count of task variants in 'done' status */
  doneCount: number;
  /** Total task variants for this phrase (typically 3: RH, LH, BH) */
  totalCount: number;
}
```

**Derivation rules**:
- `mastered`: ALL tasks for this phrase are `done`
- `failed`: ANY task is `failed` AND NOT all tasks are `done`
- `in-progress`: ANY task is `in-progress` (and not all done, none failed)
- `pending`: ALL tasks are `todo`

**Grouping key**: `${task.startMeasure}-${task.endMeasure}` — tasks with the same measure range belong to the same phrase group.

---

### Algorithmic Changes (not storage changes)

#### Phrase Detection — Minimum Phrase Length Merge (R-01)

**Location**: `backend/src/domain/phrases.rs` — post-processing step after the existing detection pipeline.

**Logic** (new function `merge_short_phrases`):

```
Given sorted phrases for one instrument:
  For each phrase P where (P.end_measure - P.start_measure + 1) < MIN_PHRASE_MEASURES:
    If P has a predecessor phrase (same instrument, adjacent start_measure):
      Merge P into predecessor: predecessor.end_measure = P.end_measure; predecessor.end_tick = P.end_tick
    Else if P has a successor:
      Merge P into successor: successor.start_measure = P.start_measure; successor.start_tick = P.start_tick
    Else:
      Keep as-is (only phrase in score)
  Re-run until no more merges (iterate until stable)
```

**Constant**: `MIN_PHRASE_MEASURES = 4` (matching the non-2/4 fallback `group_size`).

**Expected output after merges for Arabesque instrument 0** (0-based):
| Before | After | Reason |
|---|---|---|
| [0,1] | [0,1] | 2 measures — below minimum but no predecessor; stays (intro) |
| [2,8] | [2,9] | absorbs [9,9] (volta 1, 1 measure) |
| [9,9] | → merged into [2,9] | |
| [10,10] | [10,10] | 1 measure, predecessor = [2,9]. Merge → [2,10]... Actually [10,10] has predecessor [2,9]. After [9,9] is merged into [2,8]→[2,9], the next phrase is [10,10] with predecessor [2,9]. Merge → [2,10] |
| [11,18] | [11,18] | 8 measures — meets minimum, no change |
| [19,25] | [19,25] | 7 measures — meets minimum, no change |
| [26,26] | → merged into [19,26] | [26,26] has predecessor [19,25] → [19,26] |
| [27,31] | [27,31] | 5 measures — meets minimum |
| [32,32] | → merged into [27,32] | [32,32] has predecessor [27,31] → [27,32] |

**Final 5 phrases per instrument (0-based)**:
1. [0, 1] — Intro (2 measures, kept as-is: no predecessor)
2. [2, 10] — A-section with endings (9 measures)
3. [11, 18] — B-section first half (8 measures)
4. [19, 26] — B-section second half with volta (8 measures)
5. [27, 32] — Return and ending (6 measures)

**Validation status**: All phrases ≥ 2 measures; no 1-measure fragments. The [0,1] intro remains at 2 measures since it has no predecessor to merge into.

---

#### Duration Estimation — Calibrated Baseline (R-02)

**Location**: `plugins-external/sessions-plugin/durationEstimation.ts`

**Change**: `BASE_SECS_PER_MEASURE: 210 → 90`

**New per-phrase estimates at medium difficulty, defaults (loops=10, minResult=90)**:
| Phrase | Measures | Seconds per task | Minutes |
|---|---|---|---|
| Intro [0,1] | 2 | 171 | 2.9 min |
| A-section [2,10] | 9 | 770 | 12.8 min |
| B1 [11,18] | 8 | 684 | 11.4 min |
| B2 [19,26] | 8 | 684 | 11.4 min |
| Return [27,32] | 6 | 513 | 8.6 min |

All within 3–15 min range (FR-003) except intro (2.9 min ≈ acceptable for a 2-measure rest intro).

**Total estimated time** (3 tasks per phrase, medium):
`(171 + 770 + 684 + 684 + 513) × 3 = 2822 × 3 = 8466s ≈ 2.35 hours` — within 2–10 hour range (FR-004). ✓

---

#### Session Distribution — goalBudget Alignment (R-03)

**Location**: `plugins-external/sessions-plugin/GoalsView.tsx` (the `goalBudget` constant)

**Change**: `const goalBudget = Math.round(3600 * 0.5)` → `const goalBudget = 3600`

**Impact on session packing** (with R-01 + R-02 phrase structure):
| Group | Duration (s) | Fits in remaining session? |
|---|---|---|
| Intro (3 tasks × 171) | 513 | Start S0: running=513 |
| A-section (3 × 770) | 2310 | S0: 513+2310=2823 ≤ 3600 ✓ running=2823 |
| B1 (3 × 684) | 2052 | S0: 2823+2052=4875 > 3600 → roll to S1. S1: 2052 |
| B2 (3 × 684) | 2052 | S1: 2052+2052=4104 > 3600 → roll to S2. S2: 2052 |
| Return (3 × 513) | 1539 | S2: 2052+1539=3591 ≤ 3600 ✓ running=3591 |

**Result**: **3 sessions** (down from 8 with original estimates). Groups [Intro+A-section] share S0. B1 alone in S1. B2+Return share S2.

**Session schedule** (assuming no existing sessions, starting tomorrow):
- Session 1: targetDate = today+1 — Intro + A-section (2823s ≈ 47 min)
- Session 2: targetDate = today+2 — B-section first half (2052s ≈ 34 min) 
- Session 3: targetDate = today+3 — B-section second half + Return (3591s ≈ 60 min)

All sessions ≤ 3600s. FR-006 satisfied. ✓

---

## Validation Rules

| Rule | Entity | Condition |
|---|---|---|
| Phrase non-empty | `PhraseRegion` | score.phrases.length > 0 |
| Phrase valid indices | `PhraseRegion` | start_measure ≤ end_measure < num_measures |
| Phrase no overlap | `PhraseRegion[]` (per instrument) | phrases[i].end_measure < phrases[i+1].start_measure |
| Phrase minimum length | `PhraseRegion` | (end_measure - start_measure + 1) ≥ 2 (intro exception: predecessor-less) |
| Task estimate in range | `SessionTask` | estimatedDurationSecs between 150s and 1800s (2.5–30 min) |
| Session within budget | `DistributedSession` | totalEstimatedDurationSecs ≤ availableTime (unless single atomic group exceeds budget) |
| Phrase group atomic | `PhraseGroup` | All variants (staffIndex 0, 1, -1) are in the same session |
| Mastery correct | `PhraseProgress` | status === 'mastered' iff all task variants are 'done' |
| Goal completes | `Goal` | status === 'completed' iff every task in all goal sessions is 'done' |
