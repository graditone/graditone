# Quickstart: Review MIDI Keys Velocity

**Feature**: `069-midi-velocity-review`  
**Date**: 2026-04-01  
**Codebase**: `frontend/` (no sessions-plugin, no backend changes)

---

## Prerequisites

Node.js (>=18) and npm. All changes are in `frontend/`.

```bash
cd frontend
npm install   # only needed on first setup
```

---

## Run Tests

```bash
cd frontend
npm run test:run          # run all tests once (CI mode)
```

Watch mode during development:

```bash
npm test                  # vitest watch
```

Run only recording-related tests:

```bash
npx vitest run src/components/recording/NoteHistoryList.test.tsx
npx vitest run src/components/recording/RecordingView.test.tsx
npx vitest run src/services/recording/useMidiInput.test.ts
```

**Expected baseline** (before any changes): All existing tests pass. New tests written for this feature will **fail** until implementation is in place — this is correct (Constitution Principle V: Red-Green-Refactor).

---

## Type-Check

```bash
cd frontend
npm run typecheck
```

Run after every file change. Must pass before committing.

---

## Dev Server (visual preview)

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173?debug=true`. The Recording view is accessible only in debug mode:
1. Open any score
2. Click the **"Record View"** button in the toolbar (visible only in debug mode)
3. Connect a MIDI controller
4. Play notes — verify velocity, channel, and raw bytes appear in the note history

---

## Implementation Order (Constitution V: test-first)

### Step 1: Extend `NoteOnset` + `MidiNoteEvent` types

File: `frontend/src/types/recording.ts`

1. Add `velocity?: number`, `channel?: number`, `rawBytes?: readonly number[]` to `NoteOnset`
2. Add `rawBytes?: readonly number[]` to `MidiNoteEvent`
3. Run `npm run typecheck` → **must pass** (optional fields are backward-compatible; existing code compiles cleanly)

> No test step here — pure type additions with no behavior change yet.

---

### Step 2: US1 + US2 — Velocity and visual indicator in NoteHistoryList

**Test file**: `frontend/src/components/recording/NoteHistoryList.test.tsx`

1. Write **failing** tests:
   - Entry with `velocity: 100` renders `"100"` (or similar) in the list item
   - Entry with `velocity: 1` renders a minimal visual bar (`width` near 0%)
   - Entry with `velocity: 127` renders a full visual bar (`width` near 100%)
   - Entry without `velocity` (mic path) renders **no velocity column**

2. Run `npm run test:run` → confirm new tests **FAIL**

3. Modify `NoteHistoryList.tsx`:
   - Render `<span className="note-history-list__entry-velocity">{entry.velocity}</span>` when `entry.velocity !== undefined`
   - Render `<div className="note-history-list__velocity-bar" style={{ width: \`${Math.round(entry.velocity / 127 * 100)}%\` }} />` for the visual bar

4. Add CSS to `RecordingView.css` (or new `NoteHistoryList.css`):
   ```css
   .note-history-list__velocity-bar {
     height: 4px;
     background: #4caf50;
     border-radius: 2px;
     max-width: 100%;
   }
   .note-history-list__entry-velocity {
     font-variant-numeric: tabular-nums;
     min-width: 2.5ch;
   }
   ```

5. Run `npm run test:run` → confirm tests **PASS**

---

### Step 3: US3 — Channel display

**Test file**: `frontend/src/components/recording/NoteHistoryList.test.tsx`

1. Write **failing** tests:
   - Entry with `channel: 1` renders `"Ch 1"` (or equivalent)
   - Entry with `channel: 10` renders `"Ch 10"`
   - Entry without `channel` (mic path) renders **no channel column**

2. Run `npm run test:run` → confirm new tests **FAIL**

3. Modify `NoteHistoryList.tsx`:
   - Render `<span className="note-history-list__entry-channel">Ch {entry.channel}</span>` when `entry.channel !== undefined`

4. Run `npm run test:run` → confirm tests **PASS**

---

### Step 4: Wire velocity + channel in RecordingView.handleMidiNoteOn

**Test file**: `frontend/src/components/recording/RecordingView.test.tsx`

1. Write **failing** tests:
   - Playing a MIDI note with `velocity: 80, channel: 2` → note history entry has `velocity: 80` and `channel: 2`
   - Playing via mic path → note history entry has `velocity: undefined` and `channel: undefined`

2. Run `npm run test:run` → confirm new tests **FAIL**

3. Modify `RecordingView.tsx` `handleMidiNoteOn`:
   ```typescript
   const onset: NoteOnset = {
     label: event.label,
     note: noteMatch ? noteMatch[1] : event.label,
     octave: noteMatch ? parseInt(noteMatch[2], 10) : 4,
     confidence: 1.0,
     elapsedMs: event.timestampMs,
     velocity: event.velocity,   // NEW
     channel: event.channel,     // NEW
   };
   ```

4. Run `npm run test:run` → confirm tests **PASS**

---

### Step 5 (P4): Raw bytes + CC log

**This is a P4 priority feature — implement after P1–P3 are complete and tests pass.**

Files changed:
- `useMidiInput.ts`: attach `rawBytes: Array.from(ev.data)` to `MidiNoteEvent`; remove CC7/CC11 filter (move to score player caller)
- `RecordingView.tsx`: add `midiCCHistory` state, wire `onCC: handleMidiCC`; display raw bytes in expandable detail; display CC log
- Test files: add tests for raw bytes rendering and CC list

---

## Key Files

| File | Change |
|------|--------|
| `src/types/recording.ts` | Extend `NoteOnset` + `MidiNoteEvent` |
| `src/components/recording/NoteHistoryList.tsx` | Render velocity + channel + raw bytes |
| `src/components/recording/NoteHistoryList.test.tsx` | Add P1/P2/P3 tests |
| `src/components/recording/RecordingView.tsx` | Populate velocity/channel in `handleMidiNoteOn`; wire `onCC` (P4) |
| `src/components/recording/RecordingView.test.tsx` | Add handler + CC tests |
| `src/components/recording/RecordingView.css` | Velocity bar + channel pill CSS |
| `src/services/recording/useMidiInput.ts` | Add rawBytes forwarding; all-CC routing (P4) |

---

## Verification Checklist

Before marking this feature complete:

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test:run` passes — all new tests green
- [ ] Manual: Note history shows velocity value for each MIDI note
- [ ] Manual: Visual bar scales from small (soft touch) to full (hard touch)
- [ ] Manual: Channel number shown as "Ch N" for each note
- [ ] Manual: Mic input path shows NO velocity or channel columns
- [ ] Manual (P4): Expand a note entry → raw bytes visible
- [ ] Manual (P4): CC messages appear in separate CC log section
