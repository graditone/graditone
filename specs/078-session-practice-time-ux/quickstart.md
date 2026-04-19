# Quickstart: Session & Practice Goal Execution UX Improvements

**Branch**: `078-session-practice-time-ux` | **Date**: 2026-04-10

## Pre-requisites

```bash
# Worktree location
cd /Users/alvaro.delcastillo/devel/worktrees/078-session-practice-time-ux

# Clone sessions-plugin (if not already present in this worktree)
git clone git@github.com:aylabs/graditone-pro-plugins.git plugins-external
cd plugins-external && git checkout -b 078-session-practice-time-ux && cd ..
cd plugins-external/sessions-plugin && npm install && cd ../..

# Frontend
cd frontend && npm install && cd ..
```

## Running tests

```bash
# Sessions plugin tests
cd plugins-external/sessions-plugin
npx vitest run

# Frontend tests
cd frontend
npx vitest run frontend/plugins/practice-view-plugin/
```

## Key files

| Concern | File |
|---|---|
| Task invested/estimated display | `plugins-external/sessions-plugin/TaskRow.tsx` |
| Task row tests | `plugins-external/sessions-plugin/TaskRow.test.tsx` |
| Session time summary component | `plugins-external/sessions-plugin/SessionTimeSummary.tsx` (new) |
| Session index type | `plugins-external/sessions-plugin/sessionTypes.ts` |
| Session manager (close logic) | `plugins-external/sessions-plugin/useSessionManager.ts` |
| Sessions plugin (render) | `plugins-external/sessions-plugin/SessionsPlugin.tsx` |
| Sessions locale (EN) | `plugins-external/sessions-plugin/locales/en.json` |
| Sessions locale (ES) | `plugins-external/sessions-plugin/locales/es.json` |
| Results overlay | `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` |
| Practice orchestrator | `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` |
| Frontend locale (EN) | `frontend/src/i18n/locales/en.json` |
| Frontend locale (ES) | `frontend/src/i18n/locales/es.json` |

## Implementation order

Complete user stories in priority order to deliver incremental value:

1. **Story 3 (P1) — Lock loop count** `ResultsOverlay.tsx` + `PracticeViewPlugin.tsx` → add `loopCountLocked` prop, disable slider, add tooltip key to locale files, add tests.

2. **Story 1 (P1) — Invested vs estimated in TaskRow** `TaskRow.tsx` → compute invested from `linkedPractices`, display alongside estimated, add i18n keys, add tests.

3. **Story 2 (P2) — Session completion summary** `sessionTypes.ts` → add `totalRealTimeSecs`; `useSessionManager.ts` → compute on close; new `SessionTimeSummary.tsx`; `SessionsPlugin.tsx` → render in closed session detail; add i18n keys and tests.

## Acceptance test checklist

- [ ] TaskRow shows `"⏱ 4 min / 8 min"` when task has an estimate and accumulated invested time
- [ ] TaskRow shows `"⏱ 0 min / 8 min"` when task has an estimate but no practices yet
- [ ] TaskRow shows `"⏱ 4 min invested"` when task has no estimate but has practices
- [ ] TaskRow shows nothing when no estimate and no practices
- [ ] Closed session header shows real-vs-estimated time diff
- [ ] Overrun delta styled in warning colour; saving delta styled neutrally
- [ ] Partial-estimate footnote shown when not all tasks have estimates
- [ ] Loop count slider disabled in Results overlay when launched from a task
- [ ] Loop slider disabled state shows tooltip "Loop count set by session task"
- [ ] Standalone practice: loop count slider still fully interactive (no regression)
- [ ] Repractice from task: loop count stays at task-defined count, not user-modified value
