# Quickstart: Practice Goals View Tab (Feature 067)

**Date**: 2026-03-31  
**Branch**: `067-practice-goals-tab`

## Prerequisites

- Node.js 18+
- Rust toolchain with `wasm-pack` (for backend WASM build)
- The project builds and runs on the current `main` branch

## Build & Run

```bash
# 1. Checkout the feature branch
git checkout 067-practice-goals-tab

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Build the WASM module (no Rust changes, but needed for phrase detection)
cd backend && wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg && cd ..

# 4. Build the sessions plugin
cd plugins-external/sessions-plugin && npm run build && cd ../..

# 5. Start the dev server
cd frontend && npm run dev
```

## Manual Verification

1. Open the app in a browser (tablet viewport recommended)
2. Navigate to **Sessions** plugin
3. Verify three tabs visible: **Sessions**, **Calendar**, **Goals**
4. Tap **Goals** tab
5. Tap **Create Goal**
6. Select any score (e.g., "Für Elise")
7. Verify:
   - Goal appears: "Learn first phrase — Für Elise"
   - Goal shows "0/3 tasks done" (or "0/1 tasks done" for single-staff scores)
   - Expanding the goal shows LH, RH, TH tasks (or just TH for single-staff)
   - Each task: 10 loops, 90% min result, 100% tempo
8. Switch to **Sessions** tab
9. Verify a new scheduled session for tomorrow exists with the 3 tasks

## Run Tests

```bash
# Unit tests for goal engine and storage
cd plugins-external/sessions-plugin && npx vitest run goalEngine.test.ts

# Component tests for GoalsView
cd plugins-external/sessions-plugin && npx vitest run GoalsView.test.tsx

# Plugin API contract test for getPhrases()
cd frontend && npx vitest run src/plugin-api/scorePlayerContext.test.ts

# All sessions plugin tests
cd plugins-external/sessions-plugin && npx vitest run

# E2e (if available)
cd frontend && npx playwright test
```

## Key Files

| File | Purpose |
|------|---------|
| `plugins-external/sessions-plugin/goalTypes.ts` | Goal, GoalIndexEntry type definitions |
| `plugins-external/sessions-plugin/goalStorage.ts` | IndexedDB CRUD + localStorage index for goals |
| `plugins-external/sessions-plugin/goalEngine.ts` | Goal creation logic: phrase lookup, task generation |
| `plugins-external/sessions-plugin/GoalsView.tsx` | Goals tab UI component |
| `plugins-external/sessions-plugin/SessionsPlugin.tsx` | Modified: third tab added |
| `plugins-external/sessions-plugin/sessionTypes.ts` | Modified: goalId on SessionTask and Session |
| `frontend/src/plugin-api/types.ts` | Modified: getPhrases() on PluginScorePlayerContext |
| `frontend/src/services/storage/local-storage.ts` | Modified: DB_VERSION 3 → 4 |

## Architecture Notes

- **No Rust/WASM changes**: Phrase detection already exists in the backend (Feature 062). We only expose it to plugins via a new `getPhrases()` method.
- **Plugin-first approach**: All goal logic lives in `plugins-external/sessions-plugin/`. Only 3 files in `frontend/src/` are modified (plugin API types, implementation, DB schema).
- **Storage pattern**: Follows the existing sessions pattern — full entities in IndexedDB, lightweight index entries in localStorage for fast list rendering.
