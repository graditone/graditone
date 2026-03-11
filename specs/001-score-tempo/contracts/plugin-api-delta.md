# Contract Delta: Plugin API — `snapToScoreTempo`

**Branch**: `001-score-tempo` | **Date**: 2026-03-11  
**Scope**: Addition to `PluginScorePlayerContext` interface in `frontend/src/plugin-api/types.ts`

This document describes the single API surface change introduced by this feature. All other changes are internal implementation fixes with no contract implications.

---

## Added Method: `snapToScoreTempo(): void`

**Interface**: `PluginScorePlayerContext`  
**File**: `frontend/src/plugin-api/types.ts`

### Description

Resets the active playback tempo to the score's marked tempo — i.e., sets both the effective BPM to the score's base BPM **and** resets the tempo multiplier to `1.0×`. After this call, `state.bpm === score's marked BPM`.

This is the "undo manual tempo adjustment" action described in User Story 2 of the spec.

### TypeScript Signature

```ts
/**
 * Reset playback tempo to the score's marked tempo.
 *
 * Sets tempoMultiplier to 1.0 so that effectiveBpm = score's base BPM.
 * Has no effect if no score is currently loaded.
 */
snapToScoreTempo(): void;
```

### Placement in Interface

```ts
// ─── Tempo ─────────────────────────────────────────────────────────────────

/**
 * Set the tempo multiplier in the range [0.5, 2.0].
 * Effective BPM = scoreBpm × multiplier; clamped by host.
 */
setTempoMultiplier(multiplier: number): void;

/**
 * Reset playback tempo to the score's marked tempo.
 *
 * Sets tempoMultiplier to 1.0 so that effectiveBpm = score's base BPM.
 * Has no effect if no score is currently loaded.
 */
snapToScoreTempo(): void;        ← NEW
```

### Behaviour

| Precondition | Expected Result |
|---|---|
| Score loaded with 66 BPM; user has set multiplier to 0.75 (≈ 50 BPM audible) | After call: `state.bpm === 66`, multiplier resets to 1.0 |
| Score loaded with 120 BPM (default); multiplier at 1.0 | After call: no visible change (`state.bpm === 120`) |
| No score loaded | No-op; state unchanged |

### No-Op Stub (for test/offline contexts)

The existing `createNoOpScorePlayer()` stub at the bottom of `scorePlayerContext.ts` must also include `snapToScoreTempo: () => {}`.

---

## Unchanged: `setTempoMultiplier`

`setTempoMultiplier(multiplier: number): void` remains unchanged. Plugins that already call `setTempoMultiplier(1.0)` get the same effect as `snapToScoreTempo()` — the only difference is that `snapToScoreTempo()` is semantically clearer and insulated from future changes to the internal multiplier mechanism.

---

## No Backend Contract Changes

The backend (Rust/WASM) API is unchanged. The fix to the MusicXML parser is internal to the importer and does not alter any WASM-exported function signatures or response shapes.
