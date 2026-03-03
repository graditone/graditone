# Research: Practice View Plugin (External)

**Feature**: `037-practice-view-plugin`  
**Phase**: 0 — Outline & Research  
**Date**: 2026-03-03

All findings are derived from direct codebase inspection (`frontend/src/plugin-api/types.ts`, `plugins-external/virtual-keyboard-pro/`, `frontend/plugins/play-score/`, and `specs/033–036`).

---

## R-001: Plugin API v6 — Staff-Aware Note Extraction with Note IDs

**Unknown resolved**: Can the existing `extractPracticeNotes(maxCount)` support feature 037's staff-selection requirement and highlighting?

**Decision**: Plugin API v6 extension required — two additive changes to `PluginScorePlayerContext`.

**Finding**:
- Current `extractPracticeNotes(maxCount: number)` in v5 (`types.ts` line 475) always extracts from `instruments[0].staves[0].voices[0]`.
- The returned type `PluginScorePitches.notes` is `ReadonlyArray<{ midiPitch: number }>` — no `noteId`, no `tick`.
- Feature 037 requires:
  1. **Staff selection**: user can choose Treble (staves[0]) or Bass (staves[1]) before entering Practice mode.
  2. **Note IDs**: the plugin must pass a `noteId` to `ScoreRenderer.highlightedNoteIds` to display the practice target highlight. Without note IDs in the extraction result, the plugin cannot identify which score element to highlight.

**Solution**: Extend `extractPracticeNotes` signature to `extractPracticeNotes(staffIndex: number, maxCount?: number)` and add `noteId: string` and `tick: number` to each item in the returned array.

**Rationale**: Smallest possible API change; fully backward-compatible with v5 (only a new overload with an added first parameter needed); `noteId` is an opaque string that does not cross the Principle VI geometry boundary (it carries no (x,y) data).

**Alternatives considered**:
- *Deduce noteId from tick seeking*: Plugin calls `seekToTick(targetTick)` and reads `ScorePlayerState.highlightedNoteIds` — rejected because it conflates "current playback position" with "practice target note" and would cause the score to visually seek on every MIDI press.
- *Re-use `onNoteShortTap` noteId*: The plugin learns note IDs only after the user taps each note — rejected because all note IDs must be known upfront to build the ordered note list before Practice mode begins.

---

## R-002: Target Note Highlighting Mechanism

**Unknown resolved**: How does the plugin highlight the current practice target note in the `ScoreRenderer`?

**Decision**: Plugin passes its own `ReadonlySet<string>` containing the target note's `noteId` to `ScoreRenderer.highlightedNoteIds`, overriding the `ScorePlayerState.highlightedNoteIds` value while in Practice mode.

