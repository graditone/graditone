# Implementation Plan: Rapid Demo Flow Generation from a Goal

**Branch**: `102-demo-flow-generation` | **Date**: 2026-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/102-demo-flow-generation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Give demo authors a fast, agent-driven way to turn a plain-language goal into a runnable `demos/flows/<id>.yaml` in under ten seconds, grounded on the app's own accessibility surface instead of a hand-maintained selector catalogue. The application's demo-relevant controls are annotated with a correct `role`, a meaningful accessible name, and a stable `data-testid`; a **derived element index** is generated from those annotations plus the existing e2e specs (optionally enriched from a live accessibility-tree snapshot). A fast, deterministic **lookup tool** lets the demo agent (following a documented skill) map each goal phrase to a real control, order the steps with the waits/captions/holds the video needs, and write the flow plus a **generation report**. A step resolves only on an unambiguous match; anything ambiguous or missing is flagged with candidate controls — never a guessed selector.

The flow format, the step vocabulary, the runner, and the video pipeline are unchanged: the deliverable is the same YAML the existing `node demos/src/run.ts` command already consumes. The only application change is annotation of the controls the demos use, protected by an automated guard so coverage cannot silently regress.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict). The `demos/` harness is TypeScript run directly by Node 22.18+ (type stripping; `erasableSyntaxOnly`, `verbatimModuleSyntax`, explicit `.ts` imports). The frontend is React 19 + TypeScript.
**Primary Dependencies**: `demos/` — Playwright 1.64 (already present; used for the optional accessibility snapshot), `yaml` 2.8. `frontend/` — React 19, Vite 7, Vitest 4, `@testing-library/react` 16, happy-dom. No new runtime dependency is added to the app.
**Storage**: Files only, under `demos/` — the generated element index (JSON) and the flow YAML. No database, no IndexedDB, no localStorage, no user state.
**Testing**: Vitest + React Testing Library for the index builder, matcher, flow assembly, and report units; Playwright (frontend e2e) for the annotation-coverage guard and the representative goal set; `demos` `npm run typecheck` (`tsc --noEmit`) for harness types.
**Target Platform**: Developer tooling — a Node CLI run from a workstation or CI — plus the tablet PWA being annotated (iPad/Surface/Android tablets, modern browsers).
**Project Type**: Monorepo. This feature touches `frontend/` (annotations + guard), `demos/` (index, lookup, generation, report), and `.agents/skills/` (the documented workflow). The Rust/WASM backend is not touched.
**Performance Goals**: A complete flow draft in under ten seconds from goal submission to file written (SC-001), for the representative goal set; index build and lookup each complete in well under a second so they do not dominate the budget; zero added runtime cost to the app from the annotations.
**Constraints**: The flow format, the step vocabulary/attributes, and the video pipeline MUST be unchanged (FR-002, FR-014); only demo-relevant controls are annotated (Assumptions); no hand-maintained catalogue; the app gains no new runtime dependency; annotations MUST be real accessibility improvements (correct semantics), not fabricated handles; the primary demo language is English, and stable handles are preferred over label text.
**Scale/Scope**: The demo catalogue — the two existing flows (`play-a-score`, `play-a-score-tempo`) plus about three new single-plugin goals (SC-001); the annotation set is the controls those journeys touch (plugin launcher, score selection, the play-score toolbar, and the shared tempo widget).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / plan |
|-----------|--------|-----------------|
| I. Domain-Driven Design | PASS | The tooling concept model is explicit and consistently named — Demo Goal, Flow Document, Flow Step, Control Catalogue (a *derived index*), Element Binding, Generation Report — and mirrors the spec's Key Entities. Tooling vocabulary is kept out of the app domain; the frontend change is markup only. |
| II. Hexagonal Architecture | PASS | The index builder, lookup, flow assembly, and report are pure TypeScript/Node with no framework coupling; they read the app's rendered contract (role/name/testid), they do not embed domain logic. No backend change. The frontend edit is presentation-layer annotation. |
| III. Progressive Web Application Architecture | PASS | Annotations are static markup with no runtime dependency and no network/offline impact; the generation tooling runs entirely locally (source scan), and the optional snapshot uses the repo's existing Playwright. Client-side processing only. |
| IV. Precision & Fidelity | PASS | Not applicable to score timing: this feature deals with control selectors, not pulses. Nothing here changes PPQ, pulse arithmetic, or timeline structures. |
| V. Test-First Development | PASS | The index builder, matcher, flow assembly, report, CLI lookup, and the annotation guard are written as failing tests first (files listed under Project Structure and Phases A–E). Existing flows' continued execution is covered by an explicit regression test. |
| VI. Layout Engine Authority | PASS | No spatial geometry is computed. Annotations add semantic attributes only; the index and matcher read DOM attributes and never calculate coordinates, spacing, or hit-testing. |
| VII. Regression Prevention | PASS | The two existing flows MUST keep running unchanged (FR-014, SC-007) — a regression test runs them as-is. The annotation guard fails when a demo-relevant control loses its role/name/testid. The known `demos-runner-port-detection` debt is worked around in the quickstart (manual dev server + `DEMO_BASE_URL`). |
| VIII. User Profile Awareness | PASS | No new user-specific storage, setting, key, or record; annotations are static and identical for all profiles; the profile icon and per-profile state are untouched. |

**Post-design re-check (Phase 1)**: All gates still pass. The design adds no runtime dependency, no storage scope, no score-layout logic, and no backend work. The `Complexity Tracking` table is therefore not required.

## Project Structure

### Documentation (this feature)

```text
specs/102-demo-flow-generation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── annotation-contract.md          # what a demo-relevant control MUST expose
│   ├── element-index-contract.md       # the derived index format
│   └── generation-report-contract.md   # the per-run report format
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### Source Code (repository root)

```text
demos/
├── src/
│   ├── catalog/                       # NEW: the derived element index
│   │   ├── schema.ts                  #    index types (Catalog, CatalogEntry, Source)
│   │   ├── build.ts                   #    scan frontend annotations + e2e specs → index
│   │   ├── snapshot.ts                #    optional live accessibility-tree snapshot (Playwright)
│   │   ├── lookup.ts                  #    phrase → ranked candidate controls (unambiguous-only)
│   │   ├── build.test.ts              #    unit tests (builder)
│   │   └── lookup.test.ts             #    unit tests (matcher)
│   ├── generate/                      # NEW: assemble a flow from resolved steps
│   │   ├── flow.ts                    #    build a Flow Document (id/title/description/steps)
│   │   ├── report.ts                  #    build the Generation Report
│   │   ├── flow.test.ts               #    unit tests (flow assembly)
│   │   └── report.test.ts             #    unit tests (report)
│   ├── tools/
│   │   ├── build-index.ts             # NEW: CLI — (re)build the index
│   │   └── find-element.ts            # NEW: CLI — resolve one phrase to candidates
│   ├── flows/                         # EXISTING flows (unchanged)
│   ├── runner.ts, run.ts, types.ts    # EXISTING harness (unchanged; regression-tested)
│   └── catalog/elements.json          # GENERATED index (not hand-edited)
├── package.json                       # NEW scripts: catalog:build, catalog:find
└── README.md                          # Document the authoring workflow + new commands

frontend/
├── src/components/LandingScreen.tsx               # plugin launcher cards: role + name + testid
├── src/components/TempoMetronomeControl.tsx       # tempo −/display/+ : role + name + testid
├── src/components/plugins/ScoreSelectorPlugin.tsx # score rows: add stable handle + accessible name
├── plugins/play-score/playbackToolbar.tsx         # Play/Stop accessible names (from i18n)
├── e2e/annotation-coverage.spec.ts                # NEW guard: demo-relevant controls resolvable
└── scripts/check-demo-annotations.mjs             # NEW lint: static annotation coverage check

.agents/skills/graditone-demo-authoring/           # NEW documented Generation Workflow
└── SKILL.md                                        #    goal → lookup → steps → flow → report

