# Contract: Free Practice Plugin API (Feature 092)

**Branch**: `092-free-practice-option`  
**Created**: 2026-05-31  
**Type**: TypeScript interface extension (plugin ↔ host boundary)

---

## Overview

This document describes the changes to the Plugin API contract required to support the Free Practice option. All changes are **backwards-compatible**: new props are optional, the plugin API version remains `'8'`.

---

## 1. `PluginScoreSelectorProps` extension

**File**: `frontend/src/plugin-api/types.ts`

```typescript
export interface PluginScoreSelectorProps {
  // ... existing props unchanged ...

  /**
   * Feature 092: When provided, renders a "Free Practice" button in the
   * score selection dialog. Clicking it bypasses score selection entirely
   * and starts a free (score-less) practice session.
   *
   * MUST be provided only by the Practice plugin.
   * MUST NOT be provided by the Play plugin or any other host context.
   */
  onFreePractice?: () => void;
}
```

**Behaviour contract**:
- If `onFreePractice` is `undefined`, the "Free Practice" button MUST NOT render.
- If `onFreePractice` is provided, the button MUST be visible unconditionally (irrespective of catalogue length, loading state, or error state).
- Clicking the button MUST call `onFreePractice()` with no arguments and MUST NOT call `onSelectScore`, `onLoadFile`, or `onCancel`.

---

## 2. `ScoreRef` type extension

**File**: `frontend/src/services/savedPractice.types.ts`

```typescript
export interface ScoreRef {
  /**
   * Source type of the score.
   * 'free' indicates a score-less free practice session (Feature 092).
   * When type is 'free', id MUST be the empty string ''.
   */
  type: 'preloaded' | 'user' | 'free';
  id: string;
}
```

**Load contract**:
- When a `SavedPractice` is selected and `scoreRef.type === 'free'`, the handler MUST skip score loading and jump directly to the free results overlay with the saved `freeMidiRecord`.
- When `scoreRef.type === 'preloaded'` or `'user'`, existing load behaviour is unchanged.

---

## 3. `SavedPractice` extension

**File**: `frontend/src/services/savedPractice.types.ts`

```typescript
export interface SavedPractice {
  // ... existing fields unchanged ...

  /**
   * Feature 092: Raw MIDI event log captured during a free practice session.
   * Present if and only if scoreRef.type === 'free'.
   */
  freeMidiRecord?: {
    events: Array<{ midiNote: number; timestampMs: number }>;
    elapsedMs: number;
    noteCount: number;
    bpm: number;
  };
}
```

**Invariants**:
- `freeMidiRecord` present ↔ `scoreRef.type === 'free'`
- `performanceData.notes` is `[]` when `scoreRef.type === 'free'`
- Existing saved practices (without `freeMidiRecord`) load successfully (graceful undefined)

---

## 4. New exported function

**File**: `frontend/src/services/savedPracticeStorage.ts`  
**Re-exported via**: `frontend/src/plugin-api/index.ts`

```typescript
/**
 * Generate the practice name for a free practice session.
 * Format: FreePractice-{YYYYMMDDTHHmmss} (local time).
 *
 * Feature 092.
 */
export function generateFreePracticeName(date: Date): string;
```

---

## 5. `ResultsOverlay` props extension

**File**: `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` (internal, not plugin-API)

```typescript
export interface ResultsOverlayProps {
  // ... existing props unchanged ...

  /**
   * Feature 092: When true, renders the simplified free-practice results
   * (elapsed time + note count + actions). Hides accuracy score, grade,
   * and note-by-note breakdown.
   */
  isFreePractice?: boolean;

  /**
   * Feature 092: Raw MIDI record for the free practice session.
   * Used to drive free replay and display elapsed time / note count.
   */
  freeMidiRecord?: FreeMidiRecord;
}
```

---

## 6. `PracticeToolbar` props extension

**File**: `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` (internal, not plugin-API)

```typescript
export interface PracticeToolbarProps {
  // ... existing props unchanged ...

  /**
   * Feature 092: When true, hides score-dependent controls (play/pause, staff picker)
   * and shows free-practice progress (elapsed time + note count without "/").
   */
  isFreePractice?: boolean;

  /**
   * Feature 092: Running count of notes played during free practice.
   * Only meaningful when isFreePractice === true.
   */
  freeNoteCount?: number;

  /**
   * Feature 092: Formatted elapsed time for free practice (e.g., "01:32").
   * Only meaningful when isFreePractice === true.
   */
  freeElapsedDisplay?: string;
}
```

---

## Backwards Compatibility

All additions are optional props. Callers that do not pass the new props receive identical behaviour to before. No existing prop is renamed, removed, or made more restrictive.
