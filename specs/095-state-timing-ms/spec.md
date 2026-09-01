# Feature Specification: Practice Report Timing Labels

**Feature Branch**: `095-state-timing-ms`
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "Let's improve the Score Practice View reporting. In the final report, in the notes table, in the column State, when it is out of time, it must show the amount in ms. The state label must be +/- xxx ms"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Read the timing deviation for out-of-time notes in the final report (Priority: P1)

A musician completes a practice session and the final report results appear. They expand the per-note details table to review each note. For every note that was played out of time, the State column shows the exact deviation in milliseconds, expressed as a signed value — a late note shows `+120 ms`, an early note shows `-80 ms`. The musician can immediately see *how much* each out-of-time note missed the mark, without having to cross-reference the timing-delta column.

**Why this priority**: This is the entire request. Surfacing the deviation amount directly in the State label turns a qualitative flag ("off-beat") into a quantitative, actionable value in the place users look at first. It delivers the requested improvement on its own, using data that is already recorded for every note.

**Independent Test**: Complete a practice with at least one note played outside the timing tolerance → open the final report → expand the per-note table → observe that the State cell of that note displays its signed deviation in milliseconds (e.g., `+120 ms`).

**Acceptance Scenarios**:

1. **Given** a completed practice whose report contains an out-of-time (late) note, **When** the user views the State column for that note in the final report's notes table, **Then** the label shows the signed deviation in milliseconds (e.g., `+120 ms`).
2. **Given** a completed practice whose report contains an out-of-time (early) note, **When** the user views the State column for that note, **Then** the label shows the signed deviation in milliseconds with a minus sign (e.g., `-80 ms`).
3. **Given** an out-of-time note whose recorded deviation is 0 ms, **When** the user views the State column for that note, **Then** the label shows `0 ms` (no sign).
4. **Given** a completed practice whose report contains notes played within the timing tolerance, **When** the user views the State column for those notes, **Then** they continue to show the existing "Correct" label and are unaffected by this change.
5. **Given** a completed practice whose report contains wrong notes, **When** the user views the State column for those notes, **Then** they continue to show the existing "Wrong" label and are unaffected by this change.

---

### User Story 2 — Same deviation labels when reviewing a saved practice (Priority: P2)

A musician loads a previously saved practice from the saved-practices list and opens its report. The per-note details table behaves identically to the live report: out-of-time notes carry their signed deviation in milliseconds in the State column.

**Why this priority**: Saved-practice reports reuse the same results screen, so consistency here prevents users from seeing two different reporting behaviours for the same concept. It completes the feature but is a lower-priority second pass because the live report already delivers the primary value.

**Independent Test**: Save a practice that contains an out-of-time note → load the saved practice → open its report → observe the State column shows the signed deviation in milliseconds.

**Acceptance Scenarios**:

1. **Given** a saved practice containing an out-of-time note, **When** the user loads it and views the notes table in the report, **Then** the State column shows the signed deviation in milliseconds exactly as in a live report.
2. **Given** a partial (stopped-early) practice, **When** the user views its report, **Then** the existing report behaviour is unchanged (the notes table is not part of the partial report and is not affected).

---

### Edge Cases

- What happens when an out-of-time note has a recorded deviation of exactly 0 ms (possible for early-release notes)? The State label shows `0 ms` without a sign rather than a blank or dash.
- What happens when the deviation is very large? The full value is displayed (e.g., `+12042 ms`), with no rounding beyond the nearest millisecond.
- What happens to "Held too short" (early-release) notes? They are timed deviations and show the signed deviation in milliseconds, keeping their existing icon.
- What happens to wrong-note rows? They are not out-of-time states; they keep the existing "Wrong" label.
- What happens in the partial report shown when the user stops a practice mid-session? Nothing — that report has no per-note notes table, so the change does not apply there.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In the final report's notes table, for every note whose state is out of time, the State column MUST display the per-note timing deviation in milliseconds, formatted as a signed value: `+{n} ms` when the deviation is positive (late), `-{n} ms` when negative (early), and `0 ms` without a sign when the deviation is zero.
- **FR-002**: The amount shown in the State column MUST equal the recorded timing deviation for that note, rounded to the nearest whole millisecond (e.g., a recorded deviation of 120 ms displays as `+120 ms`).
- **FR-003**: "Out of time" MUST cover every timing-deviation outcome — notes played late (currently labelled "Off-beat") and notes released too early (currently labelled "Held too short"). Both are onset-timing deviations for which an amount is recorded.
- **FR-004**: Notes played within the timing tolerance MUST keep their existing "Correct" State label regardless of their (zero/near-zero) deviation.
- **FR-005**: Wrong-note rows MUST keep their existing "Wrong" State label; the deviation amount MUST NOT be shown for them.
- **FR-006**: The existing visual indicator (icon) currently shown for out-of-time states MUST be retained alongside the new millisecond label.
- **FR-007**: The change MUST apply consistently to the final report when rendered live after a completed practice AND when rendered from a loaded saved practice.
- **FR-008**: The millisecond amounts are numeric and MUST be displayed as-is regardless of UI language; the change MUST NOT alter existing translated labels for other states.
- **FR-009**: No other part of the final report (score, summary stats, timing comparison, delay graph, timing-delta column) MUST change as a result of this feature.

### Key Entities

- **Practice Note Result**: The per-note record produced during a practice session. Key attributes used here: the note's state (`correct`, `off-beat`/late, `early-release`, `wrong`) and its recorded timing deviation in milliseconds (signed: positive = late, negative = early).
- **Final Report — Notes Table**: The per-note details table in the results overlay. Contains one row per note, including the State column whose label this feature changes for out-of-time notes. Rendered from the same source whether the practice was completed live or loaded from storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of out-of-time notes in the final report's notes table display their recorded deviation in milliseconds with the correct sign (`+`, `-`, or none for zero); measured over the full set of seeded scenarios (late, early, zero-deviation).
- **SC-002**: 100% of in-tolerance notes and wrong-note rows keep their existing State labels; zero regressions to the "Correct" and "Wrong" labels.
- **SC-003**: The deviation label is identical when the same practice is reviewed live versus loaded from its saved record; 0 discrepancies across at least one saved-and-reloaded verification per reporting session.
- **SC-004**: A user can read the deviation amount for any out-of-time note at a glance — the label renders fully within the State cell without truncation at standard tablet width.
- **SC-005**: The rest of the final report (score, summary stats, timing comparison, delay graph, and the timing-delta column) is unaffected; verified by acceptance tests covering untouched sections.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will grow during implementation, deployment, or production use per Principle VII (Regression Prevention).