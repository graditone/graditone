# Implementation Plan: Fix Practice Mode MIDI Detection

**Branch**: `001-fix-practice-midi-detection` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-fix-practice-midi-detection/spec.md`

## Summary

Two independent MIDI detection bugs in the practice mode frontend layer prevent students from advancing through practice sessions containing two-hand chords or staccato chords.

**Bug 1 — HL+HR chord retry blocked after early release**: When the user enters 'holding' mode for a two-hand chord and releases a key before the hold threshold (`EARLY_RELEASE`), the `ChordDetector` instance is reset. The pin logic re-populates it using notes from the *previous* entry that are still held — but NOT notes from the *current* entry that are still physically held. When the user re-presses only the released hand, the detector never completes because the still-held notes from the other hand are not counted. The session becomes permanently stuck on that beat.

**Bug 2 — Staccato chords never advance**: Staccato notes have their `durationTicks` halved in `extractPracticeNotes()`, but this still results in a positive hold requirement (e.g., ~375 ms at 80 BPM for a staccato quarter note). Staccato playing style involves key-hold durations of ~50–100 ms. `EARLY_RELEASE` fires almost immediately every time the user correctly plays a staccato chord, returning the engine to 'active' mode on the same note. This repeats indefinitely; the session never advances past staccato beats.

**Technical approach**: Both bugs are confined to the frontend TypeScript layer. The fixes touch:
1. `PracticeViewPlugin.tsx` — broaden the ChordDetector pin logic after EARLY_RELEASE.
2. `scorePlayerContext.ts` — change staccato `durationTicks` from `× 0.5` to `= 0`.
3. `practiceEngine.ts` (and types) — add auto-advance after configurable consecutive wrong-note threshold.

No backend, WASM, or database changes are required.

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: Web MIDI API (browser built-in, no npm package), Vitest (unit tests), Playwright (E2E), React hooks (`useRef`, `useEffect`, `useReducer`).  
**Storage**: N/A — no persistence changes.  
**Testing**: Vitest for unit tests; Playwright for E2E. Existing test infrastructure at `frontend/plugins/practice-view-plugin/*.test.tsx` and `frontend/src/**/*.test.ts`.  
**Target Platform**: Browser PWA on tablet devices (Chrome 57+, Safari 11+). All changes are client-side TypeScript.  
**Project Type**: Web application (frontend only).  
**Performance Goals**: No new performance constraints. Chord grouping and pin logic are O(n) per MIDI event; hold-timer runs on rAF at 60 fps. No regressions expected.  
**Constraints**: Principle VI — no coordinate arithmetic. All changes operate on integer MIDI pitches (0–127), integer tick values, and boolean flags only.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | All domain entities (Beat, ChordDetector, DetectionState) are already first-class. New `'auto-advanced'` outcome and `consecutiveFailures` counter extend existing domain model without leaking infrastructure. |
| II. Hexagonal Architecture | ✅ PASS | Practice engine remains a pure TS reducer (no framework, no browser API). ChordDetector is a pure utility class. All browser interaction (MIDI events, rAF timer) stays in the component layer. |
| III. PWA Architecture | ✅ PASS | No changes to service worker, manifest, or offline capability. Web MIDI API is already in use. |
| IV. Precision & Fidelity | ✅ PASS | All tick arithmetic uses 960-PPQ integers. The staccato fix sets `durationTicks = 0` (integer), preserving precision. |
| V. Test-First Development | ⚠️ GATE | **Non-negotiable**: regression tests for both bugs MUST be written (failing) before implementing the fix. Plan includes red-gate test tasks first. |
| VI. Layout Engine Authority | ✅ PASS | No pixel or coordinate calculations introduced. Practice engine operates on MIDI integers and tick integers only. |
| VII. Regression Prevention | ⚠️ GATE | **Mandated**: both bugs (Issue #1 and Issue #2 in spec) MUST have failing tests created before the fix is applied. These tests remain permanently in the suite. |

**Gate result**: PASS — Principles V and VII are not violated but flag mandatory test-first workflow. No unjustified complexity violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-practice-midi-detection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── practice-engine-types.ts
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── plugins/
│   └── practice-view-plugin/
│       ├── PracticeViewPlugin.tsx         # ChordDetector pin fix (Bug 1)
│       ├── practiceEngine.ts              # Auto-advance logic, new 'auto-advanced' outcome (Bug 1 / FR-003a)
│       └── practiceEngine.types.ts        # PracticeNoteResult.outcome union extended
└── src/
    ├── plugin-api/
    │   └── scorePlayerContext.ts          # Staccato durationTicks fix (Bug 2)
    └── utils/
        └── chordDetector.ts               # (No changes required — pin logic is in the component)

tests (new or extended, per Principle VII):
frontend/
├── plugins/practice-view-plugin/
│   ├── practiceEngine.test.ts             # New: auto-advance + 'auto-advanced' outcome tests
│   └── PracticeViewPlugin.test.tsx        # New: EARLY_RELEASE pin retry test
└── src/
    └── plugin-api/
        └── scorePlayerContext.test.ts     # New: staccato durationTicks=0 test
```

**Structure Decision**: Option 2 (Web application), frontend subtree only. All changed files are within `frontend/`. No backend or WASM changes.

---

## Complexity Tracking

No constitution violations to justify. No exotic patterns introduced.

