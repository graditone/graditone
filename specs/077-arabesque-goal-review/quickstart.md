# Quickstart: Review Execution of Learning Arabesque Goal

**Branch**: `077-arabesque-goal-review` | **Date**: 2026-04-08  
**Worktree**: `../worktrees/077-arabesque-goal-review`

---

## Development Environment

All work happens in the worktree. Always `cd` into it first:

```bash
cd /Users/alvaro.delcastillo/devel/worktrees/077-arabesque-goal-review
```

---

## 1. Phrase Detection (Rust)

**Run all phrase detection tests:**

```bash
cd backend
cargo test phrase_detection -- --nocapture 2>&1 | tail -30
```

**Run the Arabesque-specific integration test (T026):**

```bash
cargo test test_parse_arabesque_produces_phrases -- --nocapture 2>&1
```

**Expected (after this feature):**
- Exactly 5 phrases per instrument (10 total for piano grand staff)
- No phrase with fewer than 2 measures (except intro [0,1])
- No 1-measure phrases at all

**Analyze Arabesque phrase structure manually:**

```bash
cd /Users/alvaro.delcastillo/devel/worktrees/077-arabesque-goal-review
python3 scripts/analyze_arabesque_phrases.py
```

Check that the slur-merged ranges and fallback gaps match expectations in research.md R-01.

**Run all backend tests (regression check):**

```bash
cd backend
cargo test 2>&1 | tail -20
```

---

## 2. Duration Estimation (TypeScript)

**Run duration estimation tests:**

```bash
cd plugins-external/sessions-plugin
npm test -- durationEstimation 2>&1
```

**Verify Arabesque phrase estimates manually:**

```typescript
// In a test or REPL context — quick calculation
import { estimateTaskDuration } from './durationEstimation';

// A-section: 9 measures, medium (2), defaults (10 loops, 90% minResult)
const aSection = estimateTaskDuration(9, 10, 2, 90);
// Expected after fix: ~770s (~12.8 min). Before fix: ~1796s (~29.9 min)
console.assert(aSection >= 150 && aSection <= 900, `A-section: ${aSection}s should be in [150, 900]`);
```

**Expected estimates (post-fix, medium difficulty, defaults):**
| Phrase | Measures | Expected secs | Expected min |
|--------|----------|---------------|--------------|
| Intro | 2 | ~171 | 2.9 |
| A-section | 9 | ~770 | 12.8 |
| B1 | 8 | ~684 | 11.4 |
| B2 | 8 | ~684 | 11.4 |
| Return | 6 | ~513 | 8.6 |

---

## 3. Session Distribution (TypeScript)

**Run session distribution tests:**

```bash
cd plugins-external/sessions-plugin
npm test -- sessionDistribution 2>&1
```

**Verify Arabesque goal session packing:**

```bash
cd plugins-external/sessions-plugin
npm test -- goalEngine 2>&1
```

**Expected session structure (post-fix):**
- 3 sessions (not 8)
- Session 1: Intro + A-section phrase groups (≤ 3600s ≈ 47 min)
- Session 2: B-section first half (≤ 3600s ≈ 34 min)
- Session 3: B-section second half + Return (≤ 3600s ≈ 60 min)
- Each session has `availableTime: 3600`; `totalEstimatedDurationSecs ≤ 3600`

---

## 4. Goal Progress Reporting (TypeScript / React)

**Run GoalsView tests:**

```bash
cd plugins-external/sessions-plugin
npm test -- GoalsView 2>&1
```

**Run goalEngine tests:**

```bash
cd plugins-external/sessions-plugin
npm test -- goalEngine 2>&1
```

**What to verify in the browser:**
1. Create an Arabesque learning goal (Sessions plugin → Goals tab → + New Goal → select Arabesque)
2. Open the goal detail (expand)
3. Expected: a "Phrase Progress" section showing 5 rows (Intro, A-section, B1, B2, Return), each with a mastery status badge and a progress bar
4. Expected: an overall completion percentage (0% initially)
5. Complete the RH task for the A-section phrase in a practice session
6. Expected: A-section row shows "1/3" with `in-progress` status

---

## 5. Full Plugin Test Suite

Run all sessions-plugin tests to catch regressions:

```bash
cd plugins-external/sessions-plugin
npm test 2>&1 | tail -30
```

All previously passing tests must remain green.

---

## 6. Test-First Development Checklist

Before implementing each change, write the failing test first (Principle V):

| Fix | Test file | Test to write before coding |
|-----|-----------|----------------------------|
| R-01 phrase merge | `backend/tests/phrase_detection_test.rs` | Extend T026: assert no phrase < 4 measures (except intro) |
| R-02 duration calibration | `durationEstimation.test.ts` | Add: `estimateTaskDuration(9, 10, 2, 90)` returns 770±30s |
| R-03 goalBudget sync | `goalEngine.test.ts` | Add: createGoal for Arabesque produces ≤ 4 sessions |
| R-04 phrase mastery | `GoalsView.test.tsx` | Add: renders PhraseProgress section with 5 rows |
| R-04 computeGoalProgress | `goalEngine.test.ts` | Add: all tasks done → completionPercentage === 100 |
