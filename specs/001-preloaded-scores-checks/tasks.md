# Tasks: Final Preloaded Scores Layout Checks

**Input**: Design documents from `/specs/001-preloaded-scores-checks/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/review-protocol.md ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: User Story 1 — Musician explicit per-score approval (P1)
- **[US2]**: User Story 2 — Regression verification across all fixed elements (P2)
- **[US3]**: User Story 3 — Cross-score visual consistency confirmation (P3)

---

## Phase 1: Setup

**Purpose**: Commit all in-progress Nocturne M29–M37 work so the repository is clean and `cargo test` reflects the current state. Two blocking issues from research.md (OI-001, OI-002) must be resolved here.

- [x] T001 Stage and commit all Nocturne M29–M37 implementation and regression test files: `git add backend/src/domain/events/rest.rs backend/src/domain/importers/musicxml/converter.rs backend/src/domain/importers/musicxml/parser.rs backend/src/domain/importers/musicxml/types.rs backend/src/layout/annotations.rs backend/src/layout/extraction.rs backend/src/layout/positioner.rs backend/tests/nocturne_m29_m37_test.rs backend/tests/debug_m2_slur_test.rs frontend/e2e/nocturne-m29-m37-layout.spec.ts .github/agents/copilot-instructions.md && git commit -m "fix(layout): Nocturne Op.9 M29-M37 defects — bb/nat, 8va M30, accidentals, rests, slurs, LH-RH alignment"`
- [x] T002 Stage and commit updated WASM artifact: `git add frontend/public/wasm/musicore_backend_bg.wasm && git commit -m "chore(wasm): rebuild WASM for Nocturne M29-M37 fixes"`

**Checkpoint**: `git status` shows no untracked files and no modified files from the Nocturne fix. Repository is clean.

---

## Phase 2: Foundational (Regression Gate)

**Purpose**: Run the full regression test suite before any review session begins. This is mandatory per FR-003 — no musician review may start until all tests pass.

**⚠️ CRITICAL**: If any test fails here, investigate and fix before proceeding. Constitution VII applies: write a failing test first if a new bug is discovered.

- [x] T003 Run full Rust regression suite: `cd backend && cargo test` — zero failures required; if any fail, document in `specs/001-preloaded-scores-checks/research.md` as a new open issue before fixing
- [x] T004 [P] Run full frontend test suite: `cd frontend && npm run test -- --run` — zero failures required
- [x] T005 Build WASM for review session: `cd backend && wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg`
- [x] T006 Start dev server and verify all 6 preloaded scores load without console errors: `cd frontend && npm run dev`; open `http://localhost:5173`; navigate to each of the 6 scores and confirm no rendering errors in the browser console

**Checkpoint**: `cargo test` ✅, `vitest` ✅, WASM built ✅, all 6 scores open without errors ✅. Review session may now begin.

---

## Phase 3: User Story 1 — Musician Per-Score Final Approval (Priority: P1) 🎯 MVP

**Goal**: Each of the 6 preloaded scores receives a written Final Approval Record. The musician explicitly approves or rejects each score using the per-score checklist in `contracts/review-protocol.md`.

**Independent Test**: Open La Candeur alongside `specs/050-fix-layout-preloaded-scores/references/Burgmuller_LaCandeur.png`; complete the checklist; create `reviews/01-LaCandeur-final.md` with `verdict: APPROVED`. The feature delivers musician sign-off value from this single score alone.

### Score Reviews

