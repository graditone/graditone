//! Multi-staff layout and collision handling
//!
//! Manages inter-staff collision detection, vertical spacing adjustments,
//! bracket/brace glyph generation, and staff group assembly for
//! multi-instrument and grand-staff layouts.

use std::collections::HashMap;

use crate::layout::types::{
    BoundingBox, BracketGlyph, BracketType, LayoutConfig, RepeatDotPosition, Staff, StaffGroup,
};

/// Compute cumulative collision-avoidance extra spacing per staff.
///
/// Returns `(cumulative_collision_extra, total_collision_extra)` where
/// `cumulative_collision_extra[i]` is the total extra spacing accumulated
/// up to and including staff `i`, and `total_collision_extra` is the
/// grand total across all staves.
pub(crate) fn compute_collision_gaps(
    staff_extents: &[(f32, f32)],
    has_inter_gap_before: &[bool],
    intra_staff_multiplier: f32,
    inter_instrument_multiplier: f32,
    units_per_space: f32,
) -> (Vec<f32>, f32) {
    let min_clearance = 2.0 * units_per_space;
    let mut cumulative: Vec<f32> = vec![0.0; staff_extents.len()];
    for i in 0..staff_extents.len().saturating_sub(1) {
        let (_, max_y_upper) = staff_extents[i];
        let (min_y_lower, _) = staff_extents[i + 1];

        let mut pair_spacing = intra_staff_multiplier * units_per_space;
        if has_inter_gap_before[i + 1] {
            pair_spacing += inter_instrument_multiplier * units_per_space;
        }

        let needed = max_y_upper - min_y_lower + min_clearance;
        let extra = (needed - pair_spacing).max(0.0);
        cumulative[i + 1] = cumulative[i] + extra;
    }
    let total = cumulative.last().copied().unwrap_or(0.0);
    (cumulative, total)
}

/// Creates bracket/brace glyph with calculated geometry for multi-staff groups
pub(crate) fn create_bracket_glyph(
    staves: &[Staff],
    bracket_type: &BracketType,
    _config: &LayoutConfig,
) -> BracketGlyph {
    let first_staff = &staves[0];
    let last_staff = &staves[staves.len() - 1];

    // Span from top of first staff to bottom of last staff
    let top_y = first_staff.staff_lines[0].y_position;
    let bottom_y = last_staff.staff_lines[4].y_position;
    let height = bottom_y - top_y;
    let _center_y = (top_y + bottom_y) / 2.0;

    // Scale glyph to match actual bracket height
    const BRACE_NATURAL_HEIGHT: f32 = 320.0; // SMuFL brace U+E000 at fontSize 80
    let scale_y = height / BRACE_NATURAL_HEIGHT;

    let codepoint = match bracket_type {
        BracketType::Brace => "\u{E000}".to_string(),
        BracketType::Bracket => "\u{E002}".to_string(),
        BracketType::None => String::new(),
    };

    let x_position = 5.0; // Left margin

    BracketGlyph {
        codepoint,
        x: x_position,
        // Feature 027 (T034): Use top_y (top anchor) instead of center_y.
        // SMuFL brace U+E000 is rendered with dominant-baseline="hanging" in the
        // frontend, anchoring the glyph top to this y coordinate. Using center_y
        // caused the brace to appear shifted down by half its height.
        y: top_y,
        scale_y,
        bounding_box: BoundingBox {
            x: x_position - 5.0,
            y: top_y,
            width: 20.0,
            height,
        },
    }
}

