# Quickstart: Rename Practice Plugin to Train & Add Plugin Order Field

**Feature**: 036-rename-practice-train | **Date**: 2026-03-03

This guide lists every concrete change required. Each section maps to one or more tasks. All test-first steps are marked **[TEST FIRST]**.

---

## Phase A: `PluginManifest` — Add `order` field (FR-008)

### A1 — Extend the type in `types.ts`

**File**: `frontend/src/plugin-api/types.ts`

After the `readonly icon?: string;` line, add:

```typescript
  /**
   * Controls the position of this plugin in the app navigation.
   * Lower values appear before higher values.
   * Plugins without this field appear after all ordered plugins,
   * then sorted alphabetically by `id`.
   * Non-finite or non-number values are treated as absent (console.warn emitted).
   * Example: `1` (Play), `2` (Train), `3` (Practice), `4` (Performance).
   */
  readonly order?: number;
```

---

## Phase B: `sortPlugins.ts` — Navigation sort utility (FR-009)

### B1 — [TEST FIRST] Write `sortPlugins.test.ts`

**File**: `frontend/src/services/plugins/sortPlugins.test.ts` (new)

Write tests BEFORE writing the implementation (Constitution Principle V). Tests must cover:
- Ordered plugins sort ascending by `order`
- Unordered plugins (no `order` field) trail all ordered plugins
- Tiebreaker: same `order` value → sort by `id` ascending
- Invalid `order` (NaN, Infinity, non-number) → treated as absent; console.warn emitted
- Negative and zero `order` values are valid (positioned before `order: 1`)
- Empty array → returns empty array
- Array of one → returns same single element

Skeleton (fill in assertions before implementing):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { sortPluginsByOrder } from './sortPlugins';
import type { BuiltinPluginEntry } from './builtinPlugins';
import type { PluginManifest } from '../../plugin-api/index';

function entry(id: string, order?: number): BuiltinPluginEntry {
  const manifest: PluginManifest = {
    id,
    name: id,
    version: '1.0.0',
    pluginApiVersion: '1',
    entryPoint: 'index.tsx',
    ...(order !== undefined ? { order } : {}),
  } as PluginManifest;
  return { manifest, plugin: { init: () => {}, dispose: () => {}, Component: () => null } };
}

describe('sortPluginsByOrder', () => {
  it('returns ordered plugins in ascending order', () => { /* ... */ });
  it('unordered plugins trail ordered plugins', () => { /* ... */ });
  it('ties in order are broken by id alphabetically', () => { /* ... */ });
  it('NaN order is treated as absent and emits console.warn', () => { /* ... */ });
  it('non-number order is treated as absent', () => { /* ... */ });
  it('negative order values sort before order: 0', () => { /* ... */ });
  it('does not mutate the input array', () => { /* ... */ });
});
```

### B2 — Implement `sortPlugins.ts`

**File**: `frontend/src/services/plugins/sortPlugins.ts` (new)

```typescript
/**
 * sortPluginsByOrder — Feature 036
 *
 * Sorts plugin entries by manifest.order ascending, then by id alphabetically.
 * Plugins without a valid finite order value are placed after all ordered plugins.
 */
import type { BuiltinPluginEntry } from './builtinPlugins';

function effectiveOrder(entry: BuiltinPluginEntry): number {
  const o = entry.manifest.order;
  if (o === undefined) return Infinity;
  if (typeof o !== 'number' || !isFinite(o)) {
    console.warn(`[sortPlugins] Plugin "${entry.manifest.id}" has invalid order value:`, o);
    return Infinity;
  }
  return o;
}

export function sortPluginsByOrder(entries: BuiltinPluginEntry[]): BuiltinPluginEntry[] {
  return [...entries].sort((a, b) => {
    const oa = effectiveOrder(a);
    const ob = effectiveOrder(b);
    if (oa !== ob) return oa - ob;
    return a.manifest.id.localeCompare(b.manifest.id);
  });
}
```

---

## Phase C: `App.tsx` — Apply sort before `setAllPlugins` (FR-009)

**File**: `frontend/src/App.tsx`

In `loadPlugins()`, just before `setAllPlugins(entries)`:

```typescript
// Feature 036: sort plugins by manifest.order before setting state
import { sortPluginsByOrder } from './services/plugins/sortPlugins';

// ...inside loadPlugins():
setAllPlugins(sortPluginsByOrder(entries));
// remove the old: setAllPlugins(entries)
```

No tests specific to `App.tsx` are needed for this change — it delegates to `sortPluginsByOrder` which is unit-tested separately.

---

## Phase D: Plugin manifests — Assign order values (FR-010, FR-011)

### D1 — `play-score/plugin.json`

**File**: `frontend/plugins/play-score/plugin.json`

Add `"order": 1` to the existing JSON object:
```json
{
  "id": "play-score",
  "name": "Play Score",
  ...,
  "order": 1
}
```

### D2 — `practice-view/plugin.json` (edit before rename)

Add `"order": 2` and update `id` and `name` (this file will be moved in Phase F):
```json
{
  "id": "train-view",
  "name": "Train",
  "version": "1.0.0",
  "pluginApiVersion": "4",
  "entryPoint": "index.tsx",
  "description": "Piano training exercise — play along and see your score.",
  "type": "core",
  "view": "full-screen",
  "icon": "🎹",
  "order": 2
}
```

---

## Phase E: Storage key migration (FR-007)

### E1 — [TEST FIRST] Write `migrateStorageKeys.test.ts`

**File**: `frontend/plugins/train-view/migrateStorageKeys.test.ts` (new — write after directory rename in Phase F, or write ahead in temp location)

Tests must cover:
- Old `localStorage` key present and new key absent → value copied to new key, old key removed
- New `localStorage` key already present → old key left untouched (migration is no-op)
- Neither key present → no action, no error
- Old `sessionStorage` key present and new key absent → value copied, old key removed
- Multiple calls (idempotent) → second call is a no-op

```typescript
describe('migrateStorageKeys', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('migrates complexity level from old localStorage key to new key', () => { /* ... */ });
  it('does not overwrite new key if it already exists', () => { /* ... */ });
  it('handles missing both keys gracefully', () => { /* ... */ });
  it('migrates tips-dismissed from sessionStorage', () => { /* ... */ });
  it('is idempotent — second call is a no-op', () => { /* ... */ });
});
```

### E2 — Implement `migrateStorageKeys.ts`

**File**: `frontend/plugins/train-view/migrateStorageKeys.ts` (new)

```typescript
/**
 * migrateStorageKeys — Feature 036
 *
 * One-time migration: copies practice-* storage keys to train-* keys.
 * Safe to call multiple times (idempotent).
 */

const KEY_MAP: Array<{ old: string; new: string; store: 'local' | 'session' }> = [
  { old: 'practice-complexity-level-v1', new: 'train-complexity-level-v1', store: 'local' },
  { old: 'practice-tips-v1-dismissed',   new: 'train-tips-v1-dismissed',   store: 'session' },
];

export function migrateStorageKeys(): void {
  for (const { old: oldKey, new: newKey, store } of KEY_MAP) {
    const storage = store === 'local' ? localStorage : sessionStorage;
    if (storage.getItem(newKey) !== null) continue; // already migrated
    const value = storage.getItem(oldKey);
    if (value !== null) {
      storage.setItem(newKey, value);
      storage.removeItem(oldKey);
    }
  }
}
```

### E3 — Call `migrateStorageKeys()` on plugin init

**File**: `frontend/plugins/train-view/index.tsx`

Call `migrateStorageKeys()` at the top of the `init()` function:

```typescript
import { migrateStorageKeys } from './migrateStorageKeys';

const trainViewPlugin: MusicorePlugin = {
  init(context: PluginContext) {
    migrateStorageKeys();   // ← add this line
    _context = context;
  },
  // ...
};
```

---

## Phase F: Rename plugin directory and files (FR-003, FR-004, FR-005, FR-006)

### F1 — Rename directory

```bash
git mv frontend/plugins/practice-view frontend/plugins/train-view
```

### F2 — Rename files inside `train-view/` (run from repo root)

```bash
cd frontend/plugins/train-view
git mv PracticePlugin.tsx TrainPlugin.tsx
git mv PracticePlugin.css TrainPlugin.css
git mv PracticePlugin.test.tsx TrainPlugin.test.tsx
git mv PracticeVirtualKeyboard.tsx TrainVirtualKeyboard.tsx
git mv PracticeVirtualKeyboard.css TrainVirtualKeyboard.css
git mv PracticeVirtualKeyboard.test.tsx TrainVirtualKeyboard.test.tsx
git mv practiceTypes.ts trainTypes.ts
```

### F3 — Update `trainTypes.ts` (renamed from `practiceTypes.ts`)

- Change `COMPLEXITY_LEVEL_STORAGE_KEY = 'practice-complexity-level-v1'` → `'train-complexity-level-v1'`
- Rename all exported identifiers: `PracticeMode` → `TrainMode`, `PracticePhase` → `TrainPhase`, `PracticeExercise` → `TrainExercise`, `ExerciseConfig` → stays (generic enough), `ActiveComplexityLevel` → stays, etc.
- Update the test assertion in `exerciseGenerator.test.ts` (line 134): `COMPLEXITY_LEVEL_STORAGE_KEY` → `'train-complexity-level-v1'`

### F4 — Update `TrainPlugin.tsx` (formerly `PracticePlugin.tsx`)

- Rename component export: `PracticePlugin` → `TrainPlugin`
- Update import of `practiceTypes` → `trainTypes`
- Update import of `PracticeVirtualKeyboard` → `TrainVirtualKeyboard`
- Replace all CSS class references `practice-plugin` → `train-plugin`, `practice-` → `train-` (inline class strings)
- Replace `sessionStorage`-accessed key `'practice-tips-v1-dismissed'` → `'train-tips-v1-dismissed'`
- Any remaining visible heading string `"Practice"` inside the JSX (e.g., `<h1>Practice</h1>` or aria-labels) → `"Train"`

### F5 — Update `TrainPlugin.css` (formerly `PracticePlugin.css`)

- Global find+replace: `.practice-plugin` → `.train-plugin`, `.practice-` → `.train-`

### F6 — Update `TrainVirtualKeyboard.tsx` and `.css`

- Rename component export: `PracticeVirtualKeyboard` → `TrainVirtualKeyboard`
- CSS class renames follow same `practice-` → `train-` pattern

### F7 — Update `index.tsx`

- Update import path: `from './PracticePlugin'` → `from './TrainPlugin'`
- Update import: `{ PracticePlugin }` → `{ TrainPlugin }`
- Rename internal plugin variable: `practiceViewPlugin` → `trainViewPlugin`
- Update component reference in `Component` field

### F8 — Update `exerciseGenerator.ts`, `exerciseScorer.ts`, `matchRawNotesToSlots.ts`

- Update imports of `practiceTypes` → `trainTypes`
- Update any re-exported type names if they were renamed (e.g., `PracticeExercise` → `TrainExercise`)

### F9 — Update `TrainPlugin.test.tsx` (formerly `PracticePlugin.test.tsx`)

- Update all imports: `PracticePlugin` → `TrainPlugin`, `practiceTypes` → `trainTypes`
- Update component references, describe-block titles containing "Practice" → "Train"
- Update localStorage key assertions: `'practice-complexity-level-v1'` → `'train-complexity-level-v1'`

### F10 — Update `TrainVirtualKeyboard.test.tsx`

- Same import and reference updates as F9 for the virtual keyboard sub-component

---

## Phase G: `builtinPlugins.ts` — Update registration (FR-006)

**File**: `frontend/src/services/plugins/builtinPlugins.ts`

```typescript
// Replace:
import practiceViewPlugin from '../../../plugins/practice-view/index';
import practiceViewManifestJson from '../../../plugins/practice-view/plugin.json';

// With:
import trainViewPlugin from '../../../plugins/train-view/index';
import trainViewManifestJson from '../../../plugins/train-view/plugin.json';

// Update BUILTIN_PLUGINS array entry:
{
  manifest: {
    ...(trainViewManifestJson as Omit<PluginManifest, 'origin'>),
    origin: 'builtin' as const,
  },
  plugin: trainViewPlugin,
},
```

---

## Phase H: Documentation updates (FR-014, FR-015)

### H1 — `PLUGINS.md`

1. Update Table of Contents (line 16): `Practice View plugin` → `Train plugin`
2. In `### PluginManifest` section: add `readonly order?: number;` with JSDoc (see `contracts/plugin-manifest-order.ts`)
3. In `## Reference: Practice View plugin` section: retitle to `## Reference: Train plugin`, update path `frontend/plugins/practice-view/` → `frontend/plugins/train-view/`

### H2 — `FEATURES.md`

In the Plugin Architecture bullet list, update:
- `**Practice View** built-in plugin (v2)` → `**Train** built-in plugin (v2)` (keep the sub-bullets unchanged)

### H3 — `specs/031-practice-view-plugin/` annotation headers

Add the following notice at the very top of each file (before `# Feature Specification:` / `# Implementation Plan:` / `# Tasks:` / `# Quickstart:`):

```markdown
> **Renamed** — The plugin described in this document was renamed to **Train** in feature 036.
> Canonical plugin path: `frontend/plugins/train-view/`
> See [specs/036-rename-practice-train/](../036-rename-practice-train/) for the rename spec.

---
```

Files to update:
- `specs/031-practice-view-plugin/spec.md`
- `specs/031-practice-view-plugin/plan.md`
- `specs/031-practice-view-plugin/tasks.md`
- `specs/031-practice-view-plugin/quickstart.md`

---

## Phase I: Final validation

```bash
# 1. TypeScript compilation — zero errors
cd frontend && npx tsc --noEmit

# 2. Run full test suite — all green
npx vitest run

# 3. Manual smoke test
# Open app → check Landing Screen shows "Train" button
# → Open Train plugin → verify header reads "Train"
# → Verify no element reads "Practice" in the plugin UI

# 4. Verify navigation order
# Open app → confirm: Play Score renders before Train in the UI

# 5. Verify sort utility
npx vitest run --reporter=verbose src/services/plugins/sortPlugins.test.ts

# 6. Verify storage migration
npx vitest run --reporter=verbose plugins/train-view/migrateStorageKeys.test.ts
```
