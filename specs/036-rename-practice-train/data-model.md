# Data Model: Rename Practice Plugin to Train & Add Plugin Order Field

**Feature**: 036-rename-practice-train | **Date**: 2026-03-03

This feature introduces no new persistent data stores and no new domain entities. It modifies one existing type contract (`PluginManifest`) and renames one set of storage keys.

---

## Modified Entity: `PluginManifest`

**File**: `frontend/src/plugin-api/types.ts`

**Change**: Add optional `order?: number` field.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique plugin identifier (e.g., `"train-view"`) |
| `name` | `string` | ✅ | Display name shown in navigation and Landing Screen |
| `version` | `string` | ✅ | Semver string |
| `pluginApiVersion` | `string` | ✅ | Minimum API version required |
| `entryPoint` | `string` | ✅ | Entry file name (e.g., `"index.tsx"`) |
| `description` | `string` | optional | Human-readable purpose |
| `type` | `'core' \| 'common'` | optional | `'core'` = featured on Landing Screen; `'common'` = nav bar only. Defaults to `'common'`. |
| `view` | `'full-screen' \| 'window'` | optional | Rendering mode. Defaults to `'window'`. |
| `icon` | `string` | optional | Emoji or single character for UI buttons |
| **`order`** | **`number`** | **optional** | **NEW — Controls navigation sort position. Lower values appear first. Plugins without this field appear after all ordered plugins, sorted by `id` as tiebreaker.** |

**Validation rules**:
- `order` must be a finite number to be honoured; non-finite values (NaN, ±Infinity) and non-number types are treated as absent with a console warning.
- Two plugins with the same `order` value are sorted by `id` alphabetically.

---

## Renamed Plugin Manifest: Train (`train-view`)

**File**: `frontend/plugins/train-view/plugin.json`

| Field | Old value | New value |
|-------|-----------|-----------|
| `id` | `"practice-view"` | `"train-view"` |
| `name` | `"Practice"` | `"Train"` |
| `order` | *(absent)* | **`2`** |

Full manifest after change:
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

## Updated Plugin Manifest: Play Score (`play-score`)

**File**: `frontend/plugins/play-score/plugin.json`

| Field | Old value | New value |
|-------|-----------|-----------|
| `order` | *(absent)* | **`1`** |

---

## Storage Key Migration

**Scope**: `frontend/plugins/train-view/migrateStorageKeys.ts` (new file)

### localStorage

| Old key | New key | Default if absent |
|---------|---------|-------------------|
| `practice-complexity-level-v1` | `train-complexity-level-v1` | `null` (plugin uses built-in default) |

### sessionStorage

| Old key | New key | Default if absent |
|---------|---------|-------------------|
| `practice-tips-v1-dismissed` | `train-tips-v1-dismissed` | Tips banner shown (expected default) |

### Migration state

No persistent migration flag is needed. The migration is idempotent:
- If new key exists → already migrated; no action.
- If old key exists and new key is absent → copy value, delete old key.
- If neither key exists → no action.

---

## Sort Algorithm

**File**: `frontend/src/services/plugins/sortPlugins.ts` (new file)

**Function**: `sortPluginsByOrder(entries: BuiltinPluginEntry[]): BuiltinPluginEntry[]`

**Rules**:
1. For each plugin, compute sort key: `[effectiveOrder, id]`
   - `effectiveOrder = manifest.order` if it is a finite `number`; else `Infinity`
   - If `manifest.order` is defined but not a finite number: emit `console.warn` and use `Infinity`
2. Sort entries by sort key ascending (primary: numeric order; secondary: `id` alphabetical)
3. Return new array (do not mutate input)

**Target navigation order with current built-ins**:

| Plugin | `order` | `id` | Sort position |
|--------|---------|------|--------------|
| Play Score | 1 | `play-score` | 1st |
| Train | 2 | `train-view` | 2nd |
| Virtual Keyboard | *(absent)* | `virtual-keyboard` | 3rd (trails ordered plugins) |

---

## No New Entities

The following are explicitly **not** new entities introduced by this feature:
- No new IndexedDB object stores (built-in plugins are in-memory only; PluginRegistry is unchanged)
- No new API endpoints or Rust/WASM changes
- No new React context or state shape changes
