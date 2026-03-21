# Final Approval Record: Chopin — Nocturne Op. 9 No. 2

**Score ID**: 06  
**Branch**: `001-preloaded-scores-checks`  
**Review Date**: <!-- YYYY-MM-DD -->  
**Reviewer**: <!-- name -->  
**Prior Approval**: `050-fix-layout-preloaded-scores / reviews/06-Chopin_NocturneOp9No2/cycle-01.md`  
**Regression Tests**: cargo test ✅ | vitest ✅  
**Nocturne M29–M37 e2e test**: playwright ✅ (see T016)

## Verdict: <!-- APPROVED | APPROVED_WITH_LIMITATIONS | REJECTED -->

## Checklist Results

> Open the score in the browser at http://localhost:5173 and compare against the reference pages:  
> `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2-1.png`  
> `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2-2.png`  
> `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2-3.png`  
> `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2-4.png`
>
> This score requires the standard checklist PLUS all Nocturne-specific checks below.  
> Pay particular attention to M29–M37 which carry the most recent fixes.

### Layout Element Checks

- [ ] **Noteheads**: Correct glyph, correct size, correct stem direction
- [ ] **Stems**: Standard length (≥ 50 units), correctly attached to noteheads
- [ ] **Beams**: Correct angle, no notehead overlap; beam clears all chord noteheads
- [ ] **Accidentals**: All required accidentals present; correctly positioned left of noteheads
- [ ] **Augmentation dots**: Present and in correct staff space; no two dots overlap (chord de-collision)
- [ ] **Rests**: Correct glyph; vertically centered at standard staff position for voice
- [ ] **Clefs**: Correct glyph at system start; mid-system clef changes positioned after barlines
- [ ] **Key signature**: Correct sharps/flats (E♭ major — 3 flats); correct sequence and vertical position
- [ ] **Time signature**: Correct numerals (12/8); aligned with staff top and bottom lines
- [ ] **Barlines**: Thin/thick strokes at correct width (1.5/4.0 units)
- [ ] **Staff lines**: Visible stroke weight (≥ 1.5 units); 5 lines per staff evenly spaced
- [ ] **Ledger lines**: Present where required; stroke weight slightly heavier than staff lines
- [ ] **Slurs**: Correct arc start/end anchors; curvature direction follows standard engraving rules (opposite to stem direction)
- [ ] **Ties**: Distinguished from slurs; connect same pitch across barlines
- [ ] **Grace notes**: Visible at smaller size (~60% of normal); correct opacity; beamed correctly
- [ ] **Ottava brackets (8va/8vb)**: "8va"/"8vb" label present; dashed line extends to terminal hook at correct note
- [ ] **Chord displacement**: Seconds displaced correctly (stem-direction-aware); accidentals staggered
- [ ] **Staccato dots**: Present on articulated notes; positioned on correct side of notehead

### Nocturne-Specific Checks (M29–M37 — Most Recent Fixes)

- [ ] **M29**: Double-flat (𝄫) on beat 1 RH — must NOT render as a natural sign (♮); fix: `parser.rs` double-flat parsing
- [ ] **M30**: "8va" bracket starts at M30 RH — confirm label and bracket visible from M30 onward
- [ ] **M34–M36**: Courtesy accidentals present and correctly positioned left of respective noteheads
- [ ] **M34–M36**: Rests centered at standard vertical position (not shifted up/down); fix: `annotations.rs` rest centering
- [ ] **M37**: Slur correctly positioned — direction follows standard engraving rules (opposite stem direction); fix: `positioner.rs`
- [ ] **M29–M37 LH/RH vertical alignment**: No tick divergence visible between treble and bass staves — notes on the same beat appear horizontally aligned across both staves

## Known Limitations

- None

## Issues Found

- None

## Notes

<!-- Free text: any observations, deviations from the reference, or confirmation of prior cycle approval for M1–M28 and M38+.
     For M29–M37, confirm each Nocturne-specific check passed. -->
