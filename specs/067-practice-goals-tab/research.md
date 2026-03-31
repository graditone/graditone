# Research: Practice Goals View Tab (Feature 067)

**Date**: 2026-03-31  
**Feature**: [spec.md](spec.md)

## Research Topics

### R1: Plugin API — Phrase Data Access

**Question**: How can the Sessions plugin access detected phrase regions for a loaded score?

**Finding**: Phrases are computed in Rust backend (`detect_phrases()` in `backend/src/domain/phrases.rs`) during MusicXML parsing and stored on the `Score` object as `score.phrases: Vec<PhraseRegion>`. The WASM binding (`parse_musicxml`) returns phrases as part of the `WasmImportResult.score`. However, the plugin API (`PluginScorePlayerContext`) does **not** currently expose phrases — there is no `getPhrases()` method.

**Decision**: Add a `getPhrases()` method to `PluginScorePlayerContext` that returns `ReadonlyArray<PhraseRegion> | null`. This follows the same pattern as `getMeasureEndTicks()` (Feature 061) — returns null when no score is loaded, returns the array when status === 'ready'.

**Alternatives considered**:
- Having the plugin subscribe to score state and extract phrases from the raw Score object → rejected: Score object is not exposed through plugin API; only `ScorePlayerState` is, which doesn't include phrases.
- Reimplementing phrase detection in TypeScript → rejected: violates Constitution Principle VI (Layout Engine Authority) and duplicates logic.

**Rationale**: Minimal API surface (one new read-only method). Zero Rust changes. Consistent with existing v6 plugin API patterns.

---

### R2: Staff Count Detection for Single-Staff Scores

**Question**: How can the plugin determine if a score has 1 or 2+ staves to decide whether to generate 1 or 3 tasks?

**Finding**: `ScorePlayerState.staffCount` (readonly number, v6 addition — Feature 037) is already available. Populated when `status === 'ready'`. Value is 0 when idle/loading/error. For piano scores, `staffCount === 2` (treble + bass). For melody-only lead sheets, `staffCount === 1`.

**Decision**: Use `ScorePlayerState.staffCount` from the score player subscription. No new API needed.

**Alternatives considered**: None — existing API is sufficient.

---

### R3: First Phrase Selection Strategy

**Question**: Given `detect_phrases()` returns `Vec<PhraseRegion>` (potentially multiple per instrument, per voice), which region should we pick as the "first phrase"?

**Finding**: `PhraseRegion` has fields: `instrument_index`, `start_measure`, `end_measure`, `start_tick`, `end_tick`. Phrases are ordered by `start_tick` within each instrument. For a piano score (instrument_index 0), the first phrase is the one with the smallest `start_measure`.

**Decision**: 
1. Filter phrases where `instrument_index === 0` (first/only instrument).
2. Sort by `start_measure` ascending.
3. Pick the first region.
4. If no phrases exist, fall back to measures 1–4 (0-indexed: 0–3), or the full score if fewer than 4 measures.

**Alternatives considered**:
- Using all phrases from all instruments → rejected: piano scores typically have one instrument with two staves; phrases are per-instrument.
- Always using first 4 measures regardless of phrase detection → rejected: spec explicitly says to use detected phrases when available.

---

### R4: IndexedDB Schema Upgrade Strategy

**Question**: How to add a `goals` object store to the existing IndexedDB without breaking existing data?

**Finding**: Current DB is `graditone-db` version 3 (in `frontend/src/services/storage/local-storage.ts` line 7). The `onupgradeneeded` handler already uses `db.objectStoreNames.contains()` guards, so adding a version 4 upgrade path is safe — existing stores are preserved.

**Decision**: Bump `DB_VERSION` from 3 to 4. Add a new `goals` object store with `keyPath: 'id'` and indexes on `createdAt` and `status`. Also maintain a lightweight localStorage index (`goals-index`) following the same pattern as `sessions-index` for fast list rendering without opening IndexedDB.

**Alternatives considered**:
- Storing goals inside existing `sessions` store → rejected: violates DDD bounded context separation; goals are a separate entity.
- Using localStorage only → rejected: localStorage has a 5 MB limit and isn't suitable for growing goal lists with embedded task IDs.

---

### R5: Goal-to-Session Linking

**Question**: How should the bidirectional link between Goal and Session work?

**Finding**: The existing `Session` type has no `goalId` field. `SessionTask` also has no `goalId`. Adding optional fields to both would enable bidirectional navigation.

**Decision**:
- Add `goalId?: string` to `SessionTask` interface — links individual tasks back to the originating goal.
- Add `goalId?: string` to `Session` interface — links the auto-created session back to the goal.
- The `Goal` entity stores `sessionId: string | null` and `taskIds: string[]` — forward references.
- On goal deletion, only the Goal record is removed — session and tasks remain with their `goalId` fields orphaned (harmless stale reference).

**Alternatives considered**:
- Only forward references (Goal → Session) → rejected: when viewing a session, it's useful to know it originated from a goal.
- Cleaning up goalId on session/tasks when goal is deleted → rejected: adds complexity with no user-facing benefit; orphaned goalId is invisible to users.

---

### R6: Tab Navigation Pattern Extension

**Question**: What's the minimal change to add a third tab?

**Finding**: `SessionsPlugin.tsx` defines `type TabId = 'sessions' | 'calendar'` at line ~200. Tab buttons are rendered in a `role="tablist"` div. Content is conditionally rendered based on `activeTab`.

**Decision**: Extend `TabId` to `'sessions' | 'calendar' | 'goals'`. Add a third button. Conditionally render `<GoalsView>` when `activeTab === 'goals'`. Follow exact same pattern as the calendar tab. The GoalsView component receives `context: PluginContext` and the `scheduleSession` function from `useSessionManager`.

**Alternatives considered**: None — pattern is straightforward and already established.

---

### R7: Score Selection Reuse

**Question**: How to reuse the TaskBuilder's score picker in the Goals tab?

**Finding**: `TaskBuilder.tsx` uses `context.components.ScoreSelector` with props: `catalogue`, `onSelectScore`, `onLoadFile`, `onCancel`, `onSelectUserScore`. The ScoreSelector is a plugin-provided component available on `PluginContext.components`.

**Decision**: GoalsView will use the same `context.components.ScoreSelector` component with the same props pattern. The `onSelectScore` handler receives a catalogue entry ID (preloaded), and `onSelectUserScore` receives a user score ID.

**Alternatives considered**: None — reuse is the correct approach per clarification Q3.
