# Feature Specification: Fix Layout Preloaded Scores

**Feature Branch**: `050-fix-layout-preloaded-scores`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Fix layout of preloaded scores. It is key that the musician approve the layout of the scores: clean, readable, consistent. We are going to use Musescore as the reference layout and the goal is to fix the layout for the 6 preloaded scores. The process will be iterative and I will be reviewing the fixes comparing the resulting layout from the one from Musecore."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Musician Reviews Preloaded Score Layout (Priority: P1)

A musician opens any of the 6 preloaded scores and reviews the layout for clarity, readability, and consistency, comparing it side-by-side with the Musescore reference layout.

**Why this priority**: The core goal of this feature is to achieve musician approval of each score's layout. No other work delivers value without this review loop.

**Independent Test**: Open each of the 6 preloaded scores and visually compare the layout to the equivalent Musescore export. The musician confirms whether the layout is clean, readable, and consistent for that score.

**Acceptance Scenarios**:

1. **Given** a preloaded score is opened, **When** the musician reviews the layout, **Then** the score's notation is clean, readable, and consistent with the Musescore reference.
2. **Given** a layout fix has been applied to a score, **When** the musician reviews the update, **Then** the musician can explicitly approve or request further changes.
3. **Given** a score previously approved, **When** no further changes are made, **Then** the approval status is preserved.

---

### User Story 2 - Iterative Layout Improvement Cycle (Priority: P2)

Scores are worked on one at a time in a defined priority order. For each score, the musician reviews the layout, requests specific adjustments, a fix is applied, and the score is reviewed again until the musician approves it. Only then does work proceed to the next score.

**Why this priority**: Layout quality cannot be determined in a single pass. The iterative process is fundamental to reaching the desired outcome.

**Independent Test**: Simulate two review cycles on one score: request a change, apply the fix, and verify the musician can review and approve the result.

**Acceptance Scenarios**:

1. **Given** the musician provides feedback on a specific layout issue, **When** the fix is applied, **Then** the next review cycle reflects the requested correction.
2. **Given** a score has gone through at least one review cycle, **When** the musician reviews the updated layout, **Then** the fix has not regressed previously approved aspects.

---

### User Story 3 - Consistent Layout Across All Preloaded Scores (Priority: P3)

All 6 preloaded scores share a consistent visual style: uniform spacing, note sizing, staff proportions, and typography - matching the Musescore reference conventions.

**Why this priority**: Consistency across scores is a quality indicator and reduces cognitive load for musicians switching between scores.

**Independent Test**: Open all 6 preloaded scores consecutively and verify that shared layout conventions (staff height, margins, note spacing, clef sizing, etc.) are uniform.

**Acceptance Scenarios**:

1. **Given** all 6 preloaded scores are opened in sequence, **When** the musician compares their layouts, **Then** spacing, proportions, and typographic conventions are consistent.
2. **Given** a generic layout fix is applied to one score, **When** the same defect is present in other unreviewed scores, **Then** the fix is propagated to all remaining scores before their review begins.

---

### Edge Cases

- What happens when a score element (e.g., a complex chord or ornament) cannot be rendered with the same fidelity as Musescore due to technical constraints?
- How is a layout conflict resolved when two scores require different treatments of the same element to be readable? (Score-specific overrides are permitted; they do not block the global fix from applying to other scores.)
- How is musician feedback recorded when it is partial (approves some aspects, rejects others)? A side-by-side screenshot with written comments naturally supports partial feedback — approved regions are left unannotated, defects are marked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display all 6 preloaded scores with a layout that is clean, readable, and consistent.
- **FR-002**: The system MUST use Musescore-exported screenshots (PNG or PDF) of each score, stored in the repository, as the reference benchmark for layout decisions.
- **FR-003**: Layout fixes MUST be applied one score at a time, in a defined priority order. Each score's layout MUST be reviewed and approved by the musician before the next score is started.
- **FR-004**: The musician MUST be able to explicitly approve or reject the layout of each individual score.
- **FR-005**: Layout conventions (spacing, proportions, typography) MUST be applied uniformly across all 6 preloaded scores. When a fix is identified as generic (applicable to the rendering engine or layout rules rather than score-specific content), it MUST be propagated immediately to all remaining unreviewed scores.
- **FR-006**: Any element that cannot be rendered with full Musescore fidelity MUST be documented as a known limitation.
- **FR-007**: Each approved score layout MUST remain stable - subsequent fixes to other scores MUST NOT regress approved ones.
- **FR-008**: Layout fixes MUST address both geometry/spacing defects (originating in the layout engine) and visual style defects (originating in the rendering layer). Each defect MUST be attributed to the layer responsible.
- **FR-009**: Musician feedback MUST be delivered as a side-by-side screenshot showing the Musescore region alongside the corresponding Graditone region, accompanied by written comments identifying each discrepancy. This artifact MUST be stored with the score's review materials.
- **FR-010**: Staccato articulation MUST affect both playback audio duration (notes shortened to 50% of written duration) and practice mode hold requirement (`requiredHoldMs` reduced proportionally), so musical articulation is reflected consistently across all interaction modes.

### Key Entities

- **Preloaded Score**: One of the 6 scores bundled with the application. Attributes: title, composer, source file, layout approval status.
- **Layout Reference**: The Musescore-rendered version of a score, serving as the visual standard for comparison.
- **Layout Fix**: A targeted change applied to a score's rendering to address a specific visual deficiency identified during review.
- **Musician Feedback**: A side-by-side screenshot showing the Musescore reference region alongside the Graditone-rendered region, with written comments identifying specific discrepancies. Stored in the repository alongside the reference images.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 6 preloaded scores receive explicit musician approval for their layout.
- **SC-002**: Each layout issue identified by the musician is addressed within 2 review cycles.
- **SC-003**: No approved score layout regresses during the fix process for other scores.
- **SC-004**: Any technical limitation preventing exact Musescore fidelity is documented for 100% of affected elements.
- **SC-005**: A musician reviewing the final layouts rates them as "clean and professional" without requiring additional changes.

