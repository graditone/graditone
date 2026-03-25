# Research: Save and Load Practices

**Feature**: 056-save-load-practices  
**Date**: 2026-03-25  
**Status**: Complete

## Research Tasks

### R1: IndexedDB Schema Migration Strategy

**Context**: Adding a new `practices` object store to the existing `graditone-db` IndexedDB database requires a version bump and schema upgrade.

**Decision**: Bump DB version from 1 to 2, add `practices` store in `onupgradeneeded`.

**Rationale**: The existing `openDB()` function already guards store creation with `db.objectStoreNames.contains()`, so bumping the version and adding a second conditional block is safe. Existing `scores` store is untouched.

**Alternatives considered**:
- *Separate database for practices*: Rejected — adds complexity, no benefit. Single DB with multiple stores is the standard IndexedDB pattern.
- *Store everything in localStorage*: Rejected — PerformanceRecord data (note results, wrong note events) can be large for long pieces. localStorage has a ~5MB limit; IndexedDB has much higher limits (~50MB+ depending on browser).

### R2: Two-Tier Storage Pattern (Index + Data)

**Context**: Need fast listing of saved practices (for the load dialog) without loading full performance data.

**Decision**: Follow the existing `UserScore` pattern — lightweight metadata index in localStorage, full data in IndexedDB.

**Rationale**: Proven pattern already used in the codebase (`userScoreIndex.ts` + `local-storage.ts`). localStorage reads are synchronous and fast for rendering the list. IndexedDB is async but only needed when actually loading a practice for replay.

**Alternatives considered**:
- *IndexedDB-only with cursor listing*: Rejected — requires async operations just to populate the list, adds complexity to the load dialog rendering.
- *localStorage-only*: Rejected — PerformanceRecord data is too large for localStorage's ~5MB limit.

### R3: Save Button Placement and State Management

**Context**: The Save button needs to integrate into the existing ResultsOverlay button row alongside Repractice and Replay.

**Decision**: Add a "Save" button as a third element in `.practice-results__replay-row`. State managed via a `savedThisSession` boolean in ResultsOverlay (reset when a new practice starts). Button transitions from "💾 Save" → "✓ Saved" (disabled) after click.

**Rationale**: Inline state change (no toast/popup) matches the overlay's existing minimal UI pattern. The Repractice and Replay buttons don't use external notifications either. The `savedThisSession` flag is local to the component and resets naturally when the practice state changes to inactive then back to complete.

**Alternatives considered**:
- *Toast notification*: Rejected per clarification — inline button state preferred by user.
- *Save button in toolbar instead of overlay*: Rejected — user explicitly requested it in the results overlay next to Replay.

### R4: Practice Name Generation

**Context**: Names follow `{score_name}-{hand}-{scope}-{datetime}` format.

**Decision**: Implement a pure function `generatePracticeName(title, staffIndex, loopRegion, date)` that:
1. Sanitizes score title: replace spaces with underscores, remove non-alphanumeric characters (except underscores), truncate to 50 chars.
2. Maps staff index: 0 → "RH", 1 → "LH", -1 → "BH".
3. Maps scope: `loopRegion !== null` → "region", otherwise → "all".
4. Formats datetime: `YYYYMMDDTHHmmss` in local time.

**Rationale**: Pure function is easily unit-testable. Truncation at 50 chars prevents excessively long names from dominating the list UI. Using local time matches the clarification that timezone indicator is unnecessary.

### R5: Score Reference Strategy for Loading

**Context**: When loading a saved practice, the system must find and load the original score.

**Decision**: Store a `scoreRef` object containing `{ type: 'preloaded' | 'user', id: string }`. For preloaded scores, `id` is the MXL filename (e.g., `Beethoven_FurElise.mxl`). For user-uploaded scores, `id` is the UUID stored in IndexedDB.

**Rationale**: Preloaded scores are always available (bundled with the app). User scores may be deleted, so the system must handle the "score not found" case gracefully per the edge case defined in the spec.

**Alternatives considered**:
- *Store only the title*: Rejected — titles can repeat (e.g., two user scores named "Practice Piece").
- *Store full score data in the practice*: Rejected — doubles storage usage for no benefit.

### R6: SavedPracticeList Component Pattern

**Context**: The load score dialog needs a new collapsible section for saved practices.

**Decision**: Follow the `UserScoreList` component pattern exactly:
- Section with `<details>/<summary>` for collapse (collapsed by default, matching ScoreGroupList pattern).
- `<ul role="list">` with list items.
- Each item: select button (name + date + partial indicator) + delete button.
- Returns `null` when empty (section hidden).

**Rationale**: Consistent UI patterns across the load dialog. The `<details>/<summary>` pattern is already used by `ScoreGroupList` for collapsible sections. Touch targets ≥ 44×44px per constitution.

### R7: Load Flow — Score Load + Results Overlay

**Context**: Loading a saved practice must load the score, restore settings, and show the results overlay immediately.

**Decision**: The load flow is:
1. User selects practice from list → dialog closes.
2. System loads the referenced score (preloaded or user).
3. System restores hand selection (`selectedStaffIndex`) and loop region.
4. System sets the `performanceRecord` (or `partialPerformanceRecord`) from saved data.
5. System sets `resultsOverlayVisible = true` — results overlay appears with stats and Replay button.

**Rationale**: Matches clarification answer (Option A). The `PracticeViewPlugin` already has state for `performanceRecord`, `resultsOverlayVisible`, and `loopRegion` — the load flow just needs to set these from saved data instead of from a live practice session.

### R8: Maximum Practices Limit and Eviction

**Context**: Spec requires max 100 practices with oldest-first eviction.

**Decision**: Enforce in `addSavedPractice()` — check index length before inserting. If at limit, remove the oldest entry (last in the date-sorted list) from both localStorage index and IndexedDB. Return evicted IDs so callers can handle if needed (same pattern as `addUserScore`).

**Rationale**: Follows the `addUserScore` eviction pattern exactly. 100 is generous but bounded.
