# Quickstart: Final Preloaded Scores Layout Checks

**Branch**: `001-preloaded-scores-checks`  
**Date**: 2026-03-21  
**Purpose**: Run the full final check session from a clean state

---

## Step 1: Commit In-Progress Work

Several files from the Nocturne M29–M37 fix are untracked. Commit them first:

```bash
cd /path/to/graditone

# Stage the Nocturne fix source files
git add backend/src/domain/events/rest.rs
git add backend/src/domain/importers/musicxml/converter.rs
git add backend/src/domain/importers/musicxml/parser.rs
git add backend/src/domain/importers/musicxml/types.rs
git add backend/src/layout/annotations.rs
git add backend/src/layout/extraction.rs
git add backend/src/layout/positioner.rs

# Stage the regression tests and e2e specs
git add backend/tests/nocturne_m29_m37_test.rs
git add backend/tests/debug_m2_slur_test.rs
git add frontend/e2e/nocturne-m29-m37-layout.spec.ts

# Stage the agent context file
git add .github/agents/copilot-instructions.md

# Commit
git commit -m "fix(layout): Nocturne Op.9 M29-M37 layout defects — bb/nat, 8va M30, accidentals, rests, slurs, LH-RH alignment"
```

---

## Step 2: Run the Regression Test Suite

```bash
# Backend tests
cd backend
cargo test
# Expected: 0 failures

# Frontend tests
cd ../frontend
npm run test -- --run
# Expected: 0 failures

# (Optional) E2E tests — requires dev server running
npm run dev &
npx playwright test e2e/nocturne-m29-m37-layout.spec.ts
```

**Do not proceed to Step 3 until both `cargo test` and `vitest` pass with zero failures.**

---

## Step 3: Build WASM

```bash
cd backend
wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg
cd ../frontend
```

---

## Step 4: Start Dev Server

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in a browser.

---

## Step 5: Open Musescore References

Open the reference PNGs for side-by-side comparison:

```
specs/050-fix-layout-preloaded-scores/references/
├── Burgmuller_LaCandeur.png
├── Burgmuller_Arabesque.png
├── Pachelbel_CanonD.png
├── Bach_InventionNo1.png
├── Beethoven_FurElise.png
└── Chopin_NocturneOp9No2.png
```

Use any image viewer. Display side-by-side with the browser.

---

## Step 6: Review Each Score

Follow `contracts/review-protocol.md` for each of the 6 scores in order.

For each score:
1. Open the score in the browser using the score selector
2. Work through the per-score checklist in `contracts/review-protocol.md`
3. Compare each system against the corresponding region of the Musescore reference PNG
4. Record the outcome in `reviews/{NN}-{ScoreName}-final.md` (use the template in the contract)

---

## Step 7: If a New Issue Is Found

1. Stop — do NOT mark the score as REJECTED yet.
2. Write a failing regression test that reproduces the issue (Constitution VII).
3. Confirm the test fails: `cargo test` or `vitest`.
4. Apply the targeted fix.
5. Confirm the test passes: `cargo test` + `vitest` (full suite — all must pass).
6. Rebuild WASM (Step 3) and restart dev server (Step 4).
7. Re-review the affected score only; continue from where you left off for others.

---

## Step 8: Produce the Overall Report

Once all 6 scores have an approval record, create:  
`reviews/final-check-report.md`

Use the template in `contracts/review-protocol.md` (Post-Session section).

The feature branch is ready to merge when:
- All 6 scores: `APPROVED` or `APPROVED_WITH_LIMITATIONS`
- `cargo test`: all pass
- `vitest`: all pass
- `final-check-report.md` exists with `overall_verdict: PASS`

---

## Reference: Key Files

| File | Purpose |
|------|---------|
| `specs/050-fix-layout-preloaded-scores/references/*.png` | Musescore reference PNGs |
| `specs/050-fix-layout-preloaded-scores/reviews/final-consistency-check/consistency-report.md` | Prior consistency results |
| `specs/001-preloaded-scores-checks/contracts/review-protocol.md` | Per-score review checklist and verdict rules |
| `backend/tests/cross_score_consistency_test.rs` | Automated consistency regression |
| `backend/tests/nocturne_m29_m37_test.rs` | Nocturne M29–M37 regression |
| `frontend/src/components/LayoutRenderer.test.tsx` | Staff line stroke width regression |
| `frontend/src/components/layout/LayoutView.grace.test.ts` | Grace note regression |
