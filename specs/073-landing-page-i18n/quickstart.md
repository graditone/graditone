# Quickstart: Adding a New Language to Graditone

**Feature**: 073-landing-page-i18n | Date: 2026-04-05

Adding a new language (e.g., French) requires exactly **2 file changes** and no component code
modifications (SC-004, FR-008).

---

## Step 1 — Create the translation catalog

Copy `frontend/src/i18n/locales/en.json` to a new file named after the
[BCP 47 primary subtag](https://www.iana.org/assignments/language-subtag-registry/) for the
new language:

```bash
cp frontend/src/i18n/locales/en.json frontend/src/i18n/locales/fr.json
```

Translate every value in `fr.json`. Keep all keys unchanged — they are language-agnostic
identifiers that must not be altered.

```json
{
  "loading.engine": "Chargement du moteur musical...",
  "errors.wasm.title": "Échec de l'initialisation du moteur musical",
  ...
}
```

**TypeScript will fail to compile** if any key present in `en.json` is missing from the new
catalog. This is intentional — it prevents partial translations shipping.

---

## Step 2 — Register the new locale

Open `frontend/src/i18n/registry.ts` and add the new language code:

```typescript
// Before:
export const SUPPORTED_LOCALES = ['en', 'es'] as const;

// After:
export const SUPPORTED_LOCALES = ['en', 'es', 'fr'] as const;
```

That's it. No component changes needed.

---

## Verification

```bash
# Type-check: confirms catalog is exhaustive
cd frontend && npx tsc --noEmit

# Unit test: confirms locale resolver returns 'fr' for a French browser
npx vitest run src/test/i18n/

# Manual: open the app in a browser with French language and verify all strings render in French
```

---

## Notes

- Use the primary language subtag only (e.g., `fr` not `fr-FR`). The resolver matches on
  the primary subtag, so `fr`, `fr-FR`, `fr-CA` etc. all use the `fr` catalog.
- If a translation is unavailable for a string, leave its value as the English string
  temporarily — the TypeScript type enforcer still requires the key to be present with _some_
  value so the build succeeds.
- If the new language reads right-to-left (e.g., Arabic, Hebrew), additional CSS changes to
  the app layout are needed — those fall outside the scope of this feature.
