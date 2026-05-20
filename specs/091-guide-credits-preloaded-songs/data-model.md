# Data Model: Credits Catalog

**Feature**: 091-guide-credits-preloaded-songs  
**Phase**: 1 — Design  
**Date**: 2025-07-15

---

## Entities

### SongCredit

Represents the attribution record for a single preloaded song.

```typescript
/**
 * Attribution record for a single preloaded score bundled with the app.
 *
 * - `id`          — Stable identifier; mirrors the PreloadedScore.id from preloadedScores.ts
 *                   (e.g. 'bach-invention-1'). Used as React key.
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
  readonly licenseKey: TranslationKey;   // enforced: must be a valid i18n key
  readonly sourceUrl?: string;
}
```

### CreditsCatalog

The ordered collection of all `SongCredit` entries. Serves as the single source of truth
for credits data displayed in the Guide plugin.

```typescript
/**
 * Ordered list of all SongCredit entries.
 * Displayed in the Guide plugin Credits section in definition order.
 * Add a new entry here to have it automatically appear in the Guide.
 */
export type CreditsCatalog = ReadonlyArray<SongCredit>;

export const CREDITS_CATALOG: CreditsCatalog = [ /* 7 entries — see contracts/ */ ];
```

---

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | ✅ | Mirrors `PreloadedScore.id`. Stable — do not change after release |
| `displayName` | `string` | ✅ | Shown as `<h3>` in the credits entry |
| `composer` | `string` | ✅ | Proper noun — not passed through `t()` |
| `arranger` | `string` | ❌ | Present only when a non-composer engraver/arranger is known |
| `licenseKey` | `TranslationKey` | ✅ | Key into the flat i18n catalog; TypeScript-enforced |
| `sourceUrl` | `string` | ❌ | Full URL to upstream source. Omit for internally engraved scores |

---

## Validation Rules

1. `id` MUST be unique across all entries in `CREDITS_CATALOG`
2. `licenseKey` MUST be one of the defined `guide.credits.license.*` keys
3. `displayName` MUST be non-empty
4. `composer` MUST be non-empty
5. `sourceUrl`, when present, MUST be a valid HTTP/HTTPS URL string

---

## Catalog Population (7 entries)

| id | displayName | composer | arranger | licenseKey | sourceUrl |
|----|-------------|----------|----------|------------|-----------|
| `bach-invention-1` | Bach — Invention No. 1 | J.S. Bach | — | `guide.credits.license.pd` | — |
| `beethoven-fur-elise` | Beethoven — Für Elise | L. van Beethoven | — | `guide.credits.license.ccbyncsa` | musescore.com/…/31905605 |
| `burgmuller-arabesque` | Burgmüller — Arabesque | F. Burgmüller | — | `guide.credits.license.ccbyncsa` | musescore.com/…/31905425 |
| `burgmuller-la-candeur` | Burgmüller — La Candeur | F. Burgmüller | — | `guide.credits.license.ccbyncsa` | musescore.com/…/31905386 |
| `chopin-nocturne-op9-2` | Chopin — Nocturne Op. 9 No. 2 | F. Chopin | — | `guide.credits.license.pd` | — |
| `pachelbel-canon-d` | Pachelbel — Canon in D | J. Pachelbel | — | `guide.credits.license.ccbyncsa` | musescore.com/…/31030811 |
| `star-sky-two-steps-from-hell` | Two Steps from Hell — Star Sky | Thomas Bergersen | Smiley32 | `guide.credits.license.all_rights_reserved` | musescore.com/…/4156611 |

---

## i18n Key Model

### New keys added to `en.json` and `es.json` (exact parity required)

```
guide.credits.heading
guide.credits.intro
guide.credits.label.composer
guide.credits.label.arranger
guide.credits.label.license
guide.credits.label.source
guide.credits.license.pd
guide.credits.license.ccbyncsa
guide.credits.license.all_rights_reserved
guide.credits.source.internal
```

### English values (en.json additions)

```json
"guide.credits.heading": "Credits",
"guide.credits.intro": "The following preloaded scores are bundled with Graditone. Composition and arrangement attribution is listed below.",
"guide.credits.label.composer": "Composer",
"guide.credits.label.arranger": "Arranged by",
"guide.credits.label.license": "License",
"guide.credits.label.source": "Source",
"guide.credits.license.pd": "Public Domain",
"guide.credits.license.ccbyncsa": "CC BY-NC-SA",
"guide.credits.license.all_rights_reserved": "All rights reserved — personal/educational use only",
"guide.credits.source.internal": "Graditone original engraving"
```

### Spanish values (es.json additions)

```json
"guide.credits.heading": "Créditos",
"guide.credits.intro": "Las siguientes partituras precargadas están incluidas con Graditone. A continuación se detalla la atribución de composición y arreglo.",
"guide.credits.label.composer": "Compositor",
"guide.credits.label.arranger": "Arreglado por",
"guide.credits.label.license": "Licencia",
"guide.credits.label.source": "Fuente",
"guide.credits.license.pd": "Dominio público",
"guide.credits.license.ccbyncsa": "CC BY-NC-SA",
"guide.credits.license.all_rights_reserved": "Todos los derechos reservados — solo uso personal/educativo",
"guide.credits.source.internal": "Grabado original de Graditone"
```

---

## Relationship to Existing Data Models

```
PreloadedScore (preloadedScores.ts)          SongCredit (creditsCatalog.ts)
  id: 'bach-invention-1'          ←→          id: 'bach-invention-1'
  displayName: 'Bach — ...'                   displayName: 'Bach — ...'
  path: '/scores/Bach_Invention...'           composer / licenseKey / sourceUrl
```

`SongCredit.id` mirrors `PreloadedScore.id` for traceability, but there is no runtime
dependency — `creditsCatalog.ts` does NOT import `preloadedScores.ts`. The two files are
independent; credits are static attribution records, not dynamic metadata for score loading.

---

## Post-Design Constitution Re-check

| Principle | Status |
|-----------|--------|
| I. DDD | ✅ `SongCredit` and `CreditsCatalog` are genuine domain entities with music-domain terminology |
| II. Hexagonal | ✅ Data model has zero external dependencies — pure TypeScript interfaces |
| V. TDD | ✅ `creditsCatalog.test.ts` tests must be written before `creditsCatalog.ts` |
| VIII. Profile Awareness | ✅ No user state — static read-only catalog |
