# Implementation Plan: Live Timing Feedback Overlay

**Branch**: `096-timing-feedback-overlay` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/096-timing-feedback-overlay/spec.md`

## Summary

Add a big, theme-styled timing-feedback overlay to the live Practice view. When a note is played out of time (`correct-late` or `early-release`), a large overlay showing the signed deviation (`+120 ms`, `-80 ms`, `0 ms`) appears and fades out quickly (~1s total), updating in place on rapid misses. It is non-blocking, is styled via existing CSS custom properties, reuses Feature 095's `formatStateLabel` as the single label source, and only fires during live play (not replay, results, or free practice).

## Technical Context

**Language/Version**: TypeScript (React 18+), frontend PWA
**Primary Dependencies**: Existing practice plugin hooks (`usePracticeMidi`, `useHoldProgress`, `usePhantomTempo`), `formatStateLabel` from Feature 095 (`frontend/plugins/practice-view-plugin/stateLabel.ts`), vitest + @testing-library/react
**Storage**: N/A — presentation-only transient overlay, no persisted state
**Testing**: vitest + @testing-library/react (`PracticeViewPlugin.test.tsx`, plus a dedicated `TimingFeedbackOverlay` test); full suite + lint + `tsc -b`
**Target Platform**: Tablet devices (iPad/Android/Surface) — PWA
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: Overlay appears within the same frame the note result is recorded; full appear→hide lifecycle ~1s; no interaction jank (non-blocking, pointer-events pass-through)
**Constraints**: Must use theme custom properties (`--ls-accent`, `--ls-success`, `--color-danger`) with fallbacks; must not stack/flicker on rapid notes; must not appear during replay
**Scale/Scope**: One transient component + wiring in `PracticeViewPlugin.tsx` + CSS additions + tests. No engine/storage/API changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Domain-Driven Design** ✅ — No new domain concepts; reuses existing `NoteOutcome` (`correct-late`, `early-release`) and `relativeDeltaMs`.
- **II. Hexagonal Architecture** ✅ — Pure presentation-layer addition; no ports/adapters affected.
- **III. PWA Architecture** ✅ — No offline, service-worker, or IndexedDB impact.
- **IV. Precision & Fidelity** ✅ — Reinforces timing precision feedback with the exact signed ms deviation, consistent with Feature 095.
- **V. Test-First Development (NON-NEGOTIABLE)** ✅ — Component tests written first (format, lifecycle timing, no-stack, no-replay, theme classes), then implementation.
- **VI. Layout Engine Authority** ✅ — Not applicable; the overlay is a DOM element above the score, not notation layout.
- **VII. Regression Prevention** ✅ — Tests pin lifecycle/behaviour; reuse of `formatStateLabel` prevents label drift.
- **VIII. User Profile Awareness** ✅ — Not applicable; no profile state.

**Gate verdict: PASS — no violations. Complexity Tracking section not required.**

## Project Structure

### Documentation (this feature)

```text
specs/096-timing-feedback-overlay/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — decisions on trigger, timing, styling
├── data-model.md        # Phase 1 output — PracticeNoteResult trigger mapping (no schema change)
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/           # Phase 1 output — overlay display contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── plugins/practice-view-plugin/
│   ├── TimingFeedbackOverlay.tsx      # NEW — transient ±ms overlay component
│   ├── TimingFeedbackOverlay.test.tsx # NEW — component tests (lifecycle, format, no-stack)
│   ├── PracticeViewPlugin.tsx         # Wire overlay onto last out-of-time result
│   ├── PracticeViewPlugin.test.tsx    # Integration tests (trigger, no-replay, no-wrong)
│   ├── PracticeViewPlugin.css         # Theme-styled overlay + fade keyframes
│   └── stateLabel.ts                  # Reuse formatStateLabel (Feature 095)
├── src/
│   ├── themes/landing-themes.css      # --ls-accent / --ls-success tokens (read-only)
│   └── i18n/locales/{en,es}.json      # Reference only — overlay is numeric (no new keys)
```

**Structure Decision**: New small component (`TimingFeedbackOverlay.tsx`) + a small new hook or inline effect in `PracticeViewPlugin.tsx` that watches the latest `practiceState.noteResults` entry. No new directories, no new modules beyond the component and its test. The label formatter is reused from 095 (`stateLabel.ts`).

## Complexity Tracking

> Not required — Constitution Check passed without violations.

## Constitution Check — Post-Design

> **Re-check**: ✅ PASS — the design stays in the presentation layer (one transient component keyed off the last note result, CSS transitions, timer refs), reuses the persisted `relativeDeltaMs`/`formatStateLabel`, adds test-first coverage, and introduces no domain/storage changes.