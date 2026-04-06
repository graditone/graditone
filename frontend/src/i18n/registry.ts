/**
 * Locale registry and resolver — Feature 073: Landing Page i18n
 *
 * Defines the supported locales, the default locale, and the resolveLocale()
 * function that maps any BCP-47 language tag to a supported locale.
 *
 * --- Adding a New Language ---
 * See specs/073-landing-page-i18n/quickstart.md for the full guide.
 * Summary (2 file changes, 0 component changes):
 *   1. Add the new locale code (e.g. 'fr') to SUPPORTED_LOCALES below.
 *   2. Create frontend/src/i18n/locales/<code>.json with all 30 keys.
 * TypeScript will reject the build if any key is missing or extra.
 */

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Maps a raw BCP-47 language tag (e.g. "es-MX", "en-GB", "zh-Hant-TW") to a
 * supported locale.  Unknown or empty tags fall back to DEFAULT_LOCALE.
 */
export function resolveLocale(raw: string | undefined): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const primary = raw.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(primary)
    ? (primary as SupportedLocale)
    : DEFAULT_LOCALE;
}
