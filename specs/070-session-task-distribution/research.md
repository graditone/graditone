# Research: Session Task Distribution

**Feature**: 070-session-task-distribution
**Date**: 2026-04-01

## Research Topic 1: Per-Region Difficulty Computation

### Decision
Add a new Rust function `compute_region_difficulty(score, start_measure, end_measure, staff_index)` exposed via WASM. This reuses the existing density + polyphony algorithm but scoped to a measure range and specific staff.

### Rationale
- Constitution Principle II (Hexagonal Architecture): domain logic stays in Rust core
- Constitution Principle VI (Layout Engine Authority): spatial/musical computations belong in backend
- The existing `compute_difficulty()` already iterates per-measure and per-staff — narrowing the range is a straightforward refactor
- Avoids duplicating the density/polyphony algorithm in TypeScript

### Alternatives Considered
1. **TypeScript-side computation**: Rejected — would duplicate domain logic and violate Principle II
2. **Pre-compute per-phrase difficulty during import**: Rejected — phrase regions can be many, and difficulty per region is only needed at goal creation time. Pre-computing all permutations (phrase × staff) is wasteful
3. **Reuse global difficulty for all tasks**: Rejected — spec requires per-region difficulty (FR-003)

### Implementation Approach
- Extract the inner loop of `compute_instrument_difficulty()` into a helper that accepts `start_measure..=end_measure`
- New public function: `compute_region_difficulty(score: &Score, start_measure: usize, end_measure: usize, staff_index: Option<usize>) -> Option<DifficultyRating>`
  - `staff_index: None` means BH (both hands — use max across staves, same as current)
  - `staff_index: Some(0)` means RH (staff 0 only)
  - `staff_index: Some(1)` means LH (staff 1 only)
- New WASM binding: `compute_region_difficulty(score_js, start_measure, end_measure, staff_index)` → returns `DifficultyRating` as JsValue
- Plugin API extension: `scorePlayer.getRegionDifficulty(startMeasure, endMeasure, staffIndex)` → `DifficultyRating | null`

---

## Research Topic 2: Duration Estimation Formula

### Decision
Use a calibrated formula based on user-clarified base of ~3-4 minutes per medium-difficulty measure of practice time. The formula:

```
estimatedDurationSecs = numMeasures × baseSecs × difficultyMultiplier × loopMultiplier × resultMultiplier
```

### Calibration

**Base time per measure** (at medium difficulty, loopCount=1, minResult=70):
- `baseSecs = 210` (3.5 minutes — midpoint of 3-4 min range)

**Difficulty multiplier**:
- Easy: 0.6 (easier passages need less practice time)
- Medium: 1.0 (baseline)
- Hard: 1.5 (harder passages need more repetition and slower practice)

**Loop multiplier** (repetitions):
- `loopMultiplier = 0.3 + 0.7 × (loopCount / 10)`
- At loopCount=10 (default): multiplier = 1.0
- At loopCount=1: multiplier = 0.37 (still need some time even with 1 loop)
- At loopCount=20: multiplier = 1.7

**Result multiplier** (higher target = more practice):
- `resultMultiplier = 0.5 + 0.5 × (minResult / 100)`
- At minResult=90 (default): multiplier = 0.95
- At minResult=100: multiplier = 1.0
- At minResult=50: multiplier = 0.75

### Example calculations

**4-measure medium phrase, default params (loop=10, minResult=90)**:
- 4 × 210 × 1.0 × 1.0 × 0.95 = 798 seconds ≈ 13.3 minutes

**4-measure easy phrase, same params**:
- 4 × 210 × 0.6 × 1.0 × 0.95 = 478.8 seconds ≈ 8 minutes

**4-measure hard phrase, same params**:
- 4 × 210 × 1.5 × 1.0 × 0.95 = 1197 seconds ≈ 20 minutes

These fit within a 1-hour session (3600s):
- Easy phrase triplet (RH+LH+BH): ~3 × 479 = 1437s ≈ 24 min → fits
- Medium phrase triplet: ~3 × 798 = 2394s ≈ 40 min → fits
- Hard phrase triplet: ~3 × 1197 = 3591s ≈ 60 min → tight fit (acceptable per FR-008)

### Rationale
- Linear scaling with measures and loops is intuitive and predictable
- Difficulty and result multipliers are bounded (0.6–1.5 and 0.5–1.0) preventing extreme outliers
- Calibrated so a default medium-difficulty session fills ~40-60 minutes per phrase triplet — reasonable for a 1-hour session

