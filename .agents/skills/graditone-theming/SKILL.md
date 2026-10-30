---
name: graditone-theming
description: Use whenever you write or review Graditone frontend UI styles (CSS files, plugin stylesheets, inline styles/colors in TSX). Covers the landing-theme design-token system (--ls-*), the WCAG-audited contrast pairs, the app bridge tokens (--color-*, --dialog-*), safe color-mix recipes, and how to verify a change across all 10 themes. Triggers on: theme, theming, colour/color, contrast, CSS variables, --ls-, --color-, hardcoded color, style, toolbar/plugin UI, hover/active/disabled/armed states, accessibility, dark mode.
---

# Graditone UI Theming (landing themes)

Graditone ships **10 landing themes** with different palettes. Any UI you add
or change must be legible and on-brand in **all of them** — a colour that looks
fine in the default theme can be unreadable in another. This skill is the
checklist for that.

**Golden rule:** never hardcode a colour. Style only through the theme tokens
below. A literal is acceptable *only* as a token's fallback, e.g.
`var(--ls-accent, #7c3aed)`.

## When this applies

Anything that renders colours: new component/plugin CSS, buttons, overlays,
badges, borders, shadows, hover/active/pressed/disabled/armed states, text on a
coloured surface. If you are about to type `#…`, `rgb(`, `rgba(` or a named
colour in a stylesheet or TSX style, stop and use a token instead.

## The token system (single source of truth)

- **Definitions:** `frontend/src/themes/landing-themes.css`, declared as
  `body[data-landing-theme="<id>"] { … }`.
- **Registry / TS mirror:** `frontend/src/themes/landing-themes.ts`
  (`LANDING_THEMES`, `getThemeById`, `DEFAULT_THEME_ID = 'ember'`).
- **Theme ids:** `ember` (default), `saffron`, `sienna`, `terracotta`,
  `paprika`, `honey`, `coral`, `marigold`, `blush`, `rust`.
- **Runtime:** `frontend/src/App.tsx` always keeps
  `document.body.dataset.landingTheme = activeThemeId`, so the tokens cascade
  into full-screen plugins, overlays and every descendant. You can rely on
  `--ls-*` being present at runtime.
- **Switching for review:** open the app with the theme in the URL hash
  (`/#saffron`, `/#honey`, …). A hidden design navbar appears when the hash
  names a known theme — use it to eyeball each theme.

### Core tokens

| Token | Role |
|---|---|
| `--ls-bg` | Page / surface background (light) |
| `--ls-body` | Body text colour (dark); also the safe "ink" for mixing |
| `--ls-heading` | Heading text colour |
| `--ls-cta-bg` / `--ls-cta-text` | Primary button background / text (audited pair) |
| `--ls-accent` | Hover / active / indicator accent — **not** a text background |
| `--ls-navbar-bg` / `--ls-navbar-active` | Navbar strip / active tab |
| `--ls-note-1/-2/-3` | Animated note colours |
| `--ls-success` | Semantic "done / OK" green |
| `--ls-font-heading` / `--ls-font-body` | Font-family stacks |
| `--ls-heading-weight` / `--ls-body-weight` | Font weights |

## Audited contrast pairs — the only safe text-on-surface combos

The palettes are audited to WCAG 2.1 AA (≥ 4.5:1). Only these pairings are
guaranteed legible in every theme:

- `--ls-body` on `--ls-bg`
- `--ls-heading` on `--ls-bg`
- `--ls-cta-text` on `--ls-cta-bg`

**`--ls-accent` is NOT an audited text background.** In `saffron`, `honey` and
`marigold` the accent is a light amber, so white/`--ls-bg` text or glyphs on a
`--ls-accent` fill fail contrast. For a solid themed control, use the **CTA
pair**, not accent + white.

## Rules

1. **No hardcoded colours.** Use `var(--ls-…)`, `var(--color-…)`,
   `var(--dialog-…)`, and `color-mix(...)` over them. Literals only as token
   fallbacks.
2. **Text on a solid surface** → use an audited pair: `--ls-cta-text` on
   `--ls-cta-bg` for buttons, `--ls-body` on `--ls-bg` for panels.
3. **Tints, borders, hovers** → mix toward the theme surface:
   `color-mix(in srgb, var(--ls-accent) 8%, var(--ls-bg))`.
4. **Darken / deepen** → mix toward `var(--ls-body)`, never `#000`:
   `color-mix(in srgb, var(--ls-cta-bg) 80%, var(--ls-body))`.
