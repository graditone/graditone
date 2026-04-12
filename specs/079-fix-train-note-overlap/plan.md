# Implementation Plan: Fix Train View — Wrong Note Overlap on Response Staff

**Branch**: `079-fix-train-note-overlap` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)

## Summary

In step mode, `handleStepInput` in `TrainPlugin.tsx` appends every new wrong-note event to `responseNoteEvents` without removing the previous one. Because each wrong note for the same slot shares the same `timestamp` (the slot's `expectedOnsetMs`), all entries land at the same horizontal position on the response staff and their note heads stack on top of each other. The fix replaces the current slot's entry instead of appending.

**Technical approach**: One-line change inside `setResponseNoteEvents` inside `handleStepInput`: filter out any existing event whose timestamp matches the current slot's `expectedOnsetMs` before adding the new one. This is purely additive — no other logic path is touched.

No backend, WASM, database, or CSS changes required.

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: Vitest (unit tests). React hooks (`useState`, `useCallback`).  
**Storage**: None.  
**Testing**: Vitest for unit tests. Existing test infrastructure at `frontend/plugins/train-view/TrainPlugin.test.tsx`.  
**Target Platform**: Browser PWA (Chrome 57+, Safari 11+). Client-side TypeScript only.  
**Constraints**: ESLint boundary — `TrainPlugin.tsx` and its test MUST NOT import from `src/services/`, `src/components/`, or `src/wasm/`.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Fix operates on `responseNoteEvents`, a first-class domain value. |
| II. Hexagonal Architecture | ✅ PASS | No framework or browser API introduced. |
| III. PWA Architecture | ✅ PASS | No service worker or manifest changes. |
| IV. Precision & Fidelity | ✅ PASS | No coordinate or tick arithmetic changed. |
| V. Test-First Development | ⚠️ GATE | Regression test MUST be written and verified FAILING before the fix. |
| VI. Layout Engine Authority | ✅ PASS | No pixel calculations. |
| VII. Regression Prevention | ⚠️ GATE | Regression test MUST be committed alongside the fix. |

---

## Project Structure

### Source Code (affected files only)

```text
frontend/
└── plugins/
    └── train-view/
        ├── TrainPlugin.tsx          # handleStepInput fix — replace instead of append
        └── TrainPlugin.test.tsx     # regression test for the overlap bug
```

---

## Phases

### Phase 1: Setup — Baseline
Confirm the existing test suite passes before any changes.

### Phase 2: Regression Test (write FIRST — verify FAILING)
Add a test that exercises the step-mode wrong-note path twice for the same slot and asserts that `responseNoteEvents` contains exactly one entry.

### Phase 3: Fix
Change the `setResponseNoteEvents` call in `handleStepInput` to filter out the previous entry for the same slot timestamp before inserting the new one.

### Phase 4: Verify
Run the full Vitest suite and confirm the new test is green with no regressions.
