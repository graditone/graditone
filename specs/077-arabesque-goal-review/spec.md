# Feature Specification: Review Execution of Learning Arabesque Goal

**Feature Branch**: `077-arabesque-goal-review`  
**Worktree**: `../worktrees/077-arabesque-goal-review`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Review execution of Learning Arabesque goal - Phrases detection, Timings, Session definitions, Reporting"

## Overview

When a user creates a "Learn to play Arabesque" goal (Burgmüller Op. 100 No. 2), the system must perform four interdependent operations correctly: detect musically meaningful phrases, estimate realistic practice durations for each phrase, generate a sensible multi-session plan, and report goal progress accurately. This feature reviews and corrects the end-to-end execution of all four aspects so the Arabesque learning goal delivers a coherent, trustworthy practice experience.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phrases Align With Musical Structure (Priority: P1)

A learner opens Arabesque in the app and creates a "Learn this score" goal. The practice tasks presented are organised around the natural phrase structure of the piece — matching the repeating A-section, contrasting B-section, and return — not arbitrary blocks of 4 measures. The learner can recognise the sections from the sheet music.

**Why this priority**: Phrase detection is the foundation for all other aspects. Wrong phrase boundaries propagate into wrong task counts, wrong time estimates, and wrong session contents. Fixing this first gives the rest of the feature a stable base.

**Independent Test**: Can be fully tested by importing `Burgmuller_Arabesque.mxl`, reading the `phrases` array on the returned `Score` object, and verifying that phrase boundaries match known musical section points — without needing to create a goal or a session.

**Acceptance Scenarios**:

1. **Given** Arabesque is imported and phrases are detected, **When** the `phrases` array is inspected, **Then** each detected phrase corresponds to a complete, musically coherent section (the A-theme entries, the B-section, and the return are each captured as distinct phrases rather than subdivided at arbitrary measure boundaries).
2. **Given** the score has slur markings spanning its thematic sections, **When** phrase detection runs, **Then** the slur-chain algorithm correctly identifies and merges adjacent slur arcs into phrase boundaries, without splitting a phrase mid-slur.
3. **Given** the piece contains a pickup (anacrusis) measure, **When** phrase detection runs, **Then** the pickup is attached to the first full phrase rather than treated as a standalone fragment.
4. **Given** a phrase boundary falls at a repeat barline, **When** phrase detection runs, **Then** the repeat barline is treated as a hard boundary and two separate phrases are produced.

---

### User Story 2 - Practice Time Estimates Feel Realistic (Priority: P2)

A learner reviews their auto-generated Arabesque learning plan and sees estimated practice times per session task. Those estimates reflect plausible effort to learn each phrase at the configured tempo and iteration count — not so short that the plan feels trivial, not so long that it looks impossible within a single practice session.

**Why this priority**: Unrealistic time estimates directly undermine user trust and session packing quality. A learner who sees "3 hours for one phrase" will not trust the system. This must be addressed after phrase detection to ensure per-phrase estimates are computed from correct phrase lengths.

**Independent Test**: Can be fully tested by calling the duration estimation function with Arabesque phrases and default goal parameters (10 iterations, 90% threshold, medium difficulty) and verifying that each phrase-task estimate falls within an acceptable range.

**Acceptance Scenarios**:

1. **Given** a phrase task covering 4–8 measures of Arabesque with default parameters (10 iterations, minResult 90%, tempo ×1.0, medium difficulty), **When** the estimated duration is calculated, **Then** the estimate is between 3 and 15 minutes.
2. **Given** a phrase task with hard difficulty, **When** the estimated duration is calculated, **Then** the estimate is visibly higher than the same phrase at easy difficulty, reflecting the extra learning effort required.
3. **Given** a phrase task for a short phrase (≤4 measures), **When** the estimated duration is calculated, **Then** the estimate is shorter than for a longer phrase of the same difficulty at the same settings.
4. **Given** all phrase tasks for the full Arabesque score are summed, **When** the total estimated practice time is inspected, **Then** the total across all sessions falls between 2 and 10 hours of dedicated practice.

---

### User Story 3 - Generated Session Plan Is Coherent (Priority: P3)

