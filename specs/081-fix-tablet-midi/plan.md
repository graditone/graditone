# Implementation Plan: Fix MIDI Detection in Tablet in Practice Mode

**Branch**: `081-fix-tablet-midi` | **Date**: 2026-04-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/081-fix-tablet-midi/spec.md`

## Summary

The MIDI connectivity indicator in `PracticeViewPlugin` calls `requestMIDIAccess()` without a timeout, a proper rejection handler, or a fallback for browsers where the Web MIDI API is absent. On tablets, where permission prompts are slow or the API is unsupported, `midiConnected` stays stuck at `null` indefinitely. The fix extracts the connectivity check into a dedicated `useMidiConnectivity` hook with an 8-second timeout, a catch handler, and an explicit `supported` flag, then threads `midiSupported` to `practiceToolbar` to show a clear "MIDI not supported" message when the API is unavailable.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vitest  
**Primary Dependencies**: React hooks, Web MIDI API (`navigator.requestMIDIAccess`), `@testing-library/react` (renderHook)  
**Storage**: N/A  
**Testing**: Vitest + `@testing-library/react`; existing MIDI mock infrastructure at `frontend/src/test/mockMidi.ts`  
**Target Platform**: Tablet devices (Chrome on Android, desktop-mode Chrome on iPad); fix must not regress desktop Chrome/Edge  
**Project Type**: Web (PWA) — frontend only  
**Performance Goals**: MIDI state resolves in ≤8s on all supported tablet browsers; unsupported state resolves synchronously (≤2s per SC-004)  
**Constraints**: Must NOT clobber `useMidiInput`'s `statechange` listener (use `addEventListener`, not `onstatechange` assignment); must NOT change note-event subscription path (`usePracticeMidi` / `useMidiInput`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ Pass | No domain model changes; purely infrastructure fix |
| II. Hexagonal Architecture | ✅ Pass | No backend changes; frontend hook is a pure adapter |
| III. PWA Architecture | ✅ Pass | Fix targets tablet Chrome; offline behavior unaffected |
| IV. Precision & Fidelity | ✅ Pass | Not timing-related (MIDI note events untouched) |
| V. Test-First Development | ✅ Pass | `useMidiConnectivity.test.ts` written before implementation |
| VI. Layout Engine Authority | ✅ Pass | No layout changes |
| VII. Regression Prevention | ✅ Pass | Existing `PracticeViewPlugin.test.tsx` + toolbar tests kept green |
| VIII. User Profile Awareness | ✅ Pass | MIDI state is ephemeral (not persisted); no profile scoping needed |

Post-design re-check: **PASS** — no new gates opened by Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/081-fix-tablet-midi/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

No external contracts directory — this fix is purely internal to the frontend PWA.

### Source Code (frontend — web application)

```text
frontend/
├── plugins/
│   └── practice-view-plugin/
│       ├── useMidiConnectivity.ts        ← NEW: hook with timeout/catch/unsupported
│       ├── useMidiConnectivity.test.ts   ← NEW: TDD tests
│       ├── PracticeViewPlugin.tsx        ← MODIFY: use useMidiConnectivity()
│       ├── practiceToolbar.tsx           ← MODIFY: add midiSupported prop
│       └── practiceToolbar.test.tsx      ← MODIFY: add unsupported state tests
└── src/
    └── i18n/
        └── locales/
            ├── en.json                   ← MODIFY: add midi_not_supported key
            └── es.json                   ← MODIFY: add midi_not_supported key (ES)
```

**Structure Decision**: Frontend-only web application change. Backend untouched. No new top-level directories.

## Complexity Tracking

No constitution violations — this is a targeted bug fix with no architectural deviation.
