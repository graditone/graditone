use crate::domain::events::global::GlobalStructuralEvent;
use crate::domain::events::staff::StaffStructuralEvent;
use crate::domain::instrument::Instrument;
use crate::domain::score::Score;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};

/// A detected musical phrase region within a score.
/// Phrases are per-instrument and aligned to measure boundaries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhraseRegion {
    /// 0-based instrument index within the Score
    pub instrument_index: usize,
    /// 0-based start measure (inclusive)
    pub start_measure: usize,
    /// 0-based end measure (inclusive)
    pub end_measure: usize,
    /// Start tick derived from measure boundaries
    pub start_tick: u32,
    /// End tick derived from measure boundaries (end of end_measure)
    pub end_tick: u32,
}

// ============================================================================
// T011: collect_hard_boundaries
// ============================================================================

/// Collect measure indices that represent hard structural boundaries.
/// These include repeat barlines, volta brackets, time signature changes (tick > 0),
/// and key signature changes (tick > 0).
pub fn collect_hard_boundaries(score: &Score) -> BTreeSet<usize> {
    let mut boundaries = BTreeSet::new();

    // Repeat barlines → boundary depends on type:
    // - End (backward repeat): the section ends AT this measure, so boundary is at measure_index + 1
    // - Start (forward repeat): the new section starts AT this measure, so boundary is at measure_index
    // - Both: boundary at measure_index + 1 (end of old section) and measure_index (start of new)
    use crate::domain::repeat::RepeatBarlineType;
    for rb in &score.repeat_barlines {
        match rb.barline_type {
            RepeatBarlineType::End => {
                let after = rb.measure_index as usize + 1;
                if after < score.measure_end_ticks.len() {
                    boundaries.insert(after);
                }
            }
            RepeatBarlineType::Start => {
                boundaries.insert(rb.measure_index as usize);
            }
            RepeatBarlineType::Both => {
                let after = rb.measure_index as usize + 1;
                if after < score.measure_end_ticks.len() {
                    boundaries.insert(after);
                }
                boundaries.insert(rb.measure_index as usize);
            }
        }
    }

    // Volta brackets → start_measure_index and end_measure_index + 1
    for vb in &score.volta_brackets {
        boundaries.insert(vb.start_measure_index as usize);
        let after_end = vb.end_measure_index as usize + 1;
        if after_end < score.measure_end_ticks.len() {
            boundaries.insert(after_end);
        }
    }

    // Time signature changes at non-zero tick
    for event in &score.global_structural_events {
        if let GlobalStructuralEvent::TimeSignature(ts) = event {
            if ts.tick.value() > 0 {
                let measure = tick_to_measure(ts.tick.value(), &score.measure_end_ticks);
                boundaries.insert(measure);
            }
        }
    }

    // Key signature changes at non-zero tick (across all instruments/staves)
    for instrument in &score.instruments {
        for staff in &instrument.staves {
            for event in &staff.staff_structural_events {
                if let StaffStructuralEvent::KeySignature(ks) = event {
                    if ks.tick.value() > 0 {
                        let measure = tick_to_measure(ks.tick.value(), &score.measure_end_ticks);
                        boundaries.insert(measure);
                    }
                }
            }
        }
    }

    boundaries
}

/// Convert a tick position to its measure index using measure_end_ticks.
fn tick_to_measure(tick: u32, measure_end_ticks: &[u32]) -> usize {
    for (i, &end_tick) in measure_end_ticks.iter().enumerate() {
        if tick < end_tick {
            return i;
        }
    }
    // If tick is beyond all measures, return last measure + 1
    measure_end_ticks.len()
}

/// Get start tick for a given measure index.
fn measure_start_tick(measure: usize, measure_end_ticks: &[u32]) -> u32 {
    if measure == 0 {
        0
    } else if measure <= measure_end_ticks.len() {
        measure_end_ticks[measure - 1]
    } else {
        *measure_end_ticks.last().unwrap_or(&0)
    }
}

/// Get end tick for a given measure index.
fn measure_end_tick(measure: usize, measure_end_ticks: &[u32]) -> u32 {
    if measure < measure_end_ticks.len() {
        measure_end_ticks[measure]
    } else {
        *measure_end_ticks.last().unwrap_or(&0)
    }
}

