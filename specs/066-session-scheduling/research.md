# Research: Session Scheduling

**Feature**: 066-session-scheduling  
**Date**: 2026-03-31

## Research Tasks

### R1: Session status extension — best practices for TypeScript union type migration

**Decision**: Extend the existing `status: 'active' | 'closed'` union type to `'active' | 'closed' | 'scheduled'` across `Session` and `SessionIndexEntry` types. Add optional `targetDate?: string` field (ISO 8601 date string, date-only portion e.g. `"2026-04-15"`).

**Rationale**: TypeScript union literals are the established pattern in this codebase (see `TaskStatus`, `completionStatus`). Adding a third literal value is backward-compatible — existing `'active' | 'closed'` values remain valid. The `targetDate` field is optional to preserve backward compatibility with existing sessions that lack it.

**Alternatives considered**:
- Separate `ScheduledSession` type: Rejected — would fragment the storage layer and require union discriminators everywhere.
- Numeric enum for status: Rejected — not consistent with existing codebase patterns.

### R2: Date picker integration in existing session creation flow

**Decision**: Add an HTML `<input type="date">` to the TaskBuilder / session creation screen, defaulting to today's date. The date value determines behavior:
- Today's date → session created as `'active'` (preserves existing `startSession` / `createSessionWithTasks` behavior)
- Future date → session created as `'scheduled'` with `targetDate` set

**Rationale**: The clarification specifies integrating into the existing flow (Option A). HTML `<input type="date">` is:
- Native on all target tablets (iPad Safari, Chrome Android, Surface Edge)
- Requires no third-party date picker library
- Provides built-in calendar UI appropriate for tablet touch targets (≥44×44px)
- Supports `min` attribute to prevent past-date selection

**Alternatives considered**:
- Third-party date picker (react-datepicker, etc.): Rejected — adds dependency for a simple date-only input.
- Custom calendar component: Rejected — over-engineering; native date input is sufficient for date-only selection.

### R3: Session activation — state transition and constraint enforcement

**Decision**: Add `activateScheduledSession(id: string)` function to `useSessionManager`. Flow:
1. Check `activeSessionIdRef.current` — if truthy, return early (constraint enforced at data layer)
2. Load session from IndexedDB, verify `status === 'scheduled'`
3. Set `session.status = 'active'`, persist to IndexedDB
4. Update index entry status to `'active'`
5. Set `activeSessionId` state and ref

UI enforcement: The activate button renders as `disabled` with a tooltip when `hasActiveSession` is true. This prevents the activation attempt before it reaches the data layer.

**Rationale**: Mirrors the existing pattern where `startSession` checks `activeSessionIdRef.current` before proceeding. Dual enforcement (UI disabled + data layer guard) follows defense-in-depth principle.

**Alternatives considered**:
- Auto-close active session on activation: Rejected per clarification — button is disabled instead.
- Confirmation dialog: Rejected per clarification — disabled with tooltip is simpler and prevents accidental activation.

### R4: Session list sorting — three-tier ordering

**Decision**: Replace the current insertion-order list with explicit sorting in the UI layer:
1. Active session(s) first
2. Scheduled sessions sorted by `targetDate` ascending (nearest date first)
3. Closed sessions sorted by `createdAt` descending (most recent first)

Implemented as a sort comparator applied to the `sessions` array before rendering. The localStorage index continues to store in insertion order; sorting is a presentation concern.

**Rationale**: Sorting in the UI layer (not storage) avoids changing the persistence format and keeps the index backward-compatible. The sort is inexpensive for ≤50 entries.

**Alternatives considered**:
- Sort in storage layer on insert: Rejected — would change the index format and require migration.
- Group by status with separate lists: Rejected — over-complicates the UI for ≤50 items.

### R5: Backward compatibility — existing sessions without targetDate

**Decision**: Extend the existing `normalizeSession()` and `normalizeIndexEntry()` functions to handle missing `targetDate`:
- `normalizeSession`: If `targetDate` is undefined, leave it undefined (existing sessions are active/closed, never scheduled)
- `normalizeIndexEntry`: If `targetDate` is undefined, leave it undefined

No data migration needed. Existing sessions remain valid — they have `status: 'active' | 'closed'` and no `targetDate`, which is correct for their lifecycle.

**Rationale**: Follows the established pattern from Feature 061 where `tasks` and `taskCount` were added with normalization fallbacks rather than data migration.

**Alternatives considered**:
- IndexedDB version migration: Rejected — unnecessary complexity for an additive schema change.

### R6: Eviction policy with scheduled sessions

**Decision**: The existing eviction policy (evict oldest closed session) applies unchanged. Scheduled sessions are NOT evicted because they represent intentional future plans. Only closed sessions are eligible for eviction.

**Rationale**: The eviction filter `e.status === 'closed'` naturally excludes scheduled sessions. No code change needed in the eviction logic itself.

**Alternatives considered**:
- Evict scheduled sessions before closed: Rejected — scheduled sessions are active plans the user created intentionally.
- Separate eviction pool for scheduled: Rejected — unnecessary complexity.

### R7: Target date preservation across state transitions

**Decision**: The `targetDate` field is write-once (set at creation) and never cleared. When a session transitions from scheduled → active → closed, the `targetDate` remains on the record for historical reference and calendar view integration (Feature 065).

**Rationale**: Per clarification answer. Preserving the field costs nothing (it's a string) and enables future analytics (e.g., "did I practice on the day I planned?").
