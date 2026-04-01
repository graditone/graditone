# Data Model: Review MIDI Keys Velocity

**Phase 1 Output** — Feature 069  
**Date**: 2026-04-01

---

## Modified Entities

### `NoteOnset` (extended) — `frontend/src/types/recording.ts`

The core bottleneck: MIDI data is dropped here in the current flow.

```typescript
export interface NoteOnset {
  // ── Existing fields (mic path + MIDI path) ────────────────────────────
  /** Full note label, e.g. "A4" */
  label: string;
  /** Note name, e.g. "A" */
  note: string;
  /** Octave number */
  octave: number;
  /** Detection confidence at time of onset (mic path: 0–1; MIDI path: always 1.0) */
  confidence: number;
  /** Elapsed ms since session startTimestamp */
  elapsedMs: number;

  // ── New optional MIDI fields (P1, P3, P4) ─────────────────────────────
  /** MIDI key velocity 1–127. Undefined when input source is microphone. (FR-001, FR-006) */
  velocity?: number;
  /** MIDI channel 1–16. Undefined when input source is microphone. (FR-003, FR-006) */
  channel?: number;
  /** Raw MIDI message bytes: [statusByte, noteByte, velocityByte]. Undefined for mic input. (FR-004) */
  rawBytes?: readonly number[];
}
```

**Validation rules**:
- `velocity`: integer, 1–127. Spec edge case: velocity 0 is a note-off; `parseMidiNoteOn` in `midiUtils.ts` already filters them (they never reach `handleMidiNoteOn`).
- `channel`: integer, 1–16.
- `rawBytes`: exactly 3 elements for note-on messages (`[0x9n, noteNumber, velocity]`).

**Backward-compatibility**: All three new fields are optional. The mic input path creates `NoteOnset` without them — they will be `undefined`. `NoteHistoryList` renders MIDI columns only when `velocity !== undefined`.

---

### `MidiNoteEvent` (extended) — `frontend/src/types/recording.ts`

Add `rawBytes` so raw data is available end-to-end through the MIDI pipeline.

```typescript
export interface MidiNoteEvent {
  // ── Existing fields (unchanged) ───────────────────────────────────────
  noteNumber: number;
  velocity: number;
  channel: number;
  timestampMs: number;
  label: string;

  // ── New field (P4) ────────────────────────────────────────────────────
  /** Raw MIDI message bytes, e.g. [0x90, 60, 100]. Set in useMidiInput from ev.data. (FR-004) */
  rawBytes?: readonly number[];
}
```

**Populated by**: `useMidiInput.ts` → `subscribeToInput` after calling `parseMidiNoteOn()`:
```typescript
if (note) {
  const noteWithBytes: MidiNoteEvent = { ...note, rawBytes: Array.from(ev.data as Uint8Array) };
  callbacksRef.current.onNoteOn(noteWithBytes);
}
```

---

### `MidiCCEvent` (existing, no changes) — `frontend/src/services/recording/midiUtils.ts`

Already defined. Used for P4 CC event log in `RecordingView`.

```typescript
export interface MidiCCEvent {
  controller: number;  // 0–127
  value: number;       // 0–127
  channel: number;     // 1–16
}
```

**P4 change in `useMidiInput.ts`**: Remove the `cc.controller === 7 || cc.controller === 11` filter — route all CC when `onCC` is wired. The filter is moved to the score player caller (the only other consumer). `RecordingView` wires `onCC` to capture all CC.

---

## State Additions in `RecordingView`

### `midiCCHistory` (P4)

```typescript
const [midiCCHistory, setMidiCCHistory] = useState<MidiCCEvent[]>([]);
```

**Cap**: 200 entries (same as `midiNoteHistory` — consistent with FR-008 eviction policy).

**Populated by**:
```typescript
const handleMidiCC = useCallback((event: MidiCCEvent) => {
  setMidiCCHistory((prev) => {
    const next = [...prev, event];
    return next.length > 200 ? next.slice(next.length - 200) : next;
  });
}, []);
```

---

## State Transitions

### MIDI note-on flow (updated)

```
Web MIDI API (ev.data: Uint8Array)
  → useMidiInput: parseMidiNoteOn() → MidiNoteEvent (all 5 fields)
  → useMidiInput: attach rawBytes: Array.from(ev.data)
  → RecordingView.handleMidiNoteOn(event: MidiNoteEvent)
      → NoteOnset { label, note, octave, confidence: 1.0, elapsedMs,
                    velocity: event.velocity,             // NEW P1
                    channel: event.channel,               // NEW P3
                    rawBytes: event.rawBytes }             // NEW P4
  → setMidiNoteHistory(prev → [onset, ...prev.slice(0, 199)])
  → NoteHistoryList renders: label + elapsed + velocity number + velocity bar + channel pill (P1/P2/P3)
```

### MIDI CC flow (P4)

```
Web MIDI API (ev.data: Uint8Array)
  → useMidiInput: parseMidiCC() → MidiCCEvent (all CC, filter removed)
  → RecordingView.handleMidiCC(event: MidiCCEvent)
  → setMidiCCHistory(prev → [...prev, event].slice(-200))
  → Separate CC log list renders: elapsed + CC# + value + channel
```

### Mic input flow (unchanged)

```
AudioWorklet → PitchSample
  → RecordingView pitch detection logic
  → NoteOnset { label, note, octave, confidence, elapsedMs }
      // velocity, channel, rawBytes all undefined — never set
  → NoteHistoryList renders: label + elapsed (no MIDI columns shown)
```
