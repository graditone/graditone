# Research: Final Preloaded Scores Layout Checks

**Branch**: `001-preloaded-scores-checks`  
**Date**: 2026-03-21  
**Status**: Complete — no NEEDS CLARIFICATION items remain

## Decision Log

### D-001: Scope of This Feature

**Decision**: Final acceptance gate only — no new fix cycle.  
**Rationale**: The `050-fix-layout-preloaded-scores` cycle approved all 6 scores on 2026-03-15 with a passing consistency report. This feature's job is to confirm the current branch (which additionally carries the `001-fix-nocturne-layout` Nocturne M29–M37 fixes) still satisfies all those approvals and passes all regression tests.  
**Alternatives considered**: Full iterative re-review per score — rejected as unnecessary overhead given the programmatic consistency check already ran clean.

### D-002: Regression Test Suite Is the Automated Safety Net

**Decision**: `cargo test` (backend) + `vitest` (frontend) must both pass before any musician review session starts.  
**Rationale**: Constitution Principle VII requires every discovered issue to have a test before a fix. Running the test suite first ensures no silent regression is masked by a visual pass.  
**Alternatives considered**: Visual-first review then tests — rejected because tests are faster to run and objectively detect regressions.

### D-003: Nocturne M29–M37 Fixes Are In-Scope for Final Check

**Decision**: The Nocturne M29–M37 fixes (untracked in `backend/tests/nocturne_m29_m37_test.rs`, `backend/tests/debug_m2_slur_test.rs`, `frontend/e2e/nocturne-m29-m37-layout.spec.ts`) must be staged and committed before the test suite baseline run.  
**Rationale**: These test files are currently untracked (visible in `git status`). They represent work already done in this branch. Committing them is a prerequisite to a clean `cargo test` run without untracked-file ambiguity.  
**Alternatives considered**: Run tests without committing — viable but risky; untracked tests could be missed by the CI configuration.

### D-004: Musescore Reference PNGs Remain Valid

**Decision**: The Musescore 4 reference PNGs in `specs/050-fix-layout-preloaded-scores/references/` are valid for this final check.  
**Rationale**: No new Musescore exports are warranted since the source `.mxl` files have not changed. The reference images were generated at 150 DPI from the same files.  
**Alternatives considered**: Re-export references — unnecessary overhead; would only be needed if the source MusicXML changed.

### D-005: Approval Record Format

**Decision**: One markdown file per score in `specs/001-preloaded-scores-checks/reviews/`, capturing date, reviewer, approved elements, and any accepted known limitations.  
**Rationale**: Simple, version-controlled, and consistent with the review artifact format used in the `050` cycle.  
**Alternatives considered**: Single consolidated approval sheet — harder to track per-score status independently.

---

## Regression Test Inventory

### Backend (`cargo test`)

| Test File | Covers | From Fix Cycle |
|-----------|--------|---------------|
| `cross_score_consistency_test.rs` | All-6-scores visual constants (font_size, stem, barlines, clef, bbox) | T066–T067 (050) |
| `slur_direction_test.rs` | Slur concavity (Für Elise M52) | T111 (050) |
| `chord_dots_test.rs` | Augmentation dot de-collision (Für Elise M63) | T112 (050) |
| `grace_note_layout_test.rs` | Grace note noteheads + stems/beams (Für Elise M26) | T109 (050) |
| `notation_dots_test.rs` | Augmentation dot vertical placement | 050 cycle |
| `layout_test.rs` | Stem length ≥ 50.0 units | T020–T021 (050) |
| `canon_d_beam_test.rs` | Beamed chord clearance (Canon D) | T105 (050) |
| `bach_slur_test.rs` | Bach Invention slurs | 050 cycle |
| `bach_incoming_ties_test.rs` | Incoming ties (Bach Invention) | 050 cycle |
| `bracket_centering_test.rs` | Ottava bracket centering | T115 (050) |
| `m21_accidental_test.rs` | Accidentals (Arabesque M21) | 050 cycle |
| `nocturne_m29_m37_test.rs` | Nocturne M29–M37 defects (bb vs nat, 8va M30, accidentals, rests, slurs) | 001-fix-nocturne-layout |
| `debug_m2_slur_test.rs` | M2 slur regression | 001-fix-nocturne-layout |

### Frontend (`vitest`)

| Test File | Covers | From Fix Cycle |
|-----------|--------|---------------|
| `frontend/src/components/LayoutRenderer.test.tsx` | Staff line `stroke-width` ≥ 1.5 | T022–T023 (050) |
| `frontend/src/components/layout/LayoutView.grace.test.ts` | Grace note forwarding + opacity | T109 (050) |
| `frontend/tests/unit/LayoutRenderer.test.tsx` | Staff rendering regression | 050 cycle |
| `frontend/tests/unit/renderUtils.test.ts` | Render utility correctness | 050 cycle |

### E2E (`playwright`)

| Test File | Covers | From Fix Cycle |
|-----------|--------|---------------|
| `frontend/e2e/nocturne-m29-m37-layout.spec.ts` | Nocturne M29–M37 visual regression | 001-fix-nocturne-layout |

---

## Open Issues Before Final Check

### OI-001: Untracked Test Files Must Be Committed

**Status**: Blocking  
**Description**: `nocturne_m29_m37_test.rs`, `debug_m2_slur_test.rs`, and `nocturne-m29-m37-layout.spec.ts` are untracked. They must be `git add`-ed and committed before the test baseline is established.

### OI-002: Modified Backend Source Files Must Be Reviewed

**Status**: Blocking  
**Description**: Several backend source files are modified but not staged:
- `backend/src/domain/events/rest.rs`
- `backend/src/domain/importers/musicxml/converter.rs`
- `backend/src/domain/importers/musicxml/parser.rs`
- `backend/src/domain/importers/musicxml/types.rs`
- `backend/src/layout/annotations.rs`
- `backend/src/layout/extraction.rs`
- `backend/src/layout/positioner.rs`
- `frontend/public/wasm/musicore_backend_bg.wasm`

These are the Nocturne M29–M37 fix implementation files. They must pass `cargo test` + `cargo clippy`, then be committed with the corresponding tests (OI-001).

### OI-003: `.github/agents/copilot-instructions.md` Is Modified

**Status**: Non-blocking  
**Description**: The agent context file reflects updated technology from prior features. Review during agent context update step (FR per plan task).

---

## Pre-Existing Approvals (from 050 cycle)

All 6 scores were approved 2026-03-15 as documented in `specs/050-fix-layout-preloaded-scores/reviews/final-consistency-check/consistency-report.md`:

| Score | Approval Date | Status |
|-------|--------------|--------|
| Burgmüller — La Candeur | 2026-03-15 | Approved |
| Burgmüller — Arabesque | 2026-03-15 | Approved |
| Pachelbel — Canon in D | 2026-03-15 | Approved |
| Bach — Invention No. 1 | 2026-03-15 | Approved |
| Beethoven — Für Elise | 2026-03-15 | Approved |
| Chopin — Nocturne Op. 9 No. 2 | 2026-03-15 | Approved (pre-M29–M37 fix) |

**Note on Nocturne**: The Nocturne was approved in 050 at a snapshot that predates the M29–M37 fixes. The final check must re-confirm the Nocturne with M29–M37 fixes applied.

---

## Known Limitations (Documented)

- Non-standard ornaments (e.g., trills, mordents) that require specific rendering not yet implemented are not rendered — this was accepted in the 050 cycle and documented per score.
- Volta bracket text positioning may differ slightly from Musescore on narrow measures — accepted as a known limitation.
