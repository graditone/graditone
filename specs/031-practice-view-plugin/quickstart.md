> **Renamed** — The plugin described in this document was renamed to **Train** in feature 036.
> Canonical plugin path: `frontend/plugins/train-view/`
> See [specs/036-rename-practice-train/](../036-rename-practice-train/) for the rename spec.

---

# Quickstart: Practice View Plugin & Plugin API Recording Extension

## Overview

This feature does three things:

1. **Extends the Plugin API (v1 → v2)** with microphone pitch capture (`context.recording`) and scheduled playback (`offsetMs` on `context.playNote`, `context.stopPlayback()`).
2. **Migrates `PracticeView`** from an internal debug component into a self-contained built-in plugin at `frontend/plugins/practice-view/`.
3. **Removes the old `PracticeView`** internal wiring after migration.

---

## 1. Plugin API Changes — What Implementors Touch

### 1a. Types update (`frontend/src/plugin-api/types.ts`)

Add to the file (see contracts/plugin-api-v2.ts for full reference):

```ts
// --- NEW: PluginPitchEvent ---
export interface PluginPitchEvent {
  readonly midiNote: number;
  readonly hz: number;
  readonly confidence: number;
  readonly timestamp: number;
}

// --- NEW: PluginRecordingContext ---
export interface PluginRecordingContext {
  subscribe(handler: (event: PluginPitchEvent) => void): () => void;
  onError(handler: (error: string) => void): () => void;
}

// --- EXTEND: PluginNoteEvent (add optional offsetMs) ---
export interface PluginNoteEvent {
  // ... existing fields ...
  readonly offsetMs?: number;   // ← NEW (v2, optional, backward-compatible)
}

// --- EXTEND: PluginContext (add recording + stopPlayback) ---
export interface PluginContext {
  // ... existing members ...
  readonly recording: PluginRecordingContext;  // ← NEW (v2)
  stopPlayback(): void;                        // ← NEW (v2)
}

// --- BUMP: API version ---
export const PLUGIN_API_VERSION = '2' as const;   // ← was '1'
```

### 1b. Barrel update (`frontend/src/plugin-api/index.ts`)

```ts
export type {
  PluginNoteEvent,
  PluginManifest,
  PluginContext,
  PluginStaffViewerProps,
  MusicorePlugin,
  PluginPitchEvent,        // ← NEW
  PluginRecordingContext,  // ← NEW
} from './types';
```

---

## 2. New Host Service: `PluginMicBroadcaster`

Create `frontend/src/services/recording/PluginMicBroadcaster.ts`:

```ts
import { detectPitch } from '../recording/pitchDetection';
import type { PluginPitchEvent } from '../../plugin-api/types';

class PluginMicBroadcaster {
  private static _instance: PluginMicBroadcaster | null = null;
  static getInstance(): PluginMicBroadcaster {
    if (!PluginMicBroadcaster._instance) {
      PluginMicBroadcaster._instance = new PluginMicBroadcaster();
    }
    return PluginMicBroadcaster._instance;
  }

  private pitchHandlers = new Set<(e: PluginPitchEvent) => void>();
  private errorHandlers = new Set<(e: string) => void>();
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private errorState: string | null = null;

  subscribe(handler: (e: PluginPitchEvent) => void): () => void {
    this.pitchHandlers.add(handler);
    if (this.pitchHandlers.size === 1 && !this.stream) this.startMic();
    return () => {
      this.pitchHandlers.delete(handler);
      if (this.pitchHandlers.size === 0) this.stopMic();
    };
  }

  onError(handler: (e: string) => void): () => void {
    this.errorHandlers.add(handler);
    if (this.errorState) queueMicrotask(() => handler(this.errorState!));
    return () => { this.errorHandlers.delete(handler); };
  }

  isActive(): boolean { return this.stream !== null; }

  private async startMic() { /* getUserMedia + AudioWorklet + detectPitch dispatch */ }
  private stopMic() { /* teardown */ }
  private dispatch(event: PluginPitchEvent) { this.pitchHandlers.forEach(h => h(event)); }
  private dispatchError(msg: string) {
    this.errorState = msg;
    this.errorHandlers.forEach(h => h(msg));
  }
}

export const pluginMicBroadcaster = PluginMicBroadcaster.getInstance();
```

