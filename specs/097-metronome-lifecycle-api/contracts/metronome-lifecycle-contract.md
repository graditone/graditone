# Metronome Lifecycle API Contract (097-metronome-lifecycle-api)

## Purpose

Defines the single, plugin-facing metronome lifecycle contract. All plugins (Play, Train, Practice) interact with the metronome only through this API; state is read from `MetronomeState`.

## State

```ts
interface MetronomeState {
  readonly active: boolean;
  readonly beatIndex: number;
  readonly isDownbeat: boolean;
  readonly bpm: number;
  readonly subdivision: MetronomeSubdivision;
  readonly subBeatIndex: number;
  readonly armed: boolean;   // NEW — pending deferred start; !(armed && active)
}
```

## API

```ts
interface PluginMetronomeContext {
  toggle(): Promise<void>;                 // existing; armed→disarm, active→stop, else→start
  setSubdivision(s: MetronomeSubdivision): Promise<void>;  // existing
  subscribe(h: (s: MetronomeState) => void): () => void;   // existing
  arm(): void;                             // NEW — enter armed (deferred) state; no-op while active
  disarm(): void;                          // NEW — clear armed state
  startFromDeferred(): Promise<boolean>;   // NEW — if armed: clear armed + start engine; returns whether it started
}
```

## Semantics

| From | `toggle()` | `arm()` | `startFromDeferred()` | `stop()` (engine) |
|------|-----------|---------|------------------------|-------------------|
| idle       | start       | armed  | no-op (returns false) | no-op           |
| armed      | disarm      | no-op  | start (→ active)      | full stop (clears armed) |
| active     | stop        | no-op  | no-op                 | full stop        |

- Invariant: `!(armed && active)`.
- `startFromDeferred()` may be called on *every* first-note event; it only acts when armed (idempotent-safe).
- `stop()` is the full-stop primitive (clears armed). "Stop + re-arm for next session" is `stop()` then `arm()`.

## Practice lifecycle policy (useMetronomeLifecycle — owns "enabled" preference)

- Waiting practice mode + toggle & idle        → `arm()` (enabled=true)
- Toggle while armed                          → `disarm()` (enabled=false)
- Toggle while active                         → `toggle()` (stop; enabled=false)
- Toggle while practice not waiting           → `toggle()` (start; enabled=true)
- First note while armed                      → `startFromDeferred()`
- Session start (start/repractice), enabled   → `arm()` (re-arm for the new session)
- Session end (finish/stop), enabled or not   → `stop()` then `disarm()` (preference kept)
  — `armed` is only meaningful *inside* a practice, so it is never left set on
  session end; the "enabled" preference survives so the next session re-arms.

## Testable Assertions

- `state.armed === true && state.active === false` after `arm()`.
- `startFromDeferred()` returns true + `active=true, armed=false` when armed; returns false and changes nothing when not armed.
- `toggle()` from armed disarms; from active stops; from idle starts.
- `stop()` sets both `active=false` and `armed=false`.
- `armed` present (boolean) in every emitted snapshot.
- Practice: armed only in waiting; first note (score and free) triggers deferred start; session end stops + disarms (never left armed); the next session start re-arms iff enabled; Play/Train never assert armed=true.