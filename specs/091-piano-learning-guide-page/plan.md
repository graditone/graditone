# Implementation Plan: Piano Learning Guide Page

**Branch**: `091-piano-learning-guide-page` | **Date**: 2026-05-20 | **Spec**: `specs/091-piano-learning-guide-page/spec.md`  
**Input**: Feature specification from `specs/091-piano-learning-guide-page/spec.md`

## Summary

Add a dedicated "Piano Learning Guide" page to the Graditone frontend. The page is a
purely presentational React component that explains how the app helps users learn piano
(note highlighting, tempo control, loop regions, virtual keyboard, stacked staves, dynamics,
MIDI input, practice workflow, and tips). It uses the existing i18n infrastructure, is
accessible from the app header navigation, and is available offline via the existing PWA
service worker. No new domain entities, no backend changes, no new storage.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React, `useTranslation` hook (Feature 073 i18n), existing CSS theming  
**Storage**: N/A — page is static content; no new localStorage or IndexedDB keys  
**Testing**: Vitest + Testing Library (existing `frontend/` test suite)  
**Target Platform**: Tablet devices (iPad/Surface/Android) + desktop/mobile browsers; PWA  
**Project Type**: Web application — `frontend/` only; no backend changes  
**Performance Goals**: Page renders within 16ms; fully offline-capable (service worker caches all static assets)  
**Constraints**: All text MUST use i18n keys (no hardcoded strings); WCAG 2.1 AA contrast; responsive 375px–1440px  
**Scale/Scope**: 1 new component, ~1 CSS file, ~30 new i18n string keys (EN + ES stubs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | ✅ PASS | No domain entities; purely presentational |
| II. Hexagonal Architecture | ✅ PASS | Frontend-only; no backend changes |
| III. PWA Architecture | ✅ PASS | Service worker already caches all static assets; page works offline |
| IV. Precision & Fidelity | ✅ N/A | No music timing involved |
| V. Test-First Development | ⚠️ **REQUIRED** | Tests must be written before component implementation (red-green-refactor) |
| VI. Layout Engine Authority | ✅ PASS | No spatial calculations; pure HTML/CSS layout |
| VII. Regression Prevention | ✅ PASS | Tests added; existing test suite unaffected |
| VIII. User Profile Awareness | ✅ PASS | Guide page is not user-specific; no profile-scoped state; profile icon already visible in app header |

**Gate result**: PASS — no violations. Constitution requires tests before implementation (Principle V).

## Project Structure

### Documentation (this feature)

```text
specs/091-piano-learning-guide-page/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks command)
```

### Source Code

```text
frontend/
├── src/
│   ├── components/
│   │   ├── PianoLearningGuidePage.tsx      ← NEW: guide page component
│   │   └── PianoLearningGuidePage.css      ← NEW: guide page styles
│   ├── i18n/
│   │   └── locales/
│   │       ├── en.json                     ← MODIFIED: new guide.* keys
│   │       └── es.json                     ← MODIFIED: ES stubs for guide.* keys
│   └── App.tsx                             ← MODIFIED: add showGuide state + nav entry
└── src/test/components/
    └── PianoLearningGuidePage.test.tsx     ← NEW: component tests (TDD)
```

**Structure Decision**: Single web application (Option 2 from template). Frontend-only
change. No new route file needed — navigation follows the existing early-return pattern
in `App.tsx` (same as `showRecording` / fullscreen plugin views). A `showGuide` boolean
state toggles the guide page in place of the main `ScoreViewer`.

## Phase 0: Research (Complete)

All unknowns resolved. See `research.md`.

**Key decisions:**
- Navigation pattern: add `showGuide` boolean state to `App.tsx`; guide renders via early
  return (same pattern as `showRecording`). No React Router needed.
- Entry point: "Learn Piano" button/link in the app header `<nav>` area, or below the
  existing Plugins button. Follows the tab/nav pattern already in the header.
- i18n key namespace: `guide.piano.*` (e.g., `guide.piano.page_title`,
  `guide.piano.section_highlights_title`, `guide.piano.feature_highlight_tempo_benefit`)
- Service worker: existing Workbox config (`sw.js`) precaches all `frontend/` build
  assets; no changes needed — the guide page component is bundled into the same chunk.
- CSS approach: new `PianoLearningGuidePage.css` scoped to `.piano-guide` class; follows
  the same CSS module-by-file convention as `LandingScreen.css`, `ScoreViewer.css`, etc.
- Profile icon: already rendered by `App.tsx` header; no changes needed (Principle VIII).

## Phase 1: Design (Complete)

### Component Interface

```tsx
// PianoLearningGuidePage.tsx
interface PianoLearningGuidePageProps {
  onBack: () => void;  // called when user closes the guide
}
```

### Sections

| Section | i18n Namespace | Content |
|---------|---------------|---------|
| Page header | `guide.piano.page_title`, `guide.piano.page_subtitle` | Title + one-line summary |
| Feature highlights | `guide.piano.section_highlights_*` | 4 core features (note highlight, tempo, loops, virtual keyboard) |
| Piano-specific features | `guide.piano.section_piano_*` | Stacked staves, dynamics, MIDI input, one-hand playback |
| Practice workflow | `guide.piano.section_workflow_*` | 6 ordered steps |
| Practice tips | `guide.piano.section_tips_*` | 4 scannable tips |
| Back button | `guide.piano.back_button` | Returns to main score view |

### Navigation Entry in App.tsx

Add a "Learn Piano" link to the plugin nav `<nav>` in the app header.
`onClick` sets `showGuide(true)`.

### Test Plan (TDD — tests written first)

Tests in `frontend/src/test/components/PianoLearningGuidePage.test.tsx`:

| # | Requirement | Test |
|---|-------------|------|
| T1 | FR-001 | Page renders without throwing |
| T2 | FR-002 | All 4 feature highlight headings present in DOM |
| T3 | FR-002 | Feature descriptions contain benefit language (piano-learner framing) |
| T4 | FR-003 | Workflow section contains at least 6 ordered steps |
| T5 | FR-004 | Piano-specific section present; MIDI, stacked staves, dynamics mentioned |
| T6 | FR-005 | Tips section contains at least 4 tips |
| T7 | FR-006 | Page renders on mobile viewport (375px) without overflow |
| T8 | FR-008 | Back button calls `onBack` prop when clicked |
| T9 | FR-010 | No hardcoded strings outside i18n (all text from `t()` calls) |
| T10 | FR-011 | MIDI hardware prerequisite note is present in DOM |

### i18n Contract

New keys added to `en.json` (EN full text) and `es.json` (ES stubs = EN text with `[ES]` prefix until translated):

```json
// en.json additions (excerpt)
{
  "guide.piano.page_title": "Learning Piano with Graditone",
  "guide.piano.page_subtitle": "How Graditone helps you practice and improve at the piano",
  "guide.piano.back_button": "← Back",
  "guide.piano.section_highlights_title": "Core Practice Features",
  "guide.piano.feature_highlight_title": "Note Highlighting",
  "guide.piano.feature_highlight_benefit": "Always know where you are in the score — highlighted notes follow playback in real time.",
  // ... (full list in data-model.md)
}
```

## Complexity Tracking

> No constitution violations to justify.

No complexity entries required. All implementation follows established patterns:
- Navigation via boolean state (same as `showRecording`)
- CSS co-located with component (same as `LandingScreen`)
- i18n via `useTranslation` (same as all other components)
- Tests via Vitest + Testing Library (same as `LandingScreen.test.tsx`)