Key implementation note: reuse `pitchDetection.ts`'s `detectPitch` function in the AudioWorklet `onmessage` handler — identical to how `usePracticeRecorder` does it, to avoid duplicating the algorithm.

---

## 3. App.tsx Changes

### 3a. Add `pluginTimersRef` for per-plugin `stopPlayback()`

```tsx
const pluginTimersRef = useRef<Map<string, Set<ReturnType<typeof setTimeout>>>>(new Map());
```

### 3b. Extend PluginContext construction in `loadPlugins()`

```tsx
const context: PluginContext = {
  // --- EXISTING members (unchanged) ---
  emitNote: ...,
  components: ...,
  midi: ...,
  manifest,

  // --- playNote: extended with offsetMs scheduling ---
  playNote: (event) => {
    const adapter = ToneAdapter.getInstance();
    if (!adapter.isInitialized()) return;
    if (event.type === 'release') {
      adapter.releaseNote(event.midiNote);
      return;
    }
    if (event.offsetMs && event.offsetMs > 0) {
      // Scheduled playback — register timer for stopPlayback() cancellation
      if (!pluginTimersRef.current.has(manifest.id)) {
        pluginTimersRef.current.set(manifest.id, new Set());
      }
      const timers = pluginTimersRef.current.get(manifest.id)!;
      const duration = event.durationMs ?? 500;
      const timer = setTimeout(() => {
        timers.delete(timer);
        adapter.playNote(event.midiNote, duration / 1000, 0);
      }, event.offsetMs);
      timers.add(timer);
    } else {
      adapter.attackNote(event.midiNote, event.velocity ?? 64);
    }
  },

  // --- NEW: stopPlayback ---
  stopPlayback: () => {
    const timers = pluginTimersRef.current.get(manifest.id);
    if (timers) {
      timers.forEach(clearTimeout);
      timers.clear();
    }
    ToneAdapter.getInstance().stopAll();
  },

  // --- NEW: recording namespace ---
  recording: {
    subscribe: (handler) => pluginMicBroadcaster.subscribe(handler),
    onError: (handler) => pluginMicBroadcaster.onError(handler),
  },
};
```

### 3c. Remove PracticeView routing (after plugin migration)

```tsx
// DELETE:
// const [showPractice, setShowPractice] = useState(false);
// const handleShowPractice = useCallback(() => { ... }, []);
// import { PracticeView } from './components/practice/PracticeView';
// {showPractice && <PracticeView onBack={...} />}
```

---

## 4. Practice Plugin Structure

```
frontend/plugins/practice-view/
├── plugin.json             # manifest — pluginApiVersion: "2"
├── index.tsx               # MusicorePlugin entry (same shape as virtual-keyboard)
├── PracticePlugin.tsx      # main component (uses context.* only)
├── PracticePlugin.css
├── PracticePlugin.test.tsx # covers all phase transitions + scoring
├── exerciseGenerator.ts    # plugin-internal copy of src/services/practice/
├── exerciseScorer.ts       # plugin-internal copy
├── matchRawNotesToSlots.ts # plugin-internal copy
└── practiceTypes.ts        # PracticePhase, PracticeExercise, ExerciseResult, etc.
```

### `plugin.json`

```json
{
  "id": "practice-view",
  "name": "Practice",
  "version": "1.0.0",
  "pluginApiVersion": "2",
  "entryPoint": "index.tsx",
  "description": "Piano practice exercise — play along and see your score."
}
```

### Key component shape (`PracticePlugin.tsx` excerpt)

