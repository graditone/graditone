# Research: Credits Page for Preloaded Songs

**Feature**: 091-guide-credits-preloaded-songs  
**Phase**: 0 — Research  
**Date**: 2025-07-15

---

## 1. Source & License Data for Each Preloaded Score

All source metadata was extracted directly from the embedded MusicXML `<identification>` blocks
inside each `.mxl` file (which are ZIP-compressed XML). The fields `<creator>`, `<rights>`, and
`<source>` carry the authoritative attribution data baked in at the time the scores were prepared.

### Bach — Invention No. 1 in C Major BWV 772

| Field | Value |
|-------|-------|
| Composer | Johann Sebastian Bach (1685–1750) |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | Unknown — no `<source>` URL embedded in MXL |
| MusicXML source | Internal — no upstream URL; prepared with MuseScore Studio 4.6.5 |
| MXL file | `Bach_InventionNo1.mxl` |
| License status | Composition: Public Domain. Arrangement: unknown — treat as own work or seek provenance |
| Display recommendation | Composer: J.S. Bach · License: Public Domain · Source: Graditone original engraving |

> **Decision**: Use "Public Domain" as license, note no external source. If the file was engraved
> by the Graditone team, "Graditone original engraving" is the appropriate source text.

---

### Beethoven — Für Elise WoO 59

| Field | Value |
|-------|-------|
| Composer | Ludwig van Beethoven (1770–1827) |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | MuseScore user 71467306 |
| MusicXML source | https://musescore.com/user/71467306/scores/31905605 |
| MXL file | `Beethoven_FurElise.mxl` |
| License status | Composition: Public Domain. MuseScore platform scores are licensed under **CC BY-NC-SA** unless stated otherwise by the uploader |
| Display recommendation | Composer: L. van Beethoven · Source: musescore.com/user/71467306/scores/31905605 · License: CC BY-NC-SA |

---

### Burgmüller — Arabesque Op. 100 No. 2

| Field | Value |
|-------|-------|
| Composer | Johann Friedrich Burgmüller (1806–1874) |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | MuseScore user 71467306 |
| MusicXML source | https://musescore.com/user/71467306/scores/31905425 |
| MXL file | `Burgmuller_Arabesque.mxl` |
| License status | Composition: Public Domain. Arrangement: CC BY-NC-SA (MuseScore default) |
| Display recommendation | Composer: F. Burgmüller · Source: musescore.com/user/71467306/scores/31905425 · License: CC BY-NC-SA |

---

### Burgmüller — La Candeur Op. 100 No. 1

| Field | Value |
|-------|-------|
| Composer | Johann Friedrich Burgmüller (1806–1874) |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | MuseScore user 71467306 |
| MusicXML source | https://musescore.com/user/71467306/scores/31905386 |
| MXL file | `Burgmuller_LaCandeur.mxl` |
| License status | Composition: Public Domain. Arrangement: CC BY-NC-SA (MuseScore default) |
| Display recommendation | Composer: F. Burgmüller · Source: musescore.com/user/71467306/scores/31905386 · License: CC BY-NC-SA |

---

### Chopin — Nocturne Op. 9 No. 2

| Field | Value |
|-------|-------|
| Composer | Frédéric Chopin (1810–1849), spelled "Fredrik Chopin" in the file |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | Unknown — no `<source>` URL embedded; MXL prepared with MuseScore Studio 4.6.5 |
| MusicXML source | Internal — no upstream URL |
| MXL file | `Chopin_NocturneOp9No2.mxl` |
| License status | Composition: Public Domain. Arrangement: unknown — treat same as Bach above |
| Display recommendation | Composer: F. Chopin · License: Public Domain · Source: Graditone original engraving |

---

### Pachelbel — Canon in D

| Field | Value |
|-------|-------|
| Composer | Johann Pachelbel (1653–1706) |
| Composition | Public domain (pre-1928) |
| Arranger / Engraver | MuseScore user 71467306 |
| MusicXML source | https://musescore.com/user/71467306/scores/31030811 |
| MXL file | `Pachelbel_CanonD.mxl` |
| License status | Composition: Public Domain. Arrangement: CC BY-NC-SA (MuseScore default) |
| Display recommendation | Composer: J. Pachelbel · Source: musescore.com/user/71467306/scores/31030811 · License: CC BY-NC-SA |

---

### Two Steps from Hell — Star Sky

| Field | Value |
|-------|-------|
| Composer | Thomas Bergersen (b. 1980) — contemporary, living author |
| Original work | "Star Sky" by Two Steps from Hell (© Thomas Bergersen & Nick Phoenix) |
| Arranger | Smiley32 (fan arrangement) |
| Rights embedded in MXL | `smiley32.com` |
| MusicXML source | http://musescore.com/user/1642096/scores/4156611 |
| MXL file | `star-sky-two-steps-from-hell.mxl` |
| License status | ⚠️ **COPYRIGHTED CONTEMPORARY WORK** — composition © Two Steps from Hell. Fan-arranged MusicXML score. Non-commercial personal/educational use is generally tolerated by the rights holder, but no explicit free license is granted. Commercial redistribution is NOT permitted. |
| Display recommendation | Composer: Thomas Bergersen / Two Steps from Hell · Arranged by: Smiley32 · License: All rights reserved — personal/educational use only |

