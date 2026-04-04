# Feature Specification: Tempo Impact on Practice and Train Results

**Feature Branch**: `072-tempo-impact-results`  
**Worktree**: `../worktrees/072-tempo-impact-results`  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: User description: "Review tempo detection in practice and train. The tempo must have impact in the results of the train and practice. Let's review the current impact."

## Clarifications

### Session 2026-04-04

- Q: What formula shape should the Practice tempo weighting use? → A: Multiplicative factor — multiply the raw accuracy score by `min(1.0, tempoMultiplier)` before clamping to [0, 100], so the penalty scales proportionally with accuracy and a perfect score at ≥1.0× tempo is never reduced.
- Q: What formula shape should the Train BPM normalisation use? → A: Logarithmic scaling — `tempoBonusFactor = log2(bpm / referenceBpm)`, clamped so it can only reduce or leave unchanged the accuracy-based penalty (never inflate above 100). Mirrors human perception of tempo difficulty.
- Q: Should existing session activities have their scores recomputed with the new tempo formula when loaded? → A: No — score-at-save-time always. Existing records keep their original score; only newly saved sessions use the tempo-weighted formula.
- Q: Where should tempo info appear in the Practice results overlay? → A: Score header area — displayed as a subtitle line directly beneath the score badge/number, making the tempo–score relationship immediately visible.
- Q: Which stored field is canonical for tempo display vs scoring in the Practice results overlay? → A: `bpmAtCompletion` is canonical for display (no recomputation needed); `tempoMultiplier` is the input to the scoring formula. Each field is authoritative for its own purpose.
## Context & Current State

### Practice Mode (Current)

`computePracticeScore` calculates a 0–100 score based purely on:
- Correct note outcomes, late outcomes (×0.5 weight), early-release outcomes (×0.5 weight)
- Wrong attempt penalty (−2 per wrong attempt, max −30)

**Gap**: The `tempoMultiplier` (stored in `SavedPractice`) and `bpmAtCompletion` (stored in `SavedPerformanceData`) are recorded but **never used in scoring**. A user who plays the full score perfectly at 50% tempo earns the same score as one who plays it perfectly at 100% tempo.

### Train Mode (Current)

`exerciseScorer.scoreCapture` calculates a score from:
- Pitch accuracy (always applied)
- Timing accuracy (applied only in MIDI flow mode via `includeTimingScore: true`)

**Gap**: BPM difficulty (low=40 BPM, mid=80 BPM, high=100 BPM) is defined as complexity levels but **does not affect the final score**. Two musicians achieving identical pitch/timing accuracy at 40 BPM and 100 BPM receive the same score.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Tempo-Weighted Practice Score (Priority: P1)

A musician completes a Practice session with the tempo multiplier set to 1.0× (full speed) and achieves 90% pitch accuracy. Another musician completes the exact same session at 0.5× speed with the same accuracy. The first musician's score is noticeably higher because they matched the intended tempo.

**Why this priority**: Tempo is a fundamental musical skill. Rewarding faster, accurate performance is the single most impactful change to motivate improvement. Without this, the score metric is an incomplete measure of musical ability.

**Independent Test**: Set tempo to 1.0×, complete 10 notes correctly → score X. Set tempo to 0.5×, complete the same 10 notes with same accuracy → score Y. Verify X > Y. Testable in isolation by passing different `tempoMultiplier` values to `computePracticeScore` and inspecting the returned breakdown.

**Acceptance Scenarios**:

1. **Given** a completed Practice session with `tempoMultiplier = 1.0` and all notes correct, **When** the score is computed, **Then** the score is 100.
2. **Given** a completed Practice session with `tempoMultiplier = 0.5` and all notes correct, **When** the score is computed, **Then** the score is exactly 50 (multiplicative factor applied: `100 × 0.5`).
3. **Given** two completed Practice sessions with identical note accuracy but `tempoMultiplier = 0.5` vs `tempoMultiplier = 1.0`, **When** both scores are computed, **Then** the 1.0× score is strictly greater than the 0.5× score.
4. **Given** a Practice session with `tempoMultiplier > 1.0` (fast practice) and all notes correct, **When** the score is computed, **Then** the score is 100 (tempo bonus does not inflate beyond the 100-point ceiling).

---

### User Story 2 — Tempo Displayed in Practice Results (Priority: P1)

A musician finishes a Practice session and opens the results overlay. They immediately see at what tempo the session was completed (e.g., "90 BPM · 75% speed") so they understand the context of their score.

