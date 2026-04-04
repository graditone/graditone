# Implementation Plan: Landing Page i18n (073)

**Branch**: `073-landing-page-i18n` | **Worktree**: `../worktrees/073-landing-page-i18n` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/073-landing-page-i18n/spec.md`

## Summary

Add internationalisation support to the Graditone landing page with English (EN) and Spanish (ES)
as the initial supported languages. The implementation uses a custom lightweight i18n module
(~50 LOC, no external library) — a `LocaleProvider` React context + `useTranslation()` hook —
backed by two flat JSON catalogs (`en.json`, `es.json`) compiled inline into the JS bundle at
build time. Locale is resolved from `navigator.language` on app load with no persistence. All
30 translatable strings across 7 components (App, LandingScreen, IOSInstallModal,
AndroidInstallBanner, OfflineBanner) are covered. Validated by per-component unit tests with a
mocked locale and one Playwright E2E smoke test that loads the app in Spanish.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite 7  
**Primary Dependencies**: React Context API (built-in), `resolveJsonModule: true` in tsconfig (already present)  
**Storage**: N/A — locale resolved fresh from `navigator.language` on every load; no persistence  
**Testing**: Vitest + @testing-library/react (unit); @playwright/test (E2E smoke)  
**Target Platform**: Tablet devices (iPad, Surface, Android tablets) — Chrome 57+, Safari 11+; PWA  
**Project Type**: Web (frontend only — no backend changes)  
**Performance Goals**: Inline bundle delivery; 0ms async load overhead; <5 KB catalog bundle increase  
**Constraints**: No external i18n library; offline-first (catalogs bundled, not fetched); TypeScript exhaustiveness enforcement at build time  
**Scale/Scope**: 30 translation keys, 2 language catalogs, 7 components modified

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. DDD | ✓ Pass | Frontend infrastructure only; no domain model changes |
| II. Hexagonal Architecture | ✓ Pass | No backend modifications; i18n is UI infrastructure |
| III. PWA Architecture | ✓ Pass | Inline bundle = offline capability preserved; no new network request |
| IV. Precision & Fidelity | ✓ N/A | No music timing or WASM logic touched |
| V. Test-First Development | ✓ Pass | TDD ordering enforced: catalog tests → hook tests → component tests → E2E |
| VI. Layout Engine Authority | ✓ N/A | No spatial geometry or coordinate logic involved |
| VII. Regression Prevention | ✓ Pass | Catalog-completeness test + per-component locale tests prevent regressions |

**Gate result**: All PASS. No violations. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/073-landing-page-i18n/
├── plan.md              # This file
├── research.md          # Phase 0: library selection, TS key safety, Playwright locale, React pattern
├── data-model.md        # Phase 1: 30-key schema, EN/ES catalog values, locale resolver algorithm
├── quickstart.md        # Phase 1: how to add a third language in 2 file changes
├── contracts/
│   └── translation-api.md  # Phase 1: TypeScript contract for TranslationKey, t(), useTranslation(), LocaleProvider
└── tasks.md             # Phase 2 output (created by /speckit.tasks — NOT this command)
```

### Source Code (frontend only)

```text
frontend/src/i18n/                         # NEW — i18n module
├── index.ts                               # LocaleProvider, useTranslation hook, resolveLocale()
├── registry.ts                            # SUPPORTED_LOCALES, SupportedLocale, DEFAULT_LOCALE
└── locales/
    ├── en.json                            # English catalog (30 keys — source of truth)
    └── es.json                            # Spanish catalog (30 keys — must satisfy Record<TranslationKey,string>)

frontend/src/
├── main.tsx                               # MODIFIED: wrap <App> in <LocaleProvider>
├── App.tsx                                # MODIFIED: replace 12 hardcoded strings with t()
├── components/
│   ├── LandingScreen.tsx                  # MODIFIED: replace 2 aria-labels with t()
│   ├── IOSInstallModal.tsx                # MODIFIED: replace 8 strings with t()
│   ├── AndroidInstallBanner.tsx           # MODIFIED: replace 6 strings with t()
│   └── OfflineBanner.tsx                  # MODIFIED: replace 1 string with t()

frontend/src/test/
├── i18n/
│   ├── locale-resolver.test.ts           # NEW: resolveLocale() for es, en, fallback, complex tags
│   └── catalog-completeness.test.ts      # NEW: every key in en.json exists in es.json
├── components/
│   ├── LandingScreen.test.tsx            # MODIFIED: add locale-mocked aria-label assertions
│   ├── IOSInstallModal.test.tsx          # NEW
│   ├── AndroidInstallBanner.test.tsx     # NEW
│   └── OfflineBanner.test.tsx            # NEW
└── App.test.tsx                          # MODIFIED: add locale-mocked header/error assertions

frontend/tests/e2e/
└── i18n-landing.spec.ts                  # NEW: Playwright smoke test (browser locale = 'es')
```
