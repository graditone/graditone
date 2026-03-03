# Quickstart: Practice View Plugin (External)

**Feature**: `037-practice-view-plugin`  
**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-03

---

## Prerequisites

- Node.js 20+ and npm
- A MIDI device (hardware or virtual, e.g. [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) on Windows, or IAC Driver on macOS)
- The Musicore host app running locally (`cd frontend && npm run dev`)

---

## 1. Scaffold the plugin package

```bash
# From repo root
cp -r plugins-external/virtual-keyboard-pro plugins-external/practice-view-plugin
cd plugins-external/practice-view-plugin

# Clear VKPro source files (keep config files)
rm -f VirtualKeyboardPro.tsx VirtualKeyboardPro.test.tsx VirtualKeyboardPro.css index.tsx
```

Update `package.json` name:
```json
{ "name": "practice-view-plugin" }
```

Update `plugin.json`:
```json
{
  "id": "practice-view-plugin",
  "name": "Practice View",
  "version": "1.0.0",
  "pluginApiVersion": "6",
  "entryPoint": "index.js",
  "description": "MIDI-driven step-by-step score practice. Select a staff and press each note on your MIDI device to advance.",
  "type": "common",
  "view": "window"
}
```

Install dependencies:
```bash
npm install
```

---

## 2. Plugin API v6 — host-side changes first

Before writing plugin code, the Plugin API v6 extension in the host must be implemented and tested. This is required because the plugin imports from `../../frontend/src/plugin-api/index`.

**Files to update in the host (`frontend/`):**

1. `frontend/src/plugin-api/types.ts`
   - Add `staffCount: number` to `ScorePlayerState`
   - Add `PluginPracticeNoteEntry` type
   - Update `PluginScorePitches.notes` to `ReadonlyArray<PluginPracticeNoteEntry>`
   - Update `extractPracticeNotes` signature: `(staffIndex: number, maxCount?: number)`
   - Bump `PLUGIN_API_VERSION` from `'5'` to `'6'`

2. `frontend/src/plugin-api/scorePlayerContext.ts`
   - Update `extractPracticeNotesFromScore()` helper to accept `staffIndex`
   - Return all chord pitches (not just max) with noteIds and tick
   - Populate `staffCount` in the state broadcast

3. `frontend/src/plugin-api/scorePlayerContext.test.ts`
   - Add / update tests for the new signature (write tests first — Principle V)

4. **Train view plugin migration** — `frontend/plugins/train-view/` uses `extractPracticeNotes`
   - Update destructuring from `.midiPitch` to `.midiPitches[0]` (or the max pitch if chord)
   - Update mock data in Train view tests to use new shape

**Verify** before starting plugin development:
```bash
cd frontend && npm test -- --run scorePlayerContext
```

---

## 3. Run the dev harness

```bash
cd plugins-external/practice-view-plugin
npm run dev          # Starts Vite dev server for the plugin
npm run dev:import   # Watch-imports the plugin into the host (in another terminal)
```

In a third terminal:
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` — the Practice View plugin should appear in the navigation.

---

## 4. Write practiceEngine tests FIRST (Principle V)

Create `practiceEngine.test.ts` with failing tests before writing any implementation:

```bash
touch practiceEngine.types.ts    # empty — just the type exports
touch practiceEngine.ts          # empty — just export {}
touch practiceEngine.test.ts     # write tests here
```

Minimum test cases (all should FAIL before implementation):
- `START` with one note → `mode === 'active'`, `currentIndex === 0`
- `CORRECT_MIDI` with matching pitch → `currentIndex++`
- `CORRECT_MIDI` on last note → `mode === 'complete'`
- `WRONG_MIDI` with non-matching pitch → `currentIndex` unchanged
- `STOP` → `mode === 'inactive'`, `currentIndex === 0`
- `DEACTIVATE` → `mode === 'inactive'`, `currentIndex` preserved
- Chord: any pitch in `midiPitches` is correct
- `SEEK(index)` → `currentIndex === index`

Run tests to confirm red:
```bash
npm test -- --run practiceEngine
```

Implement `practiceEngine.ts`, then run again to confirm green.

---

## 5. Build the plugin

```bash
cd plugins-external/practice-view-plugin
npm run build
# Output: dist/index.js
```

Load the built plugin in the host by pointing the plugin loader to `dist/index.js`.

---

## 6. Run the full test suite

```bash
# Plugin tests
cd plugins-external/practice-view-plugin && npm test

# Host plugin-api tests (verify v6 extension)
cd frontend && npm test -- --run plugin-api
```

---

## Key Implementation Notes

### Highlighting the target note (Principle VI)

```tsx
// CORRECT — pass noteIds to ScoreRenderer, let the host handle rendering
const targetNoteIds = useMemo(
  () => practiceState.mode === 'active'
    ? new Set(practiceState.notes[practiceState.currentIndex].noteIds)
    : scorePlayerState.highlightedNoteIds,
  [practiceState, scorePlayerState.highlightedNoteIds]
);

<ScoreRenderer
  currentTick={scorePlayerState.currentTick}
  highlightedNoteIds={targetNoteIds}
  ...
/>

// WRONG — never calculate positions in plugin code
// const x = note.tick * pixelsPerTick;  ← Principle VI violation
```

### MIDI matching

```ts
// In context.midi.subscribe handler:
function handleMidiEvent(event: PluginNoteEvent) {
  if (event.type !== 'attack') return;
  if (practiceStateRef.current.mode !== 'active') return;

  const target = practiceStateRef.current.notes[practiceStateRef.current.currentIndex];
  const isMatch = target.midiPitches.includes(event.midiNote);  // exact match, octave matters
  dispatch(isMatch ? { type: 'CORRECT_MIDI' } : { type: 'WRONG_MIDI' });
}
```

### Staff selector

```tsx
// Show staff selector only when staffCount > 1 AND a score is loaded
{scorePlayerState.staffCount > 1 && (
  <StaffSelector
    staffCount={scorePlayerState.staffCount}
    selectedIndex={selectedStaff.index}
    onChange={(index) => setSelectedStaff({ index })}
    disabled={practiceState.mode === 'active'}
  />
)}
```

### Cleanup on unmount (FR-013)

```ts
// In index.tsx dispose():
dispose() {
  context.stopPlayback();
  _context = null;
}

// In PracticeViewPlugin useEffect:
useEffect(() => {
  const unsubMidi = context.midi.subscribe(handleMidiEvent);
  const unsubPlayer = context.scorePlayer.subscribe(setScorePlayerState);
  return () => {
    unsubMidi();
    unsubPlayer();
  };
}, [context]);
```

---

## Checklist before PR

- [ ] `practiceEngine.test.ts` was written before `practiceEngine.ts` (Principle V gate)
- [ ] No `(x, y)` coordinate calculations anywhere in `plugins-external/practice-view-plugin/` (Principle VI gate)
- [ ] No imports from `frontend/src/components/`, `src/services/`, `src/wasm/`, or `frontend/plugins/play-score/`
- [ ] `plugin.json` declares `"pluginApiVersion": "6"`
- [ ] MIDI subscription unsubscribed in cleanup (`useEffect` return or `dispose()`)
- [ ] `context.stopPlayback()` called in `dispose()`
- [ ] Staff selector hidden when `staffCount === 1`
- [ ] Practice mode deactivates on `Stop` press and on plugin close
- [ ] Train view plugin updated to use `midiPitches[0]` (or max) instead of `midiPitch`
- [ ] Host `PLUGIN_API_VERSION` bumped to `'6'`
- [ ] All tests pass: `npm test` in both `plugins-external/practice-view-plugin/` and `frontend/`
