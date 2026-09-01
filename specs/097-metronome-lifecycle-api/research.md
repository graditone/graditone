# Research Notes: Unified Metronome Lifecycle API (097-metronome-lifecycle-api)

## Open Questions & Resolutions

### RQ-1: Where should the `armed` state live?

**Decision**: In `MetronomeEngine` (single source of truth), surfaced through `MetronomeState.armed` and the `PluginMetronomeContext` (`arm`/`disarm`/`startFromDeferred`).

**Rationale**: `active` already lives in the engine and every subscriber reads it from one producer. `armed` is a pending-start bit that is meaningless while `active`, so keeping them together enforces the `!(armed && active)` invariant centrally and lets every plugin (Practice UI, Play, Train) render from the same snapshot. The engine stays a clean state holder; the deferred-start *policy* (started only from armed, on the first note the plugin observes) is expressed through `startFromDeferred()`.

**Alternatives considered**:
- Bridge-owned armed → rejected: adds a second state producer that must be reconciled with the engine's subscribers.
- Plugin-owned armed (status quo) → rejected: exactly the duplication this refactor removes (three refs, two helper sets).

### RQ-2: `toggle()` semantics with the new armed state

**Decision**: `toggle()` from `armed` → disarm; from `active` → stop; otherwise → start immediately. `arm()` is a no-op while active; `startFromDeferred()` no-ops unless armed; `stop()` clears armed.

**Rationale**: Preserves every existing interaction: second tap while armed disarms (waiting-mode), mid-session toggle starts immediately (active), toggle-off stops. `startFromDeferred()` safe to call on every first-note event (only acts when armed) — this removes the bespoke `hasCalledFirstNote`/ref wiring in both score (`usePracticeMidi`) and free (`useFreePractice`) paths.

### RQ-3: How do we kill the practice-side duplication?

**Decision**: A new `useMetronomeLifecycle` hook (practice plugin) that owns the single "enabled during session" preference and exposes `onToggle`, `onFirstNote`, `onSessionStart`, `onSessionEnd`, plus `armed`/`active`/`state` from subscription. Both score and free practice wire their first-note triggers into `onFirstNote`; the toolbar reads `state.armed`.

**Rationale**: The *mechanics* (armed → start → stop → re-arm) are now in the engine/API (FR-003..005). The *policy* (armed only in waiting mode, re-arm after finish when enabled) is one hook — a single, testable surface instead of code in 4 files.

### RQ-4: BPM phase-lock inside `startFromDeferred()`

**Decision**: `startFromDeferred()` mirrors the standalone start branch: if the engine is currently running it is a no-op (armed can't be active); otherwise it consumes armed and starts from the downbeat (standalone `Transport` reset before repeat — the recently-fixed ordering). Phase-locking mid-playback is only relevant for `toggle()` during `status === 'playing'`, which is unchanged.

**Rationale**: Deferred start from practice waiting mode happens with the score stopped (standalone); the standalone path reuses the exact `toggle()` non-playing branch, guaranteeing identical timing (Transport reset before repeat).

## Conflicts/Notes

- `MetronomeState` gains a required `armed: boolean`. All state literals (`types.ts` doc, `metronomeContext.INACTIVE_STATE`, `useMetronome.INACTIVE_STATE`, engine `_getState`, Play/Train `INITIAL_METRONOME_STATE`, test fixtures) must be updated — additive, compile-forced.
- Free-practice's `onFreeNoteAttackRef` is currently the *trigger*; the hook replaces the *handler*. Keep the trigger points (MIDI subscribe callbacks) but route them into `lifecycle.onFirstNote`.
- The `practice-plugin__metro-btn--armed` visual must now come from `state.armed` (toolbar prop unchanged, value source changes).
- The recent fixes (arm-only-in-waiting, stop→re-arm when enabled, Transport-reset-before-repeat) must keep passing — they are the regression guard for this refactor.