# Hook Contracts: Practice Plugin Modules

This directory defines the TypeScript interface contracts for each extracted hook/component.
Since this is a pure frontend refactoring (no REST/GraphQL APIs), the "contracts" are
TypeScript interfaces specifying the input/output boundaries of each module.

## Files

- `usePracticeLoop.d.ts` — Loop region hook contract
- `usePracticeMidi.d.ts` — MIDI subscription hook contract
- `usePhantomTempo.d.ts` — Phantom tempo hook contract
- `useHoldProgress.d.ts` — Hold progress hook contract
- `usePracticeHighlights.d.ts` — Highlight computation hook contract
- `ResultsOverlay.d.ts` — Results overlay component contract

## Contract Rules

1. Each hook MUST accept a single params object and return a single result object (FR-010)
2. Refs returned to the orchestrator MUST use `React.RefObject<T>` (read-only) unless the orchestrator needs to mutate (FR-014)
3. No hook may import another hook — only the orchestrator imports all hooks (FR-011)
4. All types referenced here are either from `practiceEngine.types.ts` or defined locally in the hook file
