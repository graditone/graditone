# Quickstart: Internationalizing a Plugin (i18n)

**Feature**: 074-sessions-plugin-i18n | Date: 2026-04-06  
**Reference implementation**: `plugins-external/sessions-plugin/`

This guide describes the standard pattern for adding multi-language support to a Graditone
external plugin. The Sessions plugin is the canonical reference implementation.

---

## Overview

Adding i18n to a plugin requires **4 files** and changes to existing component files:

| File | Purpose |
|------|---------|
| `locales/en.json` | English translation catalog (source of truth) |
| `locales/es.json` | Spanish translation catalog |
| `i18n.ts` | Locale resolver, React context provider, `useTranslation` hook |
| `i18n.test.ts` | Tests for locale resolver + catalog completeness |

No imports from the host app's i18n module are permitted — the plugin's i18n is fully
self-contained, consistent with the Plugin API boundary rule.

---

## Step 1 — Create the i18n module

Create `i18n.ts` in your plugin source directory:

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import enCatalog from './locales/en.json';
import esCatalog from './locales/es.json';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Maps a raw BCP-47 tag to a supported locale, falling back to DEFAULT_LOCALE. */
export function resolveLocale(raw: string | undefined): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const primary = raw.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(primary)
    ? (primary as SupportedLocale)
    : DEFAULT_LOCALE;
}

export type TranslationKey = keyof typeof enCatalog;

const catalogs: Record<SupportedLocale, Record<string, string>> = {
  en: enCatalog,
  es: esCatalog as Record<TranslationKey, string>,
};

interface LocaleContextValue {
  catalog: Record<string, string>;
}
const LocaleContext = createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  locale?: SupportedLocale;   // Optional override — used in tests
  children: React.ReactNode;
}

export function LocaleProvider({ locale: localeProp, children }: LocaleProviderProps) {
  const locale = useMemo<SupportedLocale>(
    () => localeProp ?? resolveLocale(typeof navigator !== 'undefined' ? navigator.language : undefined),
    [localeProp],
  );
  const catalog = useMemo(() => catalogs[locale], [locale]);
  const value = useMemo(() => ({ catalog }), [catalog]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useTranslation() must be used inside <LocaleProvider>');
  const t = useMemo(
    () =>
      (key: TranslationKey, params?: Record<string, string | number>): string => {
        let value: string = ctx.catalog[key] ?? (enCatalog as Record<string, string>)[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
          }
        }
        return value;
      },
    [ctx.catalog],
  );
  return { t };
}
```

> **tsconfig requirement**: Ensure `"resolveJsonModule": true` is set in your plugin's
> `tsconfig.json`. Vite-based plugins already have this enabled by default.

---

## Step 2 — Create the English catalog

Create `locales/en.json` with a flat JSON object. Use dot-namespaced keys grouped by
component or feature area:

```json
{
  "common.cancel": "Cancel",
  "common.task": "{count} task",
  "common.tasks": "{count} tasks",

  "my_plugin.loading": "Loading…",
  "my_plugin.empty": "Nothing here yet.",
  "my_plugin.delete_aria": "Delete {name}",
  "my_plugin.delete_confirm": "Are you sure you want to delete {name}?",

  "my_plugin.status_active": "Active",
  "my_plugin.status_closed": "Closed"
}
```

**Key-naming rules**:
- Use dot notation: `namespace.descriptive_name`
- For plural pairs, create two keys: `common.task` / `common.tasks`
- For interpolated values, use `{paramName}` placeholders
- HTML markup is allowed in values (see Step 5 for guide/prose content)

> **TypeScript enforcement**: `TranslationKey = keyof typeof enCatalog` — any call to
> `t('unknown.key')` is a TypeScript compile error. Catalog key exhaustiveness is enforced
> at compile time.

---

## Step 3 — Create the Spanish catalog

Copy `en.json` to `es.json` and translate all values. **Keep all keys unchanged.**

```json
{
  "common.cancel": "Cancelar",
  "common.task": "{count} tarea",
  "common.tasks": "{count} tareas",

  "my_plugin.loading": "Cargando…",
  "my_plugin.empty": "Todavía no hay nada aquí.",
  "my_plugin.delete_aria": "Eliminar {name}",
  "my_plugin.delete_confirm": "¿Seguro que quieres eliminar {name}?",

  "my_plugin.status_active": "Activo",
  "my_plugin.status_closed": "Cerrado"
}
```

> **TypeScript enforcement**: `es.json` is typed as `Record<TranslationKey, string>`.
> Any missing or extra key is a TypeScript compile error.

---

## Step 4 — Wrap the plugin root with `LocaleProvider`

In your plugin's entry point (`index.tsx`), wrap the root component:

```typescript
import { LocaleProvider } from './i18n';
import { MyPlugin } from './MyPlugin';

