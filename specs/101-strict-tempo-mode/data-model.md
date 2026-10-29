# Phase 1 Data Model: Strict Tempo Mode

**Feature**: `101-strict-tempo-mode` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

The strict mode is session-scoped. It adds a small amount of pure state to the practice engine and two optional per-note fields to the existing result record. No new storage entity, store, or migration is introduced.

---

## 1. StrictAnchor (Tempo Grid Origin)

A point on the absolute tempo grid for the current segment. Defined in `strictTempo.ts` and imported type-only by `practiceEngine.types.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `expectedTimeMs` | `number` | Expected onset of the grace note on the score clock. |
| `responseTimeMs` | `number` | Measured onset of the grace note on the practice clock. |

**Invariants**
- Both values are finite, non-negative integers (ms).
- An anchor is created only by a grace note.
- An anchor is never updated by a normal accepted note; it is replaced only when a new segment begins (new session, tempo change, loop iteration, mid-session activation, seek, early-release retry).

**Derived value**

```text
beatDeltaMs = round((responseTimeMs - anchor.responseTimeMs)
                  - (expectedTimeMs - anchor.expectedTimeMs))
```

Positive means late relative to the grid; negative means early.

---

## 2. StrictTempoSession (fields on PracticeState)

The session-scoped strict state lives in the existing `PracticeState`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strictMode` | `boolean` | `false` | True when the metronome activated strict evaluation for this Score Practice session. |
| `strictFailureCount` | `number` | `0` | Consecutive timing failures, 0–3. Reset by an in-time judged note; unchanged by grace notes and wrong pitches. |
| `strictAnchor` | `StrictAnchor \| null` | `null` | Current segment origin. `null` means the next accepted note is a grace note. |
| `strictReanchorPending` | `boolean` | `false` | A tempo change occurred while a sustained note was in progress; the note after that hold becomes the grace note. |

**Invariants**
- `strictFailureCount` is an integer in `[0, 3]`.
- If `strictMode === false`, then `strictFailureCount === 0` and `strictAnchor === null`.
- `strictReanchorPending` is true only while `strictMode === true` and `mode === 'holding'` (or transiently in the same reducer pass that completes the hold).
- `strictFailureCount === 3` implies `mode === 'tempo-stopped'` (or the orchestrator has already transitioned to the complete-results presentation for an accepted final note).
- The strict fields are reset by `STOP` and `START`.

---

## 3. PracticeNoteResult (extended)

Existing fields are unchanged. Two optional fields are added; they are absent on results recorded outside strict mode and on old saved practices.

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| `beatDeltaMs` | `number` | yes | Signed deviation from the segment’s absolute tempo grid. Present for results recorded while strict mode was active; `0` for a grace note. |
| `strictFailure` | `boolean` | yes | True when this attempt is one of the timing failures counted toward the three-note limit. |

**Relationships**
- `strictFailure === true` and `outcome === 'correct-late'` → off-beat onset failure.
- `strictFailure === true` and `outcome === 'early-release'` → early-release failure (possibly also off-beat; the onset delta is still in `beatDeltaMs`).
- `strictFailure` is absent/false for legacy results and for strict-mode notes that were on time or grace.
- The `NoteOutcome` union is **unchanged**. A strict onset failure uses `correct-late`; an early-release failure uses `early-release`; a grace or in-time strict note uses `correct`.
- The result is still one row per attempt. Multiple early-release attempts on the same note produce multiple results, consistent with existing behavior.

**Validation**
- `beatDeltaMs` is an integer.
- `strictFailure` is set only when the session was in strict mode at the time the result was finalized.
- One attempt contributes at most one to `strictFailureCount`, even if both onset and hold fail.
- `auto-advanced`/skipped results are not user attempts; they do not change the count or the anchor.

---

## 4. PracticeAction changes

| Action | Change |
|--------|--------|
| `START` | New optional `strictTempo?: boolean` (default `false`). Resets the strict state; `strictTempo` is true when the metronome is armed or active at session start. |
| `STRICT_ENABLE` | Sets `strictMode: true`, clears the count/anchor/pending. Used when the metronome is turned on during a running Score Practice. |
| `STRICT_DISABLE` | Sets `strictMode: false`, clears the count/anchor/pending. Existing results keep their `strictFailure` flags. Used when the metronome is turned off during a running Score Practice. |
| `REANCHOR` | If the mode is not `holding`, clears `strictAnchor` (next note is grace); if `holding`, sets `strictReanchorPending` so the next note after the hold is grace. The count is preserved. Used on tempo changes in strict mode. |
| `LOOP_RESTART` | Clears `strictAnchor` and `strictReanchorPending`; preserves `strictFailureCount`. The first note of the new iteration is grace. |
| `SEEK` | Clears `strictAnchor`; preserves the count. The next accepted note is grace. |
| `STOP` | Resets all strict fields. |
| `CORRECT_MIDI`, `HOLD_COMPLETE`, `EARLY_RELEASE` | Apply the strict evaluation described in the transition table. |
| `WRONG_MIDI` | No strict change. |
| `DEACTIVATE` | Preserves the strict fields; normal flow stops the session through `STOP`. |

---

## 5. PracticeMode

Add `'tempo-stopped'` to the existing union:

