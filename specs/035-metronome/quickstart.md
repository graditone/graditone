# Quickstart: Metronome — Developer Guide

**Feature**: 035-metronome  
**Branch**: `035-metronome`  
**Date**: 2026-03-02

---

## Prerequisites

```bash
# From repo root
cd frontend
npm install       # Already installed; re-run if you see missing package errors
```

Vitest and Playwright are already configured. No new dependencies to install — `Tone.MembraneSynth` is part of the existing `tone` package (`^14.9.17`).

---

## Development Order

Follow the TDD sequence below. Always write the failing test before writing the implementation.

### Step 1 — Core Engine (RED → GREEN)

```bash
# Run metronome engine tests in watch mode
cd frontend
npx vitest --watch src/services/metronome/MetronomeEngine.test.ts
```

Create `frontend/src/services/metronome/MetronomeEngine.test.ts` first (it should fail), then `MetronomeEngine.ts`.

**Minimum test cases for MetronomeEngine.test.ts**:
- BPM clamping: `start(10)` → effective BPM is 20; `start(500)` → effective BPM is 300
- `start()` returns active state; `stop()` returns inactive state
- Beat index increments modulo `timeSignatureNumerator`
- `isDownbeat` is `true` only at beat index 0
- Default 120 BPM when no score loaded

### Step 2 — Plugin API Types

Update `frontend/src/plugin-api/types.ts`:

```typescript
// 1. Add MetronomeState interface (see contracts/plugin-api-v5.ts)
// 2. Add PluginMetronomeContext interface
// 3. Extend ScorePlayerState with timeSignature field
// 4. Add readonly metronome: PluginMetronomeContext to PluginContext
// 5. Bump PLUGIN_API_VERSION to '5'
```

Run the full type-check to verify:

```bash
cd frontend && npx tsc --noEmit
```

### Step 3 — scorePlayerContext.ts extension

In `frontend/src/plugin-api/scorePlayerContext.ts`:

1. Add private `extractTimeSignature(score)` helper (see research.md R-003 for code)
2. Add `const [timeSignature, setTimeSignature] = useState(...)` 
3. Call `setTimeSignature(extractTimeSignature(result.score))` in `loadScore()` after the existing `setScoreTempo()` call
4. Add `timeSignature` to the `ScorePlayerState` snapshot object

### Step 4 — MetronomeEngine implementation

Key design points for `MetronomeEngine.ts`:

```typescript
// Beat interval in Tone.js notation:
// e.g. 4/4 at 120 BPM → beat every "4n" (quarter note)
// 3/8 at 120 BPM → beat every "8n" (eighth note)
// General: Tone.Time({ "4n": 4 / denominator })

class MetronomeEngine {
  private beatIndex = -1;
  private repeatEventId: number | null = null;
  private downbeatSynth: Tone.MembraneSynth | null = null;
  private upbeatSynth: Tone.Synth | null = null;

  async start(bpm: number, numerator: number, denominator: number): Promise<void> {
    const effectiveBpm = Math.min(300, Math.max(20, bpm));
    // Initialize audio (handles browser autoplay unlock)
    await ToneAdapter.getInstance().init();
    // Create synths if needed
    // Start Transport if not already running
    // Schedule repeating beat event
  }

  stop(): void {
    // Cancel the repeat event
    // Silence synths
    // Reset beatIndex to -1
  }
}
```

### Step 5 — metronomeContext.ts (Plugin API bridge)

Create `frontend/src/plugin-api/metronomeContext.ts` with the T006 proxy pattern:

```typescript
export function useMetronomeBridge(): { api: PluginMetronomeContext } { ... }
export function createNoOpMetronome(): PluginMetronomeContext { ... }
export function createMetronomeProxy(ref: { current: PluginMetronomeContext }): PluginMetronomeContext { ... }
```

Reference `scorePlayerContext.ts` for the exact proxy pattern shape.