### Alternatives Considered
1. **Tempo-based calculation**: Rejected — tempo affects playback speed but not practice time (user clarified duration = learning time, not playback)
2. **Machine-learning estimation**: Rejected — over-engineering; simple formula calibrated to user expectation of 3-4 min/measure is sufficient
3. **Constant per-task duration**: Rejected — spec requires duration to vary with difficulty, measures, loops, and minResult (FR-004, FR-014)

---

## Research Topic 3: Session Distribution Algorithm

### Decision
Use a greedy first-fit algorithm with phrase-triplet grouping as the atomic unit.

### Algorithm

```
Input: phraseGroups[] (each = {tasks: SessionTask[], totalDuration: number})
Input: availableTime (default 3600s)
Output: sessions[] (each with tasks[] and targetDate)

sessions = []
currentSession = newSession(availableTime)

for each phraseGroup in phraseGroups:
  if currentSession.tasks.length > 0 AND
     currentSession.remainingTime < phraseGroup.totalDuration:
    // Current session full — start new one
    sessions.push(currentSession)
    currentSession = newSession(availableTime)
  
  // Add all tasks from this phrase group (always accepts at least one group per session)
  currentSession.tasks.push(...phraseGroup.tasks)
  currentSession.usedTime += phraseGroup.totalDuration

sessions.push(currentSession)  // Don't forget the last session
return sessions
```

### Rationale
- Greedy first-fit is O(n) and simple; scores rarely exceed 50 phrases (150 tasks)
- Phrase triplets stay together (FR-015) — never split across sessions
- A session always accepts the first phrase group even if it overflows (FR-008)
- Matches user mental model: phrases in order, fill sessions sequentially

### Alternatives Considered
1. **Best-fit bin packing**: Rejected — would reorder phrases, violating the pedagogical progression (FR-015)
2. **Knapsack optimization**: Rejected — over-engineering for <50 items; also would reorder
3. **One session per phrase**: Rejected — wastes sessions; a 1-hour session can often fit 2-3 phrase groups

---

## Research Topic 4: Free-Day Scheduling

### Decision
Query all existing sessions' targetDates, build an occupied-days set, then iterate forward from tomorrow to find free days.

### Algorithm

```
Input: numSessionsNeeded, existingSessions[]
Output: targetDates[] (one per session)

occupiedDays = new Set(
  existingSessions
    .filter(s => s.status !== 'closed' && s.targetDate)
    .map(s => s.targetDate)
)

targetDates = []
candidate = tomorrow()

while targetDates.length < numSessionsNeeded:
  dateStr = formatISO(candidate)
  if dateStr NOT in occupiedDays:
    targetDates.push(dateStr)
    occupiedDays.add(dateStr)  // Prevent double-booking within this batch
  candidate = candidate + 1 day

return targetDates
```

### Rationale
- O(n + d) where n = existing sessions, d = days scanned — trivially fast
- Uses only `targetDate` from session index (already in localStorage — no IndexedDB round-trip)
- Considers only non-closed sessions with targetDate (closed sessions are historical)
- Adding newly assigned dates to the occupiedDays set prevents double-booking within the same goal creation

### Implementation Detail
- New helper in `sessionStorage.ts`: `getOccupiedDates(): Set<string>` — reads from session index
- New function in `sessionDistribution.ts`: `scheduleSessions(sessions, occupiedDates): Session[]` — assigns targetDates

### Alternatives Considered
1. **Query IndexedDB for each candidate day**: Rejected — unnecessary I/O; the localStorage index already has all needed data
2. **Calendar-based UI for date selection**: Rejected — out of scope; user description specifies automatic scheduling

---

## Research Topic 5: Session Storage Cap and Eviction Warning

### Decision
Before creating sessions, count `existingSessions.length + newSessionCount` and compare against `MAX_SESSIONS` (50). If over, calculate how many closed sessions will be evicted and show a confirmation dialog.

### Implementation
- In `GoalsView.tsx` `processScoreSelection()`, after distribution produces sessions[], before persisting:
  1. `const currentCount = listSessionsIndex().length`
  2. `const overflow = currentCount + sessions.length - MAX_SESSIONS`
  3. If `overflow > 0`, show confirm dialog: "This will create {sessions.length} sessions. {overflow} oldest closed sessions will be removed to stay within the 50-session limit."
  4. On confirm, proceed. On cancel, abort.
- Existing eviction logic in `sessionStorage.ts` already handles the actual removal.

### Rationale
- Simple count check; no new infrastructure needed
- Uses existing eviction mechanism — only adds the user-facing warning
- Matches FR-016 requirement exactly