**Why this priority**: Without displaying tempo in results, the score change from tempo weighting is opaque. Displaying tempo is a prerequisite for musicians to interpret their score meaningfully.

**Independent Test**: Complete any Practice session → open results overlay → verify that the effective BPM and multiplier percentage are both visible. Testable as a UI-only change, independent of scoring formula.

**Acceptance Scenarios**:

1. **Given** a completed Practice session at `tempoMultiplier = 0.75` with an original score BPM of 120, **When** the results overlay opens, **Then** a subtitle line directly beneath the score badge shows "90 BPM · 75%" (effective BPM and multiplier percentage).
2. **Given** a completed Practice session at full tempo (1.0×), **When** the results overlay opens, **Then** the tempo display clearly indicates full speed.
3. **Given** a saved Practice where `bpmAtCompletion = 0` (edge case from older records), **When** the results overlay opens, **Then** the BPM portion is displayed as "—" (omitted gracefully); the overlay does NOT attempt to recompute the effective BPM from other sources.

---

### User Story 3 — Tempo-Weighted Train Score (Priority: P2)

A musician completes a Train exercise at 100 BPM (High complexity) and gets 80% pitch accuracy. Another musician gets the same 80% accuracy on the same exercise at 40 BPM (Low complexity). The high-BPM musician's score is higher because they demonstrated the same accuracy under greater temporal pressure.

**Why this priority**: Train mode has complexity levels tied directly to BPM. Making BPM contribute to the score completes the complexity system — currently High is harder to perform but produces identical scores for equal accuracy.

**Independent Test**: Run `exerciseScorer.scoreCapture` with identical pitch-correct responses on exercises at 40 BPM vs 100 BPM → verify the 100 BPM result has a higher score. Pure unit test with no UI dependency.

**Acceptance Scenarios**:

1. **Given** two Train exercises with identical note sequences and identical pitch-correct responses, one at 40 BPM and one at 100 BPM, **When** both are scored, **Then** the 100 BPM result score is strictly greater than the 40 BPM result score.
2. **Given** a Train exercise at 100 BPM with 100% pitch accuracy, **When** scored, **Then** the score is 100 (a perfect performance at high tempo still earns a perfect score).
3. **Given** a Train exercise at 40 BPM with 100% pitch accuracy, **When** scored, **Then** the score is also 100 (perfect accuracy at any tempo earns full score — tempo only differentiates imperfect runs).

---

### User Story 4 — Tempo Displayed in Train Results (Priority: P2)

A musician finishes a Train exercise and the results overlay shows the BPM alongside the score so they understand how the tempo choice affected their performance.

**Why this priority**: Same rationale as Practice Story 2 — without displaying tempo, score differences across BPM levels are invisible to the musician.

**Independent Test**: Complete any Train exercise → open `TrainResultsOverlay` → verify BPM value is shown. Testable as a UI-only overlay change.

**Acceptance Scenarios**:

1. **Given** a completed Train exercise at 80 BPM, **When** the results overlay is shown, **Then** the BPM value "80 BPM" is visible in the results.
2. **Given** a saved Train result loaded from storage, **When** the results overlay is shown, **Then** the recorded BPM from the saved record is correctly displayed.

---

### Edge Cases