let savedContext: PluginContext;

const plugin: GraditonePlugin = {
  init(context) {
    savedContext = context;
  },
  Component: () => (
    <LocaleProvider>
      <MyPlugin context={savedContext} />
    </LocaleProvider>
  ),
};

export default plugin;
```

> `LocaleProvider` reads `navigator.language` once at mount and distributes the resolved
> locale to the entire component tree via React context. No prop drilling needed.

---

## Step 5 — Replace hardcoded strings in components

Import and use `useTranslation()` in each component:

```typescript
import { useTranslation } from './i18n';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      {/* Simple string */}
      <h2>{t('my_plugin.loading')}</h2>

      {/* With interpolation */}
      <button aria-label={t('my_plugin.delete_aria', { name: item.name })}>
        ×
      </button>

      {/* Pluralization — component selects key */}
      <span>{t(count === 1 ? 'common.task' : 'common.tasks', { count })}</span>

      {/* HTML prose (e.g. guide/help content) — developer-authored, no XSS risk */}
      <li dangerouslySetInnerHTML={{ __html: t('my_plugin.guide_step1') }} />
    </div>
  );
}
```

**Named array replacement** — replace hardcoded month/day name arrays with catalog lookups:

```typescript
// Before
const MONTH_NAMES = ['January', 'February', ...];

// After
const MONTH_NAMES = (
  ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const
).map(m => t(`calendar.month_${m}` as TranslationKey));
```

---

## Step 6 — Write tests

Create `i18n.test.ts` covering four areas (FR-012):

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveLocale } from './i18n';
import enCatalog from './locales/en.json';
import esCatalog from './locales/es.json';
import { LocaleProvider } from './i18n';
import { MyComponent } from './MyComponent';

// (a) Locale resolver
describe('resolveLocale', () => {
  it('maps "es" to "es"', () => expect(resolveLocale('es')).toBe('es'));
  it('maps "es-MX" to "es"', () => expect(resolveLocale('es-MX')).toBe('es'));
  it('maps "fr" to "en" (unsupported fallback)', () => expect(resolveLocale('fr')).toBe('en'));
  it('maps undefined to "en"', () => expect(resolveLocale(undefined)).toBe('en'));
});

// (b) Spanish renders for es locale
it('renders Spanish text when locale is es', () => {
  render(
    <LocaleProvider locale="es">
      <MyComponent />
    </LocaleProvider>,
  );
  expect(screen.getByText('Cargando…')).toBeInTheDocument();
});

// (c) English renders for unsupported locale
it('renders English text when locale is unsupported', () => {
  render(
    <LocaleProvider locale="en">
      <MyComponent />
    </LocaleProvider>,
  );
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

// (d) Catalog completeness — Spanish has every key from English
describe('catalog completeness', () => {
  const enKeys = Object.keys(enCatalog).sort();
  const esKeys = Object.keys(esCatalog).sort();

  it('Spanish catalog has no missing keys', () => {
    const missing = enKeys.filter(k => !esKeys.includes(k));
    expect(missing, `Missing in es.json: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('Spanish catalog has no extra keys', () => {
    const extra = esKeys.filter(k => !enKeys.includes(k));
    expect(extra, `Extra in es.json: ${extra.join(', ')}`).toHaveLength(0);
  });
});
```

---

## Step 7 — Add a third language (future)

To add French (`fr`) later — 2 file changes, no component changes:

1. **Create `locales/fr.json`** — copy `en.json` and translate all values
2. **Register the locale in `i18n.ts`**:

```typescript
// Before
export const SUPPORTED_LOCALES = ['en', 'es'] as const;

// After
export const SUPPORTED_LOCALES = ['en', 'es', 'fr'] as const;

// Add to catalogs object:
const catalogs = { en: enCatalog, es: esCatalog, fr: frCatalog };
```

TypeScript will reject the build if `fr.json` is missing any key from `en.json`.

---

## Verification

```bash
# Type-check: confirms catalog exhaustiveness
cd plugins-external/sessions-plugin && npx tsc --noEmit

# Unit tests: locale resolver + catalog completeness + component locale rendering
npx vitest run

# Manual: load the plugin with ?lang=es or set browser language to Spanish
#         and verify all text renders in Spanish with no raw keys visible
```
