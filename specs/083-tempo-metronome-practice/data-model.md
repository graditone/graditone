# Data Model: Tempo Slider Range Extension & Practice Metronome Deferred Start

**Branch**: `083-tempo-metronome-practice` | **Date**: 2026-04-25

---

## 1. Updated Constants — `tempoCalculations.ts`

### Before vs After

| Constant | Before | After | Notes |
|----------|--------|-------|-------|
| `MIN_TEMPO_MULTIPLIER` | `0.5` (50%) | `0.1` (10%) | FR-001 |
| `MAX_TEMPO_MULTIPLIER` | `2.0` (200%) | `2.0` (200%) | unchanged |
| `DEFAULT_TEMPO_MULTIPLIER` | `1.0` (100%) | `1.0` (100%) | unchanged |
| `ABSOLUTE_BPM_FLOOR` | *(absent)* | `10` (BPM) | FR-014 |

### New Helper Function

```ts
/**
 * Compute the effective minimum tempo multiplier for a score.
 *
 * When the score's original BPM is very slow, applying MIN_TEMPO_MULTIPLIER
 * would yield a playback speed below ABSOLUTE_BPM_FLOOR. In that case, the
 * minimum is clamped upward so playback never drops below 10 BPM (FR-014).
 *
 * Examples:
 *   computeEffectiveMinMultiplier(120)  → 0.1   (10% — floor not reached)
 *   computeEffectiveMinMultiplier(40)   → 0.25  (25% — floor clamps)
 *   computeEffectiveMinMultiplier(0)    → 0.1   (defensive fallback)
 */
export function computeEffectiveMinMultiplier(originalBpm: number): number {
  if (originalBpm <= 0) return MIN_TEMPO_MULTIPLIER;
  return Math.max(MIN_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR / originalBpm);
}
```

### `clampTempoMultiplier` change

The function body is unchanged; updating `MIN_TEMPO_MULTIPLIER` constant automatically changes the clamp boundary. **No code change** required inside the function.

---

## 2. Transient React State — `PracticeViewPlugin.tsx`

### New state variable

```ts
/** True when the metronome is toggled on in practice mode but no note has been
 *  played yet. The metronome engine is NOT running while armed. Resets when
 *  practice stops, restarts, or the first note fires.
 */
const [metronomeArmed, setMetronomeArmed] = useState<boolean>(false);
```

### Reset ref (prevents multiple fires for chord events)

```ts
/** Guards onFirstNoteAttack from firing more than once per session. */
const metronomeArmedRef = useRef<boolean>(false);
```

Synchronised with `metronomeArmed` state in a `useEffect` or via direct ref assignment before calling `setMetronomeArmed`. The ref is used inside the MIDI callback (stale closure), the state is used for rendering.

### Modified `handleMetronomeToggle`

| Practice mode | Current engine state | Armed? | Action |
|---------------|---------------------|--------|--------|
| Running (waiting/active/holding) | inactive | false | Set `metronomeArmed = true` |
| Running (waiting/active/holding) | inactive | true | Set `metronomeArmed = false` (disarm) |
| Running (waiting/active/holding) | active | any | `context.metronome.toggle()` (stop) |
| Not running (inactive/complete) | any | any | `context.metronome.toggle()` (normal) |

### Reset triggers for `metronomeArmed`

| Event | Action |
|-------|--------|
| `handlePracticeToggle` — session STOP | `setMetronomeArmed(false); metronomeArmedRef.current = false` |
| `handlePracticeToggle` — session START | `setMetronomeArmed(false); metronomeArmedRef.current = false` |
| `onFirstNoteAttack` callback fires | `setMetronomeArmed(false); metronomeArmedRef.current = false` |
| `practiceState.mode === 'complete'` (natural end) | `setMetronomeArmed(false)` in mode-watch `useEffect` |

---

## 3. Updated Hook Interface — `usePracticeMidi.ts`

### New parameter

