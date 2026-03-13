# Quick Start: Graditone Documentation Plugin

**Phase 1 output** | Feature `001-docs-plugin` | 2026-03-13

This guide enables a developer to implement the Guide plugin from scratch following the plan.

---

## Prerequisites

- Working Graditone development environment (`npm run dev` serving the frontend)
- Familiarity with the plugin system (see `specs/030-plugin-architecture/quickstart.md`)
- Node dependencies installed (`cd frontend && npm install`)

---

## Step 1: Create the plugin directory

```bash
mkdir frontend/plugins/guide
```

All files for the plugin live here. No registration in any existing file is needed — Vite's `import.meta.glob` in `builtinPlugins.ts` picks up any directory with `index.{ts,tsx}` + `plugin.json` automatically.

---

## Step 2: Write the plugin manifest

Create `frontend/plugins/guide/plugin.json`:

```json
{
  "id": "guide",
  "name": "Guide",
  "version": "1.0.0",
  "pluginApiVersion": "1",
  "entryPoint": "index.tsx",
  "description": "App guide and usage documentation for Graditone.",
  "type": "common",
  "view": "window",
  "icon": "📖",
  "order": 99
}
```

Key decisions:
- `"type": "common"` → appears in the top nav bar (not on the landing screen)
- `"view": "window"` → App.tsx renders a host "← Back" button automatically
- `"pluginApiVersion": "1"` → activates the v1/v2 rendering path (host back button bar)
- `"order": 99` → rightmost position in the nav bar (sortPluginsByOrder handles this)

---

## Step 3: Write the entry point

Create `frontend/plugins/guide/index.tsx`:

```tsx
import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';
import { GuidePlugin } from './GuidePlugin';

let _context: PluginContext | null = null;

function GuidePluginWithContext() {
  if (!_context) {
    return <div className="guide-plugin">Guide: context not initialised</div>;
  }
  return <GuidePlugin />;
}

const guidePlugin: GraditonePlugin = {
  init(context: PluginContext) {
    _context = context;
  },
  dispose() {
    _context = null;
  },
  Component: GuidePluginWithContext,
};

export default guidePlugin;
```

> **Note**: `PluginContext` is stored but not consumed — the Guide is purely static. The pattern follows existing plugins (practice-view-plugin, play-score) for future extensibility.

---

## Step 4: Write the Guide component

Create `frontend/plugins/guide/GuidePlugin.tsx`:

```tsx
import './GuidePlugin.css';

export function GuidePlugin() {
  return (
    <div className="guide-plugin">
      <section className="guide-section" aria-labelledby="guide-h-what">
        <h2 id="guide-h-what">What is Graditone?</h2>
        <p>
          Graditone is a tablet-native app for interactive music scores, designed
          for practice and performance. Load any MusicXML score, hear it played
          back, follow along as notes are highlighted in real time, and train
          note by note with MIDI-driven step practice.
        </p>
        <p>
          Graditone works fully offline — once loaded, no internet connection is
          required.
        </p>
      </section>

      <section className="guide-section" aria-labelledby="guide-h-play">
        <h2 id="guide-h-play">Playing a Score</h2>
        <p>Open the <strong>Play</strong> plugin to load and play a score.</p>
        <ul>
          <li><strong>Tap a note</strong> — seek playback to that note and highlight it</li>
          <li><strong>Long-press a note</strong> — pin it (green highlight); sets the loop start point</li>
          <li><strong>Long-press a second note</strong> — define a loop region between the two pinned notes</li>
          <li><strong>Tap inside the loop region</strong> — clear the loop and return to free playback</li>
        </ul>
        <p>Use the tempo slider in the playback toolbar to slow down or speed up playback for practice.</p>
      </section>

      <section className="guide-section" aria-labelledby="guide-h-practice">
        <h2 id="guide-h-practice">Practice Mode</h2>
        <p>Open the <strong>Practice</strong> plugin to practise a score note by note.</p>
        <ol>
          <li>Select a score from the library.</li>
          <li>Connect your MIDI keyboard (USB or Bluetooth) to your device.</li>
          <li>Tap <strong>Practice</strong> — the first target note is highlighted.</li>
          <li>Play the highlighted note on your MIDI keyboard to advance. The app waits until you play the correct pitch.</li>
          <li>Continue until the end of the score. Your progress is shown in the toolbar.</li>
        </ol>
        <p>Practice works without a score selected — you can also play freely and see each note displayed on the staff.</p>
      </section>

      <section className="guide-section" aria-labelledby="guide-h-train">
        <h2 id="guide-h-train">Train</h2>
        <p>Open the <strong>Train</strong> plugin to sharpen your note-reading with ear-training exercises.</p>
        <p><strong>Complexity levels</strong> — choose one to set tempo, note count, and mode:</p>
        <ul>
          <li><strong>Low</strong> — 8 notes, C4 scale, Step mode, 40 BPM</li>
          <li><strong>Mid</strong> — 16 notes, Random, Step mode, 80 BPM</li>
          <li><strong>High</strong> — 20 notes, Random, Flow mode, 100 BPM</li>
        </ul>
        <p>Your selected level is remembered across sessions.</p>
        <p><strong>Training modes</strong>:</p>
        <ul>
          <li><strong>Step</strong> — the app waits for you to play the correct note before advancing to the next slot.</li>
          <li><strong>Flow</strong> — the exercise plays through in real time; you play along and receive a score at the end.</li>
        </ul>
        <p><strong>Exercise presets</strong>:</p>
        <ul>
          <li><strong>Random</strong> — random notes from the selected clef and octave range.</li>
          <li><strong>C4 Scale</strong> — notes from the C4 major scale (good for beginners).</li>
          <li><strong>Score</strong> — notes extracted from the currently loaded score.</li>
        </ul>
        <p><strong>Input sources</strong>: Connect a MIDI keyboard (USB or Bluetooth) for best accuracy. Alternatively, use the device microphone for acoustic instruments.</p>
      </section>

      <section className="guide-section" aria-labelledby="guide-h-loading">
        <h2 id="guide-h-loading">Loading a Score</h2>
        <p>
          Graditone loads <strong>MusicXML</strong> files (.mxl, .musicxml, .xml) — the
          industry-standard open format supported by <strong>MuseScore</strong> (free),
          Sibelius, Finale, Dorico, and hundreds of other notation apps.
        </p>
        <p><strong>Using a preloaded demo score</strong>: tap <strong>Load score</strong> inside the Play or Train plugin and choose from the built-in library (Bach Invention No. 1, Beethoven Für Elise, Burgmuller Arabesque, Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D). No upload needed.</p>
        <p><strong>Loading your own MusicXML file</strong>:</p>
        <ol>
          <li>Export your score as MusicXML from your notation software (in MuseScore: <em>File → Export → MusicXML</em>).</li>
          <li>In the Play or Train plugin, tap <strong>Load score → Load from file…</strong>.</li>
          <li>Select the .mxl or .musicxml file from your device.</li>
          <li>The score loads immediately and is saved in the browser. It will be available next time you open Graditone, even offline.</li>
        </ol>
        <p>Free MusicXML scores are available at <strong>musescore.com</strong>, <strong>imslp.org</strong>, and <strong>kern.humdrum.org</strong>.</p>
      </section>
    </div>
  );
}
```

