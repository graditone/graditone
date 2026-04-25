# Research: Tempo Slider Range Extension & Practice Metronome Deferred Start

**Branch**: `083-tempo-metronome-practice` | **Date**: 2026-04-25  
**Phase**: 0 — Resolves all NEEDS CLARIFICATION items from plan.md Technical Context

---

## R-001: Deferred Metronome Start — Integration Point

**Question**: Where does the armed-fire callback live and how does the first note attack trigger it?

**Decision**: Inject an `onFirstNoteAttack?: () => void` callback parameter into `usePracticeMidi`. Fire it exactly once when the first `attack` event arrives while `practiceStateRef.current.mode === 'waiting'` (the practice engine's initial state before the first note). Use a `hasArmedFiredRef = useRef(false)` inside `PracticeViewPlugin.tsx`, reset it whenever practice stops or restarts.

**Why this point?** The `'waiting'` mode in the practice state machine already encodes "practice started, no note yet". Using this condition avoids duplicate-trigger races for chord simultaneous events (the first `attack` event that changes mode from `waiting` to `active` fires the callback; subsequent events within the same chord are already in `'active'` mode so the guard `mode === 'waiting'` prevents re-entry).

**Rationale**: Keeping the callback at the `usePracticeMidi` boundary respects the existing pattern: note-attack processing lives in that hook. Adding a parameter keeps the engine stateless; the orchestration lives in `PracticeViewPlugin.tsx` (the feature plugin component, not the service layer), consistent with Principle II (Hexagonal).

**Alternatives considered**:
- Subscribing directly to `context.midi` in a second `useEffect` in `PracticeViewPlugin.tsx` — rejected because it duplicates the MIDI subscription and risks processing events out of order with the existing hook.
- Adding state to `MetronomeEngine` for an "armed" mode — rejected because it couples domain service to UI concept (practice mode), violating Principle II.

---

## R-002: Armed State Representation

**Question**: Should `metronomeArmed` be React state or a ref, and how does the toggle handler interact with it?

**Decision**: Use `useState<boolean>(false)` for `metronomeArmed` in `PracticeViewPlugin.tsx`. The armed state is a rendered prop (it flows to `PracticeToolbar` to show the armed CSS class), so it must be React state (not just a ref) to trigger re-renders.

**Toggle logic** (modified `handleMetronomeToggle`):

```
if practice is running (mode ∈ {waiting, active, holding}) AND metronome NOT active AND NOT armed:
  → set metronomeArmed = true         (enter armed state; do NOT call context.metronome.toggle)
else if armed:
  → set metronomeArmed = false        (disarm; metronome stays silent)
else:
  → context.metronome.toggle()        (normal behaviour: outside practice, or already active)
```

**Reset conditions for `metronomeArmed`**:
- Practice session STOP: reset to `false` in `handlePracticeToggle`
- Practice session START (fresh): reset to `false` in `handlePracticeToggle`
- Metronome disarmed by second toggle press: reset to `false`
- `onFirstNoteAttack` fires: reset to `false` (metronome is now `active`; armed no longer relevant)
- Practice session completes naturally: `mode === 'complete'` — reset in the `useEffect` that watches `practiceState.mode`

**Rationale**: Treating armed as state (not ref) ensures the toolbar button's CSS class updates immediately on the next render frame, satisfying FR-012 and SC-007.

---

## R-003: Metronome Start Call on First Note

**Question**: What exact call starts the metronome when the first note fires?

**Decision**: Call `context.metronome.toggle()` (the same method the toggle button calls) rather than a lower-level `start()`. The metronome context already handles BPM synchronisation, Transport state, and phase-locking via `scheduleOffsetSeconds`. Calling `toggle()` when the engine is currently inactive will start it — the same path as the normal button press.

**Timing**: The callback fires inside the MIDI attack event handler, which runs synchronously in a React effect. `toggle()` returns a Promise; errors are caught with `console.error` matching the existing pattern.

**Rationale**: Re-using `toggle()` avoids duplicating BPM/Transport logic. The `MetronomeEngine.start()` signature (`bpm, numerator, denominator, startBeatIndex, scheduleOffsetSeconds, subdivision`) is already abstracted behind `PluginMetronomeContext` — plugins never call `start()` directly (Principle II).

**Alternatives considered**:
- Calling a new `context.metronome.startDeferred()` method — rejected as unnecessary complexity; `toggle()` already does the right thing.
- Scheduling the click at the exact MIDI event timestamp — rejected; Tone.js Web Audio timing is handled by `MetronomeEngine` internally via `scheduleRepeat`; the first click fires ≤1 beat-interval after the call, which satisfies SC-004 ("within one beat's duration").

---

## R-004: Step Precision and Float Drift on `<input type="range" step="0.01">`

**Question**: Does changing `step` from `0.05` to `0.01` introduce float drift in the displayed percentage?

**Decision**: Yes — browsers produce values like `0.10000000000000001` at `step=0.01`. Normalise with `Math.round(raw * 100) / 100` before passing to `onTempoChange`. Display uses `multiplierToPercentage()` which already calls `Math.round`, so the displayed integer is always exact.

**Implementation**: Both `playbackToolbar.tsx` and `practiceToolbar.tsx` wrap the raw slider value:

```ts
const raw = parseFloat(e.target.value);
const snapped = Math.abs(raw - 1.0) <= 0.03 ? 1.0 : Math.round(raw * 100) / 100;
onTempoChange(snapped);
```

**Rationale**: Integer percentage display (FR-010) requires exact integers. The `Math.round` normalisation is the minimal fix with zero performance cost.

**Alternatives considered**:
- Using `step=1` on a `min=10 max=200` integer slider — simpler, but requires converting the stored `tempoMultiplier` (0.0–2.0 float) to/from integers at every boundary. Adds conversion surface area; the current float representation is the canonical form used everywhere (IndexedDB, Tone.js BPM, player).

---

## R-005: Snap Zone with New Step Size

**Question**: What is the correct snap zone for 1% integer steps?

**Decision**: Keep the snap as `±3` percentage points: `Math.abs(raw - 1.0) <= 0.03`. This gives a 7-step snap window (97%, 98%, 99%, **100%**, 101%, 102%, 103%), matching FR-011's "approximately ±3 percentage points" requirement.

**Old snap zone**: `Math.abs(raw - 1.0) <= 0.05` — was ±5pp with 5pp steps (±1 step). New zone is ±3 steps of 1pp — comparable gestural affordance.

**Rationale**: SC-006 requires that a user can land at 100% from a nearby position in a single gesture without pixel-perfect accuracy. A 7pp window (3 steps on each side) is the narrowest window that remains comfortable on a touch slider.

**Visual indicator**: A `<datalist>` with a single `<option value="1.0">` — this renders a native browser tick mark at 100% on the slider track in Chrome and Firefox. For Safari (no `datalist` tick support), a thin CSS `::after` pseudo-element on the slider wrapper provides a visual marker.

---

## R-006: Absolute BPM Floor — Effective Min Multiplier Calculation

**Question**: How is the dynamic minimum enforced when `originalBpm * 0.1 < 10 BPM`?

**Decision**: Add `computeEffectiveMinMultiplier(originalBpm: number): number` to `tempoCalculations.ts`:

```ts
export const ABSOLUTE_BPM_FLOOR = 10; // BPM — never go below this

export function computeEffectiveMinMultiplier(originalBpm: number): number {
  if (originalBpm <= 0) return MIN_TEMPO_MULTIPLIER;
  return Math.max(MIN_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR / originalBpm);
}
```

The slider's `min` attribute receives the result. Example: `originalBpm = 40` → `max(0.1, 10/40) = 0.25` (25%).

**UI communication**: When `computeEffectiveMinMultiplier(bpm) > MIN_TEMPO_MULTIPLIER`, the slider's minimum is higher than 10%. A `title` attribute on the slider element explains this: `"Minimum tempo limited to 10 BPM for this score"`. The `%` display always reflects the actual clamped position.

**`playerState.bpm`**: Confirmed to be the score's **original** BPM from the WASM layout engine (not multiplied by `tempoMultiplier`). The playback engine applies the multiplier separately. This is the value to pass to `computeEffectiveMinMultiplier`.

**Rationale**: FR-014 and SC-008 require visual communication of the BPM floor constraint. A `title` attribute is the minimal, accessible solution; no modal or toast required.

**Alternatives considered**:
- Hardcoding `min=0.1` always and clamping only on save — rejected because it would show a position (10%) the user cannot actually hear correctly (sub-10 BPM playback would stutter or be unsupported by Tone.js Transport).
- Adding a separate "min BPM" slider label — rejected as over-engineering; a tooltip suffices for this edge case (≥100 BPM scores are unaffected).

---

## R-007: Saved Tempo Clamping on Load

**Question**: Do saved `tempoMultiplier` values below 0.1 need migration logic?

**Decision**: No migration needed. `clampTempoMultiplier()` already uses `MIN_TEMPO_MULTIPLIER` and `MAX_TEMPO_MULTIPLIER`. After changing `MIN_TEMPO_MULTIPLIER` from `0.5` to `0.1`, any previously saved value in the range 0.1–0.5 will load correctly without clamping (they are now valid). Values below 0.1 do not exist in the wild (old minimum was 0.5). The upper bound (2.0) is unchanged.

**In practice**: All existing saved practices have `tempoMultiplier ∈ [0.5, 2.0]` — the new range is a strict superset, so no previously saved value falls outside the new valid range on the lower end. Silent clamping via `clampTempoMultiplier()` on load (FR-009) remains correct as a defensive measure.

**Rationale**: FR-009 is satisfied without additional migration code. The widening of the range is backward-compatible.

---

## R-008: Armed Visual State — CSS Approach

**Question**: How should the "armed/waiting" metronome state look and be implemented?

**Decision**: Add CSS modifier class `practice-plugin__metro-btn--armed` to the metronome button when `metronomeArmed === true`. The CSS rule applies a pulsing opacity animation (0.5s ease-in-out infinite alternate, opacity 0.4–1.0) to signal "waiting for input". Icon remains the same metronome symbol; colour shifts to a muted/amber tone via `color: var(--color-metro-armed, #c8a000)`.

**Implementation**:

```ts
// In practiceToolbar.tsx
const metronomeBtnClass = [
  'practice-plugin__metro-btn',
  ...(metronomeActive ? ['practice-plugin__metro-btn--active'] : []),
  ...(metronomeActive && metronomeIsDownbeat ? ['practice-plugin__metro-btn--downbeat'] : []),
  ...(metronomeArmed ? ['practice-plugin__metro-btn--armed'] : []),
].join(' ');
```

**Rationale**: CSS class approach matches the existing pattern (`--active`, `--downbeat`). No new icon assets needed. The pulsing animation is distinct from both the off state (static) and the active ticking state (beat-sync animation key change). Satisfies FR-012 and SC-007.

**Note**: `metronomeArmed` and `metronomeActive` are mutually exclusive (`armed` resets to `false` the moment the engine starts). Guard in tests: never render both classes simultaneously.

---

## R-009: No Changes to `MetronomeEngine.ts`

**Question**: Does `MetronomeEngine` need modification for deferred start?

**Decision**: No. The engine's `start()` method already accepts `scheduleOffsetSeconds` for phase-locking. When called from the first-note callback with `scheduleOffsetSeconds = 0` (default), it fires the first click within one `tickIntervalSeconds`. The 10 BPM minimum in the engine's internal BPM clamp (`[20, 300]`) is unrelated to the tempo slider multiplier — it applies only to the audio scheduling frequency, not the playback speed. No conflicts.

**Rationale**: Keeping the service layer unchanged confirms Principle II is respected. The feature is implemented entirely in the plugin and shared utility layers.

---

## Summary Table

| ID | Question | Decision |
|----|----------|----------|
| R-001 | Integration point for deferred trigger | `onFirstNoteAttack` param in `usePracticeMidi`; fires when `mode === 'waiting'` |
| R-002 | Armed state representation | `useState<boolean>` in `PracticeViewPlugin`; resets on session start/stop |
| R-003 | Call to start metronome on first note | `context.metronome.toggle()` — same as button press |
| R-004 | Float drift at step=0.01 | `Math.round(raw * 100) / 100` normalisation in onChange handlers |
| R-005 | Snap zone size | `Math.abs(raw - 1.0) <= 0.03` (±3 pp); `<datalist>` tick mark at 100% |
| R-006 | Absolute BPM floor | `computeEffectiveMinMultiplier(bpm)` = `max(0.1, 10/bpm)`; `title` tooltip |
| R-007 | Saved tempo clamping | No migration needed; existing saved values all ≥ 0.5 (new min is 0.1) |
| R-008 | Armed visual state | `practice-plugin__metro-btn--armed` CSS class + pulsing opacity animation |
| R-009 | MetronomeEngine changes | None required |
