# Phase 1 Data Model: Rapid Demo Flow Generation from a Goal

**Feature**: `102-demo-flow-generation` | **Date**: 2026-11-28 | **Spec**: [spec.md](./spec.md)

The feature is tooling over files: the app's annotations, a generated element index, and the flow YAML the existing runner already consumes. There is no database, no user state, and no new storage scope. Entity names match the spec's Key Entities.

---

## 1. Control Index Entry

One identifiable control in the application, as the lookup sees it. Lives in the generated index (`demos/catalog/elements.json`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable identity of the entry. |
| `role` | `string` | The control's semantic role (for example `button`). |
| `name` | `string \| null` | The accessible name (visible localized label, or `aria-label`), or `null` if none. |
| `testid` | `string \| null` | The `data-testid` value, when the control carries one. |
| `screen` | `string` | Owning screen or plugin the control belongs to (for example `landing`, `play-score`, `score-selector`). |
| `source` | `"annotation" \| "e2e" \| "snapshot"` | Where the entry came from. |
| `selectorHints` | `string[]` | Optional preferred selector forms (for example `[data-testid="tempo-plus"]`). |
| `aliases` | `string[]` | Optional extra phrases the goal may use (for example `"bpm up"`, `"faster"`). |

**Identity / invariants**
- An entry is uniquely identified by `testid` when present; otherwise by the tuple `(screen, role, name)`.
- `testid`, `name`, and `role` are not all empty — an entry with none is not indexed (the static scan reports it as a gap instead).
- `screen` is always set; it is what disambiguates duplicate labels (spec Edge Case, US2 acceptance 3).

**Validation rules (from requirements)**
- Only demo-relevant controls are indexed (Assumptions; annotation scope).
- The index is derived; entries are never authored by hand (FR-007, D1/D8).

---

## 2. Control Catalogue (the derived index)

The whole generated index and its provenance.

| Field | Type | Description |
|-------|------|-------------|
| `entries` | `Control Index Entry[]` | Sorted for stable diffs. |
| `builtAt` | `string` (ISO-8601) | When the index was generated. |
| `sourceRevision` | `string` | Repo revision the index was built from, so a stale index is detectable. |
| `sources` | `{ annotation: number; e2e: number; snapshot: number }` | Counts per source. |

**State transitions (lifecycle)**

```text
absent ──catalog:build──▶ built ──(frontend annotation changes)──▶ stale
                            ▲                                        │
                            └────────────catalog:build────────────────┘
```

- `stale` is *detected*, not stored: comparing `sourceRevision` / re-running the build against the annotations (D8). A stale index may resolve fewer steps; a refresh can resolve previously unresolved ones (spec Edge Case).

---

## 3. Element Binding

The link between one goal phrase and one index entry, produced by the lookup.

| Field | Type | Description |
|-------|------|-------------|
| `phrase` | `string` | The goal fragment a step came from. |
| `entryId` | `string \| null` | The matched entry, or `null` when unresolved. |
| `resolved` | `boolean` | `true` only for an unambiguous match (FR-006, D3). |
| `candidates` | `Control Index Entry[]` | Nearest candidates when unresolved. |
| `reason` | `string \| null` | Why unresolved (`missing`, `ambiguous`, `name-only-localized`, ...). |

**State transitions**

```text
phrase ──lookup──▶ resolved (exactly one match)
                 └▶ unresolved { reason, candidates }   # never a guessed selector
```

**Invariants**
- `resolved === true` ⟺ exactly one entry matched.
- `resolved === false` ⟹ `entryId === null` and `candidates` is non-empty when any near match exists.

---

## 4. Demo Goal

The natural-language input.

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The goal in the author's words (for example "open Play Score, choose Für Elise, play, raise the tempo"). |
| `audience` | `string \| null` | Optional audience hint (for example `first-time user`). |
| `plugin` | `string \| null` | Optional single-plugin hint. |
| `locale` | `string` | Demo language; default `en`. |

**Validation rules**: no formal grammar (FR-001); `text` non-empty.

---

## 5. Flow Document

The deliverable, byte-compatible with the existing `Flow` type in `demos/src/types.ts`. Unchanged in shape (FR-002, FR-014).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique, non-colliding with any existing flow (FR-012). |
| `title` | `string` | Derived from the goal (FR-003). |
| `description` | `string` | Derived from the goal (FR-003). |
| `audience` | `string \| null` | Optional; carried from the goal. |
| `viewport` | `{ width: number; height: number }` | Default `1440 × 900` (demos are tablet-native). |
| `steps` | `Flow Step[]` | Ordered journey (FR-009). |
| `democlip` | object \| absent | Passed through unchanged if the author adds it. |

---

## 6. Flow Step

One ordered action in the flow; uses only the existing step vocabulary and attributes.

| Field | Type | Description |
|-------|------|-------------|
| `action` | `goto \| click \| waitFor \| waitForFunction \| press \| evaluate \| hold` (optional) | Unchanged vocabulary. |
| `selector` | `string \| undefined` | From a resolved binding, or a `waitForFunction` script where a content wait is needed. |
| `script` | `string \| undefined` | For `waitForFunction` / `evaluate`. |
| `caption` | `string \| undefined` | Presentation for the video (FR-011). |
| `hold` | `number \| undefined` | Hold after the step, in ms (FR-011). |

**Validation rules**
- Every `click`/`waitFor` step that targets a control MUST carry a `selector` derived from a resolved binding (FR-005); an unresolved step is not emitted as a normal step — it is reported instead (FR-006).
- Wait steps are inserted before acting on asynchronously produced content (FR-010).

---

## 7. Generation Report

The per-run summary emitted alongside the flow (FR-013).

| Field | Type | Description |
|-------|------|-------------|
| `flowId` | `string` | The produced flow. |
| `elapsedMs` | `number` | Submission → file written (SC-001). |
| `lookupMs` | `number` | Time in the deterministic element lookup (D7). |
| `stepsProduced` | `number` | Total steps written. |
| `resolved` | `{ step: string; target: string }[]` | Each resolved step and the control it targets. |
| `unresolved` | `{ step: string; reason: string; candidates: string[] }[]` | Each flagged step with reason and candidates. |
| `gaps` | `string[]` | Element-annotation gaps worth closing. |

**Invariants**
- `unresolved.length > 0` ⟹ the corresponding phrases are listed in `gaps` with a suggested annotation fix (spec Edge Case "Control is not annotated").
- The report is sufficient to judge the draft without reading the flow in full (SC-008).