**Finding**:
- `PluginScoreRendererProps` (types.ts line 488) accepts `highlightedNoteIds: ReadonlySet<string>`.
- In the Play Score plugin, this prop is fed from `ScorePlayerState.highlightedNoteIds` (populated by the playback engine at the current tick).
- In Practice mode, the `PracticeViewPlugin` maintains its own `practiceHighlight: ReadonlySet<string>` state (containing the current target's noteId) and conditionally passes this to `ScoreRenderer` instead of the playback state set.
- When Practice mode is inactive, the plugin reverts to passing `ScorePlayerState.highlightedNoteIds`.

**Rationale**: Clean, no API changes beyond R-001. The `highlightedNoteIds` distinction is handled entirely inside the plugin's React component.

---

## R-003: Staff Count — ScorePlayerState v6 Addition

**Unknown resolved**: How does the plugin know how many staves are in the loaded score (to show/hide the staff selector)?

**Decision**: Add `staffCount: number` to `ScorePlayerState` as a v6 addition.

**Finding**:
- `ScorePlayerState` (types.ts line 361) currently carries `status`, `currentTick`, `totalDurationTicks`, `highlightedNoteIds`, `bpm`, `title`, `error`, `timeSignature`.
- No `staffCount` field exists.
- The plugin needs to know `staffCount` to decide whether to show the staff-selector step before Practice mode: if `staffCount === 1`, skip selection and use `staffIndex = 0` automatically.

**Solution**: Add `readonly staffCount: number` to `ScorePlayerState` (0 when idle/loading; populated after `status === 'ready'`). The host computes this during `loadScore` from the parsed score's staff list.

**Alternatives considered**:
- *Infer from extraction side-effect*: Call `extractPracticeNotes(0)` and `extractPracticeNotes(1)` and check which returns null — rejected as semantically confusing and requiring an additional API call just to discover structure.
- *Hardcode 2-staff assumption*: Pipe/Grand staff scores always have 2 staves — rejected because solo instrument scores have 1 staff and the check would fail.

---

## R-004: External Plugin Toolchain

**Unknown resolved**: What build toolchain, config files, and package structure does the external plugin require?

**Decision**: Mirror `plugins-external/virtual-keyboard-pro/` exactly.

**Findings from inspection**:

| File | Source | Notes |
|------|--------|-------|
| `package.json` | Mirror VKPro | Replace `virtual-keyboard-pro` name; same React/Vitest/Vite/TS devDeps |
| `plugin.json` | Mirror VKPro | `pluginApiVersion: '6'`; `type: 'common'`; `view: 'window'` |
| `tsconfig.json` | Mirror VKPro | Standard React/JSX config |
| `vite.config.ts` | Mirror VKPro | Single-file bundle → `dist/index.js` |
| `vite.config.dev.mts` | Mirror VKPro | Dev mode with HMR; serve from `dev/` |
| `build.sh` | Mirror VKPro | `vite build` wrapper |
| `vitest.setup.ts` | Mirror VKPro | `@testing-library/jest-dom` setup |
| `index.tsx` | Mirror VKPro | `init`/`dispose`/`Component` pattern |

Import path for Plugin API types: `../../frontend/src/plugin-api/index` (identical to VKPro's resolved relative path from `plugins-external/practice-view-plugin/`).

**Rationale**: Identical toolchain avoids configuration drift; eases onboarding for plugin developers familiar with VKPro.

---

## R-005: MIDI Note Matching Logic

**Unknown resolved**: What exactly constitutes a "match" in Practice mode, and how are chords handled?

**Decision**: Exact MIDI note number match (integer equality, octave matters). For chords, any one note in the chord's pitch set is sufficient to advance.

**Findings**:
- `PluginNoteEvent.midiNote: number` (integer 0–127) is delivered by `context.midi.subscribe`.
- Practice mode responds only to `event.type === 'attack'`; `'release'` events are ignored.
- **Single notes**: `event.midiNote === targetNote.midiPitch` → advance.
- **Chords**: the host's `extractPracticeNotes(staffIndex)` will return one `PracticeNoteEntry` per simultaneous-note group (chord), carrying the *full set* of pitches for that position (see R-001 data model). The plugin checks if `event.midiNote` is contained in `targetNote.midiPitches` (a `ReadonlyArray<number>`).
- **Incorrect pitch**: `event.midiNote` not in target → no advance, no state change (per FR-007, spec clarification Q4).
- **Rests**: rests are excluded by `extractPracticeNotes` at the host layer; the plugin never sees them in the ordered list.

**Rationale**: Exact matching is explicitly chosen (clarification session Q4). Chord handling (any pitch in the chord) is explicitly specified in FR-015. Keeping rest-skipping at the host layer maintains the Plugin API's geometry / data boundary (rests in the score have layout data the plugin should not reason about).

**Edge case — chord data model change**: The current `extractPracticeNotes` for Feature 034 keeps only `max(midiNote)` per chord (per `types.ts` line 258: "Chords: maximum pitch across simultaneous notes at the same start_tick is kept"). Feature 037 needs **all pitches** in the chord, not just the maximum. The v6 extension must change this to return a full pitch array per position. This is a data-model change from `{ midiPitch: number }` to `{ midiPitches: ReadonlyArray<number>, noteIds: ReadonlyArray<string>, tick: number }`.

---

## R-006: Feature 034 `extractPracticeNotes` Chord Behaviour Mismatch

**Unknown resolved**: Is Feature 034's chord extraction compatible with Feature 037's "any chord pitch advances" requirement?

**Decision**: Chord extraction must change — v6 `extractPracticeNotes` returns ALL pitches per chord position, not just the maximum.

**Finding**:
- Feature 034 intentionally retains only `max(midiNote)` per chord for its exercise generator (simple exercise notes).
- Feature 037 requires matching ANY note in the chord (FR-015) — so all pitches must be available at the plugin layer.
- This is a breaking change to `PluginScorePitches.notes` item shape (from `{ midiPitch }` to `{ midiPitches, noteIds, tick }`).
- However, Feature 034 (`034-practice-from-score` plugin, the Train view) is the only plugin calling `extractPracticeNotes`. Its usage is `extractPracticeNotes(8)` for exercise generation, converting only `midiPitch` values. Updating the shape requires updating the Train view plugin as well.

**Scope decision**: The v6 data model change is additive (rename `midiPitch → midiPitches: ReadonlyArray<number>`, add `noteIds`, `tick`); Feature 034 Train view plugin migration is a prerequisite task in Feature 037 or an explicit dependency. Because it's a critical path item, it MUST be included as a task.

**Rationale**: Keeping v6 fully backward-compatible with v5\'s single-note shape (via `midiPitches[0]` for the max-pitch case) is not necessary — the Train view plugin is in-repo and can be updated atomically in the same PR. Clean data model is preferable.

---

## R-007: Staff Selector UX — Where and When

**Unknown resolved**: When exactly does the staff-selector UI appear?

**Decision**:
- If `ScorePlayerState.staffCount === 1`: no selector shown; Practice mode starts directly on staff 0.
- If `ScorePlayerState.staffCount > 1`: inline selector within the toolbar (shown alongside the Practice button) appears when the score is loaded (before Practice mode is activated). The selected staff is remembered for the session; switching staff resets the practice position if Practice mode is currently active.
- The selector is part of `practiceToolbar.tsx` (plugin-owned component), not a host-provided component.

**Rationale**: Staff selection is a plugin-specific concern unrelated to score playback; it does not warrant a new host component. Inline toolbar placement keeps the UI compact on tablet screens.

---

## Summary of v6 API Additions

| Addition | Where | Description |
|----------|-------|-------------|
| `ScorePlayerState.staffCount` | `frontend/src/plugin-api/types.ts` | Number of staves in the loaded score (0 when idle) |
| `extractPracticeNotes(staffIndex: number, maxCount?: number)` | `PluginScorePlayerContext` | Extract notes from the specified staff index |
| `PluginPracticeNoteEntry` | New type | `{ midiPitches: ReadonlyArray<number>; noteIds: ReadonlyArray<string>; tick: number }` — replaces `{ midiPitch: number }` in v5 |
| `PluginScorePitches.notes` (shape change) | Existing type | Items are now `PluginPracticeNoteEntry` instead of `{ midiPitch: number }` |
| `PLUGIN_API_VERSION` bump | `types.ts` | `'5'` → `'6'` |

**Migration impact**: Only the Train view plugin (`plugins-external/virtual-keyboard-pro/` is unaffected; `frontend/plugins/train-view/` must be updated to destructure `midiPitches[0]` instead of `midiPitch`).
