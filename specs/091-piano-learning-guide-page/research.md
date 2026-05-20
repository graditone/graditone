# Research: Piano Learning Guide Page — Feature 091

All unknowns resolved through direct codebase exploration of `frontend/src/`.

---

## R1 — Navigation Pattern

### Decision
Use a `showGuide` boolean state in `App.tsx`, toggling the guide via an early
return — identical to the existing `showRecording` pattern (line 585).

### Rationale
No React Router is used in the codebase. Navigation is entirely state-driven.
Adding a guide requires only a new `useState<boolean>` and a new early-return
block. This is the least invasive change and follows the established pattern.

### Alternatives Considered
- React Router: overkill, not currently in use, would require significant refactor
- Plugin-based guide: possible, but heavyweight for purely static content

---

## R2 — Entry Point Location

### Decision
Add a "Learn Piano" button/icon to the app header `<nav>` (same row as plugin
nav entries, left of the "🧩 Plugins" button). `onClick` sets `showGuide(true)`.

### Rationale
The app header is always visible regardless of app state. Plugin nav entries
(`PluginNavEntry`) are the precedent for tool/page buttons in the header.
The guide button fits naturally alongside practice tools. Back navigation
is handled by a "← Back" button rendered inside the guide page itself, calling
`onBack` prop → `setShowGuide(false)`.

---

## R3 — i18n Infrastructure

### Decision
Use `useTranslation` hook from `frontend/src/i18n/index.tsx`. All content
strings added to `frontend/src/i18n/locales/en.json` and `es.json`.
Key namespace: `guide.piano.*`

### Rationale
Every existing component (`LandingScreen`, `ScoreViewer`, `ProfilePanel`, etc.)
uses `useTranslation`. The `TranslationKey` type is derived from `en.json` at
compile time — adding keys to `en.json` automatically makes them type-safe.
Spanish (`es.json`) stubs added alongside EN keys to keep files in sync.

---

## R4 — Offline/PWA

### Decision
No changes needed to the service worker or Vite config.

### Rationale
The Workbox service worker (`sw.js`) precaches all build outputs via the
existing Vite PWA plugin configuration. The `PianoLearningGuidePage` component
will be bundled into the main JS chunk and cached automatically on first load.

---

## R5 — CSS Strategy

### Decision
New file `frontend/src/components/PianoLearningGuidePage.css` scoped under
`.piano-guide` root class. Import directly in the `.tsx` file.

### Rationale
Follows the co-located CSS convention used by every other component in
`frontend/src/components/` (e.g., `LandingScreen.css`, `ScoreViewer.css`).
CSS custom properties from the landing theme cascade via `body[data-landing-theme]`,
so the guide page benefits from theming automatically.

---

## R6 — Features to Cover (content research)

Verified in live app and `FEATURES.md`:

| Feature | App Reference | Guide Section |
|---------|--------------|---------------|
| Note highlighting | Feature 019 | Core Highlights |
| Tempo control (10–200%) | Feature 083 | Core Highlights |
| Loop practice regions | Feature 038 | Core Highlights |
| Virtual keyboard | Feature 032 | Core Highlights |
| Stacked staves (grand staff) | Feature 010 | Piano-Specific |
| Dynamics playback (pp–ff) | Feature 072 | Piano-Specific |
| MIDI keyboard input | Feature 029 | Piano-Specific (hardware note required) |
| One-hand playback | Feature 084 | Piano-Specific |
| Practice plugin (train mode) | Feature 031 | Workflow + Tips |