A learner accepts the auto-generated session plan after creating the Arabesque goal. They see a series of scheduled practice sessions, each containing a manageable set of phrase tasks. No single session is packed beyond the available time budget, phrase groupings (RH + LH + BH for the same phrase) are kept together in the same session, and the first session is scheduled for the next free day.

**Why this priority**: Learners rely on the generated plan to know what to practise each day. A plan that packs too many tasks into one session or splits a phrase's hand tasks across different days is impractical and erodes confidence in the tool.

**Independent Test**: Can be fully tested by invoking the goal creation function with the Arabesque score and inspecting the returned sessions array — verifying session count, task distribution, and scheduling — without needing to open the UI or complete any tasks.

**Acceptance Scenarios**:

1. **Given** a learning goal is created for Arabesque with a 1-hour available time budget, **When** the sessions are generated, **Then** the estimated total duration of tasks in each session does not exceed 60 minutes.
2. **Given** a phrase has three task variants (RH, LH, BH), **When** tasks are distributed across sessions, **Then** all three variants for the same phrase are placed in the same session (they form an atomic practice unit).
3. **Given** a goal is created on a day where the user already has a scheduled session, **When** the first auto-generated session is scheduled, **Then** it is placed on the next calendar day that has no existing session.
4. **Given** Arabesque's full phrase set exceeds the 1-hour time budget for a single session, **When** task packing runs, **Then** tasks are distributed across multiple sessions respecting phrase-group atomicity and filling each session as fully as possible before creating a new one.
5. **Given** the Arabesque score is a two-staff piano score, **When** tasks are generated, **Then** each phrase produces exactly three task variants: RH (staffIndex 0), LH (staffIndex 1), and BH (staffIndex −1).

---

### User Story 4 - Goal Progress Is Clearly Reported (Priority: P4)

After completing several Arabesque practice sessions, a learner opens the Goals tab and the Sessions calendar and can immediately understand how their learning is progressing. They can see which phrases have been mastered, which are still in progress, and an overall completion percentage for the Arabesque goal.

**Why this priority**: Without meaningful progress reporting, learners cannot gauge whether the plan is working or stay motivated. This builds on the earlier three aspects being correct.

**Independent Test**: Can be fully tested by simulating completed `TaskLinkedPractice` entries for a subset of Arabesque tasks and verifying that the goal view reflects the correct mastered/in-progress/pending phrase counts and an accurate overall completion percentage.

**Acceptance Scenarios**:

1. **Given** a learner has completed all three tasks (RH, LH, BH) for a phrase with a score meeting the minResult threshold, **When** they open the Goals tab, **Then** that phrase is marked as mastered and visually distinguished from phrases still in progress.
2. **Given** a learner has completed some sessions but not all, **When** they view the Arabesque goal summary, **Then** they see an overall completion percentage (mastered phrases / total phrases × 100).
3. **Given** a learner opens the session calendar after completing two Arabesque sessions, **When** they view the day-detail for those sessions, **Then** they see per-task scores, practice durations, and note accuracy for each Arabesque phrase task practised that day.
4. **Given** a task was attempted but never met the minResult threshold across all available iterations (status: failed), **When** the progress report is shown, **Then** the failed task is clearly indicated as failed rather than silently omitted.
5. **Given** all phrase tasks across all sessions for the Arabesque goal are completed, **When** the learner views the goal, **Then** the goal status transitions to "completed" and a completion indicator is shown.

---

### Edge Cases

