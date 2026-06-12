# Quickstart: Free Practice Option (Feature 092)

**Branch**: `092-free-practice-option`  
**Created**: 2026-05-31

---

## What this feature does

Adds a "Free Practice" button to the Practice plugin's score selection overlay. Clicking it enters a score-less practice session at 4/4, 80 BPM. The user plays freely; the toolbar shows elapsed time + note count. Stopping shows a simplified results overlay with Save, Replay, and Repractice actions. The button is hidden in the Play plugin's dialog.

---

## Files to change (ordered by implementation)

### 1. `frontend/src/services/savedPractice.types.ts`
- Add `'free'` to `ScoreRef.type` union
- Add optional `freeMidiRecord` field to `SavedPractice`
- Export new `FreeMidiEvent` and `FreeMidiRecord` interfaces

### 2. `frontend/src/services/savedPracticeStorage.ts`
- Add `generateFreePracticeName(date: Date): string` pure function
- Re-export from `frontend/src/plugin-api/index.ts`

### 3. `frontend/src/plugin-api/types.ts`
- Add `onFreePractice?: () => void` to `PluginScoreSelectorProps`

### 4. `frontend/src/components/plugins/ScoreSelectorPlugin.tsx`
- Accept `onFreePractice` prop
- Render "Free Practice" button in the footer area (beside "Load from file") when prop is defined

### 5. `frontend/src/i18n/locales/en.json`
- Add keys:
  - `"score_selector.free_practice"`: `"🎹 Free Practice"`
  - `"practice.free.title"`: `"Free Practice"`
  - `"practice.free.note_count"`: `"{n} notes"`
  - `"practice.results.free_elapsed"`: `"Duration"`

### 6. `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`
- Add `isFreePractice` and `freeMidiRecord` props
- When `isFreePractice`:
  - Hide score-ring, grade, accuracy breakdown, note-by-note table
  - Show elapsed time (`freeMidiRecord.elapsedMs` formatted) and note count
  - Show Save, Replay, Repractice buttons unchanged

### 7. `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`
- Add `isFreePractice`, `freeNoteCount`, `freeElapsedDisplay` props
- When `isFreePractice`:
  - Show title as `t('practice.free.title')` instead of `scoreTitle`
  - Hide play/pause buttons (disabled without a score)
  - Hide staff picker
  - Replace `X / N` progress with `{freeElapsedDisplay}` + `t('practice.free.note_count', { n: freeNoteCount })`

### 8. `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- Add state: `isFreePractice`, `freeNoteCount`, `freeMidiRecord`, `freeElapsedDisplay`
- Add refs: `freeMidiEventsRef`, `freeElapsedMsRef`, `freeElapsedIntervalRef`
- Add handler: `handleFreePractice()` — sets `isFreePractice = true`, resets accumulators
- Extend MIDI subscription: when `isFreePractice` and practice running, push events to `freeMidiEventsRef` and increment `freeNoteCount`
- Extend stop handler: when `isFreePractice`, build `FreeMidiRecord` from ref and set `freeMidiRecord` state
- Add `handleFreeSave()`: build `SavedPractice` with `scoreRef: { type: 'free', id: '' }` and `freeMidiRecord`
- Add `handleFreeReplay()`: schedule `context.playNote()` calls from `freeMidiRecord.events`
- Extend `handleRepractice()`: if `isFreePractice`, reset accumulators and restart instead of going to ScoreSelector
- Wire `onFreePractice={handleFreePractice}` into `<ScoreSelector>` call
- Extend render: when `isFreePractice`, skip `ScoreSelector`, render toolbar + results overlay

---

## Key invariants to maintain

1. When `isFreePractice === false`, all existing behaviour is identical to before.
2. The practice engine (`practiceEngine.ts`) is never started during free practice — `practiceState.mode` remains `'inactive'` throughout.
3. `scorePlayer` is never called during free practice (no `loadScore`, `play`, `pause`, `stop`).
4. `generateFreePracticeName` is a pure function — no side effects, fully unit-testable.
5. Existing saved practices load correctly because `freeMidiRecord` is optional and `undefined` on old records.

---

## Running tests

```bash
cd frontend
npx vitest run plugins/practice-view-plugin/PracticeViewPlugin.test.tsx
npx vitest run plugins/practice-view-plugin/practiceToolbar.test.tsx
npx vitest run plugins/practice-view-plugin/ResultsOverlay.test.tsx
npx vitest run src/services/savedPracticeStorage.test.ts
```

---

## Acceptance smoke test (manual)

1. Open Practice plugin → score selection dialog appears
2. Click "🎹 Free Practice" → dialog closes, practice toolbar appears with "Free Practice" title
3. Note: play/pause disabled; staff picker hidden; metronome available
4. Click ♪ Practice → play a few MIDI notes → note count increments; elapsed time advances
5. Click ■ Stop Practice → simplified results overlay: duration + note count + Save/Replay/Repractice
6. Click Save → button shows "✓ Saved"; open score dialog → "Saved Practices" list includes the entry
7. Click Repractice → new free session starts (no dialog shown)
8. Open Play plugin → score selection dialog → "Free Practice" button is **absent**
