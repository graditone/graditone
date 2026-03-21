# Review Protocol: Final Preloaded Scores Layout Checks

**Version**: 1.0  
**Date**: 2026-03-21  
**Feature**: `001-preloaded-scores-checks`

## Purpose

This document defines the protocol that MUST be followed during the final visual review session for each of the 6 preloaded scores. It is the contract between the implementation phase and the acceptance gate — anyone following this protocol can produce a valid Final Approval Record.

---

## Prerequisites (Must Be Met Before Review Session Starts)

1. **Regression tests pass**: Run `cargo test` from `backend/` — zero failures.
2. **Frontend tests pass**: Run `npm run test` (vitest) from `frontend/` — zero failures.
3. **WASM built**: Run `wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg` from `backend/`.
4. **Dev server running**: Run `npm run dev` from `frontend/`.
5. **Untracked files committed**: `nocturne_m29_m37_test.rs`, `debug_m2_slur_test.rs`, `nocturne-m29-m37-layout.spec.ts` must be committed (see research.md OI-001).
6. **Musescore references available**: `specs/050-fix-layout-preloaded-scores/references/` contains 6 PNG files.

If any prerequisite is not met, the review session MUST NOT start.

---

## Review Order

Scores are reviewed in this fixed order:

| # | Score | Reference PNG |
|---|-------|--------------|
| 1 | Burgmüller — La Candeur | `references/Burgmuller_LaCandeur.png` |
| 2 | Burgmüller — Arabesque | `references/Burgmuller_Arabesque.png` |
| 3 | Pachelbel — Canon in D | `references/Pachelbel_CanonD.png` |
| 4 | Bach — Invention No. 1 | `references/Bach_InventionNo1.png` |
| 5 | Beethoven — Für Elise | `references/Beethoven_FurElise.png` |
| 6 | Chopin — Nocturne Op. 9 No. 2 | `references/Chopin_NocturneOp9No2.png` |

**Rationale**: Simpler scores first; Nocturne last because it carries the most recent fixes (M29–M37) and requires the most detailed attention.

---

## Per-Score Review Checklist

For each score, the reviewer MUST verify all items before issuing a verdict.

### Layout Element Checks

- [ ] **Noteheads**: Correct glyph, correct size, correct stem direction
- [ ] **Stems**: Standard length (≥ 50 units), correctly attached to noteheads
- [ ] **Beams**: Correct angle, no notehead overlap; beam clears all chord noteheads
- [ ] **Accidentals**: All required accidentals present; correctly positioned left of noteheads
- [ ] **Augmentation dots**: Present and in correct staff space; no two dots overlap (chord de-collision)
- [ ] **Rests**: Correct glyph; vertically centered at standard staff position for voice
- [ ] **Clefs**: Correct glyph at system start; mid-system clef changes positioned after barlines
- [ ] **Key signature**: Correct sharps/flats; correct sequence and vertical position
- [ ] **Time signature**: Correct numerals; aligned with staff top and bottom lines
- [ ] **Barlines**: Thin/thick strokes at correct width (1.5/4.0 units)
- [ ] **Staff lines**: Visible stroke weight (≥ 1.5 units); 5 lines per staff evenly spaced
- [ ] **Ledger lines**: Present where required; stroke weight slightly heavier than staff lines
- [ ] **Slurs**: Correct arc start/end anchors; curvature direction follows standard engraving rules (opposite to stem direction)
- [ ] **Ties**: Distinguished from slurs; connect same pitch across barlines
- [ ] **Grace notes**: Visible at smaller size (~60% of normal); correct opacity; beamed correctly
- [ ] **Ottava brackets (8va/8vb)**: Label present; dashed line extends to terminal hook at correct note (Für Elise, Nocturne)
- [ ] **Chord displacement**: Seconds displaced correctly (stem-direction-aware); accidentals staggered
- [ ] **Staccato dots**: Present on articulated notes; positioned on correct side of notehead

### Score-Specific Checks (Nocturne Only)

- [ ] M29: Double-flat (𝄫) on beat 1 RH — NOT a natural sign (♮)
- [ ] M30: "8va" bracket starts at M30 RH
- [ ] M34–M36: Courtesy accidentals present and correctly positioned
- [ ] M34–M36: Rests centered at standard vertical position
- [ ] M37: Slur correctly positioned (direction follows engraving rules)
- [ ] M29–M37: LH/RH vertical alignment — no tick divergence between staves

---

## Verdict Criteria

| Verdict | Condition |
|---------|-----------|
| `APPROVED` | All checklist items pass; no issues |
| `APPROVED_WITH_LIMITATIONS` | Checklist passes except for a known pre-documented limitation (non-implemented ornament, etc.) |
| `REJECTED` | Any checklist item fails with a new issue not previously documented |

### If REJECTED

1. Document the issue in the Final Approval Record (`issues_found` field).
2. Write a failing regression test reproducing the issue (Constitution VII).
3. Apply the targeted fix.
4. Re-run `cargo test` + `vitest` — must pass.
5. Re-run this review protocol for the affected score only.
6. Do not re-review already-approved scores unless the fix touched shared code.

---

## Approval Record Output

After reviewing each score, create the file:  
`specs/001-preloaded-scores-checks/reviews/{NN}-{ScoreName}-final.md`

Use this template:

```markdown
# Final Approval Record: {Score Name}

**Score ID**: {NN}  
**Branch**: `001-preloaded-scores-checks`  
**Review Date**: {YYYY-MM-DD}  
**Reviewer**: {name}  
**Prior Approval**: `050-fix-layout-preloaded-scores / reviews/{folder}/cycle-01.md`  
**Regression Tests**: cargo test ✅ | vitest ✅

## Verdict: {APPROVED | APPROVED_WITH_LIMITATIONS | REJECTED}

## Checklist Results

[Paste completed per-score checklist]

## Known Limitations

- {list or "None"}

## Issues Found

- {list or "None"}

## Notes

{Free text}
```

---

## Post-Session: Overall Final Check Report

Once all 6 scores have been reviewed, create:  
`specs/001-preloaded-scores-checks/reviews/final-check-report.md`

The report must confirm:
- `scores_approved`: 6
- `scores_rejected`: 0
- `overall_verdict`: PASS
- Cross-score consistency: uniform staff proportions, line weights, spacing
- All `known_limitations` listed

Only when this report exists with `overall_verdict: PASS` is the feature complete.
