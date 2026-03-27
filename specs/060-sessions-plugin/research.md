# Research: Sessions Plugin

**Feature**: 060-sessions-plugin  
**Date**: 2026-03-27  
**Status**: Complete — all unknowns resolved

## Research Tasks

### RT-1: Plugin API Practice-Save Event Mechanism

**Unknown**: No existing event/hook in Plugin API for practice-save notifications (confirmed: no `onPracticeSaved`, no `emit` pattern for practice events in Plugin API v7).

**Decision**: Extend Plugin API to v8 by adding an `onPracticeSaved` subscription method to `PluginContext`. The practice-save flow in App.tsx will broadcast to all subscribers when a practice is saved.

**Rationale**: The existing `subscribe` pattern (used by `scorePlayer.subscribe`, `midi.subscribe`, `metronome.subscribe`) is the established mechanism for host→plugin communication. Adding `onPracticeSaved(handler): () => void` follows the same pattern: returns an unsubscribe function, receives a typed event payload.

**Alternatives considered**:
- Direct coupling (sessions plugin imports practice plugin internals) — REJECTED: violates plugin architecture boundary (ESLint enforced)
- Storage polling (watch IndexedDB for changes) — REJECTED: no native IndexedDB change events, would require polling timer, unreliable and wasteful
- Custom DOM events — REJECTED: breaks the typed contract pattern; not discoverable via Plugin API types

**Implementation approach**:
1. Add `PracticeSavedEvent` type to `frontend/src/plugin-api/types.ts` containing the saved practice's ID, score title, completion status, and savedAt timestamp
2. Add `onPracticeSaved(handler: (event: PracticeSavedEvent) => void): () => void` to `PluginContext`
3. In App.tsx, maintain a subscriber list and broadcast after `savePracticeToIndexedDB` + `addSavedPracticeIndex` succeed
4. Bump `PLUGIN_API_VERSION` to `'8'`

---

### RT-2: IndexedDB Schema Migration (v2 → v3)

**Unknown**: How to add a `sessions` object store without breaking existing data.

**Decision**: Bump `DB_VERSION` from `2` to `3` in `frontend/src/services/storage/local-storage.ts` and add a guarded `sessions` store creation block in the existing `onupgradeneeded` handler.

**Rationale**: The existing pattern uses `if (!db.objectStoreNames.contains(STORE))` guards, which means each store is only created once regardless of the user's starting version. This is the established, safe migration pattern.

**Implementation approach**:
```
const DB_VERSION = 3;
const SESSIONS_STORE = 'sessions';

// In onupgradeneeded:
if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
  const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
  sessionsStore.createIndex('createdAt', 'createdAt', { unique: false });
  sessionsStore.createIndex('status', 'status', { unique: false });
}
```

**Alternatives considered**:
- Separate database for sessions — REJECTED: adds complexity, breaks the single-DB pattern
- localStorage only — REJECTED: insufficient storage for session + activity data; IndexedDB is needed for structured data

---

### RT-3: ScoreSelector Deletion Guard for Session-Linked Practices

**Unknown**: Where and how to prevent deletion of session-linked practices.

**Decision**: Pass a `protectedPracticeIds` set (or similar) to the `SavedPracticeList` component, which disables/hides the delete button for protected IDs. The sessions plugin exposes the set of protected IDs via a shared service or Plugin API query.

**Rationale**: The delete button is rendered in `SavedPracticeList.tsx` (line ~63). The simplest guard is to disable it per-item based on a lookup. The protected ID set must be computed from all session activities' `savedPracticeId` references.

**Implementation approach**:
1. Add an optional `protectedPracticeIds?: ReadonlySet<string>` prop to `PluginScoreSelectorProps`
2. Pass this through `ScoreSelectorPlugin` → `SavedPracticeList`
3. `SavedPracticeList` disables the delete button when `protectedPracticeIds.has(practice.id)`
4. The sessions plugin (or a shared sessions service) provides the set by scanning the sessions index

**Alternatives considered**:
- Override `onDeleteSavedPractice` callback to filter — REJECTED: the practice plugin wouldn't know about sessions; filtering at the callback level would silently ignore deletes without user feedback
- Move deletion guard to storage layer — REJECTED: the guard is a UX concern (hide/disable button), not a storage invariant

---

### RT-4: Active Session State Accessibility

**Unknown**: How the practice-save flow knows about the active session to link activities.

**Decision**: The sessions plugin subscribes to `onPracticeSaved` events. When it receives a notification, it checks its own state for an active session and creates an activity. No other plugin needs to know about sessions.

**Rationale**: This keeps the architecture clean — the practice plugin fires a generic "practice saved" event, and the sessions plugin reacts to it. The active session state lives entirely within the sessions plugin's own storage and React state.

**Implementation approach**:
1. Sessions plugin calls `context.onPracticeSaved(handler)` in `init()`
2. Handler reads active session from localStorage index
3. If active session exists, creates an activity and persists it
4. If no active session, the event is ignored (practice saved standalone)

**Alternatives considered**:
- Inject session ID into practice save flow — REJECTED: couples practice plugin to sessions concept
- Global app state with active session ID — REJECTED: unnecessary complexity; sessions plugin owns its own state

---

### RT-5: Built-in Plugin Auto-Discovery

**Unknown**: Whether new plugin registration requires code changes.

**Decision**: No code changes to plugin loading needed. The Vite `import.meta.glob` pattern in `builtinPlugins.ts` auto-discovers any `frontend/plugins/*/index.{ts,tsx}` + `frontend/plugins/*/plugin.json`.

**Rationale**: Confirmed by reading `frontend/src/services/plugins/builtinPlugins.ts` — glob patterns match all subdirectories of `frontend/plugins/`.

**Implementation approach**: Create `frontend/plugins/sessions-plugin/` with `index.tsx` and `plugin.json`. Set `type: "core"` and appropriate `order` value for landing screen placement. Plugin will be auto-discovered.

---

### RT-6: Session Eviction and Practice Link Release

**Unknown**: Best practice for releasing practice links when sessions are evicted.

**Decision**: When a session is evicted (oldest closed, cap of 50), remove it from both IndexedDB and the localStorage index. The saved practices it referenced remain in their own storage — they just become standalone (no session references them anymore). The `protectedPracticeIds` set is recomputed from remaining sessions, naturally releasing the evicted session's practices.

**Rationale**: No explicit "unlink" operation is needed. The protection set is derived from the current sessions data. When a session is gone, its practice IDs are no longer in the set, making them deletable again.

**Implementation approach**:
1. On session creation, check count against MAX_SESSIONS (50)
2. If at limit, find oldest closed session, delete from IndexedDB + localStorage index
3. `protectedPracticeIds` is recomputed on next render from remaining sessions' activity references
