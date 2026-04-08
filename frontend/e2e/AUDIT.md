# E2E Test Audit — Feature 076

**Date**: 2026-04  
**Feature**: `076-review-e2e-tests`  
**Total test cases at audit time**: 65  
**Spec files at audit time**: 16  

---

## Baseline Timing

> **Note**: Baseline not measured during initial implementation — run manually before deleting any CONVERT tests:
> ```sh
> cd frontend && time npx playwright test --workers=1
> ```
> Record the "real" elapsed seconds here:
>
> **Baseline duration**: _not yet recorded_

---

## Classification Summary

| Category | Files | Tests |
|----------|-------|-------|
| KEEP     | 12    | 57    |
| CONVERT  | 4     | 8     |
| REMOVE   | 0     | 0     |
| **Total**| **16**| **65**|

---

## KEEP (57 tests)

| File | Tests | Rationale |
|------|-------|-----------|
| `demo-flow.spec.ts` | 7 | Core onboarding user journey; multi-component, full pipeline, requires real browser |
| `difficulty-tag.spec.ts` | 4 | Difficulty badge data flows from backend → score selector UI; integration-level |
| `i18n-landing.spec.ts` | 4 | Browser locale behaviour and string rendering; cannot be unit-tested reliably |
| `load-score-dialog.spec.ts` | 6 | HTTP 404 checks for static assets require a real HTTP server; network path verification |
| `metronome.spec.ts` | 15 | Multi-plugin UI toggle (Play + Practice views), state teardown on close; genuine multi-component interaction |
| `persist-uploaded-scores.spec.ts` | 7 | IndexedDB persistence across page reload; browser storage lifecycle requires real browser |
| `play-score-plugin.spec.ts` | 10 | Core Play Score user journey; plugin launch, score selection, playback teardown |
| `tied-notes.spec.ts` | 2 | Guards full pipeline (HTTP load → WASM parse → SVG `<path>` element rendered); prior regression required browser |
| `train-complexity-levels.spec.ts` | 5 | Level selection, BPM preset values, localStorage persistence across reload |
| `train-from-score.spec.ts` | 11 | Most comprehensive integration test: score upload → WASM parse → exercise start; multi-plugin, real assets |
| `train-view.spec.ts` | 6 | Navigation smoke test; reference test for the practice-view-plugin equivalent |
| `train-virtual-keyboard.spec.ts` | 13 | In-plugin VK toggle interaction, exercise input routing via VK; multi-component |

---

## CONVERT (8 tests)

Tests that guard layout computations or pure-function field forwarding — belong in Rust backend or frontend unit tests.

| File | Tests | Migration Target | Status |
|------|-------|-----------------|--------|
| `m21-flat-check.spec.ts` | 2 | Frontend unit test: `convertScoreToLayoutFormat()` in `frontend/src/` — given mock `LayoutJSON` with `has_explicit_accidental: true`, assert WASM input field preserved | ✅ done — `frontend/src/components/layout/LayoutView.forwarding.test.ts`; file deleted |
| `nocturne-m2-staccato-verify.spec.ts` | 2 | Rust backend unit test: assert `notation_dots[*].y < notehead.y` for M2 LH staff in Nocturne Op.9 No.2 layout output | ✅ done — `backend/tests/nocturne_m2_staccato_test.rs`; file deleted |
| `nocturne-m29-m37-layout.spec.ts` | 3 | Rust backend unit test: assert glyph char code `U+E264` (double flat) and 8va bracket field populated in M29–M37 layout output | ✅ done — `backend/tests/nocturne_m29_m37_test.rs`; file deleted |
| `nocturne-m36-stem-verify.spec.ts` | 1 | Rust backend unit test: assert `stem_up: true` for notes 8–15 of M36 in Nocturne layout output | ✅ done — `backend/tests/nocturne_m29_m37_test.rs::test_nocturne_m36_rh_runs_have_stem_up`; file deleted |

> **Deletion policy**: Do NOT delete a CONVERT file until its replacement test is written and passing.
> Update the Status column to `✅ done` for each file once its replacement passes.

---

## Post-Deletion Timing

> After all 4 CONVERT files are deleted, record here:
> ```sh
> cd frontend && time npx playwright test --workers=1
> ```
> **Post-deletion duration**: _not yet recorded_

---

## Coverage After Feature 076

| Spec File | Tests | Category |
|-----------|-------|----------|
| `demo-flow.spec.ts` | 5 | KEEP |
| `difficulty-tag.spec.ts` | 2 | KEEP |
| `i18n-landing.spec.ts` | 3 | KEEP |
| `load-score-dialog.spec.ts` | 4 | KEEP |
| `metronome.spec.ts` | 10 | KEEP |
| `persist-uploaded-scores.spec.ts` | 5 | KEEP |
| `play-score-plugin.spec.ts` | 8 | KEEP |
| `practice-view-plugin.spec.ts` | 4 | NEW (US1) |
| `tied-notes.spec.ts` | 1 | KEEP |
| `train-complexity-levels.spec.ts` | 4 | KEEP |
| `train-from-score.spec.ts` | 6 | KEEP |
| `train-view.spec.ts` | 4 | KEEP |
| `train-virtual-keyboard.spec.ts` | 8 | KEEP |
| **Total** | **64** | |