```ts
interface UsePracticeMidiParams {
  // ... existing params unchanged ...

  /**
   * Called exactly once when the first MIDI attack event arrives during an
   * active practice session (practice mode === 'waiting'). Used to fire the
   * deferred metronome start (FR-005, FR-006).
   *
   * The hook guarantees the callback fires at most once per session.
   * The caller is responsible for resetting the armed guard on session restart.
   */
  onFirstNoteAttack?: () => void;
}
```

### Internal guard (inside `usePracticeMidi`)

The hook uses `practiceStateRef.current.mode === 'waiting'` as the guard — it is `'waiting'` only for the first note of each session. Subsequent notes see `'active'` or `'holding'`, so the callback naturally fires exactly once without needing an internal ref.

---

## 4. Updated Props — `PracticeToolbar`

### New prop

```ts
interface PracticeToolbarProps {
  // ... existing props unchanged ...

  /**
   * True when the metronome is armed (enabled in practice mode,
   * waiting for the first note). Renders the button with the
   * `practice-plugin__metro-btn--armed` CSS class.
   * Mutually exclusive with metronomeActive.
   */
  metronomeArmed: boolean;
}
```

### Button class derivation (updated)

```ts
const metronomeBtnClass = [
  'practice-plugin__metro-btn',
  ...(metronomeActive ? ['practice-plugin__metro-btn--active'] : []),
  ...(metronomeActive && metronomeIsDownbeat ? ['practice-plugin__metro-btn--downbeat'] : []),
  ...(metronomeArmed ? ['practice-plugin__metro-btn--armed'] : []),
].join(' ');
```

### Slider props (both toolbars — practice and play-score)

| Attribute | Before | After |
|-----------|--------|-------|
| `min` | `{0.5}` | `{effectiveMin}` (dynamic, from `computeEffectiveMinMultiplier(bpm)`) |
| `max` | `{2.0}` | `{2.0}` (unchanged) |
| `step` | `{0.05}` | `{0.01}` |
| snap condition | `<= 0.05` | `<= 0.03` |
| `list` | *(absent)* | `"tempo-ticks"` |
| datalist | *(absent)* | `<datalist id="tempo-ticks"><option value="1.0" /></datalist>` |
| `title` (when floor active) | *(absent)* | `"Minimum tempo limited to 10 BPM for this score"` (conditional) |

---

## 5. CSS — New Modifier Class

### `practice-plugin__metro-btn--armed`

```css
.practice-plugin__metro-btn--armed {
  color: var(--color-metro-armed, #c8a000);
  animation: metro-armed-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes metro-armed-pulse {
  from { opacity: 0.4; }
  to   { opacity: 1.0; }
}
```

Defined in the practice view plugin's CSS file (same location as the existing `--active` and `--downbeat` styles).

---

## 6. State Transitions — Metronome in Practice Mode

```
[practice OFF]
    metronomeArmed = false
    metronomeActive = false (or true — independent of practice)
    ↓ user starts practice
[practice WAITING — no note yet]
    toggle metronome ON → metronomeArmed = true, metronomeActive = false
    toggle metronome OFF → metronomeArmed = false, metronomeActive = false
    ↓ first MIDI attack received
    onFirstNoteAttack() → setMetronomeArmed(false) + context.metronome.toggle()
[practice ACTIVE — note matched]
    metronomeArmed = false
    metronomeActive = true  ← engine running
    ↓ session stops
[practice STOPPED]
    metronomeArmed = false (reset in handlePracticeToggle)
    metronomeActive = true (metronome keeps running — user controls it separately)
```

---

## 7. No Schema Changes

`SavedPractice.tempoMultiplier` type is `number` — no change. The new `MIN_TEMPO_MULTIPLIER = 0.1` means any value ≥ 0.1 is valid; all previously saved values (0.5–2.0) remain valid (no migration). `clampTempoMultiplier` on load handles any out-of-range edge case defensively.
