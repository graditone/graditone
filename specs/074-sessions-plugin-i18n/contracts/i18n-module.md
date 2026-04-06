# Contract: Sessions Plugin i18n Module

**Feature**: 074-sessions-plugin-i18n
**Date**: 2026-04-06

## Overview

The sessions plugin i18n module (`i18n.tsx`) is already implemented and exposes a self-contained
public API for locale resolution and translation within the plugin. This contract documents the
existing interface — no changes are needed to the i18n module API.

## Public API

### Constants & Types

```typescript
const SUPPORTED_LOCALES: readonly ['en', 'es'];
type SupportedLocale = 'en' | 'es';
const DEFAULT_LOCALE: SupportedLocale; // 'en'
type TranslationKey = keyof typeof enCatalog; // union of all keys in en.json
```

### Functions

#### `resolveLocale(raw: string | undefined): SupportedLocale`

Maps a BCP-47 tag to a supported locale. Extracts the primary subtag (before first `-`),
checks against `SUPPORTED_LOCALES`, falls back to `DEFAULT_LOCALE`.

| Input | Output |
|-------|--------|
| `"es"` | `"es"` |
| `"es-MX"` | `"es"` |
| `"en"` | `"en"` |
| `"en-GB"` | `"en"` |
| `"fr"` | `"en"` |
| `undefined` | `"en"` |
| `""` | `"en"` |

#### `LocaleProvider({ locale?, children }): JSX.Element`

React context provider. Resolves locale from `navigator.language` at mount (or accepts
explicit `locale` prop for testing). Makes the resolved catalog available to descendants.

#### `useTranslation(): { t }`

React hook. Returns `t(key, params?)` function.
- Looks up `key` in the active catalog, falls back to English catalog, falls back to raw key.
- If `params` provided, replaces `{paramName}` placeholders in the resolved string.

```typescript
// Usage
const { t } = useTranslation();
t('sessions.loading');           // → "Loading sessions…" (en) / "Cargando sesiones…" (es)
t('common.tasks', { count: 3 }); // → "3 tasks" (en) / "3 tareas" (es)
```

## Locale Catalog Contract

### File format

JSON object: `Record<string, string>` — flat key-value map.

```json
{
  "namespace.section.element": "Translated text with optional {param} placeholders"
}
```

### Key conventions

- Dot-separated namespaces: `common`, `sessions`, `task`, `goals`, `calendar`, `warmup`, `guide`
- Keys are lowercase, words separated by underscores: `guide.quick_start.step1`
- Interpolation uses `{paramName}` syntax

### Parity requirement

Both `en.json` and `es.json` must have identical key sets.
Enforced by `i18n.test.ts` catalog completeness tests.

## Adding a New Language

1. Create `locales/<code>.json` with all keys from `en.json`
2. In `i18n.tsx`: add the locale code to `SUPPORTED_LOCALES` array and import the catalog into `catalogs` map
3. No component code changes required
