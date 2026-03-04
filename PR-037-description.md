## Summary

Implement the **Practice View Plugin** — an external MIDI step-by-step practice plugin delivered via `plugins-external/practice-view-plugin/`. Users load a score, select a staff (Treble, Bass, or **Both Clefs**), press Practice, and advance through the score one note (or chord) at a time by playing the correct MIDI input. Simultaneously adds plugin infrastructure improvements (glob-based built-in discovery, Remove Plugin dialog) and a reusable `ChordDetector` utility exposed through the Plugin API. See `specs/037-practice-view-plugin/`.

## What's Included

### Plugin API v6 (T011–T019)
- New `PluginPracticeNoteEntry` type: `midiPitches[]`, `noteIds[]`, `tick`
- `extractPracticeNotes(staffIndex, maxCount?)` — groups simultaneous notes at the same tick into one entry; excludes rests
- `staffCount: number` added to `ScorePlayerState`
- Train View plugin migrated to v6 API

### External Plugin Scaffold (T001–T022)
- `plugins-external/practice-view-plugin/` package: `package.json`, `plugin.json`, `tsconfig.json`, `vite.config.ts`, `build.sh`
- Zero imports from `frontend/plugins/play-score/` or host internals — all via Plugin API

### Practice Toolbar & Engine (T025–T030)
- Full toolbar: Back, Play/Pause/Stop, Timer, Tempo, Metronome, Staff selector, Practice button
- Staff selector shows Treble Clef / Bass Clef / Staff N / **Both Clefs** (`value=-1`) for multi-staff scores
- Pure state machine `practiceEngine.ts`: `reduce(state, action)` with `START`, `CORRECT_MIDI`, `WRONG_MIDI`, `STOP`, `DEACTIVATE`, `SEEK` — covered by 34 unit tests (TDD)
- Practice button disabled when MIDI connection is known absent (`midiConnected === false`); enabled during pending check (`null`); tooltip shown on disabled state (FR-016)

### MIDI Step Practice & Seek (T031–T038)
- Practice mode highlights current target note via `ScoreRenderer.highlightedNoteIds`
- MIDI subscription dispatches `CORRECT_MIDI` / `WRONG_MIDI` per event
- No-MIDI notice when no device is connected (FR-012)
- Short-tap seek during active practice dispatches `SEEK` without exiting mode (FR-010)

### Pin / Loop Region
- Long-press pin state machine mirrors play-score (loopStart, loopEndPin)
- Loop region wraps practice: correct note at loop end seeks back to loop start
- Green pins hidden during active practice + loop

### Chord Detection — All Notes Required (T045–T051, Phase 8 amendment)
- `ChordDetector` class in `frontend/src/utils/chordDetector.ts`
- Accumulates MIDI attacks within an 80 ms rolling window; `complete` only when **all** required pitches pressed
- Re-exported via Plugin API (`frontend/src/plugin-api/index.ts`) — no mirror copy required in plugins
- 14 unit tests
- MIDI handler uses `ChordDetector.press()` — partial chord presses are silent (no wrong-note penalty while collecting remaining fingers)

### Results Overlay (T053–T056)
- `NoteOutcome` (`correct` | `correct-late` | `wrong`) and `PracticeNoteResult` per-note record added to engine state
- `LATE_THRESHOLD_MS = 500` — notes played >500 ms after their beat position are `correct-late`
- `WRONG_MIDI` now increments `currentWrongAttempts`; `CORRECT_MIDI` appends a `PracticeNoteResult` and resets the counter
- Session score: `((correct + late × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)`, clamped 0–100
- Overlay shows: dynamic score ring with colour-coded grade (Perfect / Great / Good / Keep Practising), 4-stat row (Notes / Correct / Late / Wrong), practice time vs. score time comparison, collapsible per-note detail table with outcome row colours
- Overlay dismissed via × or backdrop; Practice button available to restart

### Deferred Start, Phantom Highlights & Delay Graph (T057–T059)
- Practice timer stays in `'waiting'` mode until the user plays their first correct MIDI note — no pressure to start immediately
- "Waiting for first note…" status copy shown in toolbar during `waiting` mode
- Phantom tempo highlight (amber, 50% opacity) advances at the configured BPM, giving a visual tempo reference while the user's green target stays pinned at the current note
- Results overlay now includes a per-note **delay evolution SVG graph**: X-axis = note index, Y-axis = timing delta (ms); early notes shown in green, late in amber
- `delayDeltaMs = responseTimeMs − expectedTimeMs` stored per `PracticeNoteResult`

### MIDI Hotplug Fix (T060)
- Root cause: `navigator.requestMIDIAccess()` returns the same `MIDIAccess` singleton; multiple hook instances assigning `onstatechange` silently overwrote each other
- Fix: switched both `useMidiInput.ts` and `PracticeViewPlugin.tsx` to `addEventListener('statechange', …)` / `removeEventListener` cleanup
- `mockMidi.ts` updated with `addEventListener`/`removeEventListener` support; `useMidiInput.test.ts` cleanup assertion updated

### Auto-Scroll Follows User Target Note (T061)
- During practice, the phantom advances `highlightedNoteIds`, so `ScoreViewer` auto-scroll was tracking the wrong note
- New optional `scrollTargetNoteIds?: ReadonlySet<string>` prop on `PluginScoreRendererProps` flows through `ScoreRendererPlugin → LayoutView → ScoreViewer`
- `ScoreViewer.scrollToHighlightedSystem()` prefers `scrollTargetNoteIds` when present — scroll now tracks the green target note (user position)
- `PracticeViewPlugin` passes `scrollTargetNoteIds={practiceActive ? targetNoteIds : undefined}`

