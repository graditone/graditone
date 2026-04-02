use super::level::{DifficultyLevel, DifficultyRating};
use crate::domain::instrument::Instrument;
use crate::domain::score::Score;
use crate::domain::value_objects::Tick;
use crate::layout::extraction::{actual_end, actual_start};

const PPQ: f64 = 960.0;

/// Compute the difficulty rating for a score by finding the maximum
/// per-instrument combined score (density + polyphony), then mapping to a difficulty level.
pub fn compute_difficulty(score: &Score) -> Option<DifficultyRating> {
    if score.instruments.is_empty() {
        return None;
    }

    let measure_count = score.measure_end_ticks.len();
    if measure_count == 0 {
        return None;
    }

    compute_region_difficulty(score, 0, measure_count - 1, None)
}

/// Compute a difficulty rating for a specific measure range and optional staff.
///
/// - `start_measure` and `end_measure` are 0-based and inclusive.
/// - `staff_index = None` computes both hands (hardest staff per instrument).
/// - `staff_index = Some(i)` computes difficulty for a single staff index.
pub fn compute_region_difficulty(
    score: &Score,
    start_measure: usize,
    end_measure: usize,
    staff_index: Option<usize>,
) -> Option<DifficultyRating> {
    if score.instruments.is_empty() {
        return None;
    }

    let measure_count = score.measure_end_ticks.len();
    if measure_count == 0 || start_measure > end_measure || end_measure >= measure_count {
        return None;
    }

    score
        .instruments
        .iter()
        .filter_map(|instrument| {
            compute_instrument_difficulty(
                score,
                instrument,
                start_measure,
                end_measure,
                staff_index,
            )
        })
        .max_by(|a, b| a.density_rate.partial_cmp(&b.density_rate).unwrap())
}

fn compute_instrument_difficulty(
    score: &Score,
    instrument: &Instrument,
    start_measure: usize,
    end_measure: usize,
    staff_index: Option<usize>,
) -> Option<DifficultyRating> {
    if let Some(idx) = staff_index {
        if idx >= instrument.staves.len() {
            return None;
        }
    }

    let measure_count = end_measure.saturating_sub(start_measure) + 1;
    let mut bar_densities: Vec<f64> = Vec::with_capacity(measure_count);
    let mut bar_polyphonies: Vec<(f64, f64)> = Vec::with_capacity(measure_count); // (avg, max) per bar
    let mut has_any_note = false;

    for measure_index in start_measure..=end_measure {
        let tpm = ticks_per_measure_at(score, measure_index);
        if tpm == 0 {
            continue;
        }

        let bar_start = actual_start(
            measure_index,
            &score.measure_end_ticks,
            score.pickup_ticks,
            tpm,
        );
        let bar_end = actual_end(
            measure_index,
            &score.measure_end_ticks,
            score.pickup_ticks,
            tpm,
        );
        let bar_duration_ticks = bar_end.saturating_sub(bar_start);
        if bar_duration_ticks == 0 {
            continue;
        }

        // Notes-per-beat (tempo-independent density)
        let bar_duration_beats = bar_duration_ticks as f64 / PPQ;
        if bar_duration_beats <= 0.0 {
            continue;
        }

        let pitch_count = count_pitches_in_bar(instrument, bar_start, bar_end, staff_index);
        if pitch_count > 0 {
            has_any_note = true;
        }
        bar_densities.push(pitch_count as f64 / bar_duration_beats);

        // Polyphony: sample at each note onset in the bar
        let (avg_poly, max_poly) =
            compute_bar_polyphony(instrument, bar_start, bar_end, staff_index);
        bar_polyphonies.push((avg_poly, max_poly));
    }

    if bar_densities.is_empty() || !has_any_note {
        return None;
    }

    // Note density component: 0.7 * avg + 0.3 * peak
    let density_avg = bar_densities.iter().copied().sum::<f64>() / bar_densities.len() as f64;
    let density_peak = bar_densities
        .iter()
        .copied()
        .fold(f64::NEG_INFINITY, f64::max);
    let note_density = 0.7 * density_avg + 0.3 * density_peak;

    // Polyphony component: 0.7 * avg_polyphony + 0.3 * max_polyphony
    let all_avg_poly: f64 =
        bar_polyphonies.iter().map(|(a, _)| a).sum::<f64>() / bar_polyphonies.len() as f64;
    let all_max_poly: f64 = bar_polyphonies
        .iter()
        .map(|(_, m)| m)
        .copied()
        .fold(f64::NEG_INFINITY, f64::max);
    let polyphony_score = 0.7 * all_avg_poly + 0.3 * all_max_poly;

    // Combined: 0.6 * note_density + 0.4 * polyphony
    let combined = 0.6 * note_density + 0.4 * polyphony_score;

    Some(DifficultyRating {
        density_rate: combined,
        level: DifficultyLevel::from_density_rate(combined),
    })
}

