# Implementation Plan: Sessions Plugin i18n

**Branch**: `074-sessions-plugin-i18n` | **Worktree**: `../worktrees/074-sessions-plugin-i18n` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/074-sessions-plugin-i18n/spec.md`

## Summary

Add internationalization (i18n) support to the Sessions external plugin, translating all user-facing strings (including `SessionsGuide` prose) into English and Spanish. The implementation mirrors the pattern established in Feature 073 (Landing Page i18n): self-contained locale catalog JSON files, a `resolveLocale()` function, a `LocaleProvider` React context, and a `useTranslation()` hook — all bundled inside the plugin with no imports from the host app's i18n module. A dedicated `i18n.ts` module is added to the sessions plugin source, `LocaleProvider` wraps the plugin root component, and ~16 component files are updated to replace hardcoded strings with `t()` calls. `PLUGINS.md` is updated with a new i18n developer section based on this implementation (SC-004).

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (sessions plugin uses same stack as frontend)  
**Primary Dependencies**: React context API, Vite `resolveJsonModule: true` (already enabled), Vitest + React Testing Library (existing `vitest.setup.ts`)  
**Storage**: N/A — locale catalogs compiled into JS bundle; `navigator.language` read once on `LocaleProvider` mount  
**Testing**: Vitest + React Testing Library (existing harness in `plugins-external/sessions-plugin/`)  
**Target Platform**: Tablet devices (iPad/Surface/Android) — same PWA target as core app  
**Project Type**: External plugin (TypeScript/React, compiled by Vite, distributed as ZIP)  
**Performance Goals**: Zero additional network requests; catalogs are statically imported and bundled  
**Constraints**: Plugin API boundary (no imports from host `frontend/src/i18n/`); self-contained module; catalog exhaustiveness enforced at TypeScript compile time  
**Scale/Scope**: 1 plugin, ~200 translation keys, 2 languages (EN + ES)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ N/A | Feature does not touch music domain entities or ubiquitous language |
| II. Hexagonal Architecture | ✅ N/A | No backend changes; sessions plugin is pure frontend |
| III. Progressive Web Application Architecture | ✅ PASS | Locale catalogs statically imported into bundle — all features work fully offline |
| IV. Precision & Fidelity | ✅ N/A | No timing/PPQ calculations involved |
| V. Test-First Development | ✅ REQUIRED | FR-012 mandates automated tests; TDD red-green-refactor applies to all new files (`i18n.ts`, updated components) |
| VI. Layout Engine Authority | ✅ N/A | No spatial layout calculations; purely string translation |
| VII. Regression Prevention | ✅ REQUIRED | Any bug discovered during implementation must be documented in spec and covered by a failing test before fixing |
| Plugin API Boundary | ✅ PASS | FR-008: i18n module is fully self-contained inside the plugin bundle; no imports from `frontend/src/i18n/` |

No constitution violations. No Complexity Tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/074-sessions-plugin-i18n/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output (key catalog schema + full EN/ES catalog)
├── quickstart.md        ← Phase 1 output (developer guide for plugin i18n)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created here)
```

### External Plugin Repository Setup

Per constitution (Development Workflow › External Plugin Repositories), the sessions plugin
lives in a separate private repo (`graditone-pro-plugins`), gitignored in the graditone
working tree. Work on the plugin happens inside the worktree clone:

```bash
# From the feature worktree
cd /path/to/worktrees/074-sessions-plugin-i18n
git clone git@github.com:aylabs/graditone-pro-plugins.git plugins-external
cd plugins-external && git checkout -b 074-sessions-plugin-i18n
cd sessions-plugin && npm install
```

### Source Code (sessions plugin)

```text
plugins-external/sessions-plugin/
├── locales/
│   ├── en.json                     ← NEW: English catalog (~200 keys)
│   └── es.json                     ← NEW: Spanish catalog (~200 keys)
├── i18n.ts                         ← NEW: resolveLocale, LocaleProvider, useTranslation
├── i18n.test.ts                    ← NEW: tests for resolveLocale + catalog completeness
├── SessionsPlugin.tsx              ← MODIFIED: wrap root in LocaleProvider, replace hardcoded strings
├── GoalsView.tsx                   ← MODIFIED: replace hardcoded strings
├── GoalCreationForm.tsx            ← MODIFIED: replace hardcoded strings
├── WarmUpGoalCreationForm.tsx      ← MODIFIED: replace hardcoded strings
├── TaskRow.tsx                     ← MODIFIED: replace hardcoded strings
├── TaskBuilder.tsx                 ← MODIFIED: replace hardcoded strings
├── CalendarView.tsx                ← MODIFIED: replace hardcoded strings + named arrays
├── CalendarWeekView.tsx            ← MODIFIED: replace hardcoded strings
├── CalendarMonthView.tsx           ← MODIFIED: replace hardcoded strings
├── CalendarYearView.tsx            ← MODIFIED: replace hardcoded strings
├── CalendarDayOverlay.tsx          ← MODIFIED: replace hardcoded strings
├── CalendarScheduledOverlay.tsx    ← MODIFIED: replace hardcoded strings
├── CalendarPeriodReport.tsx        ← MODIFIED: replace hardcoded strings
├── CalendarPeriodSummary.tsx       ← MODIFIED: replace hardcoded strings
├── DatePicker.tsx                  ← MODIFIED: replace hardcoded strings
└── SessionsGuide.tsx               ← MODIFIED: replace guide prose with catalog keys
```

### Main Repo Change (PLUGINS.md)

```text
graditone/
└── PLUGINS.md                      ← MODIFIED: new "Internationalizing a Plugin (i18n)" section
```