> **Risk note**: Star Sky is the only non-public-domain piece in the bundle. The spec explicitly
> acknowledges this (Assumption 2) and requires the license entry to clearly state whether commercial
> reuse is permitted (FR-003, SC-002, User Story 1 scenario 3). The credits entry should
> display "All rights reserved — personal/educational use only" as the license value.

---

## 2. i18n Key Design

### Decision
Use a flat-key scheme matching the existing `guide.*` namespace pattern.
Labels (`Composer`, `Arranged by`, `License`, `Source`) are translatable.
Song titles and proper names (composer names, arranger names) are NOT translated — they are
stored as literal strings in the data model.

### Keys to add (both `en.json` and `es.json`)

```
guide.credits.heading          Section heading: "Credits"
guide.credits.intro            Introductory sentence
guide.credits.label.composer   Row label: "Composer"
guide.credits.label.arranger   Row label: "Arranged by"
guide.credits.label.license    Row label: "License"
guide.credits.label.source     Row label: "Source"
guide.credits.license.pd       Value: "Public Domain"
guide.credits.license.ccbyncsa Value: "CC BY-NC-SA"
guide.credits.license.all_rights_reserved  Value: "All rights reserved — personal/educational use only"
guide.credits.source.internal  Value: "Graditone original engraving"
```

### Rationale
- Keeping labels and license values in the catalog (rather than hardcoded) satisfies FR-005 and
  FR-006 fully, and avoids hardcoded English in the component.
- Reusing the existing `useTranslation` / `t()` hook is sufficient — no new i18n infrastructure
  is required (spec Assumption 4).

---

## 3. Component Design

### Decision
Render the credits section using a `<dl>` (description list) per song entry.

```
<section class="guide-section" aria-labelledby="guide-h-credits">
  <h2 id="guide-h-credits">{t('guide.credits.heading')}</h2>
  <p>{t('guide.credits.intro')}</p>
  {CREDITS_CATALOG.map(credit => (
    <div class="guide-credits__entry" key={credit.id}>
      <h3 class="guide-credits__title">{credit.displayName}</h3>
      <dl class="guide-credits__dl">
        <dt>{t('guide.credits.label.composer')}</dt><dd>{credit.composer}</dd>
        {credit.arranger && <><dt>{t('guide.credits.label.arranger')}</dt><dd>{credit.arranger}</dd></>}
        <dt>{t('guide.credits.label.license')}</dt><dd>{t(credit.licenseKey)}</dd>
        {credit.sourceUrl && <><dt>{t('guide.credits.label.source')}</dt><dd><a href={credit.sourceUrl}...>{credit.sourceUrl}</a></dd>}
        {!credit.sourceUrl && <><dt>{t('guide.credits.label.source')}</dt><dd>{t('guide.credits.source.internal')}</dd></>}
      </dl>
    </div>
  ))}
</section>
```

### Rationale
- `<dl>` is the semantically correct HTML element for label–value pairs (accessibility FR-008).
- Section uses `aria-labelledby` matching the existing pattern in all 5 current sections.
- Entries are driven entirely by `CREDITS_CATALOG` — adding a new entry requires zero
  component changes (spec US3, SC-005).
- `licenseKey` in the data model is a `TranslationKey` so TypeScript enforces valid values
  at compile time, preventing invalid keys from entering the catalog.

---

## 4. CSS Strategy

### Decision
No new CSS classes are strictly required. The Credits section reuses `.guide-section` and
`.guide-section h2` for the heading. Two minimal additions to `GuidePlugin.css`:

- `.guide-credits__entry` — adds `margin-bottom: 1.5rem` between song entries
- `.guide-credits__dl` — `display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 1rem`
  for the dt/dd label–value layout

### Rationale
Grid-based `<dl>` layout is modern, accessible, and visually consistent with the existing section
style. It avoids float or flexbox hacks and is supported in all target browsers (Chrome 57+,
Safari 11+, Edge 16+).

---

## 5. Resolved Clarifications

| Unknown | Resolution |
|---------|-----------|
| Source URLs for Bach / Chopin (no `<source>` in MXL) | Display "Graditone original engraving" as source; license = Public Domain |
| Star Sky copyright status | Contemporary © Thomas Bergersen. Fan arrangement by Smiley32. License = "All rights reserved — personal/educational use only" |
| i18n key structure for license values | Store `licenseKey: TranslationKey` in `SongCredit` — type-checked, translatable |
| Component markup for accessibility | Use `<dl>` per entry inside `<section aria-labelledby>` matching existing pattern |
| CSS approach | Minimal additions to GuidePlugin.css; no new stylesheet required |
