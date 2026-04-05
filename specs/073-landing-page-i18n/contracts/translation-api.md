# Contract: Translation API (073-landing-page-i18n)

**Type**: TypeScript interface contract (frontend-internal)  
**Phase 1 output** | Branch: `073-landing-page-i18n` | Date: 2026-04-05

---

## Overview

This contract defines the public surface of the i18n module (`frontend/src/i18n/`). All
translatable components consume ONLY this interface — no component imports catalogs or locale
resolution logic directly.

---

## `TranslationKey` — Enumerated Key Union

```typescript
/**
 * Union of all valid translation key strings, derived from the English catalog.
 * Using an invalid key (typo, missing key) is a compile-time TypeScript error.
 *
 * Examples: "loading.engine" | "errors.wasm.title" | "header.slogan" | "offline.banner"
 *           (see data-model.md for the full 30-key schema)
 */
export type TranslationKey = keyof typeof import('./locales/en.json');
```

---

## `t(key)` — Translation Function

```typescript
/**
 * Returns the translated string for the given key in the currently active locale.
 *
 * - If the active locale catalog contains the key, returns the translated value.
 * - If the key is missing from the active locale catalog, returns the English value
 *   (fallback; guaranteed non-empty because English is the source of truth).
 * - The key argument is type-checked against TranslationKey at compile time.
 *
 * @param key  A valid TranslationKey (dot-notation string, e.g. "header.slogan")
 * @returns    The translated string, never empty, never a raw key
 */
type TranslateFn = (key: TranslationKey) => string;
```

---

## `useTranslation()` — React Hook

```typescript
/**
 * Returns the translation function for the current locale.
 * Must be called inside a component tree wrapped by <LocaleProvider>.
 *
 * @returns { t: TranslateFn }
 *
 * @example
 *   const { t } = useTranslation();
 *   return <p>{t('header.slogan')}</p>;
 */
function useTranslation(): { t: TranslateFn }
```

---

## `<LocaleProvider>` — React Context Provider

```typescript
interface LocaleProviderProps {
  /**
   * Optional: override locale for testing or future in-app language selection.
   * When omitted, the provider auto-detects locale from navigator.language.
   * When provided, the auto-detection step is skipped entirely.
   */
  locale?: SupportedLocale;
  children: React.ReactNode;
}

/**
 * Must wrap the application root (or any subtree requiring translations).
 * Reads navigator.language once on mount (unless `locale` prop is provided).
 * Provides the resolved TranslateFn to all descendants via useTranslation().
 */
function LocaleProvider(props: LocaleProviderProps): JSX.Element
```

---

## `SupportedLocale` — Supported Locale Type

```typescript
/**
 * Union of all supported locale codes.
 * Extend by adding a new entry to SUPPORTED_LOCALES in registry.ts.
 */
export type SupportedLocale = 'en' | 'es';

/** Default locale used when navigator.language is unrecognized. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';
```

---

## Invariants

1. `t(key)` NEVER returns an empty string or a raw key string
2. `t(key)` is synchronous — no Promise, no loading state
3. The active locale is determined once at provider mount; it does not change during a session
4. Adding a new `SupportedLocale` requires: (a) a new JSON catalog file, (b) adding the locale
   code to `SUPPORTED_LOCALES` in `registry.ts` — no component code changes (FR-008)
5. `TranslationKey` is exhaustive: the TypeScript compiler rejects usage of any string not
   defined as a key in `en.json`

---

## Prohibited Patterns

```typescript
// FORBIDDEN: directly importing a catalog from a component
import es from '../i18n/locales/es.json';

// FORBIDDEN: language-specific conditional in a component (FR-007)
const label = navigator.language.startsWith('es') ? 'Complementos' : 'Plugins';

// FORBIDDEN: hardcoded strings not routed through t() in translatable components
return <p>The open platform for musical practice</p>;
```
