# Quickstart: Fix Practice Mode MIDI Detection

**Feature**: `001-fix-practice-midi-detection`  
**Branch**: `001-fix-practice-midi-detection`

---

## Prerequisites

```bash
cd /Users/alvaro.delcastillo/devel/graditone/frontend
node --version    # ≥ 18 required
npm install       # install/sync deps if needed
```

---

## Run Unit Tests

### Practice Engine (state machine logic — auto-advance)

```bash
cd frontend
npx vitest run --reporter=verbose plugins/practice-view-plugin/practiceEngine.test.ts
```

Expected: tests for `MAX_CONSECUTIVE_WRONG` constant, `'auto-advanced'` outcome in `WRONG_MIDI` case.  
**These tests must be written FIRST (Principle V / Principle VII).**

### Score Player Context (staccato durationTicks extraction)

```bash
cd frontend
npx vitest run --reporter=verbose src/plugin-api/scorePlayerContext.test.ts
```

Expected: test that staccato-marked note entries produce `durationTicks === 0`.

### ChordDetector integration (pin logic after EARLY_RELEASE)

```bash
cd frontend
npx vitest run --reporter=verbose src/utils/chordDetector.test.ts
```

Expected: test that `pin()` called for held current-entry pitches causes chord to complete on partial re-press.

---

## Run Full Frontend Test Suite

```bash
cd frontend
npx vitest run
```

All existing tests must remain green (regression gate — Principle VII).

---

## Run End-to-End Tests

Requires the dev server (or built preview):

```bash
# Terminal 1: start dev stack
cd frontend
npm run dev &

# Terminal 2: run E2E
npx playwright test e2e/train-from-score.spec.ts --reporter=line
```

Targeted scenarios to verify manually (or extend E2E):
1. Play an HL+HR chord, release RH early → EARLY_RELEASE → keep LH held → re-press RH only → chord completes and session advances.
2. Play a staccato note with a short (~50 ms) key press → session advances immediately without entering 'holding' mode.
3. Press wrong notes 3 times on the same beat → session auto-advances to next beat, outcome recorded as `'auto-advanced'`.

---

## Build Check

```bash
cd frontend
npm run build
# Must complete with zero TypeScript errors.
```

---

## Files to Modify (in order of dependency)

1. `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`  
   — Add `'auto-advanced'` to `NoteOutcome`

2. `frontend/plugins/practice-view-plugin/practiceEngine.ts`  
   — Export `MAX_CONSECUTIVE_WRONG = 3`  
   — Update `WRONG_MIDI` case for auto-advance

3. `frontend/src/plugin-api/scorePlayerContext.ts`  
   — Change staccato: `× 0.5` → `= 0`

4. `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`  
   — Replace prevPitches-scoped pin loop with all-held-required-pitches pin loop

---

## Acceptance Checklist (manual)

- [ ] Staccato notes in Arabesque advance when played with short key press (~50 ms)
- [ ] HL+HR chord retry after EARLY_RELEASE: keep LH down, re-press RH → advances
- [ ] 3 wrong presses on same beat → auto-advance (beat shown with `'auto-advanced'` outcome in result)
- [ ] Non-staccato notes still require hold (no regression)
- [ ] Cross-voice sustained notes still pin correctly on beat transition (no regression)
- [ ] All Vitest unit tests pass
- [ ] TypeScript build has zero errors