- What happens when Arabesque's pickup measure causes `start_measure = 0` to be a 1-beat anacrusis? Is it correctly merged into phrase 1 rather than reported as a fragmented phrase?
- How does session distribution handle a very small available time budget (e.g., 15 minutes), resulting in many single-task sessions?
- What if the user changes goal parameters (iterations, tempo, min result) after sessions have already been generated — are the time estimates refreshed?
- What if all Arabesque phrases collapse into one large phrase (worst-case fallback)? Does the session plan still produce meaningful task splits?
- How does reporting treat a task that was retried (currentRound reset) after a previous failed round — are both rounds visible in the history?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The phrase detection algorithm MUST correctly identify phrase boundaries in `Burgmuller_Arabesque.mxl` using slur chains as the primary signal, followed by hard boundaries (repeat barlines, time/key signature changes) and rest patterns.
- **FR-002**: The pickup (anacrusis) measure in Arabesque MUST be attached to the first full phrase, not emitted as a standalone phrase fragment.
- **FR-003**: The duration estimation function MUST return per-task estimates between 3 and 15 minutes for a medium-difficulty Arabesque phrase task at default parameters (10 iterations, 90% threshold, tempo ×1.0).
- **FR-004**: The total estimated practice time across all generated sessions for the full Arabesque learning goal MUST be between 2 and 10 hours at default parameters.
- **FR-005**: The session distribution algorithm MUST keep all task variants (RH, LH, BH) for the same phrase in the same session (phrase-group atomicity).
- **FR-006**: The session distribution algorithm MUST NOT schedule tasks into a session whose estimated total duration already exceeds the session's `availableTime`.
- **FR-007**: The first auto-generated session for an Arabesque goal MUST be scheduled on the next calendar day that has no existing session.
- **FR-008**: The Goals tab MUST display per-phrase mastery status (mastered / in-progress / pending / failed) for the Arabesque goal.
- **FR-009**: The Goals tab MUST display an overall completion percentage for the Arabesque goal, calculated as mastered phrases / total phrases × 100.
- **FR-010**: A task with status `failed` MUST be visibly distinguished from pending and in-progress tasks in both the goals view and the session detail view.
- **FR-011**: When all tasks across all sessions for the Arabesque goal are in `done` status, the goal status MUST automatically transition to `completed` without requiring a manual user action.
- **FR-012**: The session calendar day-detail MUST display per-task score, practice duration, and note accuracy for each Arabesque phrase task practised in that session.

### Key Entities

- **Score (Arabesque)**: A parsed MusicXML score with a populated `phrases: PhraseRegion[]` array. Each `PhraseRegion` carries `instrument_index`, `start_measure`, `end_measure`, `start_tick`, and `end_tick`.
- **Learning Goal**: A goal of type `learn-score-phrase` linked to the Arabesque score. Contains configurable parameters (loopCount, minResult, tempoMultiplier) and references the sessions holding all generated tasks.
- **Session Task**: A practice assignment for one phrase variant (RH, LH, or BH). Carries difficulty, estimated duration, status, and a history of `TaskLinkedPractice` results.
- **Practice Session**: A scheduled collection of session tasks bounded by `availableTime`. Holds `targetDate`, `status`, and an `activities` log.
- **Goal Progress Report**: A derived view aggregating task outcomes across all sessions to show per-phrase mastery status and overall goal completion percentage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All detected Arabesque phrases can be identified by a musically trained reviewer as corresponding to natural sections of the piece, with zero phrases that are clearly mid-section splits or musically arbitrary groupings.
- **SC-002**: 100% of auto-generated phrase task estimates for the Arabesque learning goal fall within the 3–15 minute range for medium-difficulty tasks at default settings.
- **SC-003**: The total estimated practice time across all generated Arabesque sessions is between 2 and 10 hours with default goal parameters.
- **SC-004**: All phrase task triplets (RH + LH + BH for the same phrase) are co-located in the same session — zero split triplets across all generated sessions for Arabesque.
- **SC-005**: A learner can determine which Arabesque phrases they have mastered and the overall goal completion percentage at a glance from the Goals tab, without navigating to a secondary screen.
- **SC-006**: The goal completion status transitions to "completed" within one UI refresh cycle after the last task reaches "done", with no manual action required.

## Assumptions

- Arabesque refers to Burgmüller Op. 100 No. 2, as stored in `scores/Burgmuller_Arabesque.mxl`.
- Piano (grand staff: 2 staves) is the only instrument; each phrase produces exactly 3 tasks (RH, LH, BH).
- Default goal parameters apply: 10 iterations, 90% minimum result, tempo multiplier ×1.0.
- Default available time per session is 3600 seconds (1 hour).
- The goal creation flow, Sessions plugin infrastructure, and calendar view from features 065–071 are already in place. This feature reviews and corrects their execution for the Arabesque score, not a full rebuild.
- "Mastered phrase" means all task variants (RH + LH + BH) for that phrase are in `done` status.