## Clarifications

### Session 2026-03-15

- Q: What form will the Musescore reference take during review? → A: Screenshots (PNG/PDF) of each score from Musescore, stored in the repository.
- Q: What layer of the system does "fixing the layout" target? → A: Both the layout engine (position/spacing/geometry) and the frontend rendering layer (visual style).
- Q: Should layout fixes be applied to all 6 scores simultaneously or one at a time? → A: One score at a time, sequentially, in a defined order of priority.
- Q: When a generic fix is found on one score, should it propagate to all remaining scores? → A: Yes — generic fixes are applied globally and forward-propagated to all remaining scores immediately; score-specific fixes stay scoped to the current score.
- Q: How should the musician communicate layout feedback? → A: Side-by-side screenshot (Musescore region vs Graditone region) with written comments describing each discrepancy.

## Known Issues & Regression Tests *(if applicable)*

The following limitations were identified during the 6-score review campaign (2026-03-15)
and accepted as out-of-scope for this feature. They are tracked here per FR-006.

### KL-001 — Ornaments, Grace Notes, and Dynamics not rendered

**Affects**: Beethoven Für Elise (trills, grace notes), Chopin Nocturne (trills, turns, grace notes), and any future score with ornaments or dynamic markings.

**Layer**: Layout engine — no implementation for ornament glyphs (`trill`, `turn`, `mordent`, `grace-note` elements) or dynamic markings (`p`, `f`, `mf`, `cresc.`, etc.).

**Impact**: Low — ornaments are decorative; the core pitches and rhythms are rendered correctly.

**Resolution**: Out of scope for this feature. Tracked as a future enhancement.

---

### KL-002 — Stem direction is pitch-based only (no multi-voice support)

**Affects**: Scores with two voices on the same staff (none of the current 6 preloaded scores).

**Layer**: Layout engine (`stems.rs`) — stem direction is determined by note pitch relative to the middle line (B4 for treble). Voice-number-aware stem direction (Voice 1 → stems up, Voice 2 → stems down) is not implemented.

**Impact**: None for current preloaded scores. Would be visible on future scores with multiple independent voices on one staff.

**Resolution**: Out of scope. Tracked as a future enhancement.

---

### KL-003 — `compute_beat_boundaries()` fallback for uncommon meters

**Affects**: Scores in meters other than those explicitly handled (2/4, 3/4, 4/4, 6/8, 12/8, 3/8).

**Layer**: Layout engine (`beams.rs`) — `compute_beat_boundaries()` falls back to equal beat division for unrecognised meters, which may produce incorrect beam groups.

**Impact**: None for current 6 preloaded scores (all use supported time signatures). MusicXML beam data takes precedence when present in the file.

**Resolution**: The fallback is acceptable for the current score set. Unsupported meters will be addressed when a score requiring them is added.

---

### Regression Tests Added (by this feature)

| Test | File | What it guards |
|------|------|---------------|
| `test_stem_length_standard_note` | `backend/tests/layout_test.rs` | Stem height ≥ 70 units (T020) |
| `test_staff_line_stroke_width` | `frontend/src/components/LayoutRenderer.test.tsx` | Staff line stroke-width ≥ 1.5 (T022) |
| `canon_d_beam_glyphs_have_positive_width` → `all_beams_have_positive_width` | `backend/tests/canon_d_beam_test.rs` | All beam widths > 10 units |
| `all_beams_inside_system_bounding_box` | `backend/tests/canon_d_beam_test.rs` | System bboxes cover all stems/beams (beam-cut fix regression) |
| `consistent_font_size_across_scores` | `backend/tests/cross_score_consistency_test.rs` | All scores use font_size=80.0 |
| `all_scores_have_essential_glyphs` | `backend/tests/cross_score_consistency_test.rs` | Clef, time sig, noteheads present in all 6 |
| `consistent_stem_lengths_across_scores` | `backend/tests/cross_score_consistency_test.rs` | Stem lengths ≥ 50 units in all 6 |
| `consistent_barline_widths_across_scores` | `backend/tests/cross_score_consistency_test.rs` | Barline widths 1.5/4.0 in all 6 |
| `bounding_boxes_contain_all_glyphs_across_scores` | `backend/tests/cross_score_consistency_test.rs` | No gleems outside bbox (beam-cut, all 6 scores) |
| `propagates staccato flag from the tie-start note` | `frontend/tests/unit/TieResolver.test.ts` | Staccato flag survives tie resolution (T098) |

## Constraints & Tradeoffs

- Layout fixes span two distinct layers: the **layout engine** (responsible for note positioning, spacing, beam geometry, stem lengths) and the **rendering layer** (responsible for font size, line weight, color, canvas scaling). Fixes must be identified and applied at the correct layer.
- Discrepancies that originate in the layout engine cannot be corrected solely through rendering-layer adjustments.

## Assumptions & Dependencies

- Musescore reference images (PNG or PDF) for all 6 preloaded scores are exported and stored in the repository before layout work begins.
- The 6 preloaded scores are processed in this priority order: (1) Burgmuller_LaCandeur.mxl, (2) Burgmuller_Arabesque.mxl, (3) Pachelbel_CanonD.mxl, (4) Bach_InventionNo1.mxl, (5) Beethoven_FurElise.mxl, (6) Chopin_NocturneOp9No2.mxl.
- The musician performing reviews is the same person who will use the application, ensuring feedback reflects real user needs.
- Technical layout constraints will be transparently communicated and not silently ignored.
