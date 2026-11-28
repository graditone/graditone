# Phase 0 Research: Rapid Demo Flow Generation from a Goal

**Feature**: `102-demo-flow-generation` | **Date**: 2026-11-28 | **Spec**: [spec.md](./spec.md)

This document resolves the design choices behind the agent-driven demo-flow authoring workflow. There are no `NEEDS CLARIFICATION` items in the Technical Context; the five open questions were settled in the [spec Clarifications](./spec.md#clarifications) and are restated as decisions below.

---

## D1. The app's annotations are the source of truth; the catalogue is a derived index

**Decision**: The identity of every demo-relevant control lives in the application itself — a correct `role`, a meaningful accessible name (the visible, localized label, or an i18n-driven `aria-label` where there is no text), and a stable `data-testid`. The "catalogue" is a **generated index** of those annotations, written under `demos/catalog/elements.json` and never hand-edited.

**Rationale**:
- A catalogue maintained beside the app is a second source of truth that drifts on every UI change. Deriving it from the app means it cannot drift, and diffs in the index surface UI changes in review.
- The existing codebase already leans this way: 115 `data-testid` and 197 `aria-label` occurrences in `frontend/src` + `frontend/plugins`, i18n labels in `frontend/src/i18n/locales/en.json` (for example `play_score.toolbar.play_aria` → `"Play"`), and an e2e suite that already resolves controls by `getByTestId`/`getByRole`.
- Doing it as real semantics (not test-only hooks) is an accessibility improvement for the tablet-first app, so the work has value beyond demos.

**Alternatives considered**:
- *Hand-maintained catalogue file*: rejected — drift and maintenance; the second source of truth is the problem being removed.
- *Test-only hooks (add `data-testid` everywhere, ignore ARIA)*: rejected — no accessibility payoff and role+name lookups stay unreliable, so duplicate/rendered labels cannot be disambiguated.
- *Live DOM only*: rejected as the sole source — it needs the app running on every request and yields no reviewable artifact.

---

## D2. Hybrid lookup: source scan first, live accessibility snapshot on demand

**Decision**: Build the index by scanning the frontend source (testids, ARIA roles/labels) and the existing e2e specs. Allow an **optional** enrichment from a live accessibility-tree snapshot of the running app (via the repo's existing Playwright) for controls the static scan cannot see.

**Rationale**:
- The source scan is instant and needs no running app, so it keeps the common path inside the ten-second budget.
- Runtime-only controls (rendered or dynamically labelled) need the accessibility tree; Playwright is already a dependency of `demos/`, so the cost is a captured page, not a new tool.
- Each index entry records its `source` (`annotation` | `e2e` | `snapshot`), so precision is auditable.

**Alternatives considered**:
- *Live snapshot only*: rejected — app-startup cost on every lookup and no reviewable artifact (see D1).
- *Source scan only*: rejected — misses runtime-only controls; the spec's US2 acceptance 4 (waits for content) and duplicate-label cases need the real tree.

---

## D3. A step resolves only on an unambiguous match

**Decision**: A goal phrase resolves to a control only when it maps to exactly one index entry. Ambiguous, missing, or multi-match phrases produce an **unresolved step** with the reason and the nearest candidate controls. No selector is ever emitted from a low-confidence guess.

**Rationale**:
- This is the spec's stated bottleneck (US2) and the basis of SC-003 ("zero unresolved steps as guessed selectors"). A plausible-but-wrong selector fails later during capture and costs more than an honest gap.
- It makes acceptance testing crisp: a generated flow either points at a real, unique control or is explicitly flagged.

**Alternatives considered**:
- *Best match above a threshold*: rejected — a threshold that fills more steps also emits wrong ones, which is the failure mode being removed.
- *Always fill, mark low confidence*: rejected — looks resolved when it is not and hides the gap the author needs to close.

---

## D4. Where the pieces live: `demos/` TypeScript tooling plus a documented skill

**Decision**: The deterministic pieces — index build, lookup, flow assembly, report — live in the `demos/` harness in TypeScript. The agent-facing *workflow* is documented as a new skill, `.agents/skills/graditone-demo-authoring`, alongside the existing `graditone-demo-videos` runbook.

**Rationale**:
- Reusing the `demos/` harness means the tooling shares the existing `Flow`/`FlowStep` types and the same Node toolchain (Node 22.18+, type stripping) with no new package and no build step.
- The generation is agent-driven (spec Clarifications), so the reproducible part is the *procedure*: a skill that tells the agent which CLI to call and in what order, while the lookup stays small, deterministic, and testable.
- Splitting authoring (`graditone-demo-authoring`) from capturing (`graditone-demo-videos`) keeps each skill focused and matches how the repo already documents agent workflows.

**Alternatives considered**:
- *A separate tool package*: rejected — a new package/build step for a repo-local tool; the `demos/` harness is the natural home.
- *Extend `graditone-demo-videos` only*: rejected — that skill is the capture runbook; mixing authoring in makes both harder to follow.
- *A pure script with no skill*: rejected — the workflow is agent-driven and needs the procedure documented to be reproducible (FR-001).

---

## D5. Annotation convention: correct semantics, not fabricated handles

**Decision**: For each demo-relevant control, use a correct `role` and a meaningful accessible name (the visible localized label, or `aria-label` from i18n when there is no text), plus a stable `data-testid`. Do **not** repurpose `aria-roledescription`/`aria-description` to carry "capability" prose.

**Rationale**:
- Screen readers must benefit; fabricated accessible names or prose in ARIA attributes can confuse assistive technology. The handle the lookup wants (role + name + testid) is exactly the standard semantic surface.
- i18n already supplies the names (`en.json`), so annotating mostly means filling gaps and adding testids where the current selector relies on a class or `:has-text` (for example `.score-selector-item__btn:has-text("Für Elise")`).

**Alternatives considered**:
- *Capability strings in `aria-description`*: rejected — misuse of ARIA; risks confusing AT and duplicates the visible text.
- *Testid-only*: rejected — loses the semantic name needed to disambiguate duplicate labels.

---

## D6. Enforcement: an e2e coverage guard plus a static check

**Decision**: Guard the annotations with a Playwright spec that asserts each demo-relevant control resolves by role+name and carries its testid, and a static check (`frontend/scripts/check-demo-annotations.mjs`) that fails when an annotated control loses a handle. Wire the static check into `frontend` lint/CI where a cheap gate is wanted.

**Rationale**:
- A guard converts the annotation set into a ratchet: coverage cannot silently regress (FR-017, SC-009), which is what makes the derived index trustworthy over time.
- The e2e check exercises the rendered tree (roles/names as the lookup sees them); the static check is fast and catches removals without a browser.

**Alternatives considered**:
- *No guard*: rejected — the whole value rests on annotations staying correct.
- *`eslint-plugin-jsx-a11y` alone*: reasonable complementary tooling, but it checks general accessibility, not "demo-relevant coverage", so it cannot be the specific gate.

---

## D7. The ten-second budget is measured end-to-end

**Decision**: SC-001 is measured from goal submission to the flow file being written, for the representative goal set (the two existing flows plus ~3 new goals). The Generation Report records the elapsed time and, to keep the budget honest, the deterministic lookup time separately.

**Rationale**:
- The spec fixes the budget as submission → file written (FR-004). Because generation is agent-driven, the model's own latency is part of that wall-clock; keeping the tool calls sub-second bounds the non-model part and makes any miss attributable.
- Recording both numbers means a missed target can be diagnosed (lookup vs. model) rather than guessed.

**Alternatives considered**:
- *Measure only the deterministic part*: rejected — it would report a budget nobody experiences and hide the model cost.

---

## D8. Index artifact: generated, cacheable, not hand-maintained

**Decision**: `demos/catalog/elements.json` is produced by `catalog:build`. It may be cached and (optionally) committed for fast, reviewable lookups, but its content is always reproducible from the annotations and is never edited by hand.

**Rationale**:
- The determinism and reviewability of a committed file are useful; making it authoritative by hand is not. Reproducible-from-source keeps D1 intact while allowing a fast, diffable cache.
- If committed, the annotation-coverage guard plus a `catalog:build` diff check can assert the file is current.

**Alternatives considered**:
- *Commit as the authoritative artifact*: rejected — recreates the second-source-of-truth problem.
- *Never materialize it*: rejected — a cache makes lookups instant and diffs reviewable at negligible cost.