### Both Clefs Mode (T052)
- Staff selector "Both Clefs" option (`value=-1`) merges all staves by tick
- `mergePracticeNotesByTick()` helper unions pitches at the same tick across staves
- `ChordDetector` then requires every cross-staff pitch within the 80 ms window

### Plugin Infrastructure Improvements
- `builtinPlugins.ts` uses `import.meta.glob` for auto-discovery of both `core` and `common` plugins
- `frontend/plugins/.gitignore` prevents symlinked external plugins from being committed
- `PluginRemoverDialog` + `−` button in App.tsx for removing user-imported plugins
- `tsconfig.app.json` / `vitest.config.ts` exclude symlinked external plugins from host build/test

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/plugin-api/types.ts` | v6 additions: `PluginPracticeNoteEntry`, `staffCount`, updated `extractPracticeNotes` signature |
| `frontend/src/plugin-api/scorePlayerContext.ts` | v6 implementation |
| `frontend/src/plugin-api/index.ts` | Re-export `ChordDetector`, `ChordDetectorOptions`, `ChordResult` |
| `frontend/src/utils/chordDetector.ts` | New — reusable chord detection utility |
| `frontend/src/utils/chordDetector.test.ts` | New — 14 unit tests |
| `frontend/src/services/plugins/builtinPlugins.ts` | `import.meta.glob` auto-discovery |
| `frontend/src/components/plugins/PluginRemoverDialog.tsx` | New — Remove Plugin dialog |
| `frontend/src/App.tsx` | `PluginRemoverDialog` + `−` button; V3PluginWrapper for common plugins |
| `frontend/tsconfig.app.json` | Exclude symlinked external plugins |
| `frontend/vitest.config.ts` | Exclude symlinked external plugin tests |
| `frontend/plugins/.gitignore` | New — prevent symlinks from being committed |
| `frontend/plugins/train-view/exerciseGenerator.ts` | v6 migration (`midiPitches[0]`) |
| `frontend/plugins/train-view/exerciseGenerator.test.ts` | Updated tests |
| `frontend/src/services/recording/useMidiInput.ts` | Fix: `addEventListener` instead of `onstatechange` assignment |
| `frontend/src/services/recording/useMidiInput.test.ts` | Updated cleanup test for addEventListener-based handler |
| `frontend/src/test/mockMidi.ts` | Added `addEventListener`/`removeEventListener` support to MockMidiAccess |
| `frontend/src/plugin-api/types.ts` | `scrollTargetNoteIds` prop on `PluginScoreRendererProps` |
| `frontend/src/components/plugins/ScoreRendererPlugin.tsx` | Forward `scrollTargetNoteIds` to LayoutView |
| `frontend/src/components/layout/LayoutView.tsx` | Forward `scrollTargetNoteIds` to ScoreViewer |
| `frontend/src/pages/ScoreViewer.tsx` | `scrollToHighlightedSystem()` prefers `scrollTargetNoteIds` for scroll targeting |
| `plugins-external/practice-view-plugin/practiceEngine.types.ts` | `'waiting'` mode + `delayDeltaMs` on `PracticeNoteResult` |
| `plugins-external/practice-view-plugin/practiceEngine.ts` | Deferred start reducer: `START → waiting`, first `CORRECT_MIDI → active` |
| `plugins-external/practice-view-plugin/PracticeViewPlugin.tsx` | Phantom highlights, deferred start wiring, `scrollTargetNoteIds`, delay delta payload |
| `plugins-external/practice-view-plugin/PracticeViewPlugin.css` | Phantom opacity rule + delay graph styles |
| `plugins-external/practice-view-plugin/practiceEngine.test.ts` | 3 new deferred-start tests (92 total passing) |
| `specs/037-practice-view-plugin/` | Full spec suite + Phase 8–10 amendments |

## Test Results

- **304 Rust backend tests** — all passing
- **1312 frontend unit tests** — all passing
- **49 Playwright E2E tests** — all passing
- **Plugin unit tests** — 89 passing
- **Plugin bundle** — 7 KB (limit: 50 KB) ✅

## Success Criteria Met

| Criterion | Status |
|-----------|--------|
| SC-001: Load to first MIDI advance in ≤ 4 steps | ✅ |
| SC-002: Correct MIDI → highlight advances within 100 ms | ✅ |
| SC-003: Correct/incorrect detection for single notes, chords, all octaves | ✅ |
| SC-004: Practice toggle is instantaneous | ✅ |
| SC-005: Plugin bundle ≤ 50 KB (actual: 7 KB) | ✅ |
| SC-006: Clean teardown on unmount (stopPlayback + MIDI unsubscribe) | ✅ |

## Tasks

56 tasks completed (T001–T056) across 9 phases.
See `specs/037-practice-view-plugin/tasks.md` for full task list.

### MIDI hotplug fix
- `useMidiInput.ts` and plugin MIDI detection both called `requestMIDIAccess()` which returns the **same singleton** `MIDIAccess` object — assigning `onstatechange` on one overwrote the other's handler, and cleanup (`onstatechange = null`) killed MIDI detection permanently until browser restart
- Fix: both now use `addEventListener('statechange', ...)` / `removeEventListener(...)` supporting multiple concurrent listeners
- `MockMidiAccess` test infrastructure updated to support `addEventListener`/`removeEventListener`

## Notes

- The closed-source plugin implementation lives in `aylabs/musicore-closed-plugins` at commit `343c79b`. This PR carries all host-side concerns: Plugin API surface, infrastructure improvements, `ChordDetector`, MIDI fix, and spec artefacts.
- `ChordDetector` is placed in `frontend/src/utils/` (not inside `plugin-api/types.ts`) so the canonical implementation is accessible to non-plugin host code; the re-export in `index.ts` makes it available to all plugins without duplication.
