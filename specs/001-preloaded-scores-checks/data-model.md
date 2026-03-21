# Data Model: Final Preloaded Scores Layout Checks

**Branch**: `001-preloaded-scores-checks`  
**Date**: 2026-03-21

## Overview

This feature introduces no new domain entities in the music engine. The only new structured data is the **Final Approval Record** — a per-score review document capturing the outcome of the final visual check session.

---

## Entity: Final Approval Record

**What it represents**: The outcome of one musician's final visual review of a single preloaded score. This record is the formal acceptance artifact that closes the layout work for that score.

**Storage**: One markdown file per score in `specs/001-preloaded-scores-checks/reviews/`, named `{NN}-{ScoreName}-final.md`.

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `score_id` | integer (1–6) | Sequential position in the preloaded score list |
| `score_title` | string | Full display name (composer + title) |
| `branch` | string | Git branch at time of review |
| `review_date` | date (YYYY-MM-DD) | Date of the final review session |
| `reviewer` | string | Name or identifier of the reviewing musician |
| `prior_approval_cycle` | string | Reference to the 050-cycle approval (e.g., "050-fix-layout-preloaded-scores / cycle-01.md") |
| `regression_tests_pass` | boolean | `cargo test` + `vitest` both passed before this review |
| `verdict` | enum | `APPROVED` \| `APPROVED_WITH_LIMITATIONS` \| `REJECTED` |
| `known_limitations` | list of strings | Accepted deviations from Musescore reference |
| `issues_found` | list | Any issues raised during this review (empty = none) |
| `notes` | string | Free-text reviewer remarks |

**Validation rules**:
- `verdict = APPROVED` requires `issues_found` to be empty.
- `verdict = APPROVED_WITH_LIMITATIONS` requires at least one entry in `known_limitations`.
- `verdict = REJECTED` requires at least one entry in `issues_found` and blocks overall sign-off for that score.
- `regression_tests_pass` MUST be `true` for any verdict to be valid.

**State transitions**:

```
NOT_REVIEWED → (regression tests run + musician examines score) → APPROVED
                                                                 → APPROVED_WITH_LIMITATIONS
NOT_REVIEWED → (issue found) → (fix applied + tests rerun) → APPROVED
                                                           → APPROVED_WITH_LIMITATIONS
REJECTED → (issue resolved) → NOT_REVIEWED (re-review required)
```

---

## Entity: Overall Final Check Report

**What it represents**: Aggregate status across all 6 Final Approval Records. A single document created at the end of the session once all 6 scores have been individually addressed.

**Storage**: `specs/001-preloaded-scores-checks/reviews/final-check-report.md`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `date` | date | Date the overall report was produced |
| `branch` | string | Git branch |
| `scores_approved` | integer | Count of scores with verdict APPROVED or APPROVED_WITH_LIMITATIONS |
| `scores_rejected` | integer | Count of scores with verdict REJECTED |
| `regression_test_run` | object | `{cargo: pass/fail, vitest: pass/fail, playwright: pass/fail}` |
| `overall_verdict` | enum | `PASS` (all 6 approved) \| `FAIL` (any rejected) |
| `cross_score_consistency` | string | Outcome of cross-score visual comparison |
| `known_limitations` | list | Union of known limitations across all scores |

---

## Relationship to Existing Entities

This feature creates no new domain entities in the Rust layout engine or TypeScript frontend. The existing entities from `050-fix-layout-preloaded-scores` are shown for reference:

| Existing Entity | Defined In | Role in This Feature |
|-----------------|------------|---------------------|
| `PreloadedScore` | `frontend/src/data/preloadedScores.ts` | Loaded and rendered for visual review |
| `LayoutResult` | `frontend/src/wasm/layout.ts` | Output of `computeLayout()` — what the musician sees |
| `OttavaBracketLayout` | `frontend/src/wasm/layout.ts` | 8va bracket geometry (Für Elise, Nocturne) |
| `OctaveShiftRegion` | `frontend/src/types/score.ts` | 8va region forwarded from score to WASM |
