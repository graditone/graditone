# Quickstart: One-Hand Playback in Practice Mode

**Branch**: `084-one-hand-playback` | **Date**: 2026-04-25

---

## What this feature does

Adds a **Hand Mode selector** (Both / Right hand / Left hand) to the Train plugin and Practice View plugin. When a single hand is selected, only that staff's notes produce audio during score playback — the other staff is completely silent.

---

## Architecture at a glance

```
Plugin (Train / PracticeView)
   │  user picks "Right hand"
   ▼
context.scorePlayer.setPlaybackStaffFilter(0)
   │
   ▼  [scorePlayerContext.ts]
playbackStaffFilter state = 0
   │
   ▼
filteredNotes = expandedNotesByStaff[0]   ← only treble staff notes
   │
   ▼
usePlayback(filteredNotes, tempo)
   │
   ▼
PlaybackScheduler → ToneAdapter
   (only treble notes scheduled → only treble audio output)
```

---

## Files to touch (in implementation order)

### 1. `frontend/src/plugin-api/types.ts`
Add `setPlaybackStaffFilter(staffIndex: number | null): void` to `PluginScorePlayerContext`.  
Add `HandMode` type export.

### 2. `frontend/src/plugin-api/scorePlayerContext.ts`
- Add `playbackStaffFilter` state (`number | null`, default `null`)
- Add `filteredNotes` useMemo that gates on `playbackStaffFilter`
- Pass `filteredNotes` (not `notes`) to `usePlayback`
- Implement `setPlaybackStaffFilter` callback
- Add no-op to `createNoOpScorePlayer`

### 3. `frontend/src/plugin-api/index.ts`
Re-export `HandMode` type.

### 4. `frontend/plugins/train-view/trainTypes.ts`
Add `HandMode` type (copy from plugin-api or define locally — plugin boundary).  
Add optional `handMode?: HandMode` field to `ExerciseConfig`.

### 5. `frontend/plugins/train-view/TrainPlugin.tsx`
- Add `handMode` state (default `'both'`, restored from `scopedGetItem('train-hand-mode')`)
- Show three-button segmented control in sidebar config when `config.preset === 'score' && scorePlayerState.staffCount >= 2`
- On hand mode change: update state, call `context.scorePlayer.setPlaybackStaffFilter(...)`, persist to scoped localStorage
- Reset filter to `null` on plugin unmount / when switching to scales preset
- Wire `handMode` into `ExerciseConfig` via `updateConfig({ handMode })`

### 6. `frontend/plugins/train-view/TrainPlugin.css`
Add styles for the hand-mode segmented control (reuse `.train-config__button` pattern).

### 7. `frontend/plugins/practice-view-plugin/practiceToolbar.tsx`
Add `handMode`, `onHandModeChange`, to `PracticeToolbarProps`.  
Render three-button hand mode selector below the staff picker when `staffCount >= 2`.

### 8. `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- Add `handMode` state (restored from scoped localStorage `'practice-hand-mode'`)
- On hand mode change: call `context.scorePlayer.setPlaybackStaffFilter(...)`
- Pass `handMode` + `onHandModeChange` to `PracticeToolbar`
- Clear filter on unmount

---

## Test strategy (Constitution V — Test-First)

### New test files / additions

| File | Coverage |
|------|----------|
| `frontend/src/plugin-api/scorePlayerContext.test.ts` (new section) | `setPlaybackStaffFilter` behaviour: filter=0, filter=1, filter=null, out-of-range, persists across loadScore |
| `frontend/plugins/train-view/TrainPlugin.test.tsx` | Hand mode selector renders when staffCount>=2; hidden when staffCount<2; calls setPlaybackStaffFilter on change; persists to localStorage |
| `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` | Hand mode control renders when staffCount>=2; hidden otherwise |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` | Hand mode state wired to scorePlayer filter |

### Existing tests must remain green
Run `cd frontend && npx vitest run` before submitting PR.

---

## Running the dev server

```bash
cd frontend
npm run dev
```

Load a two-stave score (e.g., Arabesque, Nocturne) in Train plugin or Practice View.  
Select "Right hand" — verify bass notes are silent.  
Select "Left hand" — verify treble notes are silent.  
Select "Both hands" — verify all notes play as before.

---

## Acceptance check (manual)

1. Load Burgmuller Arabesque in Train plugin → Score preset
2. Select **Right hand** → Start exercise → confirm only treble notes are heard
3. Select **Left hand** → Restart → confirm only bass notes are heard
4. Select **Both hands** → Restart → confirm both staves play (baseline unchanged)
5. Load a single-stave score → confirm hand mode selector is hidden
6. Switch hand mode → refresh page → confirm selection persists
