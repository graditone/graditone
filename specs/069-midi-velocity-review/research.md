# Research: Review MIDI Keys Velocity

**Phase 0 Output** — Feature 069  
**Date**: 2026-04-01  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: How to surface velocity/channel — extend `NoteOnset` vs new type

**Decision**: Extend `NoteOnset` with optional fields (`velocity?: number`, `channel?: number`, `rawBytes?: readonly number[]`).

**Rationale**: `NoteOnset` is used for both MIDI and microphone input paths. The mic path does not supply velocity or channel. Using optional fields keeps `NoteOnset` as a single type with backward-compatible construction — mic path omits MIDI fields, MIDI path populates them. Rendering logic shows MIDI columns only when `entry.velocity !== undefined`. Zero code changes required to the mic input path.

**Alternatives considered**:
- Union type `MidiNoteOnset | MicNoteOnset` — requires discriminant narrowing in all callers; over-engineered for a display feature with two paths.
- Separate `displayNoteHistory` array for MIDI — complicates `RecordingView` state management without benefit.

---

## Decision 2: Raw bytes forwarding (P4)

**Decision**: Add `rawBytes?: readonly number[]` to both `MidiNoteEvent` (in `recording.ts`) and `NoteOnset`. In `useMidiInput.ts`, populate `rawBytes: Array.from(ev.data)` on the event after calling `parseMidiNoteOn()`. In `RecordingView.handleMidiNoteOn`, forward `rawBytes: event.rawBytes` into the onset.

**Rationale**: `ev.data` (`Uint8Array`) is available at the `onmidimessage` dispatch point in `useMidiInput`. Attaching it to `MidiNoteEvent` keeps the data available throughout the event pipeline without adding a new callback parameter. `Array.from()` creates a plain immutable array copy — safe to store in React state.

**Alternatives considered**:
- New `onRawMessage?: (data: Uint8Array) => void` callback on `useMidiInput` — would require separate state management in `RecordingView` to correlate raw bytes back to a specific note onset; more complex.
- Store `Uint8Array` directly — Uint8Array is mutable and not idiomatic in React state; plain `number[]` is safer.

---

## Decision 3: Visual velocity indicator (P2, Principle VI compliance)

**Decision**: A `<div className="note-history-list__velocity-bar">` with inline style `width: ${Math.round(entry.velocity / 127 * 100)}%`. The bar is purely cosmetic — a visual transform expressing a data value as a percentage width. No spatial geometry is computed; it is equivalent to a CSS `opacity` or `color` that scales with data.

**Rationale**: Principle VI prohibits TypeScript-side *spatial coordinate calculations* (positions, bounding boxes, collision results). A bar whose width is a linear mapping of a MIDI velocity value is a *display transform* — the same class as CSS `scale()` or `opacity`. It does not calculate note positions, staff geometry, or any layout-engine-domain spatial data. The Principle VI rationale explicitly states "Permitted Transforms: Renderer MAY apply visual transforms (CSS scale, translate, pixel snapping for display sharpness) that do NOT alter logical coordinates".

**Alternatives considered**:
- Color intensity (hue/lightness) instead of bar width — harder to distinguish at a glance; bar width is more universally readable.
- SVG bar — unnecessary complexity for a simple proportional display.

---

## Decision 4: CC event log placement (P4, FR-005)

**Decision**: Add a separate `midiCCHistory: MidiCCEvent[]` state array to `RecordingView`. Wire `onCC` in `useMidiInput` to a `handleMidiCC` callback — routing **all** CC messages (not only CC7/CC11) in the recording context. Display `midiCCHistory` as a second scrollable list below the note history list, visible only when the list is non-empty.

**Rationale**: CC events are a different entity from note onsets — mixing them into `midiNoteHistory` would lose the semantic distinction and break the note-count cap. A separate list with its own clear button is consistent with the Recording view's existing pattern.

**Alternatives considered**:
- Widen existing `midiNoteHistory` to include CC entries — pollutes the note history with non-note data; the 200-entry cap logic becomes coupled to CC filtering.
- Show CC in a fixed sidebar — more complex layout; overkill for a debug feature.

**Open constraint**: The existing `useMidiInput` filters CC to only CC7/CC11. For the recording context, we need all CC. This is handled by either: (a) adding an `allCC` mode flag to `useMidiInput`, or (b) moving the CC7/CC11 filter to the caller. Decision: move the filter to the caller (score player) and pass all CC from `useMidiInput` — this is a less surprising default.

---

## Decision 5: MIDI input mode gating (FR-006)

**Decision**: Use the existing `midiDevices.length > 0` / `midiSupported` state already computed from `useMidiInput` to conditionally render the MIDI-specific columns. When `midiDevices.length === 0`, the velocity, channel, and raw bytes columns are simply absent — the entries from mic input never have `velocity` set, so `entry.velocity !== undefined` naturally handles this.

**Rationale**: No new state or props needed. The optional-field design (Decision 1) handles FR-006 automatically — mic path `NoteOnset` entries will always have `velocity === undefined`.

---

## Technology Lookup: @testing-library/react patterns for async MIDI events

Testing `handleMidiNoteOn` with velocity in `RecordingView.test.tsx` requires simulating a MIDI event. The existing test pattern mocks `useMidiInput` and calls the `onNoteOn` callback directly — this is the correct approach. No changes to test infrastructure needed.

Pattern used in existing `RecordingView.test.tsx`:
```tsx
// Mock useMidiInput, capture the onNoteOn callback, then call it:
let capturedOnNoteOn: ((e: MidiNoteEvent) => void) | undefined;
vi.mock('.../useMidiInput', () => ({
  useMidiInput: ({ onNoteOn }) => { capturedOnNoteOn = onNoteOn; return ...; }
}));
// In test:
act(() => capturedOnNoteOn!({ label: 'A4', velocity: 100, channel: 1, timestampMs: 500, noteNumber: 69 }));
```

---

## Summary of all NEEDS CLARIFICATION resolved

| Unknown | Resolution |
|---------|------------|
| How to pass velocity to NoteOnset without breaking mic path? | Optional fields on `NoteOnset` — `undefined` for mic path, populated for MIDI path |
| Where to get raw MIDI bytes in the pipeline? | `ev.data` in `useMidiInput.ts` `onmidimessage` handler; forward via `rawBytes` field on `MidiNoteEvent` |
| Does Principle VI block velocity bar? | No — velocity bar is a display transform, not a spatial coordinate calculation |
| How to show all CC (not just CC7/CC11) in recording view? | Move CC7/CC11 filter from `useMidiInput` to the score player caller; pass all CC from hook |
| Is there existing test infrastructure for MIDI events? | Yes — mocked `useMidiInput` with captured callbacks, already used in `RecordingView.test.tsx` |
