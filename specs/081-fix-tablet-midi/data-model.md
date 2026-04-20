# Data Model: Fix MIDI Detection in Tablet in Practice Mode

**Branch**: `081-fix-tablet-midi` | **Date**: 2026-04-20

---

## Entities

### `MidiConnectivityState` (new type)

Represents the result of the `useMidiConnectivity` hook. Replaces the raw `boolean | null` currently used in `PracticeViewPlugin`.

```typescript
interface MidiConnectivityState {
  /**
   * Whether at least one MIDI input device is currently connected.
   * - null  → check pending (resolves within MIDI_CONNECTIVITY_TIMEOUT_MS)
   * - true  → one or more MIDI inputs present
   * - false → check completed, no inputs (or permission denied)
   */
  connected: boolean | null;

  /**
   * Whether the Web MIDI API is available in this browser.
   * - true  → navigator.requestMIDIAccess exists; connected reflects device state
   * - false → API absent (iOS Safari without bridge, etc.); show "not supported" message
   * Set synchronously on mount — never changes after mount.
   */
  supported: boolean;
}
```

**Validation rules**:
- When `supported === false`, `connected` is always `false` (never `null` or `true`).
- When `supported === true`, `connected` starts as `null` and resolves to `true` or `false` within `MIDI_CONNECTIVITY_TIMEOUT_MS` (8000 ms).
- Once `connected` reaches `true` or `false`, it may toggle back to `true`/`false` via hot-plug statechange events but MUST NOT return to `null`.

---

### `useMidiConnectivity` hook (new)

**File**: `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts`

```typescript
function useMidiConnectivity(): MidiConnectivityState
```

**State transitions**:

```
                  Mount
                    │
    API absent? ─── YES ──► { supported: false, connected: false }   ← terminal
                    │
                   NO
                    │
                    ▼
         { supported: true, connected: null }   ← "checking"
                    │
         requestMIDIAccess() resolves ──────────────────────────────────┐
                    │                                                    │
         access.inputs.size > 0?                                        │
           YES → { connected: true }  ←──────────────────┐             │
           NO  → { connected: false } ←──────┐           │             │
                    │                         │     statechange event   │
         timeout (8s) fires ─────────────────►{ connected: false }     │
                    │                                                    │
         requestMIDIAccess() rejects ───────►{ connected: false }     ◄┘
```

**Constants**:
- `MIDI_CONNECTIVITY_TIMEOUT_MS = 8000`

---

### `PracticeToolbarProps` changes (existing component)

Two new props replace `midiConnected: boolean | null`:

```typescript
// Before:
midiConnected: boolean | null;

// After:
midiConnected: boolean | null;        // unchanged: connected | checking | no-device
midiSupported: boolean;               // new: false when browser lacks Web MIDI API
```

**Rendering rules**:
- `!midiSupported` → Practice button tooltip shows `practice.toolbar.midi_not_supported`; Practice button disabled; status banner shows unsupported message.
- `midiSupported && midiConnected === false` → Practice button tooltip shows `practice.toolbar.no_midi_device` (existing behavior unchanged).
- `midiSupported && midiConnected === null` → Practice button enabled (unchanged — user may click while check is still pending; note events work through `useMidiInput`).
- `midiSupported && midiConnected === true` → Practice button enabled, MIDI badge shown (unchanged).

---

## New i18n Keys

| Key | English | Spanish |
|-----|---------|---------|
| `practice.toolbar.midi_not_supported` | `"MIDI is not supported in this browser"` | `"MIDI no está disponible en este navegador"` |

---

## Files Changed

| File | Type | Summary |
|------|------|---------|
| `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` | **NEW** | Hook encapsulating MIDI connectivity check with timeout, catch, and unsupported detection |
| `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts` | **NEW** | TDD tests: timeout, rejection, unsupported, happy path, hot-plug |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | **MODIFY** | Replace inline `midiConnected` `useEffect` with `useMidiConnectivity()`; thread `midiSupported` to toolbar |
| `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` | **MODIFY** | Add `midiSupported` prop; render unsupported message when `!midiSupported` |
| `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` | **MODIFY** | Add tests for `midiSupported=false` rendering |
| `frontend/src/i18n/locales/en.json` | **MODIFY** | Add `practice.toolbar.midi_not_supported` |
| `frontend/src/i18n/locales/es.json` | **MODIFY** | Add `practice.toolbar.midi_not_supported` (ES) |

No backend, WASM, or data persistence changes required.
