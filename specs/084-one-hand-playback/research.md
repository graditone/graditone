# Research: One-Hand Playback in Practice Mode

**Branch**: `084-one-hand-playback` | **Date**: 2026-04-25

---

## R-001: Where playback note filtering must happen

**Decision**: Filter in `useScorePlayerBridge` (`scorePlayerContext.ts`) before notes are passed to `usePlayback`.

**Rationale**:  
`usePlayback(notes, tempo)` (in `MusicTimeline.ts`) accepts a flat `Note[]` array and passes it to `PlaybackScheduler.scheduleNotes()`. The scheduler iterates the array without any staff awareness. The cleanest, least invasive approach is to gate which notes enter `usePlayback` rather than teaching the scheduler about staves.

In `scorePlayerContext.ts`, `setNotes(parsedNotes)` stores all notes for playback. Adding a `playbackStaffFilter: number | null` state allows the `notes` memo/derived value to be filtered before `usePlayback` sees it. When `playbackStaffFilter` is `null`, all notes pass through (existing behaviour).

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| Filter inside `PlaybackScheduler.scheduleNotes()` via a `staffIndex?` param | Requires threading staff metadata through the `Note` domain type, which currently has no `staff` field; violates Principle I (domain model leak) |
| Filter in `ToneAdapter.playNote()` | Too late — notes are already scheduled in Transport; cancelling individually is complex and error-prone |
| Add `staff` field to `Note` domain type + filter in scheduler | Would fix R-003 too, but is a larger change touching the Rust-side data model, WASM bindings, and JSON schema — out of scope |
| Store notes per-staff already (they are in `expandedNotesByStaff`) and swap `usePlayback` source | `usePlayback` is a hook with fixed notes — cannot swap mid-session; would need either re-init or a single filtered array |

---

## R-002: How notes are associated with staves

**Decision**: Staff index is determined by position in `score.instruments[0].staves[]`. Staff 0 = treble (right hand), staff 1 = bass (left hand).

**Rationale**:  
The `Note` type has no `staff` field. Notes belong to `Voice → Staff → Instrument`. The `extractNotesByStaff()` helper in `scorePlayerContext.ts` already partitions notes by staff index. The same partition logic is used by `expandedNotesByStaff` for `extractPracticeNotes()`.

For filtering playback, the approach mirrors this: derive a per-staff note set and only pass the target staff's notes to `usePlayback`.

**Implication**: When `playbackStaffFilter = 0`, only `expandedNotesByStaff[0]` notes are scheduled. When `null`, the original flat `parsedNotes` (all staves merged) is used.

---

## R-003: How to expose the filter to plugins

**Decision**: Add `setPlaybackStaffFilter(staffIndex: number | null): void` to `PluginScorePlayerContext` in `types.ts`.

**Rationale**:  
Plugins (Train, Practice View) cannot import `src/services/` directly (ESLint boundary). All host services are accessed through `PluginContext`. The score player namespace (`context.scorePlayer`) is the correct home for this method — it controls all score playback behaviour.

- `staffIndex = null` → both hands (default)  
- `staffIndex = 0`    → right hand (treble staff)  
- `staffIndex = 1`    → left hand (bass staff)

The no-op stub (`createNoOpScorePlayer`) needs a corresponding no-op method so v2 plugins remain unaffected.

The `ScorePlayerState` does **not** need a new field for the active filter — the plugins own that state locally; there is no subscriber use case for it.

---

## R-004: Hand mode persistence strategy

**Decision**: Hand mode is stored in `localStorage` using `scopedSetItem` (profile-scoped) with a plugin-specific key.

**Rationale**:  
Constitution Principle VIII requires profile-aware storage for any new user state.

- `scopedSetItem`/`scopedGetItem` (already in `plugins/train-view/scopedStorage.ts`) handle profile scoping without importing from `src/`.  
- For the Practice View plugin, the same `scopedStorage.ts` file can be reused (or a copy placed in that plugin folder since cross-plugin imports are not permitted).  
- Key format: `train-hand-mode` / `practice-hand-mode` — scoped by `scopedSetItem` to `profile:<id>:train-hand-mode`.