// ============================================================================
// T012: detect_slur_phrases
// ============================================================================

/// Detect phrase regions based on slur chains in staff 0, voice 0 of the instrument.
/// Walks slur_next chains, merges adjacent/overlapping slurs, splits at hard boundaries,
/// and enforces a maximum phrase length by splitting long ranges into group_size chunks.
pub fn detect_slur_phrases(
    instrument: &Instrument,
    measure_end_ticks: &[u32],
    hard_boundaries: &BTreeSet<usize>,
    group_size: usize,
) -> Vec<PhraseRegion> {
    if instrument.staves.is_empty() || instrument.staves[0].voices.is_empty() {
        return Vec::new();
    }

    let voice = &instrument.staves[0].voices[0];
    if voice.interval_events.is_empty() {
        return Vec::new();
    }

    // Build a lookup: NoteId → &Note
    let note_map: HashMap<_, _> = voice.interval_events.iter().map(|n| (n.id, n)).collect();

    // Find all slur chains: collect (start_measure, end_measure) for each slur arc
    let mut slur_ranges: Vec<(usize, usize)> = Vec::new();

    for note in &voice.interval_events {
        if let Some(ref slur_next_id) = note.slur_next {
            let start_measure = tick_to_measure(note.start_tick.value(), measure_end_ticks);

            // Find the end note
            if let Some(end_note) = note_map.get(slur_next_id) {
                let end_tick = end_note.start_tick.value() + end_note.duration_ticks;
                // Use end_tick - 1 so a note ending exactly at a measure boundary
                // belongs to the previous measure
                let end_measure = tick_to_measure(end_tick.saturating_sub(1), measure_end_ticks);
                slur_ranges.push((start_measure, end_measure));
            }
        }
    }

    if slur_ranges.is_empty() {
        return Vec::new();
    }

    // Sort by start_measure
    slur_ranges.sort();

    // Merge overlapping/adjacent slur ranges
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (start, end) in slur_ranges {
        if let Some(last) = merged.last_mut() {
            if start <= last.1 + 1 {
                // Overlapping or adjacent — merge
                last.1 = last.1.max(end);
                continue;
            }
        }
        merged.push((start, end));
    }

    // Split merged ranges at hard boundaries and then enforce max phrase length
    // (instrument_index will be set by the caller)
    let mut phrases = Vec::new();
    for (start, end) in merged {
        let mut boundary_split = Vec::new();
        split_at_boundaries(
            start,
            end,
            hard_boundaries,
            measure_end_ticks,
            &mut boundary_split,
        );

        // Enforce max phrase length: split ranges exceeding group_size
        for phrase in boundary_split {
            let len = phrase.end_measure - phrase.start_measure + 1;
            if len > group_size {
                let mut offset = 0;
                let mut s = phrase.start_measure;
                while offset < len {
                    let group_end_offset = (offset + group_size).min(len);
                    let e = phrase.start_measure + group_end_offset - 1;
                    phrases.push(PhraseRegion {
                        instrument_index: 0,
                        start_measure: s,
                        end_measure: e,
                        start_tick: measure_start_tick(s, measure_end_ticks),
                        end_tick: measure_end_tick(e, measure_end_ticks),
                    });
                    offset += group_size;
                    s = phrase.start_measure + offset;
                }
            } else {
                phrases.push(phrase);
            }
        }
    }

    phrases
}

/// Split a measure range at hard boundaries and emit PhraseRegion entries.
fn split_at_boundaries(
    start: usize,
    end: usize,
    hard_boundaries: &BTreeSet<usize>,
    measure_end_ticks: &[u32],
    out: &mut Vec<PhraseRegion>,
) {
    let mut current_start = start;

    if start < end {
        for &boundary in hard_boundaries.range(start + 1..=end) {
            if boundary > current_start {
                out.push(PhraseRegion {
                    instrument_index: 0,
                    start_measure: current_start,
                    end_measure: boundary - 1,
                    start_tick: measure_start_tick(current_start, measure_end_ticks),
                    end_tick: measure_end_tick(boundary - 1, measure_end_ticks),
                });
            }
            current_start = boundary;
        }
    }

    // Emit the remaining range
    if current_start <= end {
        out.push(PhraseRegion {
            instrument_index: 0,
            start_measure: current_start,
            end_measure: end,
            start_tick: measure_start_tick(current_start, measure_end_ticks),
            end_tick: measure_end_tick(end, measure_end_ticks),
        });
    }
}

