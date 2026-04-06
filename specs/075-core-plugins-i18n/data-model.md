# Data Model: Complete i18n for Internal Core Plugins

**Feature**: 075-core-plugins-i18n
**Date**: 2026-04-06

## Overview

This feature does not introduce new domain entities or persistent data. The data model consists of **translation keys** added to the existing flat-JSON locale catalogs (`en.json`, `es.json`) in `frontend/src/i18n/locales/`.

## Entities

### Locale Catalog (Static JSON — existing)

| Attribute | Type | Description |
|-----------|------|-------------|
| Keys | `string` | Dot-namespaced identifiers (e.g., `play_score.toolbar.play`) |
| Values | `string` | Translated text, optionally containing `{param}` interpolation placeholders |

**Relationships**:
- One catalog per supported locale (`en.json`, `es.json`)
- All catalogs MUST have identical key sets
- English catalog is the source of truth

**Validation Rules**:
- Every key in `en.json` MUST exist in `es.json` (and vice versa)
- No value may be empty string
- Interpolation placeholders (`{param}`) must match across locales for the same key

## Key Naming Convention

All new keys follow the pattern: `<plugin_namespace>.<section>.<element>`

| Namespace | Plugin | Example Key |
|-----------|--------|-------------|
| `play_score.*` | play-score | `play_score.toolbar.play`, `play_score.selection.preloaded` |
| `train.*` | train-view | `train.toolbar.back`, `train.level.low`, `train.results.notes` |
| `practice.*` | practice-view-plugin | `practice.toolbar.practice_btn`, `practice.results.correct` |
| `guide.*` | guide | Already exists — `guide.what.title`, `guide.play.intro`, etc. |
| `vkeyboard.*` | virtual-keyboard | `vkeyboard.title`, `vkeyboard.clear`, `vkeyboard.staff` |
| `plugin.name.*` | Navigation labels | `plugin.name.sessions-plugin`, `plugin.name.virtual-keyboard` |

**Note**: Underscore separators in namespace (e.g., `play_score`) rather than hyphens, matching existing key conventions in the catalog.

## New Keys Required (estimated per plugin)

| Plugin | Estimated New Keys | Notes |
|--------|-------------------|-------|
| play-score | ~22 | Toolbar + score selection + loading |
| train-view | ~80 | Toolbar + config panel + results + tips + scale names + presets |
| practice-view-plugin | ~55 | Toolbar + results + error messages |
| virtual-keyboard | ~5 | Title + staff + clear + aria labels |
| guide | ~0-2 | Audit only — nearly 100% covered |
| Navigation names | 2 | `plugin.name.sessions-plugin`, `plugin.name.virtual-keyboard` |
| **Total** | **~165** | |

## State Transitions

N/A — locale catalogs are immutable build-time assets.
