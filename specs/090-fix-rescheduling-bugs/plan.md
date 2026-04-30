# Implementation Plan: Fix Rescheduling Bugs (087 Follow-up)

**Branch**: `090-fix-rescheduling-bugs` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/090-fix-rescheduling-bugs/spec.md`

## Summary

Two production bugs discovered in Feature 087 (Sessions Rescheduling):

1. **Incomplete detection** — the overdue-session detection `useEffect` runs synchronously before the async `reconcileSessionsIndex()` completes. If the localStorage index is empty (profile migration, browser cache clear), zero sessions are detected and the dialog never appears, leaving past sessions unaddressed.

2. **Wrong dialog theme and inaccurate info** — the reschedule overlay CSS is missing `background: rgba(0,0,0,0.45)` (semi-transparent backdrop present on all other modal overlays), and `goalCount` in the dialog body is calculated as unique-goal count (`Set.size`) instead of goal-linked session count (`.length`).

Both bugs are pure-frontend, self-contained to `plugins-external/sessions-plugin/`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React, Vitest, @testing-library/react (existing test stack)  
**Storage**: IndexedDB (full `Session` objects) + localStorage (lightweight `SessionIndexEntry[]` index)  
**Testing**: Vitest + @testing-library/react; run with `npm test` in `plugins-external/sessions-plugin/`  
**Target Platform**: Tablet-optimised PWA (Chrome/Safari/Edge on iPad, Surface, Android tablets)  
**Project Type**: External plugin (`plugins-external/sessions-plugin/`) — no backend or WASM changes  
**Performance Goals**: Dialog must appear within 1 second of Sessions view open (SC-001); detection is O(n) over the session index  
**Constraints**: Offline-first; profile-scoped storage (Principle VIII); no network calls; regression tests required before each fix (Principle VII)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | Bug fixes stay within `rescheduleEngine.ts` and `SessionsPlugin.tsx/css`; no new domain abstractions |
| II. Hexagonal Architecture | ✅ PASS | No backend changes; plugin boundary unchanged |
| III. PWA Architecture | ✅ PASS | No manifest or service-worker changes |
| IV. Precision & Fidelity | ✅ N/A | No timing/PPQ concerns in UI bug fixes |
| V. Test-First Development | ✅ REQUIRED | Failing regression tests must be written for both bugs before fixing them |
| VI. Layout Engine Authority | ✅ N/A | No spatial/coordinate changes |
| VII. Regression Prevention | ✅ REQUIRED | Both bugs are production-discovered; tests go in before fixes |
| VIII. User Profile Awareness | ✅ PASS | All storage paths already profile-scoped; no new storage keys introduced |

**Gate result**: ✅ No violations. Safe to proceed to research.

## Project Structure

### Documentation (this feature)

```text
specs/090-fix-rescheduling-bugs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no new entities — changes only)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

> No `contracts/` directory — this bug fix modifies no public API surface. The reschedule engine public API shape is unchanged.

### Source Code (repository root)

```text
plugins-external/sessions-plugin/
├── SessionsPlugin.tsx        # MODIFIED: merge detection into refreshSessions effect
├── SessionsPlugin.css        # MODIFIED: add backdrop to reschedule overlay
├── SessionsPlugin.test.tsx   # MODIFIED: add regression test for detection timing + dialog info
├── rescheduleEngine.ts       # MODIFIED: (possibly minor) no logic change expected
└── rescheduleEngine.test.ts  # MODIFIED: add regression test for goalCount accuracy
```

**Structure Decision**: Single external plugin directory. All changes are confined to `plugins-external/sessions-plugin/`. No graditone core (`frontend/`, `backend/`) files are modified.