```text
'inactive' | 'waiting' | 'active' | 'holding' | 'complete' | 'tempo-stopped'
```

**Meaning**: the third strict failure has been recorded. The reducer keeps the notes/results for the orchestrator to snapshot; the orchestrator stops the session and presents results. `tempo-stopped` is not a running practice mode and does not trigger the loop auto-restart.

---

## 6. State transitions

| Trigger | Strict state / result | Mode / next |
|---------|----------------------|-------------|
| `START` with `strictTempo: true` | `strictMode=true`, count=0, anchor=null, pending=false | `waiting` |
| First accepted note (anchor null) | Set anchor to this note; `outcome='correct'`, `beatDeltaMs=0`; count unchanged | advance / complete |
| Judged note within window | `outcome='correct'`, `strictFailure=false`; count=0; anchor unchanged | advance / complete |
| Judged note outside window | `outcome='correct-late'`, `strictFailure=true`, `beatDeltaMs` recorded; count += 1; anchor unchanged | advance / complete / `tempo-stopped` at 3 |
| Early release (not accepted) | `outcome='early-release'`, `strictFailure=true`, `beatDeltaMs` recorded if an anchor exists; count += 1; anchor=null | stay on note; `tempo-stopped` at 3 |
| Retry after early release completes (`HOLD_COMPLETE` with an existing early-release result) | No duplicate result; if anchor is null, set the retry anchor (grace); count unchanged | advance / complete |
| Retry after early release is released early again | New early-release result; count += 1; anchor=null | stay on note; `tempo-stopped` at 3 |
| Wrong pitch | No result; count and anchor unchanged | unchanged |
| `STRICT_ENABLE` | `strictMode=true`, count=0, anchor=null, pending=false | unchanged (running) |
| `STRICT_DISABLE` | `strictMode=false`, count=0, anchor=null, pending=false; existing results keep flags | unchanged (running) |
| `REANCHOR` not holding | anchor=null, pending=false; count preserved | unchanged |
| `REANCHOR` holding | pending=true; anchor unchanged for the in-progress hold; count preserved | unchanged; on completion the next anchor is null |
| `LOOP_RESTART` | anchor=null, pending=false; count preserved | active at loop start |
| `SEEK` | anchor=null, pending=false; count preserved | active at target index |
| `STOP` | all strict fields reset | inactive |
| Metronome off mid-session | `STRICT_DISABLE` | session continues non-strict |
| Third failure on an accepted final note | count=3; result marked; engine `tempo-stopped` | orchestrator presents **complete** results (FR-020) |
| Third failure on an early-released final note | count=3; result marked; engine `tempo-stopped` | orchestrator presents **tempo-stop partial** results |
| Manual stop with 1–2 failures | results retain `strictFailure`; count not 3 | partial results, reason `manual` |

---

## 7. Recording and results entities (extended)

### PartialPerformanceRecord

| Field | Type | Change |
|-------|------|--------|
| existing fields | unchanged | — |
| `stopReason` | `'manual' \| 'tempo'` (optional) | New. `'tempo'` for a third-failure stop; missing/`'manual'` for a manual stop or old records. |

### SavedPerformanceData

| Field | Type | Change |
|-------|------|--------|
| existing fields | unchanged | — |
| `stopReason` | `'manual' \| 'tempo'` (optional) | New, additive. Persisted for partial practices so a reopened tempo stop still explains itself. Old records load as manual/unknown. |

No new IndexedDB object store or localStorage key. The existing profile-scoped saved-practice storage is reused. `strictFailure`/`beatDeltaMs` travel inside the existing `noteResults` array.

### PracticeScoreBreakdown

| Field | Type | Change |
|-------|------|--------|
| `totalNotes`, `correctCount`, `lateCount`, `earlyReleaseCount`, `totalWrongAttempts`, `score`, `tempoMultiplier` | existing | Unchanged semantics. |
| `strictFailureCount` | `number` | New. Number of results with `strictFailure === true`. |

**Score rule**

```text
strictFailures = results.filter(r => r.strictFailure === true).length
lateHalfCredit = results.filter(r => r.outcome === 'correct-late' && !r.strictFailure).length
earlyHalfCredit = results.filter(r => r.outcome === 'early-release' && !r.strictFailure).length
raw = ((correctCount + (lateHalfCredit + earlyHalfCredit) * 0.5) / totalNotes) * 100
      - min(totalWrongAttempts * 2, 30)
score = clamp(round(raw), 0, 100)
```

Strict failures earn zero credit. Legacy results (no `strictFailure`) keep the existing half credit. A session with only in-time notes still scores 100.

---

## 8. Backward compatibility

- Old `PracticeNoteResult` objects have no `beatDeltaMs`/`strictFailure`; they are treated as non-strict and keep their existing score.
- Old partial records have no `stopReason`; the results overlay shows the existing “Stopped at note X of Y” badge.
- Old complete records have no strict stats; the conditional “Tempo fails” stat is hidden.
- No migration is needed; the new fields are optional and additive.
- The `NoteOutcome` union is unchanged, so external consumers that switch on outcomes are not forced to handle a new value.
- The public scoring event (`onPracticeSaved`) still receives the same fields; strict failures simply lower `practiceScore`/`correctCount` through the shared `computePracticeScore`.
