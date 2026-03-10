//! Horizontal spacing algorithm
//!
//! Implements duration-proportional spacing with minimum separation constraint.
//! Uses sqrt-based scaling (standard in music engraving) so shorter notes
//! receive proportionally more space, preventing accidental/flag overlap.

/// Configuration for horizontal spacing algorithm
#[derive(Debug, Clone)]
pub struct SpacingConfig {
    /// Base space for any note in logical units (default: 60.0 = 3 staff spaces)
    pub base_spacing: f32,
    /// Multiplier for duration-based spacing (default: 60.0)
    pub duration_factor: f32,
    /// Collision prevention minimum in logical units (default: 60.0 = 3 staff spaces)
    pub minimum_spacing: f32,
}

impl Default for SpacingConfig {
    fn default() -> Self {
        Self {
            base_spacing: 40.0,
            duration_factor: 40.0,
            minimum_spacing: 40.0,
        }
    }
}

/// Compute horizontal spacing for a note based on duration
///
/// Uses formula: `spacing_width = max(base + sqrt(duration/960) * factor, minimum)`
///
/// The sqrt function matches traditional music engraving practice (Gould, Ross):
/// shorter notes get proportionally more space than a linear mapping would give,
/// preventing flag and accidental collisions while keeping longer notes compact.
///
/// # Arguments
/// * `duration_ticks` - Note duration in ticks (960 = quarter note at 960 PPQ)
/// * `config` - Spacing configuration parameters
///
/// # Returns
/// Horizontal spacing width in logical units
pub fn compute_note_spacing(duration_ticks: u32, config: &SpacingConfig) -> f32 {
    let duration_based =
        config.base_spacing + (duration_ticks as f32 / 960.0).sqrt() * config.duration_factor;
    duration_based.max(config.minimum_spacing)
}

/// Compute total width of a measure
///
/// Sums spacing for all note and rest events in the measure plus padding for clefs/accidentals.
/// Adds additional width for flagged notes to prevent flag overlap while maintaining
/// time-proportional spacing between notes and rests.
///
/// # Arguments
/// * `note_durations` - Array of note durations in ticks for all note events in measure
/// * `rest_durations` - Array of rest durations in ticks for all rest events in measure
/// * `config` - Spacing configuration parameters
///
/// # Returns
/// Total measure width in logical units
pub fn compute_measure_width(
    note_durations: &[u32],
    rest_durations: &[u32],
    config: &SpacingConfig,
) -> f32 {
    if note_durations.is_empty() && rest_durations.is_empty() {
        // Empty measure: return default minimum width
        return 200.0;
    }

    // Sum spacing for all notes (maintains time-proportional spacing)
    let total_note_spacing: f32 = note_durations
        .iter()
        .chain(rest_durations.iter())
        .map(|&duration| compute_note_spacing(duration, config))
        .sum();

    // Count flagged notes for visual density adjustment (rests don't have flags)
    let flagged_note_count = note_durations
        .iter()
        .filter(|&&duration| duration < 960) // Eighth notes and shorter have flags
        .count();

    // Add extra measure width for flag clearance (5 units per flagged note)
    // This expands the entire measure while preserving note spacing proportions
    let flag_padding = (flagged_note_count as f32) * 5.0;

    // Add padding for clef/key/time signatures at measure start (20 logical units)
    // and end barline (10 logical units)
    let structural_padding = 30.0;

    total_note_spacing + flag_padding + structural_padding
}

/// Compute rightmost content position for a system
///
/// Finds the maximum x position among all barlines to determine
/// where staff lines should end.
pub fn compute_system_content_width(measure_widths: &[f32], left_margin: f32) -> f32 {
    if measure_widths.is_empty() {
        return left_margin + 100.0;
    }

    // Sum all measure widths to get rightmost position
    let total_width: f32 = measure_widths.iter().sum();
    left_margin + total_width
}
