# Musicore Plugin Development Guide

Plugins extend Musicore with new UI views and interactive musical tools. They run inside the application as trusted React components and communicate with the host through a versioned Plugin API.

---

## Table of Contents

1. [Concepts](#concepts)
2. [Plugin API reference](#plugin-api-reference)
3. [Creating a builtin plugin](#creating-a-builtin-plugin)
4. [Creating an importable plugin (ZIP package)](#creating-an-importable-plugin-zip-package)
5. [API constraints and ESLint boundary](#api-constraints-and-eslint-boundary)
6. [Testing your plugin](#testing-your-plugin)
7. [Reference: Virtual Keyboard plugin](#reference-virtual-keyboard-plugin)
8. [Reference: Train plugin](#reference-train-plugin)
9. [Reference: Virtual Keyboard Pro (importable plugin)](#reference-virtual-keyboard-pro-importable-plugin)

---

## Concepts

| Term | Meaning |
|---|---|
| **Plugin** | A self-contained feature that adds a new view to the Musicore navigation bar |
| **Builtin plugin** | Bundled with the repository; always available without installation |
| **Imported plugin** | Packaged as a ZIP file by a third-party developer and installed by the user at runtime |
| **Plugin API** | The only public surface a plugin may import — `frontend/src/plugin-api/index.ts` |
| **PluginContext** | Host-provided object injected into `init()`: the only channel from plugin → host |

---

## Plugin API reference

All public types are exported from `frontend/src/plugin-api/index.ts`. This is the **only** file a plugin is permitted to import from the host.

### `MusicorePlugin`

The interface your plugin's default export must satisfy.

```typescript
import type { MusicorePlugin, PluginContext } from '../../src/plugin-api/index';

const plugin: MusicorePlugin = {
  /** Called once on app startup. Store context for use inside Component. */
  init(context: PluginContext): void { ... },

  /** Optional. Called when the plugin is unregistered. Release resources here. */
  dispose?(): void { ... },

  /** Root React component rendered when the plugin's nav entry is active. */
  Component: () => <div>My Plugin</div>,
};

export default plugin;
```

### `PluginContext`

Injected by the host into `init()`. Store it in a module-level variable and pass it to your component.

```typescript
interface PluginContext {
  /**
   * Send a note event to the host WASM layout pipeline.
   * Use this to record notes the user plays on the musical staff.
   */
  emitNote(event: PluginNoteEvent): void;

  /**
   * Play a note through the host audio engine (Salamander Grand Piano samples).
   * This is the only authorised route for audio — do NOT import Tone.js directly.
   *
   *   type: 'attack'   — note-on  (default when omitted)
   *   type: 'release'  — note-off (release a sustained note)
   *   offsetMs         — optional: schedule playback N ms in the future
   */
  playNote(event: PluginNoteEvent): void;

  /**
   * Cancel all notes scheduled via playNote(offsetMs) and silence
   * any currently playing notes for this plugin.
   */
  stopPlayback(): void;

  /**
   * Microphone pitch subscription — shares a single getUserMedia stream
   * across all subscribers (one AudioContext per app lifetime).
   */
  readonly recording: PluginRecordingContext;

  /** MIDI hardware note events forwarded by the host. */
  readonly midi: { subscribe(handler: (e: PluginNoteEvent) => void): () => void };

  /** Host-provided UI components safe for plugins to render. */
  readonly components: { StaffViewer: React.ComponentType<PluginStaffViewerProps> };

  /** Read-only descriptor for this plugin instance. */
  readonly manifest: Readonly<PluginManifest>;
}
```

### `PluginNoteEvent`

The event type used by both `emitNote` and `playNote`.

```typescript
interface PluginNoteEvent {
  readonly midiNote: number;       // MIDI note number 0–127. Middle C = 60.
  readonly timestamp: number;      // Date.now() at the moment of input.
  readonly velocity?: number;      // 1–127. Defaults to 64 (mezzo-forte).
  readonly type?: 'attack' | 'release'; // Defaults to 'attack'.
  readonly offsetMs?: number;      // Schedule playback this many ms in the future.
  readonly durationMs?: number;    // Auto-release after this many ms (optional).
}
```

### `PluginManifest`

Read-only descriptor available via `context.manifest`. Populated from `plugin.json` plus `origin` set by the host.

```typescript
interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly pluginApiVersion: string;
  readonly entryPoint: string;
  readonly description?: string;
  readonly type?: 'core' | 'common';
  readonly view?: 'full-screen' | 'window';
  readonly icon?: string;
  /**
   * Controls the position of this plugin in the app navigation.
   * Lower values appear before higher values.
   * Plugins without this field appear after all ordered plugins,
   * sorted alphabetically by `id`.
   * Non-finite or non-number values are treated as absent.
   * Example order values: 1 (Play), 2 (Train), 3 (Practice), 4 (Performance).
   */
  readonly order?: number;
  readonly origin: 'builtin' | 'imported';
}
```

### `PLUGIN_API_VERSION`

```typescript
const PLUGIN_API_VERSION = '2';   // current version
```

---

## Creating a builtin plugin

Builtin plugins live in `frontend/plugins/<plugin-id>/` and are bundled at build time.

### Step 1 — Create the folder structure

```
frontend/plugins/my-plugin/
  plugin.json        # manifest
  index.tsx          # MusicorePlugin default export (entry point)
  MyPlugin.tsx       # React component(s)
  MyPlugin.css       # styles (optional)
  MyPlugin.test.tsx  # Vitest tests
```

### Step 2 — Write `plugin.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "pluginApiVersion": "1",
  "entryPoint": "index.js",
  "description": "What this plugin does."
}
```

`id` must be unique across all plugins. `pluginApiVersion` must match `PLUGIN_API_VERSION` (`"1"`).  
Do **not** include an `origin` field — the host sets it automatically.

### Step 3 — Write `index.tsx`

```tsx
/* eslint-disable react-refresh/only-export-components */
import type { MusicorePlugin, PluginContext } from '../../src/plugin-api/index';
import { MyPlugin } from './MyPlugin';

// Store context at module scope so the Component closure can access it.
let _context: PluginContext | null = null;

function MyPluginWithContext() {
  if (!_context) return null;
  return <MyPlugin context={_context} />;
}

const plugin: MusicorePlugin = {
  init(context) {
    _context = context;
  },
  dispose() {
    _context = null;
  },
  Component: MyPluginWithContext,
};

export default plugin;
```

### Step 4 — Write your component

```tsx
import { useCallback } from 'react';
import type { PluginContext } from '../../src/plugin-api/index';

export function MyPlugin({ context }: { context: PluginContext }) {
  const handlePlay = useCallback(() => {
    // Play middle C via the host audio engine
    context.playNote({ midiNote: 60, timestamp: Date.now(), type: 'attack' });
    // Also record it on the score staff
    context.emitNote({ midiNote: 60, timestamp: Date.now() });
  }, [context]);

  const handleRelease = useCallback(() => {
    context.playNote({ midiNote: 60, timestamp: Date.now(), type: 'release' });
  }, [context]);

  return (
    <button onMouseDown={handlePlay} onMouseUp={handleRelease}>
      Play C4
    </button>
  );
}
```

### Step 5 — Register in `builtinPlugins.ts`

Edit `frontend/src/services/plugins/builtinPlugins.ts`:

```typescript
import myPlugin from '../../../plugins/my-plugin/index';
import myPluginManifest from '../../../plugins/my-plugin/plugin.json';

export const BUILTIN_PLUGINS: BuiltinPluginEntry[] = [
  // ... existing plugins ...
  {
    manifest: {
      ...(myPluginManifest as Omit<PluginManifest, 'origin'>),
      origin: 'builtin' as const,
    },
    plugin: myPlugin,
  },
];
```

That's it — the plugin now appears in the navigation bar on the next `npm run dev`.

---

## Creating an importable plugin (ZIP package)

Imported plugins are distributed as `.zip` files and installed by the user via the **Import Plugin** button in the Musicore UI. They are persisted in IndexedDB and survive reloads.

> **Note**: Because importable plugins are loaded at runtime without a bundler, they must be pre-compiled to a single JavaScript file. This packaging step is the responsibility of the plugin developer.

### ZIP structure

```
my-plugin.zip
├── plugin.json     # required — manifest (same schema as above)
└── index.js        # required — compiled/bundled ES module, default-exports MusicorePlugin
```

Both files must be at the **root** of the ZIP (no subdirectory nesting). The `entryPoint` field in `plugin.json` must match the JS filename exactly.

### Validation rules

The importer rejects ZIPs that fail any of the following checks:

| Rule | Requirement |
|---|---|
| `plugin.json` present | ZIP must contain `plugin.json` at root |
| Valid JSON | `plugin.json` must parse without errors |
| Required fields | `id`, `name`, `version`, `pluginApiVersion`, `entryPoint` must all be present strings |
| API version | `pluginApiVersion` must equal `"2"` |
| Entry point present | The file named by `entryPoint` must exist in the ZIP |
| No duplicate ID | If a plugin with the same `id` is already installed, the user is prompted to replace or cancel |

### Building a plugin for distribution

You can use any bundler. Here is a minimal example using `esbuild`:

```bash
# Install dependencies
npm install --save-dev esbuild

# Bundle to a single file (React must be available in the Musicore host — use externals)
npx esbuild index.tsx \
  --bundle \
  --format=esm \
  --external:react \
  --external:react-dom \
  --outfile=dist/index.js

# Package
zip my-plugin.zip plugin.json dist/index.js --junk-paths
```

> React is provided by the Musicore host. Mark it external in your bundler config to avoid shipping a duplicate copy.

---

## API constraints and ESLint boundary

These rules are enforced automatically by ESLint (`frontend/eslint.config.js`).

### Permitted imports

```typescript
// ✅ Allowed — only the public API barrel
import type { MusicorePlugin, PluginContext, PluginNoteEvent } from '../../src/plugin-api/index';
```

### Forbidden imports

```typescript
// ❌ Forbidden — direct access to host internals
import { ToneAdapter } from '../../src/services/playback/ToneAdapter';
import { ScoreViewer }  from '../../src/components/ScoreViewer';
import { someUtil }     from '../../src/utils/someUtil';
```

### Forbidden direct audio access

```typescript
// ❌ Forbidden — plugins must not use Tone.js or Web Audio API directly
import * as Tone from 'tone';
const ctx = new AudioContext();
```

Use `context.playNote()` instead. The host manages the audio engine (Tone.js + Salamander Grand Piano samples) and enforces a single, shared AudioContext.

### Constitution Principle VI

`PluginNoteEvent` carries **musical data only** (`midiNote`, `timestamp`, `velocity`). Never add coordinate or layout fields — the WASM engine is the sole authority over all spatial layout.

---

## Testing your plugin

Write Vitest tests alongside your component. Mock `PluginContext` to keep tests fast and isolated:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MyPlugin } from './MyPlugin';
import type { PluginContext, PluginManifest } from '../../src/plugin-api/index';

function makeContext(
  emitNote = vi.fn(),
  playNote = vi.fn(),
): PluginContext {
  const manifest: PluginManifest = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    pluginApiVersion: '1',
    entryPoint: 'index.js',
    origin: 'builtin',
  };
  return { emitNote, playNote, manifest };
}

describe('MyPlugin', () => {
  let context: PluginContext;

  beforeEach(() => {
    context = makeContext();
  });

  it('calls playNote with type:attack when button is pressed', () => {
    render(<MyPlugin context={context} />);
    fireEvent.mouseDown(document.querySelector('button')!);
    expect(context.playNote).toHaveBeenCalledWith(
      expect.objectContaining({ midiNote: 60, type: 'attack' }),
    );
  });
});
```

Run the plugin tests:

```bash
cd frontend
npx vitest run plugins/my-plugin/
```

---

## Reference: Virtual Keyboard plugin

The Virtual Keyboard (`frontend/plugins/virtual-keyboard/`) is the canonical reference implementation. It demonstrates:

- Module-level `PluginContext` storage and injection into the React tree
- `context.playNote()` for attack/release audio via the host engine
- `context.emitNote()` to send note data to the WASM layout pipeline
- `useEffect` unmount cleanup to release held notes when navigating away
- A full Vitest test suite covering layout, MIDI mapping, and API calls

---

## Reference: Train plugin

The Train plugin (`frontend/plugins/train-view/`) is the reference implementation for:

- **Scheduled playback** — `context.playNote({ offsetMs })` fires notes at precise future times
- **Stop control** — `context.stopPlayback()` cancels all pending scheduled notes
- **Microphone pitch input** — `context.recording.subscribe(handler)` receives `PluginPitchEvent` objects from the host's shared mic stream
- **MIDI input** — `context.midi.subscribe(handler)` for hardware keyboard events
- **StaffViewer** — `context.components.StaffViewer` renders a read-only notation staff inside the plugin without importing the layout engine
- **Phase state machine** — `ready → countdown → playing → results`
- **Timer-based countdown** — compatible with `vi.useFakeTimers()` (no async/await)
- **Score preset (v2, Feature 034)** — requires **Plugin API v4**:
  - `context.scorePlayer.extractPracticeNotes(maxCount)` → `PluginScorePitches`
  - `context.components.ScoreSelector` — host-owned overlay for catalogue / file loading
  - Clef and octave are derived from the loaded score; controls disabled in Score mode
  - `generateScoreExercise(bpm, pitches, noteCount)` — plugin-internal factory
  - Preset caching: `scorePitches` preserved across preset switches
- **Note-duration checking (Feature 042)** — requires **Plugin API v7**:
  - `PluginPracticeNoteEntry.durationTicks` — written duration in ticks (960 PPQ); `0` = no hold required (backward-compatible)
  - New practice mode `'holding'` — engine stays on current note until `HOLD_COMPLETE` is dispatched
  - `HOLD_COMPLETE` action — advances session; records `correct` / `correct-late` result
  - `EARLY_RELEASE` action — records `early-release` result (0.5× score credit); session stays on same note for retry
  - Visual hold indicator rendered when `holdProgress > 0` and `requiredHoldMs > quarterNoteMs`
  - Quarter notes (`durationTicks <= 960`) and shorter advance immediately — no hold required
- A full Vitest test suite covering all user-visible behaviours (US1–US4)

---

## Reference: Virtual Keyboard Pro (importable plugin)

The Virtual Keyboard Pro (`plugins-external/virtual-keyboard-pro/`) is the canonical example of a **standalone importable plugin** — it lives outside `frontend/`, has its own `package.json` and build tooling, and is distributed as `virtual-keyboard-pro.zip`.

### Why it's a useful reference

- **Standalone project** — own `package.json`, `tsconfig.json`, `vitest.config.ts`; no Vite integration
- **esbuild compilation** — single `build.sh` compiles TSX → `dist/index.js` and merges CSS inline
- **CSS injection** — styles are appended to `<head>` at runtime via a self-invoking function in the bundle (needed because no Vite CSS pipeline is available for imported plugins)
- **Full Plugin API v2** — uses `playNote`, `emitNote`, `midi.subscribe`, `StaffViewer`; does NOT use `stopPlayback` or `recording`
- **24 Vitest tests** covering all four user stories (US1–US4) using a mock `PluginContext`
- **Three-octave layout** — `BASE_NOTES` array (36 notes) + `octaveOffset` useMemo shift pattern

### Source layout

```
plugins-external/virtual-keyboard-pro/
  package.json               # dev deps: esbuild, typescript, vitest, @testing-library/react
  tsconfig.json              # standalone — references ../frontend/src/plugin-api/index.ts
  vite.config.ts             # vitest config (jsdom env, globals, setupFiles)
  vitest.setup.ts            # @testing-library/jest-dom setup
  build.sh                   # esbuild → dist/index.js + CSS injection → ZIP
  scripts/inject-css.mjs     # CSS merger helper used by build.sh
  plugin.json                # manifest (id=virtual-keyboard-pro, pluginApiVersion="2")
  README.md                  # user-facing installation guide (included in ZIP)
  index.tsx                  # MusicorePlugin default export
  VirtualKeyboardPro.tsx     # main React component (~350 lines)
  VirtualKeyboardPro.css     # styles (compiled into index.js at build time)
  VirtualKeyboardPro.test.tsx # 24 Vitest tests (US1–US4)
```

### Build and distribute

```bash
cd plugins-external/virtual-keyboard-pro
npm install           # first time only
npm test              # run 24 Vitest tests
npm run build         # produces virtual-keyboard-pro.zip at repo root
```

The produced `virtual-keyboard-pro.zip` (≈5 KB) can be imported directly via the Musicore host importer:

**Settings → Plugins → Import Plugin → select `virtual-keyboard-pro.zip`**

---

## Built-in Core Plugins

### `play-score` — Play Score

| Field | Value |
|-------|-------|
| **ID** | `play-score` |
| **Name** | Play Score |
| **Version** | 1.0.0 |
| **Plugin API Version** | 3 |
| **Type** | `core` |
| **View** | `full-screen` |
| **Entry point** | `index.tsx` |

#### Description

Load and play scores from the built-in library or from a local file. Supports standard playback, note-tap seeking, pin/loop regions, tempo adjustment, and full audio teardown on exit.

#### Score Sources

- **Catalogue** — 6 pre-loaded `.mxl` scores bundled with the app
- **File** — user-supplied `.mxl` / `.xml` / `.musicxml` files from the device file picker

#### Context Requirements (Plugin API v3)

| Context Key | Usage |
|-------------|-------|
| `scorePlayer.getCatalogue()` | Populate selection screen |
| `scorePlayer.loadScore(source)` | Load catalogue or file score |
| `scorePlayer.subscribe(handler)` | React to state changes (status, tick, BPM) |
| `scorePlayer.play/pause/stop` | Playback control |
| `scorePlayer.seekToTick(tick)` | Note tap + return-to-start |
| `scorePlayer.setPinnedStart(tick\|null)` | Pin loop start |
| `scorePlayer.setLoopEnd(tick\|null)` | Pin loop end |
| `scorePlayer.setTempoMultiplier(m)` | Tempo control |
| `components.ScoreRenderer` | Host-provided score rendering component |
| `context.close()` | Return to landing screen via Back button |
| `context.stopPlayback()` | Used in teardown effect on unmount |

#### Event Flow

```
Landing screen
  → tap [plugin-launch-play-score]
  → ScoreSelectionScreen (selection)
      → tap score entry   → PlayScorePlugin (player)
      → tap Load from file → file picker → PlayScorePlugin (player)
  → PlayScorePlugin (player)
      → tap Back          → context.close()  → Landing screen
```

---

### Key implementation patterns

```tsx
// Octave shift: shift the full 3-octave BASE_NOTES array by ±12 semi-tones
const visibleNotes = useMemo(
  () => BASE_NOTES.map(n => resolveNote(n, octaveOffset)),
  [octaveOffset]
);

// MIDI subscription — re-subscribe when visible range changes
useEffect(() => {
  return context.midi.subscribe((event) => {
    if (event.type === 'release') {
      handleKeyUp(event.midiNote);
    } else {
      const note = visibleNotes.find(n => n.midi === event.midiNote);
      if (note) handleKeyDown(note);
    }
  });
}, [context, visibleNotes]);

// Empty staff on load — notes=[] renders clef + time signature only
<context.components.StaffViewer notes={playedNotes} clef="Treble" bpm={120} ... />
```
