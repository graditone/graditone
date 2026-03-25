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

    score
        .instruments
        .iter()
        .filter_map(|instrument| compute_instrument_difficulty(score, instrument, measure_count))
        .max_by(|a, b| a.density_rate.partial_cmp(&b.density_rate).unwrap())
}

fn compute_instrument_difficulty(
    score: &Score,
    instrument: &Instrument,
    measure_count: usize,
) -> Option<DifficultyRating> {
    let mut bar_densities: Vec<f64> = Vec::with_capacity(measure_count);
    let mut bar_polyphonies: Vec<(f64, f64)> = Vec::with_capacity(measure_count); // (avg, max) per bar

    for measure_index in 0..measure_count {
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

        let pitch_count = count_pitches_in_bar(instrument, bar_start, bar_end);
        bar_densities.push(pitch_count as f64 / bar_duration_beats);

        // Polyphony: sample at each note onset in the bar
        let (avg_poly, max_poly) = compute_bar_polyphony(instrument, bar_start, bar_end);
        bar_polyphonies.push((avg_poly, max_poly));
    }

    if bar_densities.is_empty() {
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
fn compute_bar_polyphony(instrument: &Instrument, bar_start: u32, bar_end: u32) -> (f64, f64) {
    // Collect all sounding intervals (start, end) across all staves/voices, max per staff
    // Use per-staff max to match the density counting approach (hardest single hand)
    let best_staff = instrument
        .staves
        .iter()
        .map(|staff| {
            let intervals: Vec<(u32, u32)> = staff
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
                .collect();
            intervals
        })
        .max_by_key(|intervals| intervals.len())
        .unwrap_or_default();

    if best_staff.is_empty() {
        return (0.0, 0.0);
    }

    // Collect unique onset ticks as sample points
    let mut onset_ticks: Vec<u32> = best_staff.iter().map(|&(s, _)| s).collect();
    onset_ticks.sort_unstable();
    onset_ticks.dedup();

    if onset_ticks.is_empty() {
        return (0.0, 0.0);
    }

    let mut total_poly = 0u32;
    let mut max_poly = 0u32;

    for &t in &onset_ticks {
        let poly = best_staff.iter().filter(|&&(s, e)| s <= t && t < e).count() as u32;
        total_poly += poly;
        if poly > max_poly {
            max_poly = poly;
        }
    }

    let avg_poly = total_poly as f64 / onset_ticks.len() as f64;
    (avg_poly, max_poly as f64)
}

/// Count individual sounding pitches in a bar range per staff, returning the
/// maximum across staves (i.e. the hardest single hand). Excludes tied
/// continuations and grace notes.
fn count_pitches_in_bar(instrument: &Instrument, bar_start: u32, bar_end: u32) -> u32 {
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
        .max()
        .unwrap_or(0)
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
