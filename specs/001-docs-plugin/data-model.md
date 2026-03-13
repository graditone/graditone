# Data Model: Graditone Documentation Plugin

**Phase 1 output** | Feature `001-docs-plugin` | 2026-03-13

---

## Overview

The Guide plugin has no persistent data model — all content is static and embedded in the component. This document describes the structural entities defined in code (plugin manifest, plugin contract) and the content taxonomy (sections and their content).

---

## Entity: Plugin Manifest (`plugin.json`)

The manifest is the single source of truth for plugin identity, positioning, and behavior.

| Field | Value | Description |
|-------|-------|-------------|
| `id` | `"guide"` | Unique identifier; also determines plugin directory name |
| `name` | `"Guide"` | Display name in the nav bar entry |
| `version` | `"1.0.0"` | Semantic version of this plugin |
| `pluginApiVersion` | `"1"` | Minimum API version required (uses only base contract) |
| `entryPoint` | `"index.tsx"` | Module resolved by Vite glob at build time |
| `description` | `"App guide and usage documentation for Graditone."` | Used in plugin management UI |
| `type` | `"common"` | Makes the plugin appear in the top nav bar (not landing screen) |
| `view` | `"window"` | Host renders a back-button bar; plugin renders in overlay |
| `icon` | `"📖"` | Displayed in the nav bar entry |
| `order` | `99` | Sentinel value; ensures rightmost placement in nav bar |

---

## Entity: Plugin Contract (`GraditonePlugin`)

The Guide plugin satisfies the base `GraditonePlugin` interface defined in `plugin-api/types.ts`:

```ts
interface GraditonePlugin {
  init(context: PluginContext): void;  // called once on activation; context stored but unused
  dispose?(): void;                    // optional; sets stored context to null
  Component: ComponentType;            // root React component rendered by the host
}
```

The `PluginContext` is stored in module scope for future extensibility but no context features are consumed by the Guide plugin.

---

## Content Taxonomy (Sections)

The Guide component renders five mandatory sections (FR-004). Each section has a canonical heading and minimum content requirements.

### Section 1: What is Graditone?

**Heading**: "What is Graditone?"
**Content**: Brief explanation of Graditone as a tablet-native app for interactive music scores; who it is for (musicians practicing, performing, studying); core capabilities in plain language.
**Acceptance**: Renders a readable paragraph; user understands what the app does after reading (SC-002).

### Section 2: Playing a Score

**Heading**: "Playing a Score"
**Content**: How to start audio playback; the gesture reference table (tap to seek, long-press to pin/loop, tap inside loop to clear); tempo control description.
**Acceptance**: All documented gestures in the README gesture table are covered (FR-006).

### Section 3: Practice Mode

**Heading**: "Practice Mode"
**Content**: How to open the Practice plugin; what MIDI-driven step practice means; how to connect a MIDI device; how to advance through notes; what the score progress indicator shows.
**Acceptance**: A user with no prior knowledge can follow the steps to start a practice session (FR-007).

### Section 4: Train

**Heading**: "Train"
**Content**: The three complexity levels (Low — 8 notes, step mode, 40 BPM; Mid — 16 notes, step mode, 80 BPM; High — 20 notes, flow mode, 100 BPM) and that the selected level persists across sessions; the two training modes (Flow — play all notes in real time; Step — wait for the correct note before advancing); the three exercise presets (Random, C4 Scale, Score — notes extracted from the currently loaded score); input sources (MIDI keyboard auto-detected or device microphone).
**Acceptance**: A user new to Train can set up and start an exercise from the Guide alone (FR-008).

### Section 5: Loading a Score

**Heading**: "Loading a Score"
**Content**: What MusicXML is and which file extensions are accepted (.mxl, .musicxml, .xml); how to export MusicXML from MuseScore (free), Sibelius, Finale, or Dorico; the bundled preloaded demo scores (Bach Invention No. 1, Beethoven Für Elise, Burgmuller Arabesque, Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D) available without uploading; how to upload a custom file from the device via the score picker; that uploaded scores are stored in the browser's IndexedDB and persist across sessions. This section applies as shared context to both the Play and Train plugins.
**Acceptance**: User understands how to load their first score and knows that uploaded scores are remembered (FR-009).

---

## CSS Theming

All colours and fonts in `GuidePlugin.css` MUST use the app's `--color-*` CSS custom properties, which are declared on `body[data-landing-theme]` in `App.css` and mapped from the active `--ls-*` landing theme tokens. Hardcoded colour values are not permitted.

| CSS token | Semantic role | Fallback |
|-----------|--------------|----------|
| `var(--color-surface, #fff)` | Page / panel background | White |
| `var(--color-text, #222)` | Heading and bold text | Near-black |
| `var(--color-text-secondary, #555)` | Body / paragraph text | Mid-grey |
| `var(--color-border, #e0e0e0)` | Section divider line | Light grey |
| `var(--color-accent, #4a90e2)` | Accent highlight (h2 underline) | Blue |

This pattern matches `TrainPlugin.css` and `plugin-dialog.css`. When no theme is active the fallback values apply; when a landing theme is active the tokens automatically inherit the palette.

---

## State Model

The Guide component has no state. It is a pure presentational component — no useState, no useEffect, no context consumption beyond storing the injected PluginContext at module level (standard plugin pattern).

```
GuidePlugin: () => JSX.Element       // stateless, no props
```

---

## Data Flow

```
App.tsx
  └─ sortPluginsByOrder([...BUILTIN_PLUGINS, ...imported])
       └─ guide plugin entry (order: 99, type: common)
            └─ rendered in nav bar via PluginNavEntry
                 └─ on tap: setActivePlugin("guide")
                      └─ activePlugin overlay rendered by App.tsx
                           └─ host back-button bar (pluginApiVersion: "1" path)
                                └─ GuidePlugin component
                                     └─ static section content (no data sources)
```