// ============================================================================
// T013: detect_rest_boundaries
// ============================================================================

/// Detect measure indices where all voices in the primary staff end with rests.
/// These serve as secondary phrase boundary signals.
pub fn detect_rest_boundaries(
    instrument: &Instrument,
    measure_end_ticks: &[u32],
) -> BTreeSet<usize> {
    let mut boundaries = BTreeSet::new();

    if instrument.staves.is_empty() {
        return boundaries;
    }

    let staff = &instrument.staves[0];
    if staff.voices.is_empty() {
        return boundaries;
    }

    let num_measures = measure_end_ticks.len();

    for m in 0..num_measures {
        let m_start = if m == 0 { 0 } else { measure_end_ticks[m - 1] };
        let m_end = measure_end_ticks[m];

        // Check if ALL voices have a rest that reaches the end of this measure
        let all_voices_rest = staff.voices.iter().all(|voice| {
            voice.rest_events.iter().any(|rest| {
                let rest_start = rest.start_tick.value();
                let rest_end = rest_start + rest.duration_ticks;
                // Rest is within this measure and reaches (or extends past) the measure end
                rest_start >= m_start && rest_start < m_end && rest_end >= m_end
            })
        });

        if all_voices_rest {
            boundaries.insert(m);
        }
    }

    boundaries
}

// ============================================================================
// T014: apply_fallback_grouping
// ============================================================================

/// Group ungrouped measure ranges into regular phrase groups.
/// - 4/4 or 3/4 time → 4-measure phrases
/// - 2/4 or 6/8 time → 8-measure phrases
/// - Default → 4-measure phrases
pub fn apply_fallback_grouping(
    start_measure: usize,
    end_measure: usize,
    time_sig_numerator: u32,
    time_sig_denominator: u32,
) -> Vec<(usize, usize)> {
    let group_size = match (time_sig_numerator, time_sig_denominator) {
        (2, 4) | (6, 8) => 8,
        _ => 4,
    };

    let total = end_measure - start_measure + 1;
    let mut groups = Vec::new();
    let mut offset = 0;

    while offset < total {
        let group_end = (offset + group_size).min(total);
        groups.push((start_measure + offset, start_measure + group_end - 1));
        offset += group_size;
    }

    groups
}

// ============================================================================
// T015: detect_phrases (public entry point)
// ============================================================================

