/**
 * contracts/credits-catalog.ts
 * Feature 091: Credits Page for Preloaded Songs
 *
 * TypeScript interface contract for the credits data model.
 * This file documents the public API surface of `frontend/src/data/creditsCatalog.ts`.
 *
 * The `licenseKey` field is typed as `TranslationKey` so the TypeScript compiler
 * enforces that only valid i18n keys can be stored — invalid keys cause a build error.
 *
 * The full catalog implementation lives in:
 *   frontend/src/data/creditsCatalog.ts
 */

import type { TranslationKey } from '../../../frontend/src/i18n/index';

// ---------------------------------------------------------------------------
// SongCredit
// ---------------------------------------------------------------------------

/**
 * Attribution record for a single preloaded score bundled with Graditone.
 *
 * All fields containing proper nouns (composer, arranger, displayName) are
 * NOT translated — they are stored as plain strings and rendered as-is.
 *
 * Only `licenseKey` uses the i18n system, enabling locale-aware license labels.
 */
export interface SongCredit {
  /**
   * Stable identifier matching the corresponding PreloadedScore.id.
   * Example: 'bach-invention-1'
   * Do NOT change after the feature ships — may be used as an anchor in the future.
   */
  readonly id: string;

  /**
   * Human-readable title displayed as the entry heading in the Credits section.
   * Example: 'Bach — Invention No. 1'
   */
  readonly displayName: string;

  /**
   * Composer's name. Proper noun — rendered as-is, never passed through t().
   * Example: 'J.S. Bach'
   */
  readonly composer: string;

  /**
   * Optional name of the arranger or MusicXML engraver.
   * Present only when a non-composer engraver/arranger is known.
   * Omit (undefined) for scores that are original Graditone engravings.
   * Example: 'Smiley32'
   */
  readonly arranger?: string;

  /**
   * Translation key for the license string.
   * MUST be one of:
   *   'guide.credits.license.pd'                  → "Public Domain"
   *   'guide.credits.license.ccbyncsa'            → "CC BY-NC-SA"
   *   'guide.credits.license.all_rights_reserved' → "All rights reserved — personal/educational use only"
   *
   * TypeScript enforces this is a valid TranslationKey at compile time.
   */
  readonly licenseKey: TranslationKey;

  /**
   * Optional full URL to the upstream MusicXML score source.
   * When present, rendered as a clickable <a> link in the Credits section.
   * Omit (undefined) for scores with no external upstream source.
   * Example: 'https://musescore.com/user/71467306/scores/31905605'
   */
  readonly sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// CreditsCatalog
// ---------------------------------------------------------------------------

/**
 * Ordered collection of SongCredit entries.
 * This is the single authoritative data source for credits displayed in
 * the Guide plugin's Credits section (FR-007).
 *
 * To add a new credit entry: append a new SongCredit object to CREDITS_CATALOG
 * in frontend/src/data/creditsCatalog.ts — no UI changes required (SC-005).
 */
export type CreditsCatalog = ReadonlyArray<SongCredit>;

// ---------------------------------------------------------------------------
// CREDITS_CATALOG — the concrete export (implemented in creditsCatalog.ts)
// ---------------------------------------------------------------------------

/**
 * The concrete catalog value exported from frontend/src/data/creditsCatalog.ts.
 * Defined here for documentation purposes only; the real implementation is in
 * the source file above.
 *
 * Catalog order (7 entries as of Feature 091):
 *   1. bach-invention-1
 *   2. beethoven-fur-elise
 *   3. burgmuller-arabesque
 *   4. burgmuller-la-candeur
 *   5. chopin-nocturne-op9-2
 *   6. pachelbel-canon-d
 *   7. star-sky-two-steps-from-hell
 */
export declare const CREDITS_CATALOG: CreditsCatalog;