FR-003 requires persistence "for the duration of the practice session without requiring reselection between exercise rounds." `localStorage` satisfies this. Full page reload persistence is a bonus but not required by the spec.

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|-------------|
| React state only (no persistence) | Satisfies FR-003 within-session, but spec says FR-003 also covers navigating away and returning; localStorage is trivially cheap |
| IndexedDB | Overkill for a single string value |
| URL param | Would pollute the URL and complicate sharing |

---

## R-005: Hand mode UI design

**Decision**: A three-button segmented control ("Both / Right / Left") placed in the Train plugin's sidebar config section and the Practice View plugin's toolbar. Hidden when `staffCount < 2` (FR-007).

**Rationale**:  
- Existing sidebar (`TrainPlugin.tsx`) already has preset/clef/octave controls; hand mode is a natural peer.  
- Practice View toolbar (`practiceToolbar.tsx`) already has a staff picker for the target staff; hand mode for playback is a related but distinct control.  
- Segmented control pattern (three mutually-exclusive buttons) matches existing UI patterns in the Train plugin sidebar.  
- `staffCount` from `ScorePlayerState` is already available in both components; hiding the control when `staffCount < 2` is straightforward.  
- Single interaction compliant with SC-002 ("requires no more than one user interaction").

---

## R-006: Impact on exercise scoring (Train plugin)

**Decision**: Scoring is unchanged. The `exerciseScorer.ts` compares `ResponseNote[]` against `ExerciseNote[]`, which is derived from the selected staff only. The scorer never touches score playback.

**Rationale**:  
The Train plugin's scoring flow:
1. Target notes come from `generateScoreExercise(pitches)` → `scorePitches` from `extractPracticeNotes(staffIndex)`.  
2. User notes come from mic/MIDI detection during playback.  
3. The scorer compares user notes against target notes.

Filtering playback does not affect which notes are expected from the user (already staff-specific via `extractPracticeNotes`). FR-008 says highlight must "continue to function correctly for the active hand's notes" — this is already true since highlighted note IDs come from the scheduler (which will only have active-hand notes when filtered).

---

## R-007: Impact on note highlighting during one-hand playback

**Decision**: Highlighting is automatically correct with no additional changes.

**Rationale**:  
`useNoteHighlight` tracks current playback position via `currentTick` and returns IDs of notes that are sounding at that tick. The `notes` array it receives is the same filtered array passed to `usePlayback`. When one-hand mode is active, only that hand's note IDs are ever in the highlight set. No code change needed for highlighting.

---

## R-008: Scales preset behaviour

**Decision**: When Train plugin is in `scales` preset, hand mode has no effect on playback (scales are not score-based). The UI control should be hidden when not in score preset.

**Rationale**:  
Scale exercises generate MIDI pitches directly — there is no score, no staves, and no `setPlaybackStaffFilter` call. The score player is not involved. The hand mode selector is only shown when `config.preset === 'score'` AND `scorePlayerState.staffCount >= 2`.

---

## R-009: Practice View plugin — staff selector vs hand mode

**Decision**: Two separate controls. The existing **staff selector** (which staff's notes to practice) is unchanged. The new **hand mode** selector controls which staff's notes are audible during score playback.

**Rationale**:  
The Practice View plugin's staff selector determines the target notes (what the user must play). The hand mode determines what audio accompanies the exercise. A student can practice right-hand notes while hearing the full score, or practice right-hand notes while hearing only right-hand audio — these are independent choices.

For implementation simplicity, and to match the spec's scope, the hand mode in Practice View will mirror the score player's staff selection: when a staff is selected for practice, the same staff becomes the default for playback filtering. The user can override by picking a different hand mode.

**Alternative considered**: Auto-couple hand mode to staff selection. Rejected — the spec explicitly states "Both-Hands Mode Is Unaffected" as a P1 user story, implying the modes are independently configurable.
