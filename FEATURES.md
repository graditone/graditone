# Graditone

**Live App**: [https://graditone.com/](https://graditone.com/)

A tablet-native app for interactive scores, designed for practice and performance.

---

## Current Features

### 🎼 Score Display
- **High-fidelity notation** rendering with SMuFL music font (Bravura)
- **Multiple clefs** support (Treble, Bass, Alto, Tenor)
- **Time signature support** - Generic support for all standard time signatures (2/4, 3/4, 4/4, 6/8, 9/8, 12/8); correct measure boundaries, barlines, and time signature glyphs derived from MusicXML import
- **Stacked staves view** for piano and multi-staff instruments
- **Accurate pitch positioning** with ledger lines
- **Chord symbols** display above the staff
- **Proportional spacing** based on musical timing
- **Tied notes** — Curved arcs (ties) connect same-pitch noteheads across same-measure, cross-barline, and multi-note chain scenarios; chords with partial ties show arcs only on the tied pitches

### 🎵 Score Management
- **MusicXML import** - Load industry-standard MusicXML files with resilient error handling
  - **Overlapping note resolution** - Automatically distributes notes to multiple voices
  - **Structural issue recovery** - Gracefully handles invalid notes (zero duration, malformed data)
  - **Import warnings** - Detailed diagnostics (OverlapResolution, StructuralIssues, MissingElements, PartialImport)
  - **Validated with real-world files** - Successfully imports Moonlight Sonata, Bach Preludes, Mozart Sonatas, Chopin Préludes
- **Demo score** on first launch for immediate exploration
- **Offline storage** - Scores persist locally using IndexedDB
- **My Scores** - Uploaded MusicXML files are saved to IndexedDB and appear in a "My Scores" section inside the score picker; scores survive page reloads; duplicate file names are auto-suffixed; each entry has a × delete button with a 5-second undo window
- **Scales library** - 48 preloaded scale scores (24 major + 24 natural minor, octaves 4 & 5) in circle of fifths order, accessible via a collapsible "Scales" group in the load score dialog
- **View-only mode** - Focus on reading and performance (editing removed)

### ▶️ Performance Features
- **Audio playback** with Web Audio API
- **Auto-scroll** during playback
- **Note highlighting** - Visual feedback showing current position
- **Tempo control** - Adjust playback speed for practice from 10% to 200% with 1% precision (Feature 083)
- **Score-defined tempo** - Playback starts at the tempo marked in the score (e.g. 60 BPM for Chopin Nocturne) instead of a fixed 120 BPM default; snap-to-score-tempo action resets both BPM and multiplier to the score's marked tempo
- **Repeat/navigation** - Jump to any point in the score
- **Tied note playback** - Tied notes sound as a single sustained note with combined duration, no re-attack at tie boundaries; chords with partial ties sustain only the tied pitch
- **Dynamic volume** (Feature 063) - MusicXML dynamics (pp–ff, crescendo/diminuendo) parsed in the backend and applied as per-note velocity; square-root gain curve for perceptually even loudness; MIDI CC7 (channel volume) and CC11 (expression) supported for live keyboard input; master volume slider (0–100%) with persistence via localStorage; Tone.Limiter (-1 dB) prevents clipping
- **Optimized playback rendering** - Zero audio glitches on mobile devices
  - **Incremental highlight updates** - CSS class toggling via rAF, no SVG DOM rebuild
  - **O(log n) note lookup** - Binary search index for real-time highlight computation
  - **Device-adaptive frame rate** - 30 Hz mobile / 60 Hz desktop with frame budget monitoring
  - **Efficient tick broadcasting** - Ref-based tick source, minimal React re-renders

### 📱 Tablet-Optimized PWA
- **Offline-first** - Works without internet connection
- **Installable** - Add to home screen on tablets
- **Touch-friendly** - Optimized for tablet interaction
- **Portrait/landscape** support
- **Responsive layout** adapts to screen size

### ⚙️ Technology
- **WASM-powered** - Rust music engine compiled to WebAssembly
- **Precision timing** - 960 PPQ (Pulses Per Quarter note) resolution
- **Domain-driven design** - Clean architecture with hexagonal pattern
- **Test-first development** - 596+ tests ensuring quality

### 🎹 Plugin Architecture
- **Extensible plugin system** - Add new interactive views via the Plugin API v4
- **Virtual Keyboard** built-in plugin - Play notes directly in the browser
- **Train** built-in plugin (v2) - Piano training exercise with scoring
  - **Pitch detection** - Microphone input via Web Audio API (shared stream)
  - **MIDI input** - Hardware MIDI keyboard support
  - **Scheduled playback** - `offsetMs` scheduling for exercise note sequences
  - **Exercise scoring** - Pitch accuracy and timing analysis
  - **Phase state machine** - Countdown → Playing → Results workflow
  - **Score preset** (Feature 034) - Practice from any loaded score; clef and octave determined automatically from score data; "Change score" button; cached pitches preserved across preset switches
  - **Complexity levels** (Feature 001) - One-click Low / Mid / High presets configure the exercise automatically: Low = C major scale, 8 notes, Treble, 40 BPM; Mid = random, 16 notes, Treble, 80 BPM; High = random, 20 notes, Bass, 100 BPM; selection persists across sessions via localStorage; Advanced parameters can still be adjusted manually (clears the level badge)
  - **Note-duration checking** (Feature 042) - Score-preset sessions enforce written note durations; a whole/half note must be held for ≥90% of its notated duration before the session advances; releasing early records an `early-release` result; a progress bar is shown while holding notes longer than a quarter note; early-release outcomes score at 0.5× credit; quarter notes and shorter advance immediately as before
  - **Tied note handling** (Feature 051) - Tied note groups are treated as a single practice event; continuation notes are skipped so the user only presses a key once per independently-attacked note
- **Importable plugins** - Third-party plugins distributed as ZIP packages
- **Practice View plugin** - Freeform score annotation and practice view; covered by e2e smoke tests
- **External plugin e2e** - Documented approach for adding Playwright smoke tests to any plugin in `plugins-external/`; see `docs/e2e-external-plugins.md`

---

## Browser Requirements

- **Chrome/Edge**: Version 57+
- **Safari**: Version 11+
- **Target devices**: iPad, Surface, Android tablets

---

## Quick Start

**Try it now**: [https://graditone.com/](https://graditone.com/)

1. **Launch the app** - Opens with a demo score
2. **Import your score** - Click "Import Score" to load MusicXML files
3. **Play and explore** - Use playback controls to listen and follow along
4. **Install** - Add to your home screen for app-like experience

---

## Development

See [README.md](README.md) for development setup and architecture details.

---

## Play Score Plugin (Core Plugin — Feature 033)

The **Play Score** plugin is a built-in full-screen plugin that lets users load, browse, and play back musical scores using Plugin API v3.

### Capabilities

- **Score catalogue**: Browse and open any of the 6 bundled pre-loaded scores with a single tap
- **File loading**: Import `.mxl`, `.xml`, or `.musicxml` files directly from the device
- **Playback controls**: Play, Pause, Stop, and a live elapsed-time display (`mm:ss`)
- **Canvas tap**: Tap the score to toggle play/pause without the toolbar
- **Note seeking**: Short-tap a note to seek playback to that tick
- **Pin & loop**: Long-press a note to set a loop start pin; long-press a second note to create a loop region; long-press inside the loop to clear it
- **Return to start**: Dedicated button seeks to tick 0 (or to the pinned loop start if set)
- **Tempo control**: Slider adjusts playback speed from 10% to 200% in 1% increments; BPM floor ensures minimum playback is always ≥10 BPM; ±3% snap zone at 100%; snap-to-score-tempo resets to the score's marked BPM (Feature 083)
- **WASM loading state**: All controls are disabled while the audio engine initialises
- **Audio teardown**: All audio stops automatically when the plugin is closed or the page navigates away (SC-005)

---

**Version**: 1.0 (Read-Only Viewer)  
**Updated**: February 2026

---

## Landing Page Redesign — Feature 039

10 warm-colour themed design variants for the landing screen, accessible via a persistent navbar switcher. Each variant applies a distinct WCAG 2.1 AA-compliant colour palette and typography pairing from three self-hosted font families.

### Design Variants

| # | Name | Heading Font | Feel |
|---|------|-------------|------|
| 1 | **Ember** | Space Grotesk Bold | Deep orange, earthy |
| 2 | **Saffron** | IBM Plex Sans Bold | Golden amber |
| 3 | **Sienna** | Inter SemiBold | Warm brown, calm |
| 4 | **Terracotta** | Space Grotesk SemiBold | Clay red, grounded |
| 5 | **Paprika** | IBM Plex Sans Bold | Crimson rose |
| 6 | **Honey** | Inter Bold | Bright amber yellow |
| 7 | **Coral** | Space Grotesk Bold | Vivid orange-red |
| 8 | **Marigold** | IBM Plex Sans SemiBold | Golden orange |
| 9 | **Blush** | Inter Bold | Pink-rose |
| 10 | **Rust** | Space Grotesk Bold | Dark rust brown |

### Capabilities

- **DesignNavbar**: Persistent horizontally-scrollable tab strip listing all 10 variants; sticky at top; keyboard navigable (Tab + Enter/Space)
- **CSS custom property theming**: 15 tokens per theme scoped to `.landing-screen.theme-*` — no global pollution
- **Deep linking**: URL hash routing (`/#ember`, `/#saffron`, etc.) — no router dependency; browser back/forward supported
- **Self-hosted fonts**: Inter, IBM Plex Sans, Space Grotesk (4 weights each, ~730 KB total) in `public/fonts/`; `font-display: swap`; offline/PWA-ready
- **Animated note colours**: Each theme's `noteColor1/2/3` palette feeds the Feature 001 Lissajous animation
- **Accessibility**: WCAG 2.1 AA contrast on all 10 palettes; ARIA roles (`tablist`/`tab`/`aria-selected`); visible focus rings

**Spec**: `specs/039-landing-page-redesign/`  
**Updated**: March 2026

---

## Help & Documentation — Feature 001-docs-plugin

Built-in documentation plugin (📖 Guide) that appears as the rightmost entry in the top nav bar and provides a single scrollable reference page for all Graditone features.

### Sections

| # | Heading | Content summary |
|---|---------|----------------|
| 1 | What is Graditone? | App overview, offline capability |
| 2 | Playing a Score | Tap/long-press gestures, loop regions, tempo slider |
| 3 | Practice Mode | MIDI-driven step practice workflow |
| 4 | Train | Complexity levels, Flow/Step modes, exercise presets, MIDI/mic input |
| 5 | Loading a Score | MusicXML export from notation software, preloaded demo scores, browser persistence |

### Capabilities

- **Nav bar entry**: `type: common`, `order: 99` — always rightmost in the top nav bar
- **Host back button**: `view: window` + `pluginApiVersion: 1` — host renders “← Back” automatically
- **Fully static**: no fetch, no state, fully offline-capable
- **Theme-aware**: all CSS uses `--color-*` custom property tokens; inherits every landing theme automatically
- **Responsive**: readable on 375 px–1366 px screen widths without truncation

**Spec**: `specs/001-docs-plugin/`  
**Updated**: March 2026

---

## Session Scheduling — Feature 066

Extends the Sessions Plugin with a **scheduled** session state, allowing users to plan future practice sessions alongside the existing active/closed lifecycle.

### Capabilities

- **Unified date picker**: The "Start Session" flow includes a date picker defaulting to today; selecting today starts an active session immediately (existing behavior preserved); selecting a future date creates a scheduled session
- **Scheduled status**: New `scheduled` state for sessions — visually distinct with a blue badge and left border accent; sorted by target date (nearest first) between active and closed sessions
- **Activation**: A dedicated "Activate" button transitions a scheduled session to active; disabled with tooltip when another session is already active; at most one active session at any time
- **Closed session finality**: Closed sessions cannot be reactivated — the activate button is only rendered for scheduled sessions
- **Task pre-planning**: Scheduled sessions support task definitions at creation time via TaskBuilder, enabling users to plan what to practice and when
- **Backward compatibility**: Existing sessions without a target date continue to work without migration; `targetDate` is an optional field (`undefined` for legacy sessions)
- **Eviction safety**: The MAX_SESSIONS cap evicts only the oldest closed sessions; scheduled sessions are preserved during eviction

**Spec**: `specs/066-session-scheduling/`  
**Updated**: March 2026

---

## Core Plugins i18n — Feature 075

Completes internationalization (i18n) for all 5 internal builtin plugins: **Play Score**, **Train**, **Practice View**, **Virtual Keyboard**, and **Guide**.

### Capabilities

- **100% translated UI strings**: All user-visible text in builtin plugins has been migrated from hardcoded English to locale catalog keys — aria-labels, button labels, section headings, status messages, grade messages, and tooltips
- **Locale catalog expanded**: `en.json` and `es.json` each extended from 117 to 314 keys — 197 new keys across namespaces `play_score.*`, `train.*`, `practice.*`, and `vkeyboard.*`
- **Plugin nav names**: `plugin.name.sessions-plugin` and `plugin.name.virtual-keyboard` keys added so plugin navigation entries translate correctly alongside existing builtin names
- **Locale parity enforced**: Existing parity regression test now validates 314 keys in perfect sync between EN and ES
- **Scale names**: `train.scales.*` keys provide translated scale names (C Major → Do Mayor, etc.) for the train configuration sidebar
- **Grade messages**: All five performance grade tiers (Perfect/Excellent/Good/Keep going/Keep practicing) fully translated in both train and practice result overlays
- **Tests updated**: All plugin unit tests updated with `LocaleProvider` wrapper; catalog-completeness test updated to reflect new key count

**Spec**: `specs/075-core-plugins-i18n/`  
**Updated**: June 2025


---

## Tempo Slider Precision & Metronome Deferred Start — Feature 083

Extends tempo control precision for both Play Score and Practice View, and adds a smart metronome "armed" mode for practice sessions.

### Capabilities

- **Extended tempo range**: Slider minimum lowered from 50% to **10%** (was 0.5× → now 0.1×); maximum remains 200% (2.0×)
- **1% step granularity**: Slider step reduced from 5% to **1%** (step=0.01) for fine-grained speed control
- **BPM floor protection**: When the score's original tempo is slow, the slider minimum rises proportionally so playback never drops below **10 BPM** (e.g. 40 BPM score → min slider = 25%)
- **Recalibrated 100% snap zone**: Snap-to-100% triggers within **±3 steps** (±3pp) of 1.0×, tightened from ±5pp for more precise control at normal speed
- **Tick mark at 100%**: The 100% position is marked via `<datalist>` for browser snap UI hints
- **BPM floor tooltip**: When the effective minimum is above 10% due to the BPM floor, the slider shows a tooltip explaining "Min. speed limited to 10 BPM"
- **Metronome armed state** (Practice View only): Toggling the metronome button while practice is in "waiting" mode arms it — the metronome does **not** start immediately; instead it waits for the first MIDI note attack and starts in sync with the player's first note
- **Armed visual indicator**: The metronome button shows a pulsing amber glow while armed (`--armed` CSS modifier)
- **Auto-disarm on stop**: If the user stops practice before playing any note, the armed state is cleared automatically

**Spec**: `specs/083-tempo-metronome-practice/`  
**Updated**: July 2025

---

## One-Goal 40% Session Time Cap — Feature 087

Prevents a single goal from monopolising all practice time when multiple active goals exist. When a second (or subsequent) goal is created, the session planner redistributes pending tasks from all active goals using a **40% per-goal cap** per session.

### Capabilities

- **Per-goal time cap**: Each goal may contribute at most 40% of `availableTime` (3600 s) per session — i.e. ≤ 1440 s — when multiple goals are active
- **Greedy round-robin distribution**: `distributeMultiGoalTasks()` fills sessions using per-goal FIFO phrase queues, iterating goals until nothing more fits
- **Best-effort first group**: A goal's first phrase group in any session is always admitted even if it exceeds the 40% budget (avoids starving large phrase groups)
- **Zero-duration tasks are free**: Tasks without `estimatedDurationSecs` contribute 0 s toward the goal budget and may be placed freely
- **Single-goal bypass**: When only one goal is active, distribution delegates unchanged to `distributeTasks()` (no cap applied)
- **Unlimited mode preserved**: Setting `availableTime = 0` still packs all tasks in one session regardless of goal count
- **Excess deferral, no dropping**: Phrase groups that don't fit in session N roll to session N+1; no tasks are ever discarded
- **Multi-goal session metadata**: `Session.goalIds` and `SessionIndexEntry.goalIds` record which goals contributed tasks to each session
- **Redistribution on new goal**: Adding a goal triggers deletion of all existing sessions for other active goals and recreates them with the capped distribution
- **GoalPhraseGroup reconstruction**: `reconstructPhraseGroupsFromTasks()` rebuilds phrase groups from flat `SessionTask[]` for redistribution

**Spec**: `specs/087-one-goal-40pct-cap/`  
**Updated**: July 2025
