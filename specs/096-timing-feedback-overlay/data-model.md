# Data Model: Live Timing Feedback Overlay (096-timing-feedback-overlay)

> This feature introduces **no schema changes**. It reads the existing per-note
> practice result entity and renders a transient overlay from it.

## Entity: PracticeNoteResult (existing, read-only)

**Source**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts:25`

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `outcome` | `NoteOutcome` | **Trigger** — overlay shows for `correct-late` and `early-release`. |
| `relativeDeltaMs` | number | **Display value** — passed to `formatStateLabel`. |

## Trigger Mapping (derived / presentation)

| `outcome` | Overlay? | Overlay text |
|-----------|----------|--------------|
| `correct-late` | Yes | `formatStateLabel(relativeDeltaMs)` → `+{n} ms` / `-{n} ms` / `0 ms` |
| `early-release` | Yes | same |
| `correct` / `wrong` / `auto-advanced` / `pending` | No | — |

## Entity: Timing Feedback Overlay (new, transient, NOT persisted)

Presentation-only:

- **value**: string produced by `formatStateLabel`
- **visible**: boolean driven by the last recorded out-of-time result
- **lifetime**: ~1s, refreshed (reset) on each new out-of-time result
- **state**: not stored anywhere (no storage, no IndexedDB, no profile)

## Validation Rules (from spec)

- FR-001: `correct-late` / `early-release` → overlay with signed ms.
- FR-005: `correct`, `wrong` → no overlay.
- FR-006: rapid results → single overlay, latest value, timer reset.
- FR-007: replay → no overlay.
- FR-009: value MUST come from `formatStateLabel` (single source shared with Feature 095 report).

## State Transitions

```
idle ──(out-of-time result recorded, live session)──► visible(value)
visible ──(~1s elapses)──► fadingOut ──► idle
visible ──(new out-of-time result)──► visible(refreshed value, timer reset)
visible ──(stop / results overlay / replay)──► hidden immediately
```

No persisted state transitions.