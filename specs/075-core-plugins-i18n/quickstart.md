# Quickstart: Complete i18n for Internal Core Plugins

**Feature**: 075-core-plugins-i18n
**Date**: 2026-04-06

## Prerequisites

1. Git worktree created at `../worktrees/075-core-plugins-i18n`
2. Node.js installed (per `.nvmrc`)

## Setup

```bash
cd ../worktrees/075-core-plugins-i18n/frontend
npm install
```

## Run Tests

```bash
cd frontend
npx vitest run                    # all frontend tests
npx vitest run --grep i18n        # i18n-related tests only
```

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/i18n/index.tsx` | i18n module: LocaleProvider, useTranslation (t, tDynamic) |
| `frontend/src/i18n/locales/en.json` | English translation catalog (~117 existing keys) |
| `frontend/src/i18n/locales/es.json` | Spanish translation catalog (~117 existing keys) |
| `frontend/src/i18n/registry.ts` | Supported locales definition |
| `frontend/src/components/plugins/PluginNavEntry.tsx` | Plugin name translation via tDynamic |

## Plugins to Modify

| Plugin | Directory | Main UI Files |
|--------|-----------|--------------|
| play-score | `frontend/plugins/play-score/` | PlayScorePlugin.tsx, playbackToolbar.tsx, scoreSelectionScreen.tsx |
| train-view | `frontend/plugins/train-view/` | TrainPlugin.tsx, TrainResultsOverlay.tsx, TrainVirtualKeyboard.tsx |
| practice-view-plugin | `frontend/plugins/practice-view-plugin/` | PracticeViewPlugin.tsx, practiceToolbar.tsx, ResultsOverlay.tsx |
| guide | `frontend/plugins/guide/` | GuidePlugin.tsx (already uses t() — audit only) |
| virtual-keyboard | `frontend/plugins/virtual-keyboard/` | VirtualKeyboard.tsx |

## Implementation Workflow Per Plugin

1. **Add keys to `en.json`** — English values matching current hardcoded strings
2. **Add matching keys to `es.json`** — Spanish translations
3. **Import useTranslation** in the component file:
   ```tsx
   import { useTranslation } from '../../src/i18n';
   ```
4. **Destructure the hook** inside the component:
   ```tsx
   const { t } = useTranslation();
   ```
5. **Replace hardcoded strings** with `t('key')` calls
6. **Run tests** — `npx vitest run`

## Verifying Translations

```bash
# Check key parity between locale files
cd frontend && python3 -c "
import json
with open('src/i18n/locales/en.json') as f: en = json.load(f)
with open('src/i18n/locales/es.json') as f: es = json.load(f)
en_keys, es_keys = set(en.keys()), set(es.keys())
missing_en = es_keys - en_keys
missing_es = en_keys - es_keys
print(f'EN: {len(en_keys)} keys, ES: {len(es_keys)} keys')
if missing_es: print(f'Missing in ES: {sorted(missing_es)}')
if missing_en: print(f'Missing in EN: {sorted(missing_en)}')
if not missing_en and not missing_es: print('Perfect parity!')
"
```
