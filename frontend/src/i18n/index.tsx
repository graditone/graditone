/**
 * i18n public API — Feature 073: Landing Page i18n
 *
 * Exports:
 *   - TranslationKey   – union type of all valid translation keys (derived from en.json)
 *   - LocaleProvider   – Context provider; auto-detects locale or accepts an override
 *   - useTranslation   – hook that returns { t } for translating keys
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import type { SupportedLocale } from './registry';
import { resolveLocale } from './registry';
import enCatalog from './locales/en.json';
import esCatalog from './locales/es.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Union of all valid translation keys — derived from the EN catalog at compile time */
export type TranslationKey = keyof typeof enCatalog;

const catalogs: Record<SupportedLocale, Record<TranslationKey, string>> = {
  en: enCatalog,
  es: esCatalog as Record<TranslationKey, string>,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface LocaleContextValue {
  locale: SupportedLocale;
  catalog: Record<string, string>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface LocaleProviderProps {
  /**
   * Optional locale override.  When omitted, the locale is detected from
   * `navigator.language` at mount time.
   */
  locale?: SupportedLocale;
  /**
   * Internal test-only prop: inject a partial catalog to exercise key-missing
   * fallback behaviour without module patching.
   */
  _testCatalogOverride?: Record<string, string>;
  children: React.ReactNode;
}

export function LocaleProvider({
  locale: localeProp,
  _testCatalogOverride,
  children,
}: LocaleProviderProps) {
  const locale = useMemo<SupportedLocale>(
    () =>
      localeProp ??
      resolveLocale(
        typeof navigator !== 'undefined' ? navigator.language : undefined,
      ),
    [localeProp],
  );

  const catalog = useMemo<Record<string, string>>(
    () => _testCatalogOverride ?? catalogs[locale],
    [locale, _testCatalogOverride],
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, catalog }), [locale, catalog]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTranslation(): { t: (key: TranslationKey) => string } {
  const ctx = useContext(LocaleContext);

  if (!ctx) {
    throw new Error(
      'useTranslation() must be used inside a <LocaleProvider>. ' +
        'Wrap your component tree with <LocaleProvider>.',
    );
  }

  const t = useMemo(
    () =>
      (key: TranslationKey): string =>
        ctx.catalog[key] ?? enCatalog[key],
    [ctx.catalog],
  );

  return { t };
}