### Step 6 — Wire into PluginView.tsx and App.tsx

In `PluginView.tsx` — add `metronomeRef` to `V3ProxyRefs`:
```typescript
metronomeRef: { current: PluginMetronomeContext };
```

In the `V3PluginWrapper` component:
```typescript
const { api: metronomeApi } = useMetronomeBridge();
proxyRefs.metronomeRef.current = metronomeApi;
```

In `App.tsx` — in `loadPlugins()`:
```typescript
const metronomeRef = { current: createNoOpMetronome() };
v3ProxyRefsMap[plugin.manifest.id] = { scorePlayerRef, metronomeRef };
const context: PluginContext = {
  // ... existing fields ...
  metronome: createMetronomeProxy(metronomeRef),
};
```

### Step 7 — Play Score Plugin UI

In `playbackToolbar.tsx`:

1. Extend `PlaybackToolbarProps` with:
   ```typescript
   metronomeActive: boolean;
   metronomeIsDownbeat: boolean;  // for visual pulse
   onMetronomeToggle: () => void;
   ```

2. Add metronome button as the **rightmost** element:
   ```tsx
   <button
     className={`play-score__toolbar-btn play-score__toolbar-btn--metronome ${
       metronomeActive ? 'play-score__toolbar-btn--metronome-active' : ''
     } ${metronomeIsDownbeat ? 'play-score__toolbar-btn--metronome-pulse' : ''}`}
     onClick={onMetronomeToggle}
     aria-label={metronomeActive ? 'Stop metronome' : 'Start metronome'}
     aria-pressed={metronomeActive}
   >
     ♩
   </button>
   ```

3. In `PlayScorePlugin.tsx`, subscribe to `context.metronome.subscribe()` and wire state to toolbar props.

### Step 8 — Practice View Plugin UI

In `PracticePlugin.tsx`, add the metronome button to the existing header toolbar, rightmost position. Follow the same pattern as Step 7.

The practice BPM is already in `bpmValue` state — pass it to `context.metronome.toggle()` by reading it before calling toggle (or the engine reads it from `context.scorePlayer` state).

### Step 9 — E2E Tests

```bash
cd frontend
npx playwright test tests/metronome.spec.ts --project=chromium
```

**Minimum E2E scenarios** (see spec FR-001 through FR-012):
- Metronome button visible in play view toolbar (rightmost)
- Clicking button toggles `aria-pressed` attribute
- `metronome-active` CSS class applied when active
- Metronome button visible in practice view toolbar (rightmost)
- Navigating away from play view removes active state

---

## Running All Tests

```bash
cd frontend

# Unit + integration (fast)
npx vitest run

# E2E (slower, requires build)
npx playwright test --project=chromium
```

---

## CSS Conventions

Follow existing `play-score__` and `practice__` BEM naming conventions.

**Visual pulse CSS** (`play-score/PlayScorePlugin.css`):
```css
.play-score__toolbar-btn--metronome-active {
  color: var(--color-accent);        /* highlighted state */
}
.play-score__toolbar-btn--metronome-pulse {
  animation: metro-pulse 0.08s ease-out;
}
@keyframes metro-pulse {
  0%   { transform: scale(1.15); }
  100% { transform: scale(1.0); }
}
```

---

## Debugging Tips

- **No audio in browser?** Open DevTools → Console. Look for `[ToneAdapter]` log lines. `Tone.start()` must be called inside a user gesture.
- **Beat drifting relative to playback?** Verify `scheduleRepeat` is tied to the same Transport; check that `ToneAdapter.startTransport()` was called before scheduling.
- **Test failures on `MetronomeEngine`?** Tone.js requires `AudioContext` — jest/vitest runs in Node. Use `vi.mock('tone', ...)` to stub the audio primitives.
- **Type errors after `types.ts` edit?** Run `npx tsc --noEmit` from `frontend/` to get the full error list before running tests.
