# Research: Landing Page i18n (073)

**Phase 0 output** | Branch: `073-landing-page-i18n` | Date: 2026-04-05

## Research Question 1: Library vs Custom Implementation

**Context**: ~30 static strings, 2 languages, no async loading, no interpolation, no
pluralization. The spec mandates inline bundling, flat JSON catalogs, and `navigator.language`
detection.

**Decision**: Custom lightweight implementation (no i18n library)

**Rationale**:
- All translatable strings are static (no variable interpolation, no plural forms)
- 30 strings × 2 languages fits in ~3 KB — negligible bundle contribution
- A custom `useTranslation` hook + React Context is ~50 lines of TypeScript, fully typed,
  zero dependency overhead, and trivially testable by providing a mock `LocaleProvider`
- `i18next` / `react-i18next` are ~50 KB+ gzipped and designed for large multi-locale apps
  with async loading, namespaces, interpolation, and pluralization — all unused here
- Adding a third language later still requires only a JSON file + one registry entry (2-file max
  per SC-004) with a custom implementation

**Alternatives considered**:
- `i18next` + `react-i18next`: Eliminated — feature-rich but oversized for 30 static strings;
  async loading by default (would require custom configuration to avoid FOUC); adds 2 runtime
  dependencies for a feature that needs none
- `@formatjs/intl` + `react-intl`: Eliminated — ICU message syntax adds build tooling; heavier
  than needed; designed for complex internationalization workflows (date/time, currencies, plural
  rules) none of which are needed here

---

## Research Question 2: TypeScript Key Exhaustiveness

**Context**: Translation keys must be stable identifiers. The TypeScript compiler should catch
any component that references a missing or misspelled key, and the test suite should catch any
Spanish catalog entry missing from the English catalog (and vice versa).

**Decision**: Derive `TranslationKey` from `keyof typeof enCatalog` (the English catalog as the
source of truth); enforce Spanish catalog type as `Record<TranslationKey, string>`.

**Rationale**:
- Importing `en.json` with `import catalog from './locales/en.json' assert { type: 'json' }` (or
  with `resolveJsonModule: true` in tsconfig) gives a statically-typed object
- `type TranslationKey = keyof typeof enCatalog` produces a union of all valid key strings
- The `t(key: TranslationKey)` signature makes any misspelled or unknown key a compile-time
  TypeScript error in every component
- `es.json` is typed as `Record<TranslationKey, string>` on import — the TypeScript compiler
  rejects a Spanish catalog that is missing any key or has extra keys not in English

**Implementation note**: TypeScript's `resolveJsonModule` (already idiomatic in Vite/TypeScript
projects) enables this without any code generator or build step.

**Alternatives considered**:
- Codegen (e.g., `i18next-parser`): Eliminated — introduces a build step and tool dependency
  for a one-time extraction from a small, known set of files
- Runtime key validation: Eliminated — compile-time type errors are caught earlier and require
  no test overhead

---

## Research Question 3: Playwright Locale Spoofing

**Context**: SC-006 requires one Playwright E2E smoke test that loads the app in Spanish. The
test must control `navigator.language` without requiring an actual Spanish OS/browser session.

**Decision**: Use Playwright `BrowserContext.locale` option (`browser.newContext({ locale: 'es' })`).

**Rationale**:
- Playwright's `locale` context option sets both the `Accept-Language` HTTP header AND
  `navigator.language` / `navigator.languages` to the specified value — exactly what the
  implementation reads (FR-001: `navigator.language`)
- This is the idiomatic Playwright mechanism recommended in official documentation for locale
  testing; no hacks, overrides, or custom scripts needed
- The existing `playwright.config.ts` in the project can be extended with a named `project`
  for the Spanish locale test without affecting other E2E test projects

**Alternatives considered**:
- `page.addInitScript(() => Object.defineProperty(navigator, 'language', ...))`: Eliminated —
  fragile; requires manual maintenance; not the Playwright-idiomatic approach
- Setting `Accept-Language` via `extraHTTPHeaders`: Eliminated — doesn't affect
  `navigator.language`, which is what the implementation reads

---

## Research Question 4: React Context Integration Pattern

**Context**: The `t()` function must be available in all 7 landing page surfaces without prop
drilling. The approach must be unit-testable per-component via locale injection.

**Decision**: React Context (`LocaleContext`) providing `t: (key: TranslationKey) => string`,
with a `LocaleProvider` at the app root that resolves the locale from `navigator.language` on
mount, and a `useTranslation()` hook for consumption.

**Rationale**:
- React Context avoids prop drilling across `App.tsx`, `LandingScreen.tsx`,
  `IOSInstallModal.tsx`, `AndroidInstallBanner.tsx`, and `OfflineBanner.tsx`
- The `LocaleProvider` component accepts an optional `locale` prop (used in tests to inject a
  fixed locale, bypassing `navigator.language`) — same pattern as React Testing Library
  wrappers in the existing test suite
- `useTranslation()` is a 2-line hook (`useContext(LocaleContext)`) with a dev-mode invariant
  if used outside a provider
- The existing test suite uses `renderWithProviders` / wrapper patterns — this fits naturally

**Alternatives considered**:
- Module-level singleton (export `t` directly): Eliminated — makes `navigator.language` read
  happen at module load time, making it un-mockable in tests without module-level patching
- Prop drilling `t` through component tree: Eliminated — requires touching every component
  signature and every call site unnecessarily

---

## Summary of Decisions

| Question | Decision | Rationale |
|---|---|---|
| Library selection | **Custom implementation (~50 LOC)** | 30 static strings; zero interpolation/plural; no library overhead needed |
| TypeScript key safety | **`keyof typeof enCatalog`** | Compile-time exhaustiveness on keys and both catalogs |
| Playwright locale | **`browser.newContext({ locale: 'es' })`** | Idiomatic Playwright; sets both HTTP header and `navigator.language` |
| React integration | **`LocaleContext` + `LocaleProvider` + `useTranslation()`** | Avoids prop drilling; injectable locale for testing |
