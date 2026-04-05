# Data Model: Landing Page i18n (073)

**Phase 1 output** | Branch: `073-landing-page-i18n` | Date: 2026-04-05

---

## Translation Key Schema

The English catalog (`en.json`) is the authoritative source of truth. Every key defined here
MUST have a corresponding entry in every other language catalog. The TypeScript type
`TranslationKey` is derived from `keyof typeof enCatalog` at compile time.

### Catalog Structure (flat JSON)

```json
{
  "loading.engine": "",

  "errors.wasm.title": "",
  "errors.wasm.offline_title": "",
  "errors.wasm.offline_body": "",
  "errors.wasm.offline_reload": "",
  "errors.wasm.generic_body": "",
  "errors.wasm.details_toggle": "",
  "errors.wasm.offline_note": "",
  "errors.wasm.browser_hint": "",

  "header.slogan": "",
  "header.plugins_button": "",
  "header.plugins_button_label": "",
  "header.installed_plugins_nav": "",

  "landing.aria_playing": "",
  "landing.aria_paused": "",

  "ios_install.title": "",
  "ios_install.step_intro": "",
  "ios_install.step_share": "",
  "ios_install.step_share_aria": "",
  "ios_install.step_add": "",
  "ios_install.step_confirm": "",
  "ios_install.dismiss_button": "",
  "ios_install.dismiss_button_aria": "",

  "android_install.banner_aria": "",
  "android_install.title": "",
  "android_install.subtitle": "",
  "android_install.cta": "",
  "android_install.cta_aria": "",
  "android_install.dismiss_aria": "",

  "offline.banner": ""
}
```

### English Values (`en.json`)

```json
{
  "loading.engine": "Loading music engine...",

  "errors.wasm.title": "Failed to Initialize Music Engine",
  "errors.wasm.offline_title": "Offline First Launch Detected",
  "errors.wasm.offline_body": "This app requires one online visit to download the music engine before offline mode works.",
  "errors.wasm.offline_reload": "Please connect to the internet and reload the page.",
  "errors.wasm.generic_body": "Your browser may not support WebAssembly, or there was an error loading the music engine.",
  "errors.wasm.details_toggle": "Error Details",
  "errors.wasm.offline_note": "After one online visit, all features work offline.",
  "errors.wasm.browser_hint": "Try using a modern browser like Chrome, Firefox, Safari, or Edge.",

  "header.slogan": "The open platform for musical practice",
  "header.plugins_button": "Plugins",
  "header.plugins_button_label": "Manage Plugins",
  "header.installed_plugins_nav": "Installed plugins",

  "landing.aria_playing": "Landing screen (click to pause)",
  "landing.aria_paused": "Landing screen (paused — click to resume)",

  "ios_install.title": "Install Graditone",
  "ios_install.step_intro": "Install this app on your iPad for the best experience:",
  "ios_install.step_share": "Tap the Share button",
  "ios_install.step_share_aria": "Share icon",
  "ios_install.step_add": "Scroll down and tap \"Add to Home Screen\"",
  "ios_install.step_confirm": "Tap \"Add\" to confirm",
  "ios_install.dismiss_button": "Got it",
  "ios_install.dismiss_button_aria": "Dismiss install instructions",

  "android_install.banner_aria": "Install Graditone from Google Play",
  "android_install.title": "Graditone is on Google Play",
  "android_install.subtitle": "Install the app for the best experience",
  "android_install.cta": "Get the app",
  "android_install.cta_aria": "Get Graditone on Google Play",
  "android_install.dismiss_aria": "Dismiss Play Store banner",

  "offline.banner": "You're offline — all features work normally"
}
```

### Spanish Values (`es.json`)

```json
{
  "loading.engine": "Cargando el motor de música...",

  "errors.wasm.title": "Error al inicializar el motor de música",
  "errors.wasm.offline_title": "Primer inicio sin conexión detectado",
  "errors.wasm.offline_body": "Esta aplicación requiere una visita en línea para descargar el motor de música antes de que funcione sin conexión.",
  "errors.wasm.offline_reload": "Conéctate a internet y recarga la página.",
  "errors.wasm.generic_body": "Es posible que tu navegador no sea compatible con WebAssembly, o que haya habido un error al cargar el motor de música.",
  "errors.wasm.details_toggle": "Detalles del error",
  "errors.wasm.offline_note": "Tras una visita en línea, todas las funciones funcionan sin conexión.",
  "errors.wasm.browser_hint": "Prueba con un navegador moderno como Chrome, Firefox, Safari o Edge.",

  "header.slogan": "La plataforma abierta para la práctica musical",
  "header.plugins_button": "Complementos",
  "header.plugins_button_label": "Gestionar complementos",
  "header.installed_plugins_nav": "Complementos instalados",

  "landing.aria_playing": "Pantalla de inicio (haz clic para pausar)",
  "landing.aria_paused": "Pantalla de inicio (pausada — haz clic para reanudar)",

  "ios_install.title": "Instalar Graditone",
  "ios_install.step_intro": "Instala esta aplicación en tu iPad para la mejor experiencia:",
  "ios_install.step_share": "Toca el botón Compartir",
  "ios_install.step_share_aria": "Icono de compartir",
  "ios_install.step_add": "Desplázate hacia abajo y toca "Añadir a pantalla de inicio"",
  "ios_install.step_confirm": "Toca "Añadir" para confirmar",
  "ios_install.dismiss_button": "Entendido",
  "ios_install.dismiss_button_aria": "Cerrar instrucciones de instalación",

  "android_install.banner_aria": "Instalar Graditone desde Google Play",
  "android_install.title": "Graditone está en Google Play",
  "android_install.subtitle": "Instala la aplicación para la mejor experiencia",
  "android_install.cta": "Obtener la aplicación",
  "android_install.cta_aria": "Obtener Graditone en Google Play",
  "android_install.dismiss_aria": "Cerrar banner de Play Store",

  "offline.banner": "Estás sin conexión — todas las funciones funcionan normalmente"
}
```

---

## Locale Resolver Logic

```
Input:  navigator.language  (BCP 47 string, e.g. "es-MX", "en-US", "fr")
Output: SupportedLocale     ("en" | "es")

Algorithm:
  1. Extract primary subtag: lang = navigator.language.split('-')[0].toLowerCase()
  2. If lang appears in SUPPORTED_LOCALES registry → return lang
  3. Otherwise → return DEFAULT_LOCALE ("en")
```

### Supported Locales Registry

```typescript
// registry.ts
export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';
```

---

## Translation Catalog Type Contract

```typescript
// Derived from en.json at compile time:
import enCatalog from './locales/en.json';
export type TranslationKey = keyof typeof enCatalog;

// Spanish catalog enforced to cover every key:
import type { TranslationKey } from './index';
// es.json must satisfy Record<TranslationKey, string> — validated at import
```

---

## Component → Key Mapping

| Component | Keys Used |
|---|---|
| `App.tsx` (loading) | `loading.engine` |
| `App.tsx` (WASM error) | `errors.wasm.*` (8 keys) |
| `App.tsx` (header) | `header.*` (4 keys) |
| `LandingScreen.tsx` | `landing.aria_playing`, `landing.aria_paused` |
| `IOSInstallModal.tsx` | `ios_install.*` (8 keys) |
| `AndroidInstallBanner.tsx` | `android_install.*` (6 keys) |
| `OfflineBanner.tsx` | `offline.banner` |

**Total**: 30 keys across 7 components.
