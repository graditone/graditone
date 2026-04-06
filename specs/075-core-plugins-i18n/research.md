# Research: Complete i18n for Internal Core Plugins

**Feature**: 075-core-plugins-i18n
**Date**: 2026-04-06
**Status**: Complete — all unknowns resolved

## Research Area 1: Scope Clarification — Which Plugins Are Builtin?

**Question**: The spec lists six "internal core plugins." Which ones actually exist in `frontend/plugins/`?

**Findings**:
- Builtin plugin directories: `guide`, `play-score`, `practice-view-plugin`, `train-view`, `virtual-keyboard`, `lint-test`
- `sessions-plugin` does NOT exist as a builtin — it is an external plugin in `plugins-external/sessions-plugin/`, handled by feature 074
- `lint-test` is not a real plugin (no `plugin.json`) — it's a test/linting fixture

**Decision**: Feature scope covers 5 builtin plugins: play-score, train-view, practice-view-plugin, guide, virtual-keyboard. The sessions-plugin nav name key will still be added to locale files for completeness.

## Research Area 2: Current i18n Coverage Per Plugin

**Question**: What percentage of each plugin's UI strings are already translated?

**Findings**:

| Plugin | Files with t() | Hardcoded strings | Status |
|--------|---------------|-------------------|--------|
| guide | 1/2 (GuidePlugin.tsx) | 1 (init error in index.tsx) | ~99% done |
| play-score | 0/4 | ~22 strings | 0% done |
| train-view | 0/6 UI files | ~80+ strings | 0% done |
| practice-view-plugin | 0/4 UI files | ~55+ strings | 0% done |
| virtual-keyboard | 0/2 | ~5 strings | 0% done |

**Decision**: Guide needs only an error-string cleanup and audit. The other four plugins need full i18n migration from scratch.

## Research Area 3: Host i18n API Capabilities

**Question**: Does the host i18n system support what the plugins need (interpolation, dynamic keys)?

**Findings**:
- `useTranslation()` exposes `t(key, params?)` and `tDynamic(key, fallback)`
- `t()` supports `{param}` interpolation: `t("key", { count: 5 })` → replaces `{count}`
- `tDynamic()` supports runtime key lookup with a fallback value — used by `PluginNavEntry` for plugin names
- Missing key fallback: English catalog is used when a key is missing from the active locale
- The system is sufficient for all plugin needs

**Decision**: No i18n system changes required. Plugins import `useTranslation` from `frontend/src/i18n/index.tsx`.

## Research Area 4: Plugin Navigation Names

**Question**: Which plugin name keys are missing from locale files?

**Findings**:
- Present: `plugin.name.play-score`, `plugin.name.train-view`, `plugin.name.practice-view-plugin`, `plugin.name.guide`
- Missing: `plugin.name.sessions-plugin`, `plugin.name.virtual-keyboard`
- `PluginNavEntry.tsx` uses `tDynamic("plugin.name.{id}", plugin.name)` — missing keys fall back to the manifest `name` field

**Decision**: Add both missing keys to `en.json` and `es.json`.

## Research Area 5: Scale Names and Preset Descriptions

**Question**: Should scale names (C Major, G Major, etc.) and train preset descriptions be translated?

**Findings**:
- `exerciseGenerator.ts` contains ~15 scale display names (e.g., "C Major", "A Minor")
- `trainTypes.ts` contains 3 preset description strings (e.g., "8 notes · C Major · 40 BPM · Step")
- `savedTrainStorage.ts` generates label fragments using mode names ("Step", "Flow") and identifiers
- Scale names are music-domain terminology that varies by language (e.g., "Do Mayor" in Spanish)
- Preset descriptions contain interpolated values that could be assembled from translated fragments

**Decision**: Scale names should be translated (they are standard musical terms with well-known translations). Preset descriptions should be assembled from translated fragments. Non-JSX utility files that need translated strings will accept a translation function parameter or export key-based lookups rather than importing `useTranslation` (which is a React hook restricted to components).

**Rationale**: Music terminology has established translations in major languages.
**Alternatives considered**: Keeping scale names in English — rejected because musicians expect their native language for scale names.

## Research Area 6: Non-Component Files Using Hardcoded Strings

**Question**: How should non-React files (`.ts` without JSX) consume translations?

**Findings**:
- `trainTypes.ts` (preset descriptions), `exerciseGenerator.ts` (scale names), `savedTrainStorage.ts` (label fragments) are all plain `.ts` files without React context
- `useTranslation()` is a React hook — cannot be called outside a component

**Decision**: Two approaches depending on context:
1. For display-only values (scale names, preset descriptions): move the display-name mapping to the component that renders them, using t() there
2. For storage labels: these are internal identifiers not directly displayed to users — keep as English constants

**Rationale**: Keeps business logic files free of React dependencies while ensuring all user-visible text is translated at the point of rendering.
