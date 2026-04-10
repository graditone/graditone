# Research: Review Execution of Learning Arabesque Goal

**Branch**: `077-arabesque-goal-review` | **Date**: 2026-04-08

All unknowns resolved through direct code analysis. No external research required.

---

## R-01: Arabesque Musical Structure and Expected Phrases

**Decision**: Define an expected phrase map for Burgmüller Arabesque (Op. 100 No. 2, 33 measures, 2/4) and use it as the acceptance target in T026.

**Findings from `scripts/analyze_arabesque_phrases.py` and Rust phrase detection trace**:

The current algorithm produces **9 phrases per instrument** (0-based measure indices):

| # | Measures (0-based) | Length | Source | Musical role |
|---|---|---|---|---|
| 1 | [0, 1] | 2 | Fallback | Intro (whole-rest intro, not a pickup) |
| 2 | [2, 8] | 7 | Slur-based | A-section first half |
| 3 | [9, 9] | 1 | Slur-based (boundary fragment) | Volta 1 ending |
| 4 | [10, 10] | 1 | Slur-based (boundary fragment) | Volta 2 ending |
| 5 | [11, 18] | 8 | Slur-based | B-section / contrasting section |
| 6 | [19, 25] | 7 | Slur-based | Return of A material |
| 7 | [26, 26] | 1 | Fallback (boundary fragment) | Volta 1 ending (second repeat) |
| 8 | [27, 31] | 5 | Slur-based | Second volta / ending section |
| 9 | [32, 32] | 1 | Fallback (boundary fragment) | Final measure |

**Issues identified** (P1 — Foundation):
- Phrases 3, 4, 7, 9 are 1-measure boundary fragments. These arise because `detect_slur_phrases` respects hard boundaries from repeat barlines and volta brackets when splitting slur chains, and the volta measures fall on boundaries. The volta measures themselves are musically meaningful but culturally inappropriate as standalone "practice sections".
- The current T026 test only checks structural validity (non-empty, valid indices, no overlaps) — it does NOT verify that phrases align with musical sections.

**Rationale for expected phrase map**:
The musical sections of Arabesque are:
- **Intro** (mm. 1-2 / 0-based 0-1): whole-rest pickups — acceptable as a short intro phrase
- **A-section exposition** (mm. 3-10 / 0-based 2-9, with volta): the A-theme spans mm. 3-10 inclusive; the volta measure at m.10 (1st ending) is the natural end of the first A-section pass
- **A-section repeat + 2nd ending** (m.11 / 0-based 10): single-measure 2nd ending
- **B-section** (mm. 12-27 / 0-based 11-26, with volta): the contrasting section spanning 16 measures with a volta bracket
- **Return + ending** (mm. 28-33 / 0-based 27-32): the A-theme return and final cadence

**Recommendation**:
- Merge single-measure volta fragments ([9,9] and [10,10]) with their adjacent slur-based phrase to produce musically coherent phrases of at least 4 measures.
- Define a minimum phrase length of 4 measures (matching the fallback `group_size` for non-2/4 meters) and merge shorter phrases into their predecessor.
- Alternatively, extend the slur-chain merging to not split at volta barlines that are the last measure of a multi-measure section (treat them as "soft" hard boundaries).

**Alternatives considered**:
- Keep 1-measure phrases as-is: rejected (unintuitive practice sections, misleading task count, awkward UX).
- Only apply minimum merge for Arabesque specifically: rejected (general problem, general fix needed).
- Increase fallback `group_size` from 8 to 16 for 2/4: doesn't fix the slur-boundary fragmentation root cause.

---

## R-02: Duration Estimate Calibration

**Decision**: Reduce `BASE_SECS_PER_MEASURE` from 210 to 90 to bring medium-difficulty Arabesque phrase task estimates into the 3–15 minute target range.

**Current formula** (in `durationEstimation.ts`):
```
duration = round(N_measures × 210 × D_mult × loop_mult × result_mult)
```
With defaults (loops=10 → loop_mult=1.0; minResult=90 → result_mult=0.95; difficulty=2 → D_mult=1.0) this simplifies to:
```
duration = round(N_measures × 210 × 0.95) = round(N_measures × 199.5)
```

**Calculated estimates at current baseline (medium difficulty, defaults)**:

