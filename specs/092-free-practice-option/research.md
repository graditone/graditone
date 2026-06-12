# Research: Free Practice Option (Feature 092)

**Branch**: `092-free-practice-option`  
**Created**: 2026-05-31

---

## Decision 1: How to model a "no-score" practice session

**Decision**: Introduce an `isFreePractice` boolean flag in `PracticeViewPlugin` state. When `true`, the plugin skips the `ScoreSelector` screen entirely, uses a hardcoded 4/4 / 80 BPM synthetic player state, and suppresses all score-dependent UI (staff picker, play/pause, score title text).

**Rationale**: The existing `isLoaded` boolean (derived from `playerState.status !== 'idle'`) gates the entire score-based UI. Adding a parallel `isFreePractice` state flag avoids touching the `scorePlayer` at all for free sessions, keeping the boundary between the host's score player and the plugin's practice engine clean (Principle II).

**Alternatives considered**:
- Create a synthetic "empty score" and load it via `scorePlayer.loadScore()` — rejected because the score player would try to parse/render a non-existent score and introduce error states we'd have to paper over.
- Add a new `kind: 'free'` to `ScoreLoadSource` in the plugin API — rejected as over-engineering; free practice doesn't need the score player at all.

---

## Decision 2: ScoreSelectorPlugin vs LoadScoreDialog — where to show the button

**Decision**: Add `onFreePractice?: () => void` to `PluginScoreSelectorProps`. `ScoreSelectorPlugin` renders the button only when `onFreePractice` is provided. `PracticeViewPlugin` passes the prop; the Play plugin's wiring in `App.tsx` does not pass it, so the button never appears there.

**Rationale**: This is the minimal, backwards-compatible, type-safe way to satisfy FR-001 ("Practice plugin MUST show the button; Play plugin MUST NOT"). `LoadScoreDialog` (used by the Play plugin) is a separate component that is never given this prop, so it requires zero changes.

**Alternatives considered**:
- Add a `showFreePractice` boolean prop — equivalent but less idiomatic React; callback is better because it already carries the action.
- Hardcode the button inside `ScoreSelectorPlugin` with a feature flag — rejected because it would require a separate mechanism to suppress it in the Play plugin context.

---

## Decision 3: Free practice MIDI capture strategy

**Decision**: Capture raw MIDI events as `{ midiNote: number; timestampMs: number }[]` in a `useRef` that accumulates during the free session. On Stop, snapshot this array into a `FreeMidiRecord` struct and pass it to the results overlay and save handler.

**Rationale**: The existing `PerformanceRecord` / `PartialPerformanceRecord` are tightly coupled to `PracticeNoteResult` (which requires `expectedMidi`, `outcome`, etc. — all undefined for free practice). Rather than hacking in nullable fields, a dedicated `FreeMidiRecord` type cleanly models what free practice actually captures: a timestamped MIDI event log for audio replay.

**Alternatives considered**:
- Reuse `PerformanceRecord` with dummy/empty `noteResults` — rejected because it would render accuracy stats (with all-zero values) in the full results overlay and require special-casing throughout `ResultsOverlay.tsx`.
- Use Web Audio API `AudioWorklet` for MIDI capture — out of scope; the existing `context.midi.subscribe` pattern already delivers MIDI events.

---

## Decision 4: Replay mechanism for free practice

**Decision**: Replay uses `context.playNote()` with each captured `{ midiNote, timestampMs }` offset from the replay start time. The results overlay's existing `handleReplay` callback is extended to detect `isFreePractice` and switch to free-replay mode.

**Rationale**: `context.playNote()` is already used by the score-based replay path and correctly produces audio output. The only difference is that free replay iterates over `FreeMidiRecord.events` instead of `performanceRecord.noteResults`. No new audio APIs or dependencies are needed.

**Alternatives considered**:
- Re-route MIDI events through the score player's playback engine — rejected; the score player has no concept of raw MIDI event logs.

---

## Decision 5: Saved practice naming and storage for free sessions

**Decision**: Add a new `generateFreePracticeName(date: Date): string` pure function to `savedPracticeStorage.ts`. The name format is `FreePractice-{YYYYMMDDTHHmmss}`. Extend `ScoreRef.type` to include `'free'` and set `scoreRef: { type: 'free', id: '' }` on the saved record. Loading a free practice checks `scoreRef.type === 'free'` and skips score loading, jumping directly to the results overlay.

**Rationale**: Reusing `generatePracticeName()` would require passing dummy/empty arguments and produce garbled names (e.g., `--all-20260531T...`). A dedicated function is cleaner and easier to test. The `'free'` source type in `ScoreRef` is the minimal addition needed to give the load handler a clear signal that no score loading is needed (FR-011, FR-012).

**Alternatives considered**:
- Store free practices in a separate IndexedDB store — rejected; using the same `practices` store means `addSavedPracticeIndex`, `listSavedPractices`, eviction, and the saved practice list UI all work unchanged.

---

## Decision 6: Results overlay for free practice (simplified view)

**Decision**: Add an `isFreePractice?: boolean` prop to `ResultsOverlay`. When `true`, skip the score/grade ring, the accuracy breakdown, and the note-by-note table. Render instead: elapsed time, total notes played, and the action buttons (Save, Replay, Repractice). The `partialPerformanceRecord` path is not used for free practice — every free session ends via Stop.

**Rationale**: The existing overlay renders its sections conditionally based on `practiceReport` (which requires `noteResults`). Since `FreeMidiRecord` has no `noteResults`, `practiceReport` will always be `null` for free sessions, which already suppresses accuracy stats. The `isFreePractice` prop makes the intent explicit and enables safe rendering of the elapsed-time + note-count summary without defensive null checks scattered throughout.

**Alternatives considered**:
- Create a separate `FreeResultsOverlay` component — rejected; it would duplicate the Save/Replay/Repractice button row and associated state management.

---

## Decision 7: Toolbar progress display during free practice

**Decision**: Add `isFreePractice?: boolean` and `freeNoteCount?: number` props to `PracticeToolbar`. When `isFreePractice` is `true`, hide the `X / N` note-progress indicator and instead show elapsed time (already rendered) plus a `"{N} notes"` count beside it. The elapsed time clock (`elapsedFormatted`) already increments via the score player tick subscription — for free practice, a `useRef` with `setInterval` at 1 s is used instead since there is no score player ticking.

**Rationale**: The spec requires both elapsed time and note count without a "/" separator (FR-013). The existing timer uses score player ticks; free sessions have no score player, so a wall-clock interval is the simplest correct approach (still within 1 s accuracy for a progress display).

**Alternatives considered**:
- Synthetic tick injection via `scorePlayer.loadScore()` — rejected (see Decision 1).
- Use `performance.now()` polled in `requestAnimationFrame` — unnecessarily precise for a display-only counter; 1 s interval is sufficient.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| How to avoid showing the button in Play plugin | Optional `onFreePractice` prop — omitted in App.tsx for Play plugin context |
| What data to store for free practice save/replay | `FreeMidiRecord`: timestamped MIDI events; new `ScoreRef.type = 'free'` |
| How to time elapsed time without a score player | Wall-clock `setInterval` (1 s) while `isFreePractice && practiceRunning` |
| How to distinguish free from partial on load | `scoreRef.type === 'free'` check in the select-saved-practice handler |
| Plugin API version bump needed? | No — `onFreePractice` is an optional prop on `PluginScoreSelectorProps`, not a new API capability; version stays at `'8'` |
