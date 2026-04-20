# Quickstart: Fix MIDI Detection in Tablet in Practice Mode

**Branch**: `081-fix-tablet-midi`

## Prerequisites

- Node.js (see `frontend/package.json` for version)
- The worktree open in VS Code: `code ../worktrees/081-fix-tablet-midi/`

## Run Frontend Tests

```bash
cd frontend
npx vitest run plugins/practice-view-plugin/useMidiConnectivity.test.ts
npx vitest run plugins/practice-view-plugin/practiceToolbar.test.tsx
npx vitest run plugins/practice-view-plugin/PracticeViewPlugin.test.tsx
npx vitest run src/i18n/locales.test.ts
```

## Run All Tests (regression check)

```bash
cd frontend
npx vitest run
```

## Manual Tablet Verification

1. Open Chrome on Android tablet (or desktop-mode Chrome on iPad)
2. Navigate to the deployed dev build
3. Open Practice mode
4. **Test 1 — device already connected**: plug in MIDI keyboard before opening practice view → MIDI badge appears within 8s
5. **Test 2 — hot-plug**: open practice view with no device → connect MIDI keyboard → badge appears within 2s
6. **Test 3 — unsupported browser**: open on iOS Safari (no bridge) → "MIDI is not supported in this browser" shown within 2s
7. **Test 4 — permission denied**: deny MIDI permission on Android → "no MIDI device" shown (not spinning/checking)

## Key Files

- `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` — new hook (primary change)
- `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts` — new tests
- `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` — lines ~140–170 (replaced)
- `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` — `midiSupported` prop added
- `frontend/src/i18n/locales/en.json` + `es.json` — new i18n key
