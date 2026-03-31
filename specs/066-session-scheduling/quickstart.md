# Quickstart: Session Scheduling

**Feature**: 066-session-scheduling  
**Date**: 2026-03-31

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Frontend dev server: `cd frontend && npm run dev`
- Sessions plugin loaded (already in `plugins-external/sessions-plugin/`)

## Files to Modify

| File | Change |
|------|--------|
| `plugins-external/sessions-plugin/sessionTypes.ts` | Add `'scheduled'` to status union, add `targetDate?` field to `Session` and `SessionIndexEntry` |
| `plugins-external/sessions-plugin/sessionStorage.ts` | Extend `normalizeSession`/`normalizeIndexEntry` for `targetDate`, update `updateSessionIndex` to accept `targetDate` |
| `plugins-external/sessions-plugin/useSessionManager.ts` | Add `scheduleSession()`, `activateScheduledSession()` functions; modify `startSession`/`createSessionWithTasks` to accept `targetDate` parameter |
| `plugins-external/sessions-plugin/SessionsPlugin.tsx` | Add date picker to creation flow, add activate button for scheduled sessions, implement three-tier sorting, add status badge for "Scheduled" |
| `plugins-external/sessions-plugin/TaskBuilder.tsx` | Pass through `targetDate` from date picker |

## New Test Files

| File | Coverage |
|------|----------|
| Unit tests for state transitions | `scheduled → active`, `active → closed`, blocked transitions (`closed → *`), single-active constraint |
| Unit tests for date validation | Past date rejection, today = active, future = scheduled |
| Unit tests for sorting | Three-tier sort order verification |
| E2e tests for scheduling flow | Create scheduled session, verify persistence, activate, verify state change |

## Development Flow

### Step 1: Type Changes
```typescript
// sessionTypes.ts
export interface Session {
  // ... existing fields ...
  status: 'active' | 'closed' | 'scheduled';  // add 'scheduled'
  targetDate?: string;                          // new field
}

export interface SessionIndexEntry {
  // ... existing fields ...
  status: 'active' | 'closed' | 'scheduled';  // add 'scheduled'
  targetDate?: string;                          // new field
}
```

### Step 2: Storage Layer
```typescript
// sessionStorage.ts — extend normalizeSession
function normalizeSession(session: Session): Session {
  if (!Array.isArray(session.tasks)) session.tasks = [];
  // targetDate: leave undefined if not present (backward compat)
  return session;
}

// extend updateSessionIndex to handle targetDate
export function updateSessionIndex(
  id: string,
  update: Partial<Pick<SessionIndexEntry, 'name' | 'status' | 'activityCount' | 'taskCount' | 'allTasksDone' | 'targetDate'>>,
): void { /* ... */ }
```

### Step 3: Session Manager
```typescript
// useSessionManager.ts — new functions
const scheduleSession = async (targetDate: string, tasks?: SessionTask[]) => {
  // Validate targetDate > today
  // Create session with status: 'scheduled', targetDate
  // Persist to IndexedDB + localStorage index
  // Do NOT set activeSessionId (scheduled != active)
};

const activateScheduledSession = async (id: string) => {
  // Guard: if activeSessionIdRef.current, return
  // Load session, verify status === 'scheduled'
  // Set status = 'active', persist
  // Update index, set activeSessionId
};
```

### Step 4: UI Changes
- Add `<input type="date">` to session creation screen (defaulting to today)
- Add "Activate" button on scheduled session items (disabled when hasActiveSession, with tooltip)
- Add "Scheduled" status badge with target date display
- Implement `sortSessions()` comparator for three-tier ordering

## Verification Commands

```bash
# Run unit tests
cd frontend && npx vitest run --reporter=verbose

# Run e2e tests  
cd frontend && npx playwright test

# Type check
cd frontend && npx tsc --noEmit
```
