# Contract: Derived Element Index

**Feature**: `102-demo-flow-generation`  
**Producer**: `demos/src/tools/build-index.ts` (`npm run catalog:build`)  
**Consumer**: `demos/src/tools/find-element.ts` (`npm run catalog:find`), the generation workflow, the generation report  
**File**: `demos/catalog/elements.json` (generated; never hand-edited)

The index is the machine-readable form of the app's annotated demo-relevant controls. It is derived from the frontend source and e2e specs, optionally enriched from a live accessibility-tree snapshot. Its shape is stable so the lookup and the guard can be tested against it.

---

## 1. Document

```json
{
  "builtAt": "2026-11-28T10:00:00.000Z",
  "sourceRevision": "87b5d34",
  "sources": { "annotation": 12, "e2e": 4, "snapshot": 0 },
  "entries": [ /* Control Index Entry[] */ ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `builtAt` | string (ISO-8601) | yes | Build time. |
| `sourceRevision` | string | yes | Repo revision; a mismatch marks the index stale. |
| `sources` | `{ annotation, e2e, snapshot }` numbers | yes | Provenance counts. |
| `entries` | `Control Index Entry[]` | yes | Sorted (by `screen`, then `testid`, then `name`) for stable diffs. |

---

## 2. Control Index Entry

```json
{
  "id": "play-score/tempo-plus",
  "role": "button",
  "name": "Increase tempo",
  "testid": "tempo-plus",
  "screen": "play-score",
  "source": "annotation",
  "selectorHints": ["[data-testid=\"tempo-plus\"]"],
  "aliases": ["bpm up", "faster"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable identity; `screen`/`testid` when available. |
| `role` | string | yes | Semantic role; empty string only if genuinely none. |
| `name` | string \| null | yes | Accessible name, or `null` if none. |
| `testid` | string \| null | yes | `data-testid`, or `null`. |
| `screen` | string | yes | Owning screen/plugin; disambiguates duplicate labels. |
| `source` | `"annotation" \| "e2e" \| "snapshot"` | yes | Provenance. |
| `selectorHints` | string[] | no | Preferred selector forms, ordered. |
| `aliases` | string[] | no | Extra phrases a goal may use. |

**Invariants**
- `role`, `name`, and `testid` are not all empty.
- `id` is unique across `entries`.
- An entry with `testid` set is uniquely identified by it.

---

## 3. Lookup result (the tool's output)

`npm run catalog:find -- "<phrase>" [--screen <screen>]` prints JSON:

```json
{
  "phrase": "raise the tempo",
  "resolved": true,
  "entry": { /* Control Index Entry */ },
  "candidates": [],
  "reason": null
}
```

```json
{
  "phrase": "press play",
  "resolved": false,
  "entry": null,
  "candidates": [
    { "id": "play-score/play", "screen": "play-score", "role": "button", "name": "Play", "testid": "play" },
    { "id": "train/play", "screen": "train", "role": "button", "name": "Play", "testid": "train-play" }
  ],
  "reason": "ambiguous"
}
```

**Rules**
- `resolved` is `true` **only** when exactly one entry matches after applying any `--screen` filter (FR-006, D3).
- `reason` ∈ `{ null, "missing", "ambiguous", "name-only-localized" }`.
- `candidates` is non-empty when a near match exists.
- Exit code: `0` when resolved; `1` when unresolved (so the agent/CLI can branch on it).

---

## 4. Schema (informal)

`entry.properties` — each field is required per the table above; `role`/`screen`/`source` are non-empty strings; `testid`/`name` are `string` or `null`; `selectorHints`/`aliases` are string arrays. `document.properties.entries` is an array of `entry`.
