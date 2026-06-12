---
applyTo: "frontend/plugins/practice-view-plugin/**"
---

# Practice View Plugin — Copilot Instructions

When working on any file under `frontend/plugins/practice-view-plugin/`, follow these rules:

## Architecture — read ARCHITECTURE.md first

The full architecture is at `frontend/plugins/practice-view-plugin/ARCHITECTURE.md`. Read it before making changes.

## File ownership (DDD)

- **`useFreePractice.ts`** — ALL free practice state and logic (Feature 092). Never add free practice state directly to `PracticeViewPlugin.tsx`.
- **`useSavedPracticeManager.ts`** — ALL saved practice CRUD, task config, navigation data (Features 056/060/061). Never add save/load logic to the orchestrator.
- **`freePractice.helpers.ts`** — pure functions only, no React. Keep it React-free.
- **`PracticeViewPlugin.tsx`** — thin orchestrator. Should stay under ~1000 lines. Never put domain logic here; wire existing hooks instead.

## Free practice timing — critical invariant

Timing MUST be deferred to the first MIDI note. `freeSessionActiveRef = true` arms the session. The actual clock, elapsed timer, and display origin start in the MIDI attack handler when `freeSessionStartedRef.current === false`. Never call `startMeasureClock()` from Start button / `handlePracticeToggle` / `handleRepractice`.

## WASM layout engine — explicit rests required

`computeLayout` in `PluginStaffViewer.tsx` does NOT auto-fill gaps. You MUST pass explicit `rest_events` for every gap. `decomposeGapRests()` handles this. The legato pass (extend notes to fill gaps < 960 ticks) runs before the rest computation.

## Build in worktree

`frontend/node_modules` does not exist in the worktree. To build, copy files to the main repo at `/Users/alvaro.delcastillo/devel/graditone` and run `cd frontend && npm run build`. Restore after.

## Commits

Always use `git commit --no-verify` in the worktree (pre-commit hook is broken outside the main repo).

## Constants

- WASM PPQ: 960 ticks per quarter note
- 4/4 measure: 3840 ticks (`WASM_MEASURE_TICKS`)
- Free practice BPM default: 120 (from `MetronomeContext.DEFAULT_BPM`)
- Legato gap threshold: 960 ticks (1 quarter note)
