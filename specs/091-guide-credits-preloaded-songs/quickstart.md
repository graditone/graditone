# Quickstart: Adding or Updating a Credit Entry

**Feature**: 091-guide-credits-preloaded-songs  
**Audience**: Developer adding a new preloaded song or updating an existing credit  
**Date**: 2025-07-15

---

## Overview

Credits for preloaded songs live in a single file:

```
frontend/src/data/creditsCatalog.ts
```

The Guide plugin (`frontend/plugins/guide/GuidePlugin.tsx`) reads this catalog at render time and
displays one entry per song — **no component changes are needed when you add or remove a credit**.

---

## Adding a New Credit Entry

### Step 1 — Write the test first (Constitution Principle V)

Open `frontend/src/data/creditsCatalog.test.ts` and add a test for the new entry:

```typescript
it('includes an entry for <New Song>', () => {
  const entry = CREDITS_CATALOG.find(c => c.id === '<new-song-id>');
  expect(entry).toBeDefined();
  expect(entry?.composer).toBe('<Composer Name>');
  expect(entry?.licenseKey).toBe('guide.credits.license.pd'); // or ccbyncsa / all_rights_reserved
});
```

Run `npm run test -- src/data/creditsCatalog` — confirm the test fails (red).

### Step 2 — Add the new `SongCredit` to the catalog

Open `frontend/src/data/creditsCatalog.ts` and append a new entry to `CREDITS_CATALOG`:

```typescript
{
  id: 'new-song-id',           // must match PreloadedScore.id exactly
  displayName: 'Composer — Title',
  composer: 'Full Composer Name',
  arranger: 'Arranger Name',   // omit if no separate arranger
  licenseKey: 'guide.credits.license.pd',   // see license key table below
  sourceUrl: 'https://musescore.com/...',   // omit if no external source
},
```

Run `npm run test -- src/data/creditsCatalog` — confirm the test passes (green).

### Step 3 — Verify in the Guide plugin

Start the dev server (`npm run dev` from `frontend/`) and open the Guide plugin. Scroll to the
Credits section — the new entry should appear at the bottom of the list.

---

## License Key Reference

| `licenseKey` value | Displayed in English | When to use |
|---|---|---|
| `'guide.credits.license.pd'` | Public Domain | Classical compositions pre-1928 with no upstream arranger or Graditone-original engraving |
| `'guide.credits.license.ccbyncsa'` | CC BY-NC-SA | Scores sourced from MuseScore.com (default platform license) |
| `'guide.credits.license.all_rights_reserved'` | All rights reserved — personal/educational use only | Contemporary copyrighted works (e.g. film/game music, living composers) |

---

## Updating an Existing Credit

1. Find the entry by `id` in `frontend/src/data/creditsCatalog.ts`
2. Edit the relevant field(s)
3. Update the corresponding assertion in `creditsCatalog.test.ts` if the tested value changed
4. Run `npm run test -- src/data/creditsCatalog` to verify

---

## Adding a New License Type

If none of the three existing license keys fits:

1. Add the new key to **both** `frontend/src/i18n/locales/en.json` and `es.json`:
   ```json
   "guide.credits.license.my_license": "My License Name"
   ```
   (Both files must have exactly the same keys — enforced by `locales.test.ts`)

2. Use the new key as `licenseKey` in the `SongCredit` entry. TypeScript will compile-error
   if the key does not exist in `en.json`.

---

## Running All Related Tests

```bash
cd frontend

# Data model contract
npm run test -- src/data/creditsCatalog

# Guide plugin rendering (credits section)
npm run test -- plugins/guide

# i18n key parity (en.json ↔ es.json)
npm run test -- src/i18n/locales.test
```

---

## File Map

| File | Purpose |
|------|---------|
| `frontend/src/data/creditsCatalog.ts` | **Edit here** to add/update credit entries |
| `frontend/src/data/creditsCatalog.test.ts` | Unit tests for the catalog contract |
| `frontend/plugins/guide/GuidePlugin.tsx` | Renders credits — do NOT edit for data changes |
| `frontend/plugins/guide/GuidePlugin.test.tsx` | Component tests — update when credits count changes |
| `frontend/src/i18n/locales/en.json` | English translations — add new license keys here |
| `frontend/src/i18n/locales/es.json` | Spanish translations — must mirror `en.json` keys exactly |
| `specs/091-guide-credits-preloaded-songs/data-model.md` | Full data model documentation |