5. **Shadows** → `color-mix(in srgb, var(--ls-body) 45%, transparent)`.
6. **Disabled** → change `opacity`, not colours.
7. **Inverted / high-attention chips** (e.g. an "armed" state) → use the
   inverted audited pair: `background: var(--ls-body); color: var(--ls-bg);`
   plus an accent-derived ring.
8. **Semantic states** → prefer the bridge tokens below (`--color-danger`,
   `--color-success`, `--color-warning`) over inventing new colours.
9. **Plugin CSS is global** — consume the tokens; do not redefine them per
   plugin.

## App bridge tokens — `frontend/src/App.css`

Under `body[data-landing-theme]`, the app maps the palette onto neutral,
intent-named tokens (use these when the *meaning* matters more than the brand
colour):

| Token | Maps to |
|---|---|
| `--color-surface`, `--color-surface-alt` | `--ls-bg`, `--ls-navbar-bg` |
| `--color-border` | subtle black |
| `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-muted` | heading / body |
| `--color-accent`, `--color-accent-dark`, `--color-primary` | CTA bg |
| `--color-danger`, `--color-danger-dark`, `--color-danger-bg` | accent |
| `--color-success`, `--color-success-bg` | `--ls-success` |
| `--color-warning`, `--color-warning-dark` | accent-derived |
| `--dialog-*` | dialogs/overlays |

There is also a `:root` **dark default** (Catppuccin Mocha) for `--dialog-*`
that applies outside a themed body — keep it working.

## Recipes

```css
/* Subtle themed button */
background: color-mix(in srgb, var(--ls-accent) 8%, var(--ls-bg));
border: 1px solid color-mix(in srgb, var(--ls-accent) 40%, transparent);
color: var(--ls-body);

/* Solid primary control (legible in every theme) */
background: var(--ls-cta-bg);
color: var(--ls-cta-text);

/* Pressed / deeper */
background: color-mix(in srgb, var(--ls-cta-bg) 80%, var(--ls-body));

/* Inverted "armed" chip */
background: var(--ls-body);
color: var(--ls-bg);
box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ls-accent) 60%, var(--ls-bg));

/* Dark panel (menu/overlay) */
background: color-mix(in srgb, var(--ls-accent) 15%, var(--ls-body));
color: var(--ls-bg);
box-shadow: 0 4px 16px color-mix(in srgb, var(--ls-body) 45%, transparent);
```

## Anti-patterns (each breaks at least one theme)

- `color: #fff` on a `var(--ls-accent)` background — fails on
  `saffron` / `honey` / `marigold` (light amber accent).
- `#000`, `#111`, `rgba(0,0,0,.4)`, `#e2d9f3`, `#a78bfa`, gold literals, etc.
- Using `--ls-accent` as *text* on `--ls-bg` when the accent is light.
- Re-declaring `--ls-*` tokens inside a component/plugin.
- Hardcoding "white text" or "black shadow" for a themed surface.

## Definition of done — verify across all themes

1. **Run the guard** (part of `npm run lint`, so it runs in CI and pre-commit):
   ```bash
   npm run lint:colors          # fails on any NEW hardcoded colour
   npm run lint:colors:update   # refresh the ratchet baseline after a reviewed sweep
   npm run lint:colors -- --list  # print every current offender, file:line
   ```
   It scans `frontend/src` + `frontend/plugins` CSS, allows literals only as
   `var(--token, <fallback>)` fallbacks, and grandfathers existing debt via
   `frontend/scripts/theme-colors-baseline.json` (a file → count ratchet). Do
   **not** add a file to the baseline to silence a real violation — fix it with
   a token instead; only `lint:colors:update` after a genuine, reviewed change.
2. **Manual grep** (for files the guard excludes, e.g. TSX inline styles):
   ```bash
   grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\(' path/to/File.tsx
   ```
3. **Reason against all 10 palettes** (`landing-themes.ts`) — especially the
   light-accent ones (`saffron`, `honey`, `marigold`) and the dark-text CTA
   themes where `--ls-cta-text` is `#1A1A1A`.
4. **Eyeball in the running app** by cycling URL hashes `#ember` … `#rust`
   (the design navbar appears when the hash names a theme).
5. Prefer the audited pairs above so the result is correct by construction.

## File map

- Tokens: `frontend/src/themes/landing-themes.css`, `landing-themes.ts`
- Bridge: `frontend/src/App.css` (`body[data-landing-theme]` block)
- Theme switch: `frontend/src/App.tsx`, `frontend/src/components/DesignNavbar.tsx`
- Reference implementation of a theme-correct widget:
  `frontend/src/components/TempoMetronomeControl.css`
