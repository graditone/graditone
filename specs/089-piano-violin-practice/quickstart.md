# Quickstart: Piano Practice with Violin Accompaniment Playback

**Feature**: 089-piano-violin-practice  
**Date**: 2026-04-29

---

## What This Feature Does

When a violin+piano score is loaded in the Practice plugin, the violin (and all non-piano parts) automatically play back as accompaniment during practice sessions. An independent volume slider in the Practice plugin's toolbar lets the student balance the accompaniment against their piano feedback.

**Before this feature**: Only the piano part is played back (for note detection feedback). In a violin+piano sonata, the student practices in silence without the violin melody.

**After this feature**: The violin plays back automatically. A volume slider lets the student set accompaniment to 0–100% (default 70%).

---

## How to Verify It Works

1. Open the Practice plugin.
2. Load a score with both violin and piano parts (e.g. `Beethoven_FurElise.mxl` does NOT have violin — use a violin+piano sonata score).
3. The Practice toolbar now shows an **Accompaniment** volume slider.
4. Press play — the violin part plays back automatically.
5. Adjust the slider — the violin gets louder/quieter without affecting piano note detection.
6. Load a piano-only score — the slider disappears (FR-008).

---

## Architecture Overview

```
Practice plugin (PracticeViewPlugin.tsx)
  └── useAccompaniment(scorePlayer)
        ├── scorePlayer.getInstruments()     → PluginInstrumentInfo[]  [NEW v11]
        ├── derives: accompanimentParts, hasAccompaniment
        └── setVolume(v) → scorePlayer.setPartVolume(partIndex, v)  [NEW v11]
                              └── ToneAdapter.getChannel(partIndex).setVolume(v)
                                    └── Tone.Volume node (per instrument)

Practice toolbar (practiceToolbar.tsx)
  └── <AccompanimentVolumeSlider>  [NEW — rendered only when hasAccompaniment=true]
```

---

## Key Files

| File | Status | Purpose |
|------|--------|---------|
| `frontend/src/plugin-api/types.ts` | MODIFY | Add `PluginInstrumentInfo` type, extend `PluginScorePlayerContext` with `getInstruments()` + `setPartVolume()` (v11) |
| `frontend/src/plugin-api/scorePlayerContext.ts` | MODIFY | Implement `getInstruments()` + `setPartVolume()` |
| `frontend/plugins/practice-view-plugin/useAccompaniment.ts` | CREATE | Hook: detects accompaniment parts, manages volume |
| `frontend/plugins/practice-view-plugin/AccompanimentVolumeSlider.tsx` | CREATE | Component: volume slider in toolbar |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | MODIFY | Wire `useAccompaniment`, pass props to toolbar |
| `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` | MODIFY | Render `AccompanimentVolumeSlider` |

---

## Adding a New Test Score

To test with a violin+piano score during development:

1. Add a MusicXML file with violin and piano parts to `scores/` (or use an existing score in the preloaded catalogue that contains both instruments).
2. Check instrument types are correctly identified: open DevTools, run `getInstruments()` via the practice plugin and inspect the console output (available in dev builds).
3. Verify `hasAccompaniment === true` and the slider appears.

---

## Volume Control Behaviour

| Scenario | Volume state |
|----------|-------------|
| Page reload | Reset to 70% (default) |
| Score change (same page session) | Preserved (carries over) |
| Practice stop/restart | Preserved (volume is on audio node, not playback state) |
| Staff filter change (one-hand mode) | Unaffected — orthogonal to accompaniment volume |

---

## Constitution Notes

- **Principle V (TDD)**: Tests are written *before* implementation. See `useAccompaniment.test.ts` and `AccompanimentVolumeSlider.test.tsx`.
- **Principle VIII**: Accompaniment volume is page-session transient — no `localStorage` key added. Profile scoping is not required.
- **Principle VI**: No coordinate calculations anywhere in this feature. The slider is a CSS flex element.
- **Principle II**: All cross-boundary calls go through `PluginScorePlayerContext`. The hook never imports `ToneAdapter` directly.