- [ ] T007 [US1] Review Burgmüller La Candeur: open score in browser, compare against `specs/050-fix-layout-preloaded-scores/references/Burgmuller_LaCandeur.png`, complete all checklist items per `specs/001-preloaded-scores-checks/contracts/review-protocol.md`, create `specs/001-preloaded-scores-checks/reviews/01-LaCandeur-final.md`
- [ ] T008 [US1] Review Burgmüller Arabesque: open score, compare against `specs/050-fix-layout-preloaded-scores/references/Burgmuller_Arabesque.png`, complete checklist, create `specs/001-preloaded-scores-checks/reviews/02-Arabesque-final.md`
- [ ] T009 [US1] Review Pachelbel Canon in D: open score, compare against `specs/050-fix-layout-preloaded-scores/references/Pachelbel_CanonD.png`, complete checklist, create `specs/001-preloaded-scores-checks/reviews/03-CanonD-final.md`
- [ ] T010 [US1] Review Bach Invention No. 1: open score, compare against `specs/050-fix-layout-preloaded-scores/references/Bach_InventionNo1.png`, complete checklist, create `specs/001-preloaded-scores-checks/reviews/04-Invention-final.md`
- [ ] T011 [US1] Review Beethoven Für Elise: open score, compare against `specs/050-fix-layout-preloaded-scores/references/Beethoven_FurElise.png`; pay specific attention to grace notes (M26), slur concavity (M52), augmentation dot de-collision on chord seconds (M63/M69), ottava bracket (M82–M83); complete checklist, create `specs/001-preloaded-scores-checks/reviews/05-FurElise-final.md`
- [ ] T012 [US1] Review Chopin Nocturne Op. 9 No. 2: open score, compare against `specs/050-fix-layout-preloaded-scores/references/Chopin_NocturneOp9No2.png`; complete the standard checklist PLUS all Nocturne-specific checks from `contracts/review-protocol.md` (M29 𝄫 vs ♮, M30 8va bracket, M34–M36 accidentals and rest centering, M37 slur, M29–M37 LH/RH alignment); create `specs/001-preloaded-scores-checks/reviews/06-Nocturne-final.md`

### Remediation (Conditional — Execute Only If a Score Is Rejected)

- [ ] T013 [US1] If any score review returns `REJECTED`: write a failing regression test reproducing the issue (Constitution VII — test MUST fail before fix is applied); apply targeted fix; run `cargo test` + `npm run test -- --run` — full suite must pass; rebuild WASM (T005); re-review the affected score only and update its approval record

**Checkpoint**: All 6 `reviews/{NN}-*-final.md` files exist with `verdict: APPROVED` or `verdict: APPROVED_WITH_LIMITATIONS`. No `REJECTED` verdicts remain.

---

## Phase 4: User Story 2 — Regression Verification Sign-Off (Priority: P2)

**Goal**: Confirm with a final automated pass that all fixed elements from the `050-fix-layout-preloaded-scores` cycle remain correctly in place after any remediation fixes applied during Phase 3.

**Independent Test**: `cargo test` passes zero failures — no musician-in-the-loop required.

- [ ] T014 [US2] Re-run full Rust regression suite post-review: `cd backend && cargo test` — zero failures confirm the per-score reviews (Phase 3) introduced no regressions; if any fail, apply Constitution VII (test is already present) and fix
- [ ] T015 [P] [US2] Re-run frontend test suite: `cd frontend && npm run test -- --run` — zero failures
- [ ] T016 [US2] Run Nocturne M29–M37 e2e test: `cd frontend && npx playwright test e2e/nocturne-m29-m37-layout.spec.ts` — all assertions pass

**Checkpoint**: `cargo test` ✅, `vitest` ✅, Nocturne playwright e2e ✅. Regression verification complete.

---

## Phase 5: User Story 3 — Cross-Score Visual Consistency Confirmation (Priority: P3)

**Goal**: The musician opens all 6 preloaded scores consecutively in the same session and confirms that shared layout properties — staff height, line weights, clef proportions, note spacing, margin conventions — are visually uniform. No score should stand out as inconsistent.

**Independent Test**: Open all 6 scores consecutively; compare staff proportions and line weights by eye. No per-note analysis required — this is a gestalt consistency check deliverable on its own.