/// Detect musical phrases in a score for all instruments.
/// Orchestrates: collect hard boundaries → detect slur phrases → detect rest boundaries
/// → apply fallback grouping → compute ticks → return sorted Vec<PhraseRegion>.
pub fn detect_phrases(score: &Score) -> Vec<PhraseRegion> {
    if score.measure_end_ticks.is_empty() || score.instruments.is_empty() {
        return Vec::new();
    }

    let num_measures = score.measure_end_ticks.len();
    let hard_boundaries = collect_hard_boundaries(score);

    // Get the initial time signature for fallback grouping
    let (ts_num, ts_den) = get_initial_time_signature(score);
    let group_size: usize = match (ts_num, ts_den) {
        (2, 4) | (6, 8) => 8,
        _ => 4,
    };

    let mut all_phrases = Vec::new();

    for (inst_idx, instrument) in score.instruments.iter().enumerate() {
        // Step 1: Detect slur-based phrases
        let slur_phrases = detect_slur_phrases(
            instrument,
            &score.measure_end_ticks,
            &hard_boundaries,
            group_size,
        );

        // Step 2: Detect rest-based boundaries (secondary signal)
        let rest_boundaries = detect_rest_boundaries(instrument, &score.measure_end_ticks);

        // Step 3: Merge hard_boundaries + rest_boundaries for gap detection
        let mut all_boundaries = hard_boundaries.clone();
        all_boundaries.extend(&rest_boundaries);

        // Step 4: Find gaps not covered by slur phrases → apply fallback grouping
        let covered = measure_coverage(&slur_phrases, num_measures);
        let gaps = find_gaps(&covered, num_measures);

        let mut instrument_phrases = slur_phrases;

        for (gap_start, gap_end) in gaps {
            // Split gap at hard+rest boundaries, then apply fallback grouping to each sub-gap
            let sub_gaps = split_range_at_boundaries(gap_start, gap_end, &all_boundaries);
            for (sub_start, sub_end) in sub_gaps {
                let groups = apply_fallback_grouping(sub_start, sub_end, ts_num, ts_den);
                for (gs, ge) in groups {
                    instrument_phrases.push(PhraseRegion {
                        instrument_index: inst_idx,
                        start_measure: gs,
                        end_measure: ge,
                        start_tick: measure_start_tick(gs, &score.measure_end_ticks),
                        end_tick: measure_end_tick(ge, &score.measure_end_ticks),
                    });
                }
            }
        }

        // T016: Pickup measure handling — ensure measure 0 is included in first phrase
        if score.pickup_ticks > 0 && !instrument_phrases.is_empty() {
            instrument_phrases.sort_by_key(|p| p.start_measure);
            if instrument_phrases[0].start_measure > 0 {
                instrument_phrases[0].start_measure = 0;
                instrument_phrases[0].start_tick = 0;
            }
        }

        // Set instrument_index on slur-derived phrases (they had placeholder 0)
        for phrase in &mut instrument_phrases {
            phrase.instrument_index = inst_idx;
        }

        // T017: Whole-score fallback — if no phrases were generated, return single spanning phrase
        if instrument_phrases.is_empty() {
            instrument_phrases.push(PhraseRegion {
                instrument_index: inst_idx,
                start_measure: 0,
                end_measure: num_measures - 1,
                start_tick: 0,
                end_tick: *score.measure_end_ticks.last().unwrap(),
            });
        }

        // Sort by start_measure
        instrument_phrases.sort_by_key(|p| p.start_measure);

        all_phrases.extend(instrument_phrases);
    }

    // Sort globally by (instrument_index, start_measure)
    all_phrases.sort_by_key(|p| (p.instrument_index, p.start_measure));
    all_phrases
}

/// Get the initial time signature from the score (default 4/4).
fn get_initial_time_signature(score: &Score) -> (u32, u32) {
    for event in &score.global_structural_events {
        if let GlobalStructuralEvent::TimeSignature(ts) = event {
            if ts.tick.value() == 0 {
                return (ts.numerator as u32, ts.denominator as u32);
            }
        }
    }
    (4, 4) // default
}

/// Create a boolean array marking which measures are covered by existing phrases.
fn measure_coverage(phrases: &[PhraseRegion], num_measures: usize) -> Vec<bool> {
    let mut covered = vec![false; num_measures];
    for phrase in phrases {
        for item in covered
            .iter_mut()
            .take(phrase.end_measure.min(num_measures - 1) + 1)
            .skip(phrase.start_measure)
        {
            *item = true;
        }
    }
    covered
}

/// Find contiguous gaps of uncovered measures.
fn find_gaps(covered: &[bool], num_measures: usize) -> Vec<(usize, usize)> {
    let mut gaps = Vec::new();
    let mut i = 0;
    while i < num_measures {
        if !covered[i] {
            let start = i;
            while i < num_measures && !covered[i] {
                i += 1;
            }
            gaps.push((start, i - 1));
        } else {
            i += 1;
        }
    }
    gaps
}

/// Split a contiguous range at boundary points, returning sub-ranges.
fn split_range_at_boundaries(
    start: usize,
    end: usize,
    boundaries: &BTreeSet<usize>,
) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut current_start = start;

    if start < end {
        for &boundary in boundaries.range(start + 1..=end) {
            if boundary > current_start {
                ranges.push((current_start, boundary - 1));
            }
            current_start = boundary;
        }
    }

    if current_start <= end {
        ranges.push((current_start, end));
    }

    ranges
}
