# Contract: `setPlaybackStaffFilter` — Plugin Score Player API

**Feature**: 084-one-hand-playback  
**File**: `frontend/src/plugin-api/types.ts` → `PluginScorePlayerContext`

---

## Purpose

Allows plugins to restrict score playback audio to a single staff (hand). When active, only notes belonging to the specified staff index are scheduled for audio output. Notes on other staves are completely silent.

---

## TypeScript Interface Addition

```typescript
// In PluginScorePlayerContext interface (types.ts)

/**
 * Feature 084: Set a staff-index filter for score playback.
 *
 * When set, only notes from the specified staff are scheduled for audio.
 * All other staves are completely silent during playback.
 * Pass null to restore full playback (all staves — default behaviour).
 *
 * Staff indices are 0-based, matching the score structure:
 *   - 0 = top staff (treble / right hand in standard piano scores)
 *   - 1 = bottom staff (bass / left hand in standard piano scores)
 *
 * The filter takes effect from the next playback start or seek.
 * It does NOT interrupt audio currently in-flight.
 *
 * Calling this with an out-of-range staffIndex is safe: the filter
 * is silently ignored and all notes play (equivalent to null).
 *
 * @param staffIndex  0-based staff index to isolate, or null for all staves.
 */
setPlaybackStaffFilter(staffIndex: number | null): void;
```

---

## Behaviour Contract

| Precondition | Postcondition |
|-------------|---------------|
| `staffIndex = null` | All staves produce audio (default) |
| `staffIndex = 0` | Only notes from `score.instruments[0].staves[0]` are scheduled |
| `staffIndex = 1` | Only notes from `score.instruments[0].staves[1]` are scheduled |
| `staffIndex` out of range | Treated as `null`; all staves play |
| No score loaded | Method is a no-op; filter stored for when score is loaded |
| Score replaced via `loadScore()` | Filter persists; applied to new score's note set immediately |

---

## Implementation Contract

**Location**: `frontend/src/plugin-api/scorePlayerContext.ts`

```typescript
// In useScorePlayerBridge():

const [playbackStaffFilter, setPlaybackStaffFilter] = useState<number | null>(null);

// Derived notes — filtered when playbackStaffFilter is set
const filteredNotes = useMemo((): Note[] => {
  if (playbackStaffFilter === null) return notes;
  const staffNotes = expandedNotesByStaff[playbackStaffFilter];
  if (!staffNotes) return notes; // out-of-range → all notes (safe fallback)
  return staffNotes;
}, [notes, expandedNotesByStaff, playbackStaffFilter]);

// Pass filteredNotes (not notes) to usePlayback:
const playbackState = usePlayback(filteredNotes, scoreTempo);
```

**Note**: `notes` (unfiltered) must remain in scope for `extractPracticeNotes` which always works on per-staff slices independently.

---

## No-Op Stub Contract

```typescript
// In createNoOpScorePlayer() (scorePlayerContext.ts)

setPlaybackStaffFilter: (_staffIndex: number | null) => { /* no-op */ },
```

The no-op ensures v2 plugins (which receive this stub) are unaffected.

---

## Related Types (new)

```typescript
// In frontend/src/plugin-api/index.ts — re-export for plugin use

/**
 * Feature 084: Hand mode for one-hand playback filtering.
 * Maps to setPlaybackStaffFilter argument:
 *   'both'  → null
 *   'right' → 0  (staff index 0, treble)
 *   'left'  → 1  (staff index 1, bass)
 */
export type HandMode = 'both' | 'right' | 'left';
```

---

## Test Contract (vitest)

Tests in `frontend/src/plugin-api/scorePlayerContext.test.ts`:

```typescript
describe('setPlaybackStaffFilter', () => {
  it('schedules only staff-0 notes when filter = 0', () => { ... });
  it('schedules only staff-1 notes when filter = 1', () => { ... });
  it('schedules all notes when filter = null', () => { ... });
  it('schedules all notes when staffIndex is out of range', () => { ... });
  it('filter persists across loadScore() calls', () => { ... });
  it('no-op stub accepts call without throwing', () => { ... });
});
```