DEBT.md, FEATURES.md                               # documentation currency at completion
```

**Structure Decision**: The application's annotations are the single source of truth; the "catalogue" is therefore a **generated index**, written under `demos/catalog/elements.json` and never hand-edited. Keeping the deterministic pieces (index build, lookup, flow assembly, report) inside the `demos/` harness in TypeScript lets them reuse the existing `Flow`/`FlowStep` types and run with the same Node toolchain that already executes the runner, with no new dependency. The agent-facing behaviour is documented as a dedicated skill (`.agents/skills/graditone-demo-authoring`) so the *workflow* is reproducible while the *lookup* stays a small, testable, sub-second CLI. The frontend change is deliberately limited to annotating the controls the demos actually use, plus an automated guard, so the app's runtime and its accessibility stay correct rather than test-specific.

## Implementation Phases

### Phase A — Index schema and builder (tests first)

1. Define `demos/src/catalog/schema.ts`: `CatalogEntry` (see [data-model.md](./data-model.md)) and `Catalog` (entries + build metadata: source revision, built-at, sources used).
2. Implement `demos/src/catalog/build.ts`: scan `frontend/src` and `frontend/plugins` for `data-testid`, `aria-label`, and `role` in the demo-relevant components, plus the selector patterns in `frontend/e2e/*.spec.ts`, and emit index entries with `{role, name, testid, screen, source}`.
3. Written first: `build.test.ts` covering testid extraction, aria-label/role pairing, screen attribution, duplicate-label entries, and a stable, sorted output.

### Phase B — Lookup tool (tests first)

1. Implement `demos/src/catalog/lookup.ts`: given a phrase, return ranked candidate entries, and mark the result ambiguous when more than one entry matches (FR-006).
2. Implement `demos/src/tools/find-element.ts` (CLI) and `build-index.ts` (CLI); add `catalog:build` / `catalog:find` scripts to `demos/package.json`.
3. Written first: `lookup.test.ts` for exact-testid hits, role+name hits, no-match (reason + nearest candidates), and the ambiguous case (must NOT auto-resolve).

### Phase C — Flow assembly and report (tests first)

1. Implement `demos/src/generate/flow.ts`: assemble a `Flow Document` from resolved steps — assign a non-colliding `id`, derive `title`/`description` from the goal, keep the existing step vocabulary and add caption/hold where a state change or wait must be seen (FR-002, FR-003, FR-009, FR-011, FR-012).
2. Implement `demos/src/generate/report.ts`: emit the Generation Report (elapsed time, step counts, resolved/unresolved with targets and candidates) (FR-013).
3. Written first: `flow.test.ts` (valid flowchart shape, id-collision avoidance, wait insertion) and `report.test.ts`; validate emitted YAML by parsing it back through the existing `yaml` loader and the `Flow` type.

### Phase D — Frontend annotations and guard

1. Annotate the demo-relevant controls in `LandingScreen.tsx`, `TempoMetronomeControl.tsx`, `ScoreSelectorPlugin.tsx`, and `playbackToolbar.tsx`: ensure each exposes a correct `role`, a meaningful accessible name (localized visible text or an i18n-driven `aria-label`), and a stable `data-testid`. [annotation-contract.md](./contracts/annotation-contract.md) is the checklist.
2. Written first: `frontend/e2e/annotation-coverage.spec.ts` asserts each demo-relevant control resolves by role+name and carries its testid; `frontend/scripts/check-demo-annotations.mjs` is a static gate that fails when an annotated control loses a handle.
3. Update i18n `en.json`/`es.json` only where a name is missing; `locales.test.ts` parity must pass.

### Phase E — Documented Generation Workflow and representative set

1. Author `.agents/skills/graditone-demo-authoring/SKILL.md`: the human/agent steps — interpret the goal, resolve each step through `catalog:find`, order steps with waits/captions/holds, write the flow, emit the report, hand off to the existing video command. Link the `graditone-demo-videos` runbook for capture/verification.
2. Define the representative goal set: upgrade the two existing flows' targets to the annotated handles where needed, and add ~3 new single-plugin goals covering a resolved journey, a wait-heavy journey, and a goal with one unresolvable step.
3. Update `demos/README.md` with the new commands and the workflow pointer; update `FEATURES.md` if the accessibility change is user-visible.

### Phase F — Verification

1. Run the focused units first, then `cd demos && npm run typecheck`, `cd frontend && npm test -- --run`, `cd frontend && npm run lint`, and `cd frontend && npx playwright test e2e/annotation-coverage.spec.ts`.
2. Run the representative set end-to-end per [quickstart.md](./quickstart.md): measure generation time (SC-001) and first-attempt capture success (SC-002), and confirm `node demos/src/run.ts <id>` still runs the two existing flows unchanged (SC-007).
3. Confirm no new runtime dependency, no backend diff, and no new profile-scoped storage.

## Risks and Mitigations

- **Source scan misses runtime-only controls** (rendered/dynamic labels): the index records `source: 'annotation'` vs `'snapshot'`; the optional Playwright accessibility snapshot ([snapshot.ts](../../demos/src/catalog/snapshot.ts)) enriches entries the static scan cannot see. Prefer testid/role over label so a miss is rare.
- **Accessible names are localized**: matching prefers `data-testid` and `role`+screen; name matching is a secondary signal and is tested in English. A non-English goal that depends on label text is reported, not silently resolved (spec edge case).
- **Duplicate labels** ("Play" on several surfaces): every entry carries its owning `screen`/`plugin`; an ambiguous hit is flagged with candidates rather than resolved (FR-006, US2 acceptance 3).
- **Agent latency threatens the ten-second budget**: the deterministic parts (build, lookup) are sub-second and cached; the budget is measured end-to-end from submission to file written, as SC-001 states. If the model's own latency dominates in practice, the report records the breakdown so the target can be judged honestly; the plan keeps the workflow tool-driven so latency stays bounded.
- **Annotation drift as the frontend evolves**: the annotation-coverage e2e spec plus the static check fail on regression (FR-017, SC-009); the index is regenerated from the annotations, so it cannot drift independently.
- **Accidental change to the video pipeline**: `demos/src/runner.ts` and the `Flow` types are not edited; a regression test runs the existing flows unchanged.
- **Dev-server port collision** (known debt `demos-runner-port-detection`): the quickstart documents the manual dev-server + `DEMO_BASE_URL` path, so the representative runs do not depend on `ensureServer`'s hardcoded 5174.

## Complexity Tracking

> No constitution violations. No new projects, dependencies, services, or storage scopes are introduced.