| Phrase length | Secs | Minutes | In 3-15 min range? |
|---|---|---|---|
| 1 measure | 200 | 3.3 | ✓ |
| 2 measures | 399 | 6.6 | ✓ |
| 4 measures | 798 | 13.3 | ✓ |
| 5 measures | 998 | 16.6 | ✗ — exceeds 15 min |
| 7 measures | 1397 | 23.3 | ✗ |
| 8 measures | 1596 | 26.6 | ✗ |

**Phrases violating FR-003 with current formula**: [2,8] (7 m, 23 min), [11,18] (8 m, 26.6 min), [19,25] (7 m, 23 min), [27,31] (5 m, 16.6 min).

**At BASE=90 (proposed)**:
Formula becomes: `round(N_measures × 90 × 0.95)` = `round(N_measures × 85.5)`.

| Phrase length | Secs | Minutes | In 3-15 min range? |
|---|---|---|---|
| 1 measure | 86 | 1.4 | Below 3 min — but 1-measure phrases are being eliminated by R-01 |
| 2 measures | 171 | 2.8 | Below 3 min for intro phrase — acceptable given it's a rest-only intro |
| 4 measures | 342 | 5.7 | ✓ |
| 5 measures | 428 | 7.1 | ✓ |
| 7 measures | 599 | 10.0 | ✓ |
| 8 measures | 684 | 11.4 | ✓ |

With R-01 fixes (minimum 4-measure phrases) and BASE=90, all Arabesque phrases fall within the 3–15 minute range for medium difficulty at default settings.

**Total estimated time at BASE=90** (after R-01 phrase merge):
Approximate phrase structure after merges (9 → 6 phrases per instrument):
- Intro [0,1]: 2 measures → 171s (~2.9 min) per hand
- A-section [2,9]: 8 measures → 684s (~11.4 min) per hand
- 2nd ending [10,10]: absorbed into A-section or kept at 1 measure → 86s per hand
- B-section [11,26]: 16 measures → too long, group_size=8 splits → [11,18]: 684s + [19,26]: 684s
- Return [27,32]: 6 measures → 513s (~8.6 min) per hand

With 3 tasks per phrase, total ≈ (171 + 684 + 684 + 684 + 513) × 3 ≈ 8244s ≈ **2.3 hours**. Within 2–10 hour range (FR-004/SC-003). ✓

**Alternatives considered**:
- Scale by time-signature numerator (shorter multiplier for 2/4 than 4/4): more accurate musically but adds complexity; deferred to a future feature.
- Tune via user testing feedback: deferred, not actionable without real data.
- Keep BASE=210 and tighten the spec's time range: rejected — the 3-15 min target is correct for a single phrase task.

---

## R-03: Session Distribution — Atomic Group Overflow

**Decision**: Current behaviour is correct by design. No algorithm change needed. Update FR-006 semantics and documentation only.

**Findings**:
`distributeTasks(phraseGroups, availableTime)` uses `goalBudget = Math.round(3600 × 0.5) = 1800s` as the distribution budget. Phrase groups are atomic (RH+LH+BH together). A group that exceeds the budget individually is placed alone in its own session — it has no choice. The resulting session's `totalEstimatedDurationSecs` > `availableTime` in those cases.

With current phrase durations, several phrase groups (7–8 measure slur phrases) exceed the 1800s budget individually. After R-02 calibration (BASE=90), the largest group is ~2052s (B-section first half, 8 measures × 3 hands × 85.5s/measure) which at default params = 684 × 3 = 2052s — still above 1800s.

**Root cause of overflow sessions**: The `goalBudget` (1800s = 30 min) is too small relative to phrase sizes. GoalsView should use `3600s` as both the distribution budget and the stored `availableTime`, bringing them in sync.

**Recommendation**:
- Increase `goalBudget` from `Math.round(3600 × 0.5)` to `3600` (same as `availableTime`).
- At BASE=90, the largest phrase group (B-section/return, ~8 measures) = 684s × 3 = 2052s, which slightly exceeds 3600s budget? No: 2052s < 3600s. ✓ Most groups will fit within a 3600s session, allowing multiple groups per session.

