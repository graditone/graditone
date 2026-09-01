# Implementation Plan: Practice Report Timing Labels

**Branch**: `095-state-timing-ms` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/095-state-timing-ms/spec.md`

## Summary

Improve the Score Practice View final report: in the per-note notes table, the **State/Status column** must show the timing deviation in milliseconds for out-of-time notes, formatted as a signed value (`+120 ms`, `-80 ms`, `0 ms`). The deviation already exists on every `PracticeNoteResult` as `relativeDeltaMs`; this is a **presentation-only change** in the results overlay. Out-of-tolerance notes (`correct-late`) and early-release notes keep their state meaning, icon, and now carry the signed ms amount in the label. "Correct" and "Wrong" labels are untouched. The same rendering path serves live reports and loaded saved reports, so both are covered by one change.

## Technical Context

**Language/Version**: TypeScript (React 18+), frontend PWA
**Primary Dependencies**: react-i18next (`t()` locale strings), @testing-library/react + vitest (tests), existing practice plugin infrastructure
**Storage**: N/A — no persistence change. `relativeDeltaMs` is already persisted as a field of `PracticeNoteResult` in saved practice records (`frontend/src/services/savedPractice.types.ts:66`)
**Testing**: vitest + @testing-library/react (`ResultsOverlay.test.tsx`, `PracticeViewPlugin.test.tsx`), e2e Playwright (`frontend/e2e/practice-view-plugin.spec.ts`)
**Target Platform**: Tablet devices (iPad/Android/Surface) — PWA
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: UI feedback within 16ms (60fps); this change is a string-formatting concern on an already-rendered row and adds no measurable cost
**Constraints**: Tablet-optimized; labels must render fully within the Status cell without truncation at standard tablet width; localized strings unchanged for unaffected states
**Scale/Scope**: Single UI component (`ResultsOverlay.tsx`) + tests. No engine, storage, or API changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Domain-Driven Design** ✅ — Uses existing domain vocabulary. "Out of time" maps to existing `NoteOutcome` values (`correct-late`, `early-release`); no new domain concepts introduced.
- **II. Hexagonal Architecture** ✅ — Change confined to the presentation layer (results overlay). No ports/adapters affected.
- **III. PWA Architecture** ✅ — No offline, service-worker, or IndexedDB impact.
- **IV. Precision & Fidelity** ✅ — The change *improves* precision reporting by surfacing the exact deviation in milliseconds next to the qualitative label. Sign semantics (`+` = late, `-` = early) match the existing timing-delta column.
- **V. Test-First Development (NON-NEGOTIABLE)** ✅ — Implementation driven by component tests asserting the new label composition for `correct-late`, `early-release`, and the 0 ms boundary, plus regression guards that "Correct"/"Wrong" labels are unchanged.
- **VI. Layout Engine Authority** ✅ — Not applicable; no notation/layout engine involvement.
- **VII. Regression Prevention** ✅ — `relativeDeltaMs` sign/format reuse means no drift between State label and timing-delta column; tests pin both.
- **VIII. User Profile Awareness** ✅ — Not applicable; this reports performance data for the practicing musician and involves no profile state.

**Gate verdict: PASS — no violations. Complexity Tracking section not required.**

> **Re-check after design (Phase 1):** ✅ Still PASS. The finalized design keeps the change strictly
> in the presentation layer (`ResultsOverlay.tsx` State cell + a small pure formatter), reuses the
> persisted `relativeDeltaMs` field, adds component tests (Principle V), and introduces no new
> domain concepts, storage, or ports/adapters. No violations introduced by the design.

## Project Structure

### Documentation (this feature)

```text
specs/095-state-timing-ms/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — sign/format decisions
├── data-model.md        # Phase 1 output — PracticeNoteResult usage (no schema change)
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/           # Phase 1 output — state label rendering contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── plugins/practice-view-plugin/
│   ├── ResultsOverlay.tsx            # State column label rendering (primary change)
│   ├── ResultsOverlay.test.tsx       # Component tests for the label format
│   ├── PracticeViewPlugin.test.tsx   # Existing labels regression guards (T030/T030b)
│   ├── practiceEngine.types.ts       # PracticeNoteResult.relativeDeltaMs (read-only, no change)
│   └── practiceEngine.ts             # relativeDeltaMs computation (read-only, no change)
├── src/
│   ├── i18n/locales/en.json         # practice.results.* keys (reference; no changes expected)
│   ├── i18n/locales/es.json         # practice.results.* keys (reference; no changes expected)
│   └── services/savedPractice.types.ts  # Persists noteResults incl. relativeDeltaMs (read-only)
└── e2e/practice-view-plugin.spec.ts # Optional end-to-end validation
```

**Structure Decision**: Single web-app component change inside the existing practice plugin. No new directories, no new modules. The label formatter may live inline in `ResultsOverlay.tsx` (consistent with the existing inline `formatTimeMs` helper at line 32) or be extracted as a small pure function with its own unit tests — final choice in Phase 1 research.

## Complexity Tracking

> Not required — Constitution Check passed without violations.