# Research: Rename Practice Plugin to Train & Add Plugin Order Field

**Feature**: 036-rename-practice-train | **Date**: 2026-03-03

## R-001 — Built-in plugin id impact on IndexedDB

**Question**: If the plugin `id` changes from `"practice-view"` to `"train-view"`, what IndexedDB records must be migrated?

**Finding**: `PluginRegistry.ts` (line 5–8) explicitly documents: *"Built-in plugins (origin: 'builtin') should not be registered here — they are held in-memory via builtinPlugins.ts."* The `practice-view` plugin is a built-in and has never been written to IndexedDB. There are zero IndexedDB records keyed by `"practice-view"` to migrate.

**Decision**: The spec's FR-006b clause "migrate id-keyed IndexedDB records" is precautionary but has zero practical scope for this built-in plugin. The id rename from `"practice-view"` to `"train-view"` is safe with no IndexedDB migration needed.

**Rationale**: Built-in plugins bypass `PluginRegistry.put()` entirely — searching the codebase confirms that `BUILTIN_PLUGINS` is loaded directly in `loadPlugins()` in `App.tsx` and passed to `setAllPlugins` without going through the registry.

**Alternatives considered**: Keeping `id: "practice-view"` for backward compatibility. Rejected: user chose full rename (Option A in clarify session) for internal consistency.

---

## R-002 — Navigation sort placement

**Question**: Where should navigation sort logic live — in `App.tsx`, `builtinPlugins.ts`, or a dedicated utility?

**Finding**: `allPlugins` state is assembled in `loadPlugins()` in `App.tsx` (line 141–295). The final `entries` array is merged from `BUILTIN_PLUGINS` + dynamically loaded imported plugins. Sort must happen after the merge, before `setAllPlugins(entries)` (line 293). Two patterns were considered:

1. **Inline in App.tsx**: Simple, but App.tsx is already large and sort logic is testable in isolation.
2. **Pure utility `sortPlugins.ts`**: `sortPluginsByOrder(entries: BuiltinPluginEntry[]): BuiltinPluginEntry[]` — pure function, easily unit-tested without rendering.

**Decision**: Pure utility `frontend/src/services/plugins/sortPlugins.ts` containing `sortPluginsByOrder()`. Called once inside `loadPlugins()` before `setAllPlugins`.

**Rationale**: Constitution Principle V (Test-First) is satisfied more cleanly with a pure function: tests for the sort are isolated unit tests on a function, not component rendering tests.

**Alternatives considered**: Sort at render time (e.g., inside the `allPlugins.map()` in JSX). Rejected: sort at state-set time is more predictable and doesn't re-sort on every render.

---

## R-003 — localStorage keys owned by the practice plugin

**Question**: What localStorage and sessionStorage keys does the practice plugin own?

**Finding** (from codebase scan):
- `localStorage` key `'practice-complexity-level-v1'` — defined as `COMPLEXITY_LEVEL_STORAGE_KEY` constant in `practiceTypes.ts` line 149. Read on mount in `PracticePlugin.tsx` via this constant.
- `sessionStorage` key `'practice-tips-v1-dismissed'` — inline string literal in `PracticePlugin.tsx` lines 134 and 971.

**Decision**: Both keys must be migrated:
- `'practice-complexity-level-v1'` → `'train-complexity-level-v1'` (update `COMPLEXITY_LEVEL_STORAGE_KEY` constant in `trainTypes.ts`)
- `'practice-tips-v1-dismissed'` → `'train-tips-v1-dismissed'` (update inline string in `TrainPlugin.tsx`)
- Migration utility `migrateStorageKeys()` in `frontend/plugins/train-view/migrateStorageKeys.ts` handles the one-time copy-and-delete on first load.
- `sessionStorage` is session-scoped (cleared on browser close), so migration loss is acceptable if the user closes/reopens the browser during the transition. The migration still runs for in-session upgrades.

**Rationale**: Preserving user settings (especially complexity level) across the rename avoids surprising users who have personalised the plugin.

**Alternatives considered**: Not migrating sessionStorage tips key (it resets every session anyway). Acceptable but inconsistent — migrating both keeps the behaviour symmetric.

---

## R-004 — Core plugin rendering paths affected by name change

**Question**: How many rendering locations use `manifest.name` for the Practice plugin? Does renaming `name: "Practice"` → `name: "Train"` cover all of them automatically?

**Finding**: Two rendering paths consume `manifest.name`:
1. **Nav bar** (`App.tsx` line 521): `allPlugins.filter(p => p.manifest.type !== 'core')` — renders `<PluginNavEntry plugin={manifest} ...>`. `PluginNavEntry` displays `manifest.name`.
2. **Landing Screen** (`App.tsx` line 565): `allPlugins.filter(p => p.manifest.type === 'core').map(p => ({ id, name: p.manifest.name, icon }))` — passed to `<ScoreViewer corePlugins={...}>` → `<LandingScreen>`. The landing screen launch button shows `p.manifest.name`.

The `practice-view` plugin has `"type": "core"` in its `plugin.json`, so it appears on the **Landing Screen**, not in the nav bar. Changing `name: "Practice"` → `name: "Train"` in `plugin.json` propagates automatically to both paths.

**Decision**: No code changes to `App.tsx`, `PluginNavEntry`, or `LandingScreen` are needed for the label update — the manifest `name` change is sufficient.

**Alternatives considered**: Hard-coded "Train" in the component. Rejected: the manifest-driven approach is already the correct pattern.

---

## R-005 — Files requiring rename in the plugin directory

**Question**: Which files must be renamed (not just edited internally)?

**Finding** (from `ls frontend/plugins/practice-view/`):

| Current name | New name | Reason |
|---|---|---|
| `PracticePlugin.tsx` | `TrainPlugin.tsx` | Contains component `PracticePlugin` |
| `PracticePlugin.css` | `TrainPlugin.css` | CSS file paired with component |
| `PracticePlugin.test.tsx` | `TrainPlugin.test.tsx` | Test file for the component |
| `PracticeVirtualKeyboard.tsx` | `TrainVirtualKeyboard.tsx` | Sub-component name |
| `PracticeVirtualKeyboard.css` | `TrainVirtualKeyboard.css` | Paired CSS |
| `PracticeVirtualKeyboard.test.tsx` | `TrainVirtualKeyboard.test.tsx` | Paired test |
| `practiceTypes.ts` | `trainTypes.ts` | Contains `COMPLEXITY_LEVEL_STORAGE_KEY` and all practice-domain types |
| Directory `practice-view/` | `train-view/` | Plugin root directory |

Files that do NOT need renaming (no "practice" in filename): `exerciseGenerator.ts`, `exerciseGenerator.test.ts`, `exerciseScorer.ts`, `matchRawNotesToSlots.ts`, `index.tsx`. These files DO need internal identifier updates but not renames.

**Decision**: Rename the 7 files listed. Move via `git mv` to preserve git history.

**Rationale**: `git mv` keeps the rename tracked in history so blame/log are preserved.

---

## R-006 — PluginManifest `order` field design

**Question**: What type, name, and JSON serialisation should the `order` field use?

**Finding**: The existing `PluginManifest` shape uses simple primitive types (`string`, optional `string`). An `order?: number` field is consistent with the existing pattern. The sort must handle:
- Present + finite → use numeric value ascending
- Absent / `undefined` → treat as `Infinity` (sort last)
- Invalid (non-finite, NaN, non-number) → console.warn + treat as `Infinity`

Tiebreaker: `id` alphabetical (string comparison), deterministic.

**Decision**: `readonly order?: number` in `PluginManifest`. Sort comparator:
```typescript
function pluginSortKey(m: PluginManifest): [number, string] {
  const o = m.order;
  const rank = typeof o === 'number' && isFinite(o) ? o : Infinity;
  if (o !== undefined && !(typeof o === 'number' && isFinite(o))) {
    console.warn(`[sortPlugins] Plugin "${m.id}" has invalid order value:`, o);
  }
  return [rank, m.id];
}
```

**Rationale**: `Infinity` as sentinel ensures unordered plugins always trail ordered ones regardless of numeric collation. Using `[rank, id]` as a tuple comparator guarantees stable sort without depending on `Array.prototype.sort` stability (though modern engines are stable, this is explicit).

**Alternatives considered**: `order: 0` as default (all plugins default-ordered). Rejected: breaks the "unordered plugins trail" invariant for plugins that haven't declared an intent.

---

## R-007 — PLUGINS.md manifest documentation scope

**Question**: Which sections of PLUGINS.md require update?

**Finding** (from grep):
1. **`### PluginManifest` section** (line 118) — shows the TypeScript interface shape. Must add `readonly order?: number` with JSDoc.
2. **`## Reference: Practice View plugin` section** (line 403) — describes the practice-view plugin path and API usage. Must be retitled to "Reference: Train plugin" and paths updated.
3. **Table of Contents entry** (line 16) — links to the practice-view anchor. Must update to Train.

**Decision**: Update all three locations in `PLUGINS.md`.

**Alternatives considered**: Only update the manifest schema (minimal change). Rejected: the reference section pointing to `frontend/plugins/practice-view/` becomes a broken path after the rename.