- What happens when `tempoMultiplier` is 0 or absent in an older saved Practice? Treat as 1.0 (neutral) to avoid penalising archived records.
- What happens when `bpmAtCompletion` is 0 in a Practice record? Display the BPM portion as "—" rather than "0 BPM". Since `bpmAtCompletion` is display-only (score formula uses `tempoMultiplier`), a zero value here has no impact on scoring — only on the BPM label in the overlay.
- What happens when a Train exercise has `bpm = 0`? Skip tempo weighting entirely and return the pure pitch/timing score.
- What is the ceiling and floor of the tempo weight? Designed so a perfect performance always reaches `rawScore × min(1.0, multiplier)`; the score can reach 0 at very low multipliers, but the formula is transparent and predictable.
- Does the tempo change for saved practices affect previously displayed scores? No — stored scores are never recalculated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Practice score formula MUST incorporate `tempoMultiplier` such that the same note accuracy at a higher multiplier yields an equal or higher score than at a lower multiplier.
- **FR-002**: The tempo weighting in Practice MUST use a multiplicative formula: `adjustedScore = rawAccuracyScore × min(1.0, tempoMultiplier)`, applied before clamping the final value to [0, 100]. A `tempoMultiplier` ≥ 1.0 leaves the score unchanged; a multiplier of 0.5 halves the raw accuracy score (e.g., a perfect raw score of 100 becomes 50, then subject to the existing wrong-attempt penalty clamp).
- **FR-003**: The `computePracticeScore` function MUST accept an optional `tempoMultiplier` parameter defaulting to 1.0, so all existing callers are backward-compatible without changes.
- **FR-004**: The Practice results overlay MUST display tempo as a subtitle line directly beneath the score badge/number in the score header area (e.g., "90 BPM · 75%"). The BPM value MUST be read from `SavedPerformanceData.bpmAtCompletion` (no recomputation); the percentage MUST be derived from `SavedPractice.tempoMultiplier`. This applies to every completed or partial session, both live and loaded from storage.
- **FR-005**: The Train exercise scorer MUST apply a tempo difficulty factor derived from the exercise `bpm` such that equal note accuracy at a higher BPM yields an equal or higher score.
- **FR-006**: The tempo difficulty factor for Train MUST use logarithmic scaling: `tempoBonusFactor = log2(bpm / referenceBpm)`, where referenceBpm = 80. This factor is applied to reduce (never inflate) the accuracy-based penalty only — it MUST be clamped so a perfect performance at any BPM still achieves a score of 100, and a score below 0 is not possible.
- **FR-007**: The `TrainResultsOverlay` MUST display the BPM of the completed exercise.
- **FR-008**: All existing saved Practice and Train records MUST display without errors. The score persisted at save time is the authoritative value and MUST be displayed as-is — no recomputation on load. The new tempo-weighted formula applies only to sessions saved after this feature is deployed.
- **FR-009**: When `PracticeViewPlugin` saves a new session and broadcasts a `PracticeSavedEvent`, it MUST pass the session's `tempoMultiplier` into `computePracticeScore` so the score written into the sessions index and `SavedPractice` record reflects the tempo weighting. This applies only at save time — no retroactive updates to existing records.

### Key Entities

- **PracticeScoreBreakdown**: The existing result type of `computePracticeScore`. Receives a new optional `tempoMultiplier` field so callers can inspect the applied weighting without coupling display logic to the formula internals.
- **TrainExercise**: The `bpm` field transitions from metadata-only to an active input to the scorer. No data model change required — `bpm` is already present.
- **ExerciseResult** (train): Receives a `bpm` field for storage and display in `TrainResultsOverlay`. This ensures the overlay does not need to reach outside the result object for tempo data.
- **SavedPerformanceData** (`bpmAtCompletion`, stored since Feature 056): Now consumed by `computePracticeScore` when re-displaying results — value feeds the `tempoMultiplier`-based calculation at result display time.
- **SavedTrain** (`bpm`, stored since Feature 071): Already saved alongside each train result; now surfaced in `TrainResultsOverlay`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A completed Practice session at 1.0× tempo with 100% note accuracy produces a score of 100. The same accuracy at 0.5× tempo produces a score of exactly 50 (multiplicative factor: `100 × min(1.0, 0.5) = 50`), confirming the formula is applied correctly.
- **SC-002**: A completed Train exercise at 100 BPM with 80% pitch accuracy produces a score at least 10 points higher than the same accuracy at 40 BPM, confirming that the logarithmic tempo factor (`log2(bpm/80)`) meaningfully differentiates performance across complexity levels.
- **SC-003**: Tempo information (effective BPM and multiplier) is visible in the Practice results overlay for 100% of completed sessions — both newly created and loaded from storage.
- **SC-004**: BPM is visible in the Train results overlay for 100% of completed exercises — both new and loaded from storage.
- **SC-005**: All existing unit and integration tests pass without modification after the changes.
- **SC-006**: The tempo weighting logic is covered by at least 3 dedicated unit tests — one each for below-1.0×, exactly-1.0×, and above-1.0× multipliers in Practice; and at least 2 for Train (below-reference BPM, above-reference BPM).

## Assumptions

- The reference BPM for Train tempo normalisation is 80 BPM (the Mid complexity preset). This may be adjusted during implementation without impacting the spec intent.
- Tempo weighting in Practice uses a multiplicative formula (`rawScore × min(1.0, multiplier)`), capped at 1.0 — playing faster than the score's intended tempo does not produce scores above 100.
- At 0.5× multiplier with perfect note accuracy, the score is 50 (exactly half the raw accuracy score).
- Sessions plugin score broadcasting already passes `noteResults` to `computePracticeScore`; adding `tempoMultiplier` is a localized change at the call site in `PracticeViewPlugin.tsx`.
- Backward compatibility for saved records: stored scores are never recalculated — only new sessions reflect the updated formula at save time.



