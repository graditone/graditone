## Summary

Introduce **Plugin API v6** and the supporting host-side changes required by the
**Practice View Plugin** (Feature 037) — an external full-screen score player
with MIDI step-by-step practice mode distributed as a separate ZIP package in
`musicore-closed-plugins`. See `specs/037-practice-view-plugin/`.

## What's Included

### Plugin API v6 (types.ts + scorePlayerContext.ts)

- **`PluginPracticeNoteEntry`** — replaces the v5 `{ midiPitch: number }` item
  shape in `PluginScorePitches.notes`:
  - `midiPitches: ReadonlyArray<number>` — all pitches at the tick (chord support)
  - `noteIds: ReadonlyArray<string>` — opaque IDs parallel to `midiPitches` for
    passing directly to `ScoreRenderer.highlightedNoteIds`
  - `tick: number` — absolute 960-PPQ tick for seeking
- **`PluginScorePitches.notes`** changed from `ReadonlyArray<{ midiPitch }>` →
  `ReadonlyArray<PluginPracticeNoteEntry>`
- **`ScorePlayerState.staffCount`** — number of staves in the loaded score
  (0 while idle/loading/error)
- **`extractPracticeNotes(staffIndex, maxCount?)`** — now takes an explicit
  `staffIndex` parameter; collects all chord pitches at each tick (no longer
  keeping only the highest)
- `scorePlayerContext.ts` and tests updated to implement the new contract

### App.tsx — V3PluginWrapper for common plugins (bug fix)

v3+ `common`-type plugins were rendered via bare `<PluginView>` so
`scorePlayerRef.current` stayed on the `createNoOpScorePlayer()` stub forever.
`getCatalogue()` returned `[]` and `loadScore()` was a no-op.

Fix: detect `pluginApiVersion >= 3` for common plugins and wrap them with
`<V3PluginWrapper>` + a dedicated `proxyRefs` entry, matching the existing
treatment of `core` plugins.

### Train View — exerciseGenerator migration

`exerciseGenerator.ts` and its tests updated to consume the new
`PluginPracticeNoteEntry` shape: `p.midiPitches[0]` instead of `p.midiPitch`.
No behavioural change for the Train plugin (single-pitch access path preserved).

### Spec — specs/037-practice-view-plugin/

Full specification suite for the Practice View Plugin:
`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `research.md`,
`quickstart.md`, `contracts/`, `checklists/`.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/plugin-api/types.ts` | v6 API additions |
| `frontend/src/plugin-api/scorePlayerContext.ts` | v6 implementation |
| `frontend/src/plugin-api/scorePlayerContext.test.ts` | v6 test coverage |
| `frontend/src/plugin-api/metronomeContext.test.ts` | minor test fix |
| `frontend/src/App.tsx` | V3PluginWrapper for common v3+ plugins |
| `frontend/plugins/play-score/PlayScorePlugin.tsx` | minor compatibility fix |
| `frontend/plugins/train-view/TrainPlugin.tsx` | minor compatibility fix |
| `frontend/plugins/train-view/exerciseGenerator.ts` | midiPitches[0] migration |
| `frontend/plugins/train-view/exerciseGenerator.test.ts` | updated tests |
| `specs/037-practice-view-plugin/` | full spec suite (new) |

## Compatibility

- All existing plugins (`play-score`, `train-view`, `virtual-keyboard-pro`,
  `virtual-keyboard`) continue to work unchanged.
- The `exerciseGenerator` change is API-compatible: it reads `midiPitches[0]`
  which is identical to the old `midiPitch` for single-note entries.
- Plugin API version constant bumped to `"6"`.