- [ ] T017 [US3] Open all 6 preloaded scores consecutively in the browser; for each pair compare: staff line stroke weight, staff height, clef glyph size, notehead size, barline weight, system margins; document outcome in `specs/001-preloaded-scores-checks/reviews/cross-score-consistency.md` (PASS / FAIL with notes on any inconsistency found)
- [ ] T018 [US3] If any inconsistency is found in T017: determine whether it is a score-specific accepted override (document as known limitation) or a genuine rendering inconsistency (apply Constitution VII fix); no new score-specific overrides may be introduced without updating the corresponding `reviews/{NN}-*-final.md` known limitations field

**Checkpoint**: `reviews/cross-score-consistency.md` exists with `PASS` outcome (or PASS-WITH-LIMITATIONS if accepted overrides noted).

---

## Final Phase: Close-Out

**Purpose**: Produce the overall Final Check Report and commit all review artifacts.

- [ ] T019 Create `specs/001-preloaded-scores-checks/reviews/final-check-report.md` with: all 6 scores listed with their verdicts, `cargo test` + `vitest` + playwright results, `overall_verdict: PASS`, union of all known limitations, cross-score consistency outcome from T017
- [ ] T020 [P] Run `cd backend && cargo clippy -- -D warnings` — zero warnings
- [ ] T021 Commit all review artifacts: `git add specs/001-preloaded-scores-checks/reviews/ && git commit -m "docs(reviews): final preloaded scores acceptance gate — all 6 scores approved (001-preloaded-scores-checks)"`

---

## Dependencies

```
T001 ──► T002 ──► T003 ──► T007
                  T004 ──► T007 (gate: tests pass first)
                  T005 ──► T006 ──► T007
T007 ──► T008 ──► T009 ──► T010 ──► T011 ──► T012 (sequential: Nocturne last)
T012 ──► T013 (conditional: only if REJECTED)
T007..T013 ──► T014 (post-review test re-run)
T014 ──► T015 (parallel: both post-review test runs)
T015 ──► T016 (playwright after vitest)
T014..T016 ──► T017 (consistency check after regression verified)
T017 ──► T018 (remediation only if needed)
T017..T018 ──► T019 ──► T020 ──► T021
```

## Parallel Execution

**Phase 1**: T001 → T002 sequential (same git history; T002 depends on WASM from T001's committed source).

**Phase 2**: T003 + T004 in parallel (different test runners); T005 after T003 (WASM build needs clean Rust); T006 after T005.

**Phase 3**: T007–T012 are sequential — each review may surface a fix that re-runs tests before the next review begins. T013 (conditional) runs only if needed, before the next score review restarts.

**Phase 4**: T014 + T015 in parallel (independent test runners); T016 after T015 (playwright needs vitest to pass first to avoid noise).

**Phase 5**: T017 → T018 sequential (T018 only if T017 finds issues).

**Final**: T019 → T020 in parallel (report creation and clippy are independent); T021 after both.

## Implementation Strategy

**MVP scope**: Phases 1–3 (T001–T012) — delivers the most critical value: all 6 scores with explicit musician sign-off. Proves the complete acceptance gate workflow.

**Incremental delivery**:
1. Phase 1 + 2 (T001–T006): Clean repo + green test suite (~1 session, automated)
2. Phase 3 scores 1–4 (T007–T010): La Candeur, Arabesque, Canon, Invention — lowest risk; prior 050 approval unchanged by recent fixes
3. Phase 3 scores 5–6 (T011–T012): Für Elise + Nocturne — most complex, most recent fixes
4. Phase 4 (T013–T016): Final test re-run after all reviews
5. Phase 5 + Final (T017–T021): Consistency check + report + commit

**Risk management**: Nocturne is reviewed last (T012) because it carries the most recent fixes (M29–M37) and is most likely to surface new issues. Scores 1–4 (T007–T010) were already approved in the 050 cycle with no changes to their rendering paths; the Nocturne fix only touches `converter.rs`, `parser.rs`, `types.rs`, and `rest.rs` — all in the MusicXML import and Nocturne-specific paths.
