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
- Pure state machine `practiceEngine.ts`: `reduce(state, action)` with `START`, `CORRECT_MIDI`, `WRONG_MIDI`, `STOP`, `DEACTIVATE`, `SEEK` — covered by 24 unit tests (TDD)

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
| `specs/037-practice-view-plugin/` | Full spec suite + Phase 8 amendment |

## Test Results

- **304 Rust backend tests** — all passing
- **1312 frontend unit tests** — all passing
- **49 Playwright E2E tests** — all passing
- **Plugin unit tests** — 72 passing
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

52 tasks completed (T001–T052) across 8 phases.
See `specs/037-practice-view-plugin/tasks.md` for full task list.

## Notes

- The closed-source plugin implementation lives in `aylabs/musicore-closed-plugins` at commit `eb27f93`. This PR carries all host-side concerns: Plugin API surface, infrastructure improvements, `ChordDetector`, and spec artefacts.
- `ChordDetector` is placed in `frontend/src/utils/` (not inside `plugin-api/types.ts`) so the canonical implementation is accessible to non-plugin host code; the re-export in `index.ts` makes it available to all plugins without duplication.
