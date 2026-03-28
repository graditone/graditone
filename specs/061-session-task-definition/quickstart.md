# Quickstart: Tasks-Based Session Definition

**Feature**: 061-session-task-definition  
**Branch**: `061-session-task-definition`

## Prerequisites

- Node.js 18+ and npm
- The Graditone frontend dev server running (`cd frontend && npm run dev`)
- The sessions plugin built (`cd plugins-external/sessions-plugin && npm run build`)

## Development Setup

```bash
# 1. Checkout the feature branch
git checkout 061-session-task-definition

# 2. Install frontend dependencies (if needed)
cd frontend && npm install && cd ..

# 3. Install sessions plugin dependencies (if needed)
cd plugins-external/sessions-plugin && npm install && cd ..

# 4. Run the frontend dev server
cd frontend && npm run dev
```

## Files to Modify

### Sessions Plugin (`plugins-external/sessions-plugin/`)

| File | Action | Purpose |
|------|--------|---------|
| `sessionTypes.ts` | MODIFY | Add `SessionTask`, `TaskLinkedPractice`, `TaskStatus`. Extend `Session`, `SessionActivity`, `SessionIndexEntry` |
| `sessionStorage.ts` | MODIFY | Add `loadTasksFromLastSession()`, extend `addActivityToActiveSession()` for task linkage, extend `computeProtectedPracticeIds()` |
| `useSessionManager.ts` | MODIFY | Replace `startSession()` with `createSessionWithTasks(tasks)`, add task status update logic |
| `SessionsPlugin.tsx` | MODIFY | Add task builder flow (new session), task list display (active/closed sessions), progress summary |
| `SessionsPlugin.css` | MODIFY | Styles for task builder form, task rows, status indicators, progress bar |
| `TaskBuilder.tsx` | CREATE | Task creation form: score picker, region, hand, iterations, tempo, min result |
| `TaskRow.tsx` | CREATE | Single task display: config summary, status badge, practice link, expandable practices list |
| `TaskStatusEngine.ts` | CREATE | Pure function: `computeTaskStatus(task) → TaskStatus` |
| `taskStatusEngine.test.ts` | CREATE | Unit tests for all status transitions, edge cases, retry logic |
| `sessions-plugin.test.tsx` | MODIFY | Add tests for task creation, inheritance, storage, backward compat |

### Plugin API (`frontend/src/plugin-api/`)

| File | Action | Purpose |
|------|--------|---------|
| `types.ts` | MODIFY | Add `taskId?: string` to `PracticeSavedEvent` |

### Practice View Plugin (`frontend/plugins/practice-view-plugin/`)

| File | Action | Purpose |
|------|--------|---------|
| `PracticeViewPlugin.tsx` | MODIFY | Handle `navData.taskConfig` on mount: load score, set staff/tempo/loop/iterations. Store `taskId` in ref and include in `broadcastPracticeSaved()` |
| `usePracticeLoop.ts` | MODIFY | Accept optional `initialStartTick` / `initialEndTick` parameters for programmatic loop region setup |

## Testing

```bash
# Run sessions plugin tests
cd plugins-external/sessions-plugin && npx vitest run

# Run with watch mode during development
cd plugins-external/sessions-plugin && npx vitest
```

### Key Test Scenarios

1. **Task status engine** — all transitions: todo→in-progress→done, todo→in-progress→failed, failed→in-progress (retry)
2. **Task validation** — required fields, measure range validation, empty task list rejection
3. **Task inheritance** — pre-population from last session, empty when no previous session
4. **Backward compatibility** — legacy sessions (no tasks) load correctly, display without task section
5. **Protected practices** — practices linked via tasks are included in protected set

## Architecture Notes

- **No backend changes** — this is entirely frontend/plugin work
- **No data migration** — new fields are optional/defaulted; legacy data loads correctly
- **Task list is immutable** after session creation — no add/remove/reorder in active sessions
- **Tasks are practicable in any order** — no sequential enforcement
- **tempoMultiplier** (not BPM) is stored — ratio is score-independent
- **Measure numbers** are 1-based user-facing — converted to ticks at practice launch time using `measure_end_ticks` from the loaded score
