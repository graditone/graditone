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

### 🎵 Score Management
- **MusicXML import** - Load industry-standard MusicXML files with resilient error handling
  - **Overlapping note resolution** - Automatically distributes notes to multiple voices
  - **Structural issue recovery** - Gracefully handles invalid notes (zero duration, malformed data)
  - **Import warnings** - Detailed diagnostics (OverlapResolution, StructuralIssues, MissingElements, PartialImport)
  - **Validated with real-world files** - Successfully imports Moonlight Sonata, Bach Preludes, Mozart Sonatas, Chopin Préludes
- **Demo score** on first launch for immediate exploration
- **Offline storage** - Scores persist locally using IndexedDB
- **View-only mode** - Focus on reading and performance (editing removed)

### ▶️ Performance Features
- **Audio playback** with Web Audio API
- **Auto-scroll** during playback
- **Note highlighting** - Visual feedback showing current position
- **Tempo control** - Adjust playback speed for practice
- **Score-defined tempo** - Playback starts at the tempo marked in the score (e.g. 60 BPM for Chopin Nocturne) instead of a fixed 120 BPM default; snap-to-score-tempo action resets both BPM and multiplier to the score's marked tempo
- **Repeat/navigation** - Jump to any point in the score
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
- **Importable plugins** - Third-party plugins distributed as ZIP packages

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
- **Tempo control**: Slider adjusts playback speed from 0.5× to 2.0×; snap-to-score-tempo resets to the score's marked BPM
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
