# Contract: Saved Practice Types

**Feature**: 056-save-load-practices  
**Date**: 2026-03-25

## TypeScript Interfaces

```typescript
// --- Score Reference ---

interface ScoreRef {
  /** Source type of the score */
  type: 'preloaded' | 'user';
  /** Filename for preloaded scores, IndexedDB UUID for user-uploaded scores */
  id: string;
}

// --- Performance Data (serializable subset of PerformanceRecord) ---

interface SavedPerformanceData {
  notes: PluginPracticeNoteEntry[];
  noteResults: PracticeNoteResult[];
  wrongNoteEvents: WrongNoteEvent[];
  bpmAtCompletion: number;
  /** Non-null for partial practices */
  stoppedAtIndex: number | null;
  /** Non-null for partial practices */
  totalNoteCount: number | null;
}

// --- Full Saved Practice (IndexedDB `practices` store) ---

interface SavedPractice {
  /** UUID v4 */
  id: string;
  /** Auto-generated: {score_name}-{hand}-{scope}-{datetime} */
  name: string;
  /** ISO 8601 timestamp */
  savedAt: string;
  scoreRef: ScoreRef;
  scoreTitle: string;
  /** 0 = RH, 1 = LH, -1 = BH */
  staffIndex: number;
  loopRegion: { startTick: number; endTick: number } | null;
  tempoMultiplier: number;
  loopCount: number;
  completionStatus: 'complete' | 'partial';
  performanceData: SavedPerformanceData;
}

// --- Lightweight Index Entry (localStorage) ---

interface SavedPracticeIndexEntry {
  /** Same UUID as SavedPractice.id */
  id: string;
  name: string;
  /** ISO 8601 */
  savedAt: string;
  completionStatus: 'complete' | 'partial';
  scoreTitle: string;
}
```

## Service Contracts

### savedPracticeIndex.ts

```typescript
/** localStorage key: 'graditone-saved-practices-index' */
/** Maximum entries: 100 */

/** List all saved practices, sorted by savedAt descending (most recent first). */
function listSavedPractices(): SavedPracticeIndexEntry[];

/** Add a new entry to the index. Returns evicted IDs if limit exceeded. */
function addSavedPracticeIndex(
  entry: SavedPracticeIndexEntry
): { evictedIds: string[] };

/** Remove an entry by ID. No-op if not found. */
function removeSavedPracticeIndex(id: string): void;
```

### savedPracticeStorage.ts

```typescript
/** Save full practice data to IndexedDB 'practices' store. */
function savePracticeToIndexedDB(practice: SavedPractice): Promise<void>;

/** Load full practice data by ID. Returns null if not found. */
function loadPracticeFromIndexedDB(id: string): Promise<SavedPractice | null>;

/** Delete a practice from IndexedDB by ID. */
function deletePracticeFromIndexedDB(id: string): Promise<void>;
```

### Name Generation

```typescript
/** Pure function to generate the practice name per FR-002. */
function generatePracticeName(
  scoreTitle: string,
  staffIndex: number,
  loopRegion: { startTick: number; endTick: number } | null,
  date: Date
): string;
```

## Component Contracts

### SavedPracticeList

```typescript
interface SavedPracticeListProps {
  practices: ReadonlyArray<SavedPracticeIndexEntry>;
  disabled?: boolean;
  onSelect: (practice: SavedPracticeIndexEntry) => void;
  onDelete: (id: string) => void;
}
```

### ResultsOverlay (additional props)

```typescript
// Added to existing ResultsOverlayProps:
interface ResultsOverlayProps {
  // ... existing props ...
  onSave?: () => void;
  isSaved?: boolean;
}
```

### LoadScoreDialog (additional props)

```typescript
// Added to existing LoadScoreDialogProps:
interface LoadScoreDialogProps {
  // ... existing props ...
  savedPractices?: ReadonlyArray<SavedPracticeIndexEntry>;
  onSelectSavedPractice?: (practice: SavedPracticeIndexEntry) => void;
  onDeleteSavedPractice?: (id: string) => void;
}
```
