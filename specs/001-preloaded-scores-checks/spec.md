# Feature Specification: Final Preloaded Scores Layout Checks

**Feature Branch**: `001-preloaded-scores-checks`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "Final preloaded scores checks - Let's do a final round revision to check all is OK in the layout of preloaded scores"

## Overview

This feature is a final end-to-end validation pass across all 6 preloaded scores, confirming that every layout fix applied during the `050-fix-layout-preloaded-scores` cycle is correct, no regressions have been introduced, and the musician is satisfied with the overall presentation as a complete set. It is not a fix iteration cycle — it is the acceptance gate before the layout work is considered done.

The 6 preloaded scores to validate are:
1. Burgmüller — La Candeur
2. Burgmüller — Arabesque
3. Pachelbel — Canon in D
4. Bach — Invention No. 1
5. Beethoven — Für Elise
6. Chopin — Nocturne Op. 9 No. 2

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Musician Final Approval of Each Score Layout (Priority: P1)

The musician opens each of the 6 preloaded scores and performs a final visual review, comparing the Graditone layout to a Musescore reference export. For each score, the musician either confirms final approval or identifies any remaining issues that must be corrected before the layout work is closed.

**Why this priority**: This is the acceptance gate for the entire `050-fix-layout-preloaded-scores` effort. Without explicit musician sign-off per score, the layout work cannot be considered complete.

**Independent Test**: Open one preloaded score (e.g., La Candeur), display it alongside the Musescore reference, and confirm the musician can provide an explicit final approval or rejection for that score alone.

**Acceptance Scenarios**:

1. **Given** all 6 preloaded scores are rendered with the post-fix layout, **When** the musician reviews each score against the Musescore reference, **Then** the musician is able to explicitly approve or reject the layout of each score.
2. **Given** a score layout is approved, **When** no further changes are made, **Then** the approval is recorded and that score is considered closed.
3. **Given** the musician identifies a remaining issue during final review, **When** the issue is reported, **Then** a targeted fix is applied before re-conducting the final check for that score only.

---

### User Story 2 - Regression Verification Across All Fixed Elements (Priority: P2)

The musician and the automated test suite jointly confirm that the specific layout fixes from `050-fix-layout-preloaded-scores` are correctly in place: stems, staff line weights, slur direction, grace notes, augmentation dots, ottava brackets, staccato, and chord displacement. No previously approved element should have regressed.

**Why this priority**: Each fix was approved in isolation during the iterative cycle. A final cross-score regression check ensures that no fix inadvertently broke another score or element.

**Independent Test**: Run the full regression test suite inherited from `050-fix-layout-preloaded-scores`. All tests must pass. Independently testable — no musician-in-the-loop required.

**Acceptance Scenarios**:

1. **Given** the complete regression test suite is run, **When** all tests execute, **Then** zero failures are reported.
2. **Given** a score was previously approved during the fix cycle, **When** reviewed again in this final pass, **Then** no previously approved sections display regressions.
3. **Given** a fix was marked as generic (affecting the rendering engine rather than a single score), **When** each score is reviewed, **Then** the fix is consistently applied across all 6 scores.

---

### User Story 3 - Cross-Score Visual Consistency Confirmation (Priority: P3)

The musician reviews all 6 scores in sequence to confirm that shared layout conventions — staff height, note spacing, clef sizing, margin proportions, line weights, and typographic style — are uniform. No score should stand out as visually inconsistent with the others.

**Why this priority**: Consistency is the final quality bar, ensuring a polished product experience. It can only be evaluated once all per-score fixes are confirmed individually.

**Independent Test**: Open all 6 preloaded scores consecutively in the same session and compare their shared visual properties (staff height, margins, line weight). Independently testable by visual inspection without per-note detail.

**Acceptance Scenarios**:

1. **Given** all 6 preloaded scores are opened in sequence, **When** the musician compares their layouts side by side, **Then** staff height, line weights, spacing conventions, and clef proportions are visually uniform.
2. **Given** a visual inconsistency is detected between two scores during cross-score review, **When** it is traced to a score-specific override rather than a generic rule, **Then** the inconsistency is documented as an accepted known limitation.

---

### Edge Cases

- What happens if an issue is discovered during final review that was not caught during the iterative cycle? A targeted fix is applied and only that score's final approval is re-conducted.
- What if a regression test fails but the visual output looks correct? The test definition must be reviewed and updated to reflect the actual correct behavior; the visual approval does not override a failing regression test.
- What if two scores require different rendering treatments for the same element to appear correct? This is an accepted score-specific override; it must be documented as a known limitation within the spec.
- How is a partial approval handled (musician approves most of a score but flags one measure)? The flagged measure is treated as a single targeted issue; approval of the rest of the score is preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The musician MUST perform a final visual review of each of the 6 preloaded scores against the Musescore reference export before the layout work is considered complete.
- **FR-002**: Each score MUST receive an explicit final approval or rejection from the musician. Approved scores are considered closed and MUST NOT be re-opened unless a regression is detected.
- **FR-003**: The full regression test suite from `050-fix-layout-preloaded-scores` MUST pass without failures before the final visual review session begins.
- **FR-004**: Any issue identified during the final review MUST receive a targeted fix, a corresponding regression test, and a re-review of that score before it is approved.
- **FR-005**: Approvals MUST be recorded in a final review artifact (one document or structured entry per score) capturing the approval date and any accepted known limitations.
- **FR-006**: Cross-score visual consistency (staff proportions, line weights, spacing conventions) MUST be confirmed as uniform across all 6 scores before the overall final check is closed.
- **FR-007**: Any element that cannot achieve full Musescore fidelity MUST be explicitly documented as a known limitation and acknowledged by the musician before the score is approved.
- **FR-008**: Any fix introduced during this final check phase MUST not regress previously approved scores — the regression test suite MUST be re-run after each fix.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 6 preloaded scores receive explicit musician sign-off with no outstanding unresolved issues.
- **SC-002**: The full regression test suite (inherited from `050-fix-layout-preloaded-scores`) passes with zero failures at the time of final approval.
- **SC-003**: All 6 scores are confirmed visually consistent in shared layout properties (staff height, line weights, spacing, clef proportions) during the cross-score review.
- **SC-004**: Any known limitations are explicitly documented and acknowledged — the set of undocumented deviations from the Musescore reference is zero at close.
- **SC-005**: No regression introduced during the final check phase — any fix applied must leave all previously approved scores passing the regression suite.

## Assumptions

- The Musescore 4 reference PNGs produced during `050-fix-layout-preloaded-scores` (stored in `specs/050-fix-layout-preloaded-scores/references/`) remain valid benchmarks for this final check.
- The regression tests written during `050-fix-layout-preloaded-scores` are the authoritative automated safety net and are considered part of this feature's test coverage.
- The review methodology follows the same side-by-side screenshot comparison protocol established in `050-fix-layout-preloaded-scores` (Graditone region vs Musescore region, annotated with written comments).
- "Final approval" means the musician explicitly states the score is acceptable — no implicit or assumed approval.