```tsx
import type { PluginContext, PluginPitchEvent, PluginNoteEvent } from '../../src/plugin-api/index';
// ALL Musicore capabilities come from context. No src/services/ imports.

export function PracticePlugin({ context }: { context: PluginContext }) {
  const [phase, setPhase] = useState<PracticePhase>('ready');
  const [exercise, setExercise] = useState(() => generateExercise(defaultConfig));
  const captureRef = useRef<PluginPitchEvent[]>([]);

  // Pitch events from microphone — always-on, plugin filters by phase
  useEffect(() => {
    return context.recording.subscribe((event) => {
      if (phase !== 'playing') return;
      captureRef.current.push(event);
    });
  }, [context, phase]);

  // MIDI events — same pattern
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (event.type !== 'attack' || phase !== 'playing') return;
      captureRef.current.push({ midiNote: event.midiNote, hz: 0, confidence: 1, timestamp: event.timestamp });
    });
  }, [context, phase]);

  // Scheduled exercise playback
  const handlePlay = useCallback(async () => {
    setPhase('countdown');
    await runCountdown();   // 3…2…1…Go! — setTimeout-based
    setPhase('playing');
    captureRef.current = [];
    exercise.notes.forEach((note, i) => {
      context.playNote({
        midiNote: note.midiPitch,
        timestamp: Date.now(),
        offsetMs: note.expectedOnsetMs,
        durationMs: msPerBeat * 0.85,
      });
    });
    // Finish timer
    setTimeout(() => {
      context.stopPlayback();
      const result = scoreCapture(exercise, captureRef.current);
      setResult(result);
      setPhase('results');
    }, lastNoteMs + msPerBeat + 100);
  }, [context, exercise, phase]);

  return (
    <>
      {/* Exercise staff */}
      <context.components.StaffViewer notes={exerciseNotes} highlightedNotes={highlightedNotes} clef={config.clef} />
      {/* Response staff */}
      <context.components.StaffViewer notes={responseNotes} clef={config.clef} />
      {/* Controls, config, results... */}
    </>
  );
}
```

---

## 5. `builtinPlugins.ts` update

```ts
import practiceViewPlugin from '../../../plugins/practice-view/index';
import practiceViewManifestJson from '../../../plugins/practice-view/plugin.json';

export const BUILTIN_PLUGINS: BuiltinPluginEntry[] = [
  {
    manifest: { ...(virtualKeyboardManifestJson as Omit<PluginManifest, 'origin'>), origin: 'builtin' },
    plugin: virtualKeyboardPlugin,
  },
  {
    manifest: { ...(practiceViewManifestJson as Omit<PluginManifest, 'origin'>), origin: 'builtin' },
    plugin: practiceViewPlugin,
  },
];
```

---

## 6. `ScoreViewer.tsx` update

Remove the `onShowPractice` prop, the practice debug button, and `PracticeViewProps` type reference (if any). The Practice feature is now available via the navigation plugin entry — no debug button needed.

---

## 7. Deletion checklist (after migration verified)

- [ ] `frontend/src/components/practice/PracticeView.tsx`
- [ ] `frontend/src/components/practice/PracticeView.css`
- [ ] `frontend/src/components/practice/PracticeView.test.tsx` ← only after `PracticePlugin.test.tsx` covers equivalent scenarios
- [ ] `frontend/src/components/practice/ExerciseResultsView.tsx` (if standalone; otherwise move inline into plugin)
- [ ] `frontend/src/types/practice.ts` — audit: if only used by practice components, delete; if shared, keep
- [ ] `frontend/src/services/practice/practiceLayoutAdapter.ts` — used only by PracticeView; delete after plugin migration

---

## 8. ESLint boundary — practice-view plugin

The existing ESLint `no-restricted-imports` block in `frontend/eslint.config.js` already targets `plugins/**/*.{ts,tsx}`. No changes needed — the boundary already enforces that `frontend/plugins/practice-view/` cannot import from `src/` except via `src/plugin-api/`.

Verify by running:
```
cd frontend && npx eslint plugins/practice-view/
```
Any import of `src/services/`, `src/components/`, `src/wasm/` etc. must produce an error.

---

## 9. Test strategy

| Area | Test file | Coverage required |
|---|---|---|
| `PluginMicBroadcaster` | `src/services/recording/PluginMicBroadcaster.test.ts` | subscribe/unsubscribe, shared stream, error delivery, teardown on last unsubscribe |
| Plugin API contract | `src/plugin-api/plugin-api.test.ts` (extend) | `PluginPitchEvent` type, `recording` namespace present on context, `stopPlayback` callable |
| `offsetMs` scheduling | `src/App.test.tsx` or integration test | Note delayed by offsetMs fires after correct interval; stopPlayback cancels it |
| Practice plugin | `plugins/practice-view/PracticePlugin.test.tsx` | All phase transitions, mic capture, MIDI capture, flow mode, step mode, scoring, results display |
| ESLint boundary | `plugins/practice-view/PracticePlugin.test.tsx` (lint CI) | Zero imports from `src/services/`, `src/wasm/` |
