# Research: Fix MIDI Detection in Tablet in Practice Mode

**Branch**: `081-fix-tablet-midi` | **Date**: 2026-04-20

---

## Root Cause Analysis

### Decision: Three bugs in the inline MIDI connectivity check within `PracticeViewPlugin.tsx`
**Rationale**: Static code analysis of `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (lines 140–170) identified three defects that all contribute to the `midiConnected` state staying stuck at `null` (the "checking" state) indefinitely on tablet devices:

1. **No timeout** (primary bug for tablet): `requestMIDIAccess()` is awaited without a deadline. On tablets, browsers may surface a permission prompt that the user hasn't dismissed, or hardware negotiation takes longer than on desktop. If the promise never resolves quickly, `midiConnected === null` forever. There is no `Promise.race` or `setTimeout` guard.

2. **Silent catch** (affects denied permission on tablet): The `.catch()` handler is empty — `catch(() => { /* MIDI permission denied or unavailable */ })`. When MIDI permission is denied, `midiConnected` stays `null` instead of transitioning to `false`, leaving the UI in a perpetual "checking" state.

3. **API unavailable path exits without setting state**: When `'requestMIDIAccess' not in navigator` (iOS Safari, older browsers), the `useEffect` returns early but never calls `setMidiConnected(false)`. The state stays `null`, giving no user-visible message.

### Contrast with `useMidiInput`
The note-event subscription hook (`frontend/src/services/recording/useMidiInput.ts`) already handles all three cases correctly:
- `Promise.race` with a `3000ms` timeout → sets error and falls back
- `.catch()` sets `error: 'MIDI access denied'`
- API absent → synchronously sets `isSupported: false`

The `PracticeViewPlugin` MIDI *connectivity indicator* calls `requestMIDIAccess()` independently (to avoid clobbering `useMidiInput`'s `onstatechange` handler) and lacks equivalent robustness. This is the gap to close.

---

## Technology Choices

### Decision: Extract into `useMidiConnectivity` custom hook
- **Rationale**: Keeping the logic in `PracticeViewPlugin.tsx` as an inline `useEffect` is what caused the original bugs to be hard to test. A dedicated hook is unit-testable in isolation and follows the existing pattern (`useMidiInput`, `usePracticeMidi`, `usePracticeLoop`, `usePhantomTempo` — all extracted hooks).
- **Alternatives considered**: Inline fix (rejected — untestable, hard to evolve); reuse `useMidiInput` for connectivity (rejected — `useMidiInput` owns note event subscriptions and device lists, coupling connectivity status to it would create responsibility overlap).

### Decision: 8-second timeout for connectivity check
- **Rationale**: FR-002 / SC-001 / SC-002 require the state to resolve within 8 seconds. The existing `useMidiInput` uses 3 seconds for its own access grant; 8 seconds is more generous for the connectivity indicator to accommodate slow tablet permission flows while still being user-perceptible.
- **Alternatives considered**: 3s (too aggressive for tablet permission prompt UX), 15s (exceeds spec requirement, poor UX).

### Decision: Return `{ connected: boolean | null; supported: boolean }` from `useMidiConnectivity`
- **Rationale**: Distinguishes "unsupported browser" from "no device connected" — required by FR-003 (show "MIDI not supported" not "no MIDI device"). A single `boolean | null | 'unsupported'` value would conflate state with a reason; a two-field shape is more explicit and composable.
- **Alternatives considered**: Extend `midiConnected` to a string union (rejected — prop interface already widely used as `boolean | null` in practiceToolbar; changing the type would widen breakage); add a separate `midiUnsupported: boolean` prop to the toolbar (equivalent but less clean than a result object).

### Decision: `MIDI_CONNECTIVITY_TIMEOUT_MS = 8000`
- Matches FR-002 / SC-002 exactly. Constant named explicitly for future tunability.

---

## Integration Patterns

### `addEventListener` vs `onstatechange`
The existing code comment (line 142–147 of `PracticeViewPlugin.tsx`) is correct: the browser returns the same `MIDIAccess` singleton across all `requestMIDIAccess()` calls. `useMidiConnectivity` MUST use `access.addEventListener('statechange', handler)` — never assign `access.onstatechange`. This ensures `useMidiInput`'s hot-plug handler is not clobbered.

### i18n
Two new keys needed:
- `practice.toolbar.midi_not_supported` — shown in Practice button tooltip and/or banner when `supported === false`
- Both `en.json` and `es.json` must be updated to keep the locale parity test green (`frontend/src/i18n/locales.test.ts`)

### Test infrastructure
`frontend/src/test/mockMidi.ts` provides `mockMidiSupported`, `mockMidiUnsupported`, `createMockMidiAccess`, `createMockMidiInput`, `fireMidiStateChange` — reusable by `useMidiConnectivity.test.ts`. Pattern: `vi.useFakeTimers()` + `act(async () => { vi.advanceTimersByTime(8000); })` for timeout path.

---

## Unchanged Scope

- `useMidiInput` — not modified; handles note events independently.
- `usePracticeMidi` — not modified.
- Backend / WASM — no changes needed.
- Desktop behavior — `useMidiConnectivity` uses the same Web MIDI API path as before; the only additions are a timeout guard and proper catch, which are no-ops on fast desktop browsers.
