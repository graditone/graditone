# Data Model: Fix Metronome Issues (085)

**Branch**: `085-fix-metronome-issues`  
**Scope**: Frontend TypeScript only — no backend/WASM/database changes.

---

## Overview

This feature is a bug fix. No new entities are introduced. The only model change is an additive field on the existing `MetronomeState` interface (Plugin API v5 → v5.1).

---

## Changed Entity: `MetronomeState`

**File**: `frontend/src/plugin-api/types.ts`

### Current shape (v5)
```typescript
export interface MetronomeState {
  readonly active: boolean;
  readonly beatIndex: number;       // 0-based; -1 when inactive
  readonly isDownbeat: boolean;
  readonly bpm: number;             // 0 when inactive; clamped 20–300 when active
  readonly subdivision: MetronomeSubdivision; // 1 | 2 | 4
}
```

### New shape (v5.1)
```typescript
export interface MetronomeState {
  readonly active: boolean;
  readonly beatIndex: number;       // 0-based; -1 when inactive
  readonly isDownbeat: boolean;
  readonly bpm: number;             // 0 when inactive; clamped 10–300 when active
  readonly subdivision: MetronomeSubdivision; // 1 | 2 | 4
  readonly subBeatIndex: number;    // NEW: 0 = on-beat; 1..(subdivision-1) = sub-tick
}
```

### Field: `subBeatIndex`

| Attribute | Value |
|-----------|-------|
| Type | `number` |
| Range when active | `0` to `subdivision - 1` |
| When inactive | `0` (not `-1` — sub-beat has no meaningful "inactive" sentinel) |
| Semantics | Position within the current beat subdivision cycle. `0` means the callback fired on a full beat boundary. Non-zero values fire on intermediate subdivision ticks. |
| Backward compatibility | Additive change — existing consumers that only read `beatIndex` / `isDownbeat` are unaffected. |

---

## Field Removed (effective): BPM clamping range

No schema change, but the semantic range of `MetronomeState.bpm` changes:

| | Before | After |
|---|--------|-------|
| Active BPM range | clamped `[20, 300]` | clamped `[10, 300]` |
| Source | `MetronomeEngine.clampBpm()` | `MetronomeEngine.clampBpm()` |

---

## Unchanged Entities

| Entity | Status | Reason |
|--------|--------|--------|
| `PluginMetronomeContext` | Unchanged | `toggle()`, `setSubdivision()`, `subscribe()` signatures unchanged |
| `MetronomeSubdivision` | Unchanged | `1 | 2 | 4` type unchanged |
| `ScorePlayerState` | Unchanged | Loop state is not exposed via Plugin API |
| `PlaybackToolbarProps` | Extended (internal) | New `metronomeSubBeatIndex: number` prop added (not part of public Plugin API) |

---

## State transitions

### `subBeatIndex` lifecycle

```
Engine.start()  →  subBeatIndex = 0  (always starts at 0)
Each Transport tick fires Engine._fireBeat():
  Notify subscribers with current (beatIndex, subBeatIndex)
  subBeatIndex += 1
  if subBeatIndex >= subdivision:
    subBeatIndex = 0
    beatIndex = (beatIndex + 1) % numerator
Engine.stop()   →  subBeatIndex = 0  (reset on stop, not exposed to subscribers)
```

### Loop restart (Issue #2 fix)

```
MusicTimeline detects loop boundary
  → adapter.startTransport()
      → onTransportRestart fires
          → MetronomeEngine._clearEvent()  [clears scheduleRepeat]
          → useMetronomeBridge listener: Promise.resolve().then(() => {
              engine.start(bpm, num, den, beatIndex=0, offset=0, subdivision)
            })
      → Transport.stop()
      → Transport.start('+0.05', 0)
  [microtask runs here — Transport is live at position 0]
  → engine.start() registers new scheduleRepeat from beat 0
```

---

## Validation rules

### BPM (updated)
- Must be a positive finite number.
- Values below 10 are clamped to 10 (warn in console).
- Values above 300 are clamped to 300 (warn in console).
- Applied in `MetronomeEngine.clampBpm()` and inherited by `updateBpm()`.

### subBeatIndex
- Not validated externally — computed exclusively by `MetronomeEngine._fireBeat()`.
- Always in `[0, subdivision - 1]`.

---

## No new contracts

This feature fixes existing behavior. No new public API surfaces, no new REST endpoints, no new WASM bindings, no new CLI commands.

The `MetronomeState` interface change is additive; existing plugin code that does not read `subBeatIndex` continues to work.