/// Compute the average and maximum polyphony for a bar.
/// polyphony(t) = number of notes sounding at time t.
/// Samples at each note onset tick within the bar.
fn compute_bar_polyphony(
    instrument: &Instrument,
    bar_start: u32,
    bar_end: u32,
    staff_index: Option<usize>,
) -> (f64, f64) {
    // Collect sounding intervals (start, end).
    // - Single staff: intervals from that staff only.
    // - Both hands (None): combine intervals from ALL staves so that
    //   polyphony reflects simultaneous notes across both hands.
    let combined_intervals: Vec<(u32, u32)> = if let Some(idx) = staff_index {
        let Some(staff) = instrument.staves.get(idx) else {
            return (0.0, 0.0);
        };
        staff
            .voices
            .iter()
            .flat_map(|voice| voice.interval_events.iter())
            .filter(|note| {
                !note.is_tie_continuation
                    && !note.is_grace
                    && note.start_tick.value() >= bar_start
                    && note.start_tick.value() < bar_end
            })
            .map(|note| {
                let start = note.start_tick.value();
                let end = start + note.duration_ticks;
                (start, end)
            })
            .collect()
    } else {
        instrument
            .staves
            .iter()
            .flat_map(|staff| {
                staff
                    .voices
                    .iter()
                    .flat_map(|voice| voice.interval_events.iter())
                    .filter(|note| {
                        !note.is_tie_continuation
                            && !note.is_grace
                            && note.start_tick.value() >= bar_start
                            && note.start_tick.value() < bar_end
                    })
                    .map(|note| {
                        let start = note.start_tick.value();
                        let end = start + note.duration_ticks;
                        (start, end)
                    })
            })
            .collect()
    };

    if combined_intervals.is_empty() {
        return (0.0, 0.0);
    }

    // Collect unique onset ticks as sample points
    let mut onset_ticks: Vec<u32> = combined_intervals.iter().map(|&(s, _)| s).collect();
    onset_ticks.sort_unstable();
    onset_ticks.dedup();

    if onset_ticks.is_empty() {
        return (0.0, 0.0);
    }

    let mut total_poly = 0u32;
    let mut max_poly = 0u32;

    for &t in &onset_ticks {
        let poly = combined_intervals
            .iter()
            .filter(|&&(s, e)| s <= t && t < e)
            .count() as u32;
        total_poly += poly;
        if poly > max_poly {
            max_poly = poly;
        }
    }

    let avg_poly = total_poly as f64 / onset_ticks.len() as f64;
    (avg_poly, max_poly as f64)
}

/// Count individual sounding pitches in a bar range.
///
/// - `staff_index = Some(i)`: count for that single staff.
/// - `staff_index = None` (both hands): **sum** across all staves so that
///   playing both hands produces a higher density than either hand alone.
///
/// Excludes tied continuations and grace notes.
fn count_pitches_in_bar(
    instrument: &Instrument,
    bar_start: u32,
    bar_end: u32,
    staff_index: Option<usize>,
) -> u32 {
    if let Some(idx) = staff_index {
        let Some(staff) = instrument.staves.get(idx) else {
            return 0;
        };
        return staff
            .voices
            .iter()
            .flat_map(|voice| voice.interval_events.iter())
            .filter(|note| {
                !note.is_tie_continuation
                    && !note.is_grace
                    && note.start_tick.value() >= bar_start
                    && note.start_tick.value() < bar_end
            })
            .count() as u32;
    }

    instrument
        .staves
        .iter()
        .map(|staff| {
            staff
                .voices
                .iter()
                .flat_map(|voice| voice.interval_events.iter())
                .filter(|note| {
                    !note.is_tie_continuation
                        && !note.is_grace
                        && note.start_tick.value() >= bar_start
                        && note.start_tick.value() < bar_end
                })
                .count() as u32
        })
        .sum()
}

/// Derive ticks-per-measure from the time signature active at the start of the given measure.
fn ticks_per_measure_at(score: &Score, measure_index: usize) -> u32 {
    // Estimate the tick at the start of this measure using measure_end_ticks
    let tick_at_start = if measure_index == 0 {
        0u32
    } else {
        score.measure_end_ticks[measure_index - 1]
    };

    if let Some(ts) = score.get_time_signature_at(Tick::new(tick_at_start)) {
        let numerator = ts.numerator as u32;
        let denominator = ts.denominator as u32;
        if denominator == 0 {
            return 0;
        }
        // ticks_per_measure = (numerator / denominator) * 4 * PPQ
        // e.g. 4/4 → (4/4)*4*960 = 3840; 3/4 → (3/4)*4*960 = 2880
        (numerator * 4 * 960) / denominator
    } else {
        // Fallback: 4/4 time
        3840
    }
}