---

## Step 5: Write the styles

Create `frontend/plugins/guide/GuidePlugin.css`:

```css
/*
 * GuidePlugin.css — uses --color-* CSS custom properties so the Guide
 * automatically inherits every landing theme. The same token pattern is
 * used by TrainPlugin.css and plugin-dialog.css.
 * Fallback values apply when no theme is active (plain white background).
 */
.guide-plugin {
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
  overflow-y: auto;
  box-sizing: border-box;
  font-size: 1rem;
  line-height: 1.6;
  background: var(--color-surface, #fff);
  color: var(--color-text-secondary, #555);
}

.guide-section {
  margin-bottom: 2.5rem;
}

.guide-section h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text, #222);
  margin-bottom: 0.75rem;
  border-bottom: 2px solid var(--color-accent, #4a90e2);
  padding-bottom: 0.25rem;
}

.guide-section p,
.guide-section li {
  margin-bottom: 0.5rem;
  color: var(--color-text-secondary, #555);
}

.guide-section ul,
.guide-section ol {
  padding-left: 1.5rem;
}

.guide-section strong {
  color: var(--color-text, #222);
}

@media (max-width: 480px) {
  .guide-plugin {
    padding: 16px;
  }
}
```

---

## Step 6: Write the tests (Test-First)

Write `frontend/plugins/guide/GuidePlugin.test.tsx` **before** implementing the component:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GuidePlugin } from './GuidePlugin';
import guidePlugin from './index';
import manifest from './plugin.json';

describe('GuidePlugin — component', () => {
  it('renders without crashing', () => {
    render(<GuidePlugin />);
  });

  it('displays the five required section headings', () => {
    render(<GuidePlugin />);
    expect(screen.getByRole('heading', { name: /what is graditone/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /playing a score/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /practice mode/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^train$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /loading a score/i })).toBeInTheDocument();
  });
});

describe('GuidePlugin — plugin contract', () => {
  it('exports a valid GraditonePlugin object', () => {
    expect(typeof guidePlugin.init).toBe('function');
    expect(typeof guidePlugin.Component).toBe('function');
  });

  it('init stores context without throwing', () => {
    expect(() => guidePlugin.init({} as never)).not.toThrow();
  });
});

describe('GuidePlugin — manifest', () => {
  it('declares type: common to appear in the nav bar', () => {
    expect(manifest.type).toBe('common');
  });

  it('declares order: 99 for rightmost nav bar placement', () => {
    expect(manifest.order).toBe(99);
  });

  it('declares icon 📖', () => {
    expect(manifest.icon).toBe('📖');
  });

  it('declares name Guide', () => {
    expect(manifest.name).toBe('Guide');
  });
});
```

---

## Step 7: Verify

```bash
cd frontend

# Run tests
npm run test -- plugins/guide

# Type-check
npx tsc --noEmit

# Start dev server and verify nav bar entry appears
npm run dev
# → Open http://localhost:5173 → "Guide 📖" should appear rightmost in the nav bar
# → Tap Guide → scrollable guide content displays → "← Back" button works
```

---

## Files Created

| File | Purpose |
|------|---------|
| `frontend/plugins/guide/plugin.json` | Plugin manifest |
| `frontend/plugins/guide/index.tsx` | Plugin entry point (GraditonePlugin contract) |
| `frontend/plugins/guide/GuidePlugin.tsx` | React content component |
| `frontend/plugins/guide/GuidePlugin.css` | Scoped typography and layout styles |
| `frontend/plugins/guide/GuidePlugin.test.tsx` | Unit tests (written first) |

**No changes to existing files are required.** The Vite glob in `builtinPlugins.ts` auto-discovers the new plugin.