/// Join measure barlines within each multi-staff group.
///
/// Standard engraving: internal barlines span from the top line of the
/// first staff to the bottom line of the last staff in the group.
/// We adjust the y_start/y_end of each barline segment on staves[0] to
/// cover the full group height, collect repeat dots from all staves onto
/// staves[0], then clear barlines from staves[1..].
pub(crate) fn join_multi_staff_barlines(staff_groups: &mut [StaffGroup]) {
    for staff_group in staff_groups.iter_mut() {
        if staff_group.staves.len() >= 2 {
            let top_y = staff_group.staves[0].staff_lines[0].y_position;
            let bottom_y = staff_group.staves.last().unwrap().staff_lines[4].y_position;

            // Collect repeat dots from subsequent staves, keyed by barline X
            // so they can be merged onto the matching barline on staves[0].
            let mut extra_dots: HashMap<i32, Vec<RepeatDotPosition>> = HashMap::new();
            for staff in staff_group.staves[1..].iter() {
                for bar_line in &staff.bar_lines {
                    if bar_line.dots.is_empty() {
                        continue;
                    }
                    let x_key = bar_line
                        .segments
                        .first()
                        .map(|s| (s.x_position * 10.0) as i32)
                        .unwrap_or(0);
                    extra_dots
                        .entry(x_key)
                        .or_default()
                        .extend_from_slice(&bar_line.dots);
                }
            }

            // Extend staves[0] barlines to span the full group height.
            for bar_line in &mut staff_group.staves[0].bar_lines {
                for segment in &mut bar_line.segments {
                    segment.y_start = top_y;
                    segment.y_end = bottom_y;
                }
                let x_key = bar_line
                    .segments
                    .first()
                    .map(|s| (s.x_position * 10.0) as i32)
                    .unwrap_or(0);
                if let Some(more_dots) = extra_dots.remove(&x_key) {
                    bar_line.dots.extend(more_dots);
                }
            }

            // Remove barlines from subsequent staves (merged into staves[0]).
            for staff in staff_group.staves[1..].iter_mut() {
                staff.bar_lines.clear();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::layout::assembly;

    /// T064: Unit test for brace/bracket positioning and vertical scaling
    #[test]
    fn test_create_bracket_glyph_brace() {
        let config = LayoutConfig::default();

        // Create two dummy staves at different vertical positions
        let staff_0_lines = assembly::create_staff_lines(0.0, 1200.0, config.units_per_space);
        let staff_1_offset = 14.0 * config.units_per_space;
        let staff_1_lines =
            assembly::create_staff_lines(staff_1_offset, 1200.0, config.units_per_space);

        let staff_0 = Staff {
            staff_lines: staff_0_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
            notation_dots: vec![],
            tie_arcs: vec![],
            slur_arcs: vec![],
            fingering_glyphs: vec![],
        };

        let staff_1 = Staff {
            staff_lines: staff_1_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
            notation_dots: vec![],
            tie_arcs: vec![],
            slur_arcs: vec![],
            fingering_glyphs: vec![],
        };

        let staves = vec![staff_0, staff_1];
        let bracket_type = BracketType::Brace;

        let bracket_glyph = create_bracket_glyph(&staves, &bracket_type, &config);

        // Verify brace codepoint
        assert_eq!(
            bracket_glyph.codepoint, "\u{E000}",
            "Brace should use SMuFL codepoint U+E000"
        );

        // Verify x position (left margin)
        assert_eq!(bracket_glyph.x, 5.0, "Brace should be at x=5");

        // Verify vertical scaling is applied
        assert!(
            bracket_glyph.scale_y > 0.0,
            "Brace should have positive vertical scale"
        );

        // Verify bounding box spans both staves
        let first_staff_top = staves[0].staff_lines[0].y_position;
        let last_staff_bottom = staves[1].staff_lines[4].y_position;

        // Brace should extend to cover both staves
        assert!(
            bracket_glyph.bounding_box.y <= first_staff_top,
            "Brace bounding box should start at or above first staff"
        );
        assert!(
            bracket_glyph.bounding_box.y + bracket_glyph.bounding_box.height >= last_staff_bottom,
            "Brace bounding box should extend to or below last staff"
        );
    }

    /// T064: Unit test for square bracket positioning (ensemble scores)
    #[test]
    fn test_create_bracket_glyph_bracket() {
        let config = LayoutConfig::default();

        let staff_0_lines = assembly::create_staff_lines(0.0, 1200.0, config.units_per_space);
        let staff_1_offset = 14.0 * config.units_per_space;
        let staff_1_lines =
            assembly::create_staff_lines(staff_1_offset, 1200.0, config.units_per_space);

        let staff_0 = Staff {
            staff_lines: staff_0_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
            notation_dots: vec![],
            tie_arcs: vec![],
            slur_arcs: vec![],
            fingering_glyphs: vec![],
        };

        let staff_1 = Staff {
            staff_lines: staff_1_lines,
            glyph_runs: vec![],
            structural_glyphs: vec![],
            bar_lines: vec![],
            ledger_lines: vec![],
            notation_dots: vec![],
            tie_arcs: vec![],
            slur_arcs: vec![],
            fingering_glyphs: vec![],
        };

        let staves = vec![staff_0, staff_1];
        let bracket_type = BracketType::Bracket;

        let bracket_glyph = create_bracket_glyph(&staves, &bracket_type, &config);

        // Verify bracket codepoint
        assert_eq!(
            bracket_glyph.codepoint, "\u{E002}",
            "Bracket should use SMuFL codepoint U+E002"
        );
    }
}
