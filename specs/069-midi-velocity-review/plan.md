# Implementation Plan: Review MIDI Keys Velocity

**Branch**: `069-midi-velocity-review` | **Date**: 2026-04-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/069-midi-velocity-review/spec.md`

## Summary

Add velocity, MIDI channel, and raw byte display to the Recording view's note history. `MidiNoteEvent` already captures all required data (`velocity`, `channel`, `noteNumber`) — none reaches the UI because `handleMidiNoteOn` strips them when building `NoteOnset`. The core change is: extend `NoteOnset` with optional MIDI fields, populate them in `RecordingView.handleMidiNoteOn`, display them in `NoteHistoryList`, and add a proportional CSS velocity bar. P4 (raw bytes + CC log) adds `rawBytes` forwarding and a parallel CC event list. All changes are frontend-only; the WASM/Rust backend is untouched.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19  
**Primary Dependencies**: React 19, Vite 5, Vitest 2, @testing-library/react 16, @testing-library/jest-dom  
**Storage**: N/A — in-memory React state only; no IndexedDB or localStorage changes  
**Testing**: Vitest 2 + @testing-library/react 16 in `frontend/` workspace (`npm run test:run`)  
**Target Platform**: Tablet PWA (iPad/Surface/Android, Chrome 57+/Safari 11+); Recording view is gated behind `?debug=true` URL param  
**Project Type**: Web application (frontend/src changes only — no backend, no WASM, no sessions-plugin)  
**Performance Goals**: 60 fps; SC-005 requires responsiveness at ≥50 notes/second with full MIDI detail rendered  
**Constraints**: `NoteOnset` additions must be optional/backward-compatible (mic input path creates `NoteOnset` without MIDI fields — `undefined` is the mic-path value); no spatial coordinate calculations in renderer (Principle VI)  
**Scale/Scope**: 5 source files + 2 test files changed; no new routes, no new services, no new IndexedDB stores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-Driven Design | `MidiNoteEvent` is a first-class domain entity with velocity/channel already modeled. Extending `NoteOnset` follows ubiquitous language. No leakage of technical abstractions. | ✅ PASS |
| II. Hexagonal Architecture | Frontend-only change. No backend ports, adapters, or domain core touched. | ✅ PASS |
| III. PWA Architecture | Display-only UI change. No service worker, manifest, or offline storage affected. Aligns with tablet-first interactive score goal. | ✅ PASS |
| IV. Precision & Fidelity | No timing changes. Velocity and channel are integers (1–127, 1–16). No floating-point introduced in domain logic. | ✅ PASS |
| V. Test-First Development | **ACTION REQUIRED**: Tests written and confirmed failing before any implementation file is changed. Red-Green-Refactor enforced for every file. | ⚠️ ENFORCE |
| VI. Layout Engine Authority | The velocity visual indicator is a CSS cosmetic transform (`width: ${v/127*100}%`). This is a display transform, NOT a spatial coordinate calculation. Principle VI permits visual transforms that do not alter logical geometry. | ✅ PASS |
| VII. Regression Prevention | No bugs are being fixed. The mic-path backward-compatibility constraint is enforced by a dedicated regression test asserting `NoteOnset` created from mic input has `velocity === undefined`. | ✅ PASS |

**Gate result**: All principles PASS. No complexity justifications required. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/069-midi-velocity-review/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── types/
│   │   └── recording.ts                        # Extend NoteOnset + MidiNoteEvent (rawBytes)
│   ├── services/recording/
│   │   ├── midiUtils.ts                        # MidiCCEvent already defined here (no changes for P1-P3)
│   │   └── useMidiInput.ts                     # Add rawBytes forwarding to MidiNoteEvent (P4); expose all CC (P4)
│   └── components/recording/
│       ├── NoteHistoryList.tsx                 # Add velocity number + visual bar + channel pill
│       ├── NoteHistoryList.test.tsx            # Update + add P1/P2/P3 tests (test-first)
│       ├── RecordingView.tsx                   # Populate velocity/channel/rawBytes in handleMidiNoteOn
│       ├── RecordingView.test.tsx              # Update handleMidiNoteOn tests + add CC log tests (P4)
│       └── RecordingView.css                   # .note-history-list__velocity-bar, .note-history-list__channel-pill
└── tests/                                      # No e2e changes required
```

**Structure Decision**: Web application (Option 2). All changes are in `frontend/src/`. No backend, WASM, or sessions-plugin changes. The mic input path (`confidence`-based `NoteOnset` with no velocity) is kept intact via optional fields.

## Complexity Tracking

> No Constitution violations — section left empty per policy.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