**Re-simulation at BASE=90 and goalBudget=3600**:
Phrase groups (after R-01 merges, approx):
1. Intro [0,1]: 3 × 171 = 513s
2. A-section [2,9]: 3 × 684 = 2052s
3. B [11,18]: 3 × 684 = 2052s
4. B2 [19,26]: 3 × 684 = 2052s
5. Return [27,32]: 3 × 513 = 1539s

Session packing with budget=3600s:
- S0: Intro (513) + A-section (2052) = 2565s ≤ 3600 ✓
  - Try adding B1: 2565+2052 = 4617 > 3600 → roll
- S1: B [11,18] (2052) + remaining check: 2052+2052=4104 > 3600 → roll
- S2: B2 [19,26] (2052) + Return: 2052+1539=3591 ≤ 3600 ✓
  
**Result: 3 sessions** (much better than the current 8!). Total time: 8156s ≈ 2.3 hours. Fully compliant with FR-004 / SC-003.

**Alternatives considered**:
- Allow splitting atomic phrase groups: rejected — violates FR-005 and musical practice principles.
- Use unlimited sessions (no budget): rejected — sessions become infinitely long.

---

## R-04: Per-Phrase Mastery Reporting in GoalsView

**Decision**: Add a "Phrase Progress" section to GoalsView that computes and displays per-phrase mastery status and an overall completion percentage.

**Findings**:
Current GoalsView (expanded goal view) shows:
- `{done}/{total}` task count
- A list of individual session tasks with `status` (todo/in-progress/done/failed)

What is **missing** (FR-008, FR-009, SC-005):
- Per-**phrase** mastery (a phrase is "mastered" when all its tasks — RH, LH, BH — are in `done` status)
- Overall mastery percentage = mastered phrases / total phrases × 100
- No "failed" visual distinction in the goal task list (FR-010) — it uses the same `status` field but the current CSS treatments need verification

**Computation approach**:
- Group goal tasks by phrase: tasks share the same `startMeasure`/`endMeasure` (same phrase range). Tasks for the same phrase are the three variants with `staffIndex` 0, 1, -1.
- A phrase is mastered when ALL its tasks are `done`.
- A phrase is failed when ANY of its tasks is `failed` (and the rest are not all `done`).
- A phrase is in-progress when ANY of its tasks is `in-progress`.
- A phrase is pending when ALL tasks are `todo`.

**Type needed**: `PhraseProgress` — see data-model.md.

**Goal completion trigger (FR-011)**:
`checkGoalCompletionAcrossSessions` is called in GoalsView only on expand and after warm-up practice returns. Regular practice completion (`.pendingPractice` route) does NOT currently call it. Needs a `useEffect` on task state changes.

**Alternatives considered**:
- Show mastery in a separate "Report" screen: rejected — FR-SC-005 requires no secondary navigation.
- Compute mastery in goalEngine.ts and persist to goalStorage: rejected — per spec, this is a view-level aggregation, not a stored field (status of tasks is already persisted).

---

## R-05: Pickup/Anacrusis Handling in Arabesque

**Decision**: No change needed. Arabesque's `score.pickup_ticks = 0` (the first two measures are whole rests, not a pickup). T016 logic exists and is correct.

**Findings**:
`score.pickup_ticks > 0` check in `detect_phrases` (T016) correctly avoids treating the intro whole-rest measures as a pickup. The intro is handled by the fallback grouping, producing phrase [0,1]. This is musically acceptable (musicians would skip this as "count-in" or "wait" measures). After R-01 phrase minimum-length merging, the intro phrase stays as [0,1] since it is ≥ the intro minimum.

---

## Research Summary Table

| ID | Topic | Decision | Files Affected |
|---|---|---|---|
| R-01 | Phrase fragment merging | Add minimum phrase length (4 measures); merge ≤3-measure phrases with predecessor | `backend/src/domain/phrases.rs` |
| R-02 | Duration calibration | Reduce `BASE_SECS_PER_MEASURE` from 210 → 90 | `plugins-external/sessions-plugin/durationEstimation.ts` |
| R-03 | Session goalBudget sync | Increase `goalBudget` from `3600×0.5=1800` → `3600` | `plugins-external/sessions-plugin/GoalsView.tsx` (or `goalEngine.ts`) |
| R-04 | Phrase mastery reporting | Add `PhraseProgress` type and phrase-mastery section to GoalsView | `goalTypes.ts`, `GoalsView.tsx` |
| R-05 | Pickup handling | No change needed | — |
