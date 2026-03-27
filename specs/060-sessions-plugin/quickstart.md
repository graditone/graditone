# Quickstart: Sessions Plugin (060)

## Prerequisites

- Node.js 18+ / pnpm
- Frontend dev server running (`cd frontend && pnpm dev`)
- Familiarity with the existing plugin structure (see `frontend/plugins/practice-view-plugin/` as reference)

## Key Files to Understand First

1. **Spec**: [specs/060-sessions-plugin/spec.md](../spec.md) — requirements and clarifications
2. **Data Model**: [specs/060-sessions-plugin/data-model.md](../data-model.md) — entities, storage, relationships
3. **API Contract**: [specs/060-sessions-plugin/contracts/plugin-api-v8.ts](../contracts/plugin-api-v8.ts) — Plugin API v8 additions
4. **Research**: [specs/060-sessions-plugin/research.md](../research.md) — decisions and rationale

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    App.tsx (Host)                     │
│                                                       │
│  ┌─────────────┐    PracticeSavedEvent    ┌─────────────┐
│  │  Practice    │ ──────────────────────► │  Sessions    │
│  │  Plugin      │    (via Plugin API v8)  │  Plugin      │
│  └─────────────┘                          └──────┬──────┘
│                                                   │
│                                                   │ read/write
│                                                   ▼
│                          ┌────────────────────────────────┐
│                          │  Session Storage                │
│                          │  IndexedDB (sessions store)     │
│                          │  localStorage (sessions index)  │
│                          └────────────────────────────────┘
│                                                   │
│  ┌─────────────┐                                  │ protectedPracticeIds
│  │ ScoreSelector│ ◄───────────────────────────────┘
│  │ (delete guard)│
│  └─────────────┘
└─────────────────────────────────────────────────────┘
```

## Implementation Order

### Step 1: Session Types & Storage (no UI)

Create the storage layer first — it's independently testable.

- Define `Session`, `SessionActivity`, `SessionIndexEntry` types
- Implement `sessionStorage.ts`: CRUD for sessions in IndexedDB + localStorage index
- Upgrade `local-storage.ts`: bump DB v2→v3, add `sessions` object store
- Write unit tests for all storage operations (TDD: write tests first)

### Step 2: Plugin API v8 — Practice-Saved Event

Extend the host to broadcast practice-save events.

- Add `PracticeSavedEvent` type to `plugin-api/types.ts`
- Add `onPracticeSaved` to `PluginContext` interface
- Implement subscriber list + broadcast in `App.tsx` after practice save
- Bump `PLUGIN_API_VERSION` to `'8'`
- Write contract test: subscribing plugin receives event after practice save

### Step 3: Sessions Plugin Skeleton

Create the plugin directory and basic structure.

- Create `frontend/plugins/sessions-plugin/` with `plugin.json`, `index.tsx`
- Implement `GraditonePlugin` contract: `init()` subscribes to `onPracticeSaved`, stores context
- Basic `SessionsPlugin.tsx` component (empty state only)
- Verify plugin auto-discovered in dev server

### Step 4: Session CRUD UI

Build the core session management.

- "Start Session" button → creates active session
- Session list rendering (name, date, status, activity count)
- Active session visual distinction
- "Close Session" button → changes status to closed
- Inline rename (tap session name to edit)

### Step 5: Activity Creation & Display

Wire up practice-saved events to session activities.

- `onPracticeSaved` handler creates `SessionActivity` with snapshotted metadata
- Collapsible activity list per session
- Activity display: score title, date, completion status

### Step 6: Activity → Load Practice

Enable loading a practice from an activity.

- Tap activity → load saved practice (reuse existing load flow)
- Handle missing practice data gracefully

### Step 7: Deletion Guard

Protect session-linked practices from deletion.

- Add `protectedPracticeIds` prop to `PluginScoreSelectorProps`
- Compute protected set from sessions data
- Pass through `ScoreSelectorPlugin` → `SavedPracticeList`
- Disable delete button for protected practices

### Step 8: Eviction

Implement the 50-session cap.

- On session creation, check count
- Evict oldest closed session if at limit
- Release linked practice protections on eviction

## Testing Strategy

| Layer | Tool | What to Test |
|-------|------|-------------|
| Storage | Vitest | CRUD operations, eviction, index sync, edge cases |
| State logic | Vitest | Session state machine, activity creation, protection set computation |
| Components | Vitest + React Testing Library | List rendering, expand/collapse, rename, button states |
| Integration | Vitest | Plugin API v8 event flow, practice-save → activity creation |
| E2E | Playwright | Full workflow: start session → practice → activity appears → close session |

## Key Design Decisions

- **Activities embedded in Session document** — not a separate store. Activities are always accessed via their parent session.
- **Metadata snapshotted** — activity display data survives even if practice is deleted
- **Plugin API event** — decoupled communication, no direct import between plugins
- **Auto-discovery** — Vite glob pattern picks up new plugin automatically
- **Two-tier storage** — mirrors existing saved-practices pattern (localStorage index + IndexedDB data)
