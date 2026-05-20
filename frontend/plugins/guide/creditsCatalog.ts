/**
 * creditsCatalog.ts — Feature 091-guide-credits-preloaded-songs
 *
 * Defines the SongCredit interface and the authoritative CREDITS_CATALOG array
 * for all preloaded scores bundled with Graditone.
 *
 * Adding or removing an entry here automatically updates the Credits section
 * in GuidePlugin with no component changes required (FR-007, SC-005, US3).
 *
 * NOTE: This file does NOT import from preloadedScores.ts — the two files are
 * intentionally independent. Credits are static attribution records, not
 * dynamic metadata for score loading.
 */

import type { TranslationKey } from '../../src/i18n/index';

/**
 * Attribution record for a single preloaded score bundled with the app.
 *
 * - `id`          — Stable identifier; mirrors the PreloadedScore.id from
 *                   preloadedScores.ts (e.g. 'bach-invention-1'). Used as React key.
 * - `displayName` — Human-readable song title as shown in the credits list.
 * - `composer`    — Composer name in natural language (not translated — proper noun).
 * - `arranger`    — Optional arranger/engraver name. Omit for original-engraving entries.
 * - `licenseKey`  — TranslationKey referencing the license string in the i18n catalog
 *                   (e.g. 'guide.credits.license.pd'). Enforced at compile time.
 * - `sourceUrl`   — Optional URL to the upstream MusicXML score source.
 *                   Omit for internally engraved scores.
 */
export interface SongCredit {
  readonly id: string;
  readonly displayName: string;
  readonly composer: string;
  readonly arranger?: string;
  readonly licenseKey: TranslationKey;
  readonly sourceUrl?: string;
}

/**
 * Ordered list of all SongCredit entries.
 * Displayed in the Guide plugin Credits section in definition order.
 * Add a new entry here to have it automatically appear in the Guide.
 */
export type CreditsCatalog = ReadonlyArray<SongCredit>;

export const CREDITS_CATALOG: CreditsCatalog = [
  {
    id: 'bach-invention-1',
    displayName: 'Bach — Invention No. 1',
    composer: 'J.S. Bach',
    licenseKey: 'guide.credits.license.ccby',
    sourceUrl: 'https://musescore.com/kursattaydas/scores/1478431',
  },
  {
    id: 'beethoven-fur-elise',
    displayName: 'Beethoven — Für Elise',
    composer: 'L. van Beethoven',
    licenseKey: 'guide.credits.license.cczero',
    sourceUrl: 'https://musescore.com/user/71467306/scores/31905605',
  },
  {
    id: 'burgmuller-arabesque',
    displayName: 'Burgmüller — Arabesque',
    composer: 'F. Burgmüller',
    licenseKey: 'guide.credits.license.ccbysa',
    sourceUrl: 'https://musescore.com/user/71467306/scores/31905425',
  },
  {
    id: 'burgmuller-la-candeur',
    displayName: 'Burgmüller — La Candeur',
    composer: 'F. Burgmüller',
    licenseKey: 'guide.credits.license.cczero',
    sourceUrl: 'https://musescore.com/user/71467306/scores/31905386',
  },
  {
    id: 'chopin-nocturne-op9-2',
    displayName: 'Chopin — Nocturne Op. 9 No. 2',
    composer: 'F. Chopin',
    licenseKey: 'guide.credits.license.ccby',
    sourceUrl: 'https://musescore.com/user/6662591/scores/4383881',
  },
  {
    id: 'pachelbel-canon-d',
    displayName: 'Pachelbel — Canon in D',
    composer: 'J. Pachelbel',
    licenseKey: 'guide.credits.license.pd',
  },
  {
    id: 'star-sky-two-steps-from-hell',
    displayName: 'Two Steps from Hell — Star Sky',
    composer: 'Thomas Bergersen',
    arranger: 'Smiley32',
    licenseKey: 'guide.credits.license.ccbysa',
    sourceUrl: 'https://musescore.com/smiley32/scores/4156611',
  },
];
