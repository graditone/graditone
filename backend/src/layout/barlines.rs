//! Barline rendering
//!
//! Creates barlines at measure boundaries, generates barline segment
//! geometry (single, double, final, repeat), computes repeat dot
//! positions, and handles system-end and multi-staff barline joining.

use std::collections::HashMap;

use crate::layout::breaker;
use crate::layout::types::{
    BarLine, BarLineSegment, BarLineType, RepeatDotPosition, StaffGroup, TickRange,
};

/// Create bar lines for a single staff at measure boundaries
#[allow(clippy::too_many_arguments)]
pub(crate) fn create_bar_lines(
    measure_infos: &[breaker::MeasureInfo],
    tick_range: &TickRange,
    staff_vertical_offset: f32,
    left_margin: f32,
    _system_width: f32,
    units_per_space: f32,
    note_positions: &HashMap<u32, f32>,
    measure_x_bounds: &HashMap<u32, (f32, f32)>,
) -> Vec<BarLine> {
    let mut bar_lines = Vec::new();

    // Y positions for top and bottom staff lines
    let y_start = staff_vertical_offset; // Top line (line 0)
    let y_end = staff_vertical_offset + (4.0 * units_per_space); // Bottom line (line 4)

    // Find measures that overlap with this system's tick range
    let measures_in_system: Vec<&breaker::MeasureInfo> = measure_infos
        .iter()
        .filter(|m| m.start_tick < tick_range.end_tick && m.end_tick > tick_range.start_tick)
        .collect();

    if measures_in_system.is_empty() {
        return bar_lines;
    }

    // Add bar lines at the end of each measure.
    // Use the measure's end boundary from measure_x_bounds (which are already
    // justified/aligned) so barlines appear at the correct position between
    // the last note of one measure and the first note of the next.
    for measure in measures_in_system.iter() {
        // Skip barline if measure ends at or beyond the system boundary.
        // The system-end barline post-processing step handles the closing
        // barline at the justified edge, so we must not create a duplicate
        // that would leave an empty gap before the system edge.
        if measure.end_tick >= tick_range.end_tick {
            continue;
        }

        // Place barline at the midpoint between the last note of this measure
        // and the first note of the next, ensuring equal visual clearance on
        // both sides.  Fall back to a fixed offset when a side has no notes
        // (empty measures or last measure in the system).
        let last_x_in_measure = note_positions
            .iter()
            .filter(|(tick, _)| **tick >= measure.start_tick && **tick < measure.end_tick)
            .max_by_key(|(tick, _)| *tick)
            .map(|(_, &x)| x);
        let first_x_in_next = note_positions
            .iter()
            .filter(|(tick, _)| **tick >= measure.end_tick && **tick < tick_range.end_tick)
            .min_by_key(|(tick, _)| *tick)
            .map(|(_, &x)| x);
        let barline_x = match (last_x_in_measure, first_x_in_next) {
            (Some(last_x), Some(next_x)) if next_x > last_x => (last_x + next_x) * 0.5,
            (Some(last_x), _) => last_x + 30.0,
            _ => measure_x_bounds
                .get(&measure.start_tick)
                .map(|(_, end_x)| *end_x)
                .unwrap_or(left_margin + 30.0),
        };

        // Determine bar line type
        let bar_type = {
            // Check repeat flags for this measure and the one that starts next
            let next_start_repeat = measure_infos
                .iter()
                .find(|m| m.start_tick == measure.end_tick)
                .map(|m| m.start_repeat)
                .unwrap_or(false);

            if measure.end_repeat && next_start_repeat {
                BarLineType::RepeatBoth
            } else if measure.end_repeat {
                BarLineType::RepeatEnd
            } else if next_start_repeat {
                BarLineType::RepeatStart
            } else if measure.end_tick == tick_range.end_tick {
                // Check if this is the very last measure in the entire score
                let is_last_measure =
                    measure_infos.last().map(|m| m.end_tick) == Some(measure.end_tick);
                if is_last_measure {
                    BarLineType::Final
                } else {
                    BarLineType::Single
                }
            } else {
                BarLineType::Single
            }
        };

        // Create bar line segments with explicit geometry (Principle VI: Layout Engine Authority)
        let segments = create_bar_line_segments(barline_x, y_start, y_end, &bar_type);
        let dots = compute_repeat_dots(barline_x, y_start, units_per_space, &bar_type);

        bar_lines.push(BarLine {
            segments,
            bar_type,
            dots,
        });
    }

    bar_lines
}

/// Creates bar line segments with explicit geometry for each line
/// This ensures the renderer doesn't calculate positions (Principle VI compliance)
pub(crate) fn create_bar_line_segments(
    x_position: f32,
    y_start: f32,
    y_end: f32,
    bar_type: &BarLineType,
) -> Vec<BarLineSegment> {
    const THIN_WIDTH: f32 = 1.5;
    const THICK_WIDTH: f32 = 4.0;
    const DOUBLE_SPACING: f32 = 4.0; // Space between double bar lines
    const FINAL_SPACING: f32 = 4.0; // Space between thin and thick in final bar

    match bar_type {
        BarLineType::Single => {
            vec![BarLineSegment {
                x_position,
                y_start,
                y_end,
                stroke_width: THIN_WIDTH,
            }]
        }
        BarLineType::Double => {
            vec![
                BarLineSegment {
                    x_position: x_position - DOUBLE_SPACING / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + DOUBLE_SPACING / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
        BarLineType::Final => {
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
            ]
        }
        BarLineType::RepeatEnd => {
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
            ]
        }
        BarLineType::RepeatStart => {
            vec![
                BarLineSegment {
                    x_position: x_position - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + FINAL_SPACING + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
        BarLineType::RepeatBoth => {
            vec![
                BarLineSegment {
                    x_position: x_position - FINAL_SPACING - THICK_WIDTH,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position - THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + THICK_WIDTH / 2.0,
                    y_start,
                    y_end,
                    stroke_width: THICK_WIDTH,
                },
                BarLineSegment {
                    x_position: x_position + FINAL_SPACING + THICK_WIDTH,
                    y_start,
                    y_end,
                    stroke_width: THIN_WIDTH,
                },
            ]
        }
    }
}

/// Compute repeat dot positions for repeat barline types (Principle VI: Layout Engine Authority)
pub(crate) fn compute_repeat_dots(
    x_position: f32,
    y_start: f32,
    units_per_space: f32,
    bar_type: &BarLineType,
) -> Vec<RepeatDotPosition> {
    const THICK_WIDTH: f32 = 4.0;
    let dot_radius = 0.25 * units_per_space;
    let x_offset = 0.6 * units_per_space;
    let dot_y0 = y_start + 1.0 * units_per_space;
    let dot_y1 = y_start + 3.0 * units_per_space;

    match bar_type {
        BarLineType::RepeatEnd => {
            let dot_x = x_position + THICK_WIDTH / 2.0 - x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        BarLineType::RepeatStart => {
            let dot_x = x_position - THICK_WIDTH / 2.0 + x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        BarLineType::RepeatBoth => {
            let dot_x_left = x_position - THICK_WIDTH / 2.0 - x_offset;
            let dot_x_right = x_position + THICK_WIDTH / 2.0 + x_offset;
            vec![
                RepeatDotPosition {
                    x: dot_x_left,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_left,
                    y: dot_y1,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_right,
                    y: dot_y0,
                    radius: dot_radius,
                },
                RepeatDotPosition {
                    x: dot_x_right,
                    y: dot_y1,
                    radius: dot_radius,
                },
            ]
        }
        _ => vec![],
    }
}

/// Add a system-end barline at the justified right edge for every staff group.
///
/// For multi-staff groups the barline spans the full group height; for
/// single-staff groups it spans that staff.  The barline type reflects the
/// last measure in this system (Final for the score's last measure, repeat
/// types if applicable, Single otherwise).
pub(crate) fn render_system_barlines(
    staff_groups: &mut [StaffGroup],
    measure_infos: &[breaker::MeasureInfo],
    system_end_tick: u32,
    content_width: f32,
    units_per_space: f32,
) {
    let end_bar_type = {
        let last_measure = measure_infos
            .iter()
            .rfind(|m| m.end_tick == system_end_tick);
        match last_measure {
            Some(m) => {
                let next_start_repeat = measure_infos
                    .iter()
                    .find(|mi| mi.start_tick == m.end_tick)
                    .map(|mi| mi.start_repeat)
                    .unwrap_or(false);
                if m.end_repeat && next_start_repeat {
                    BarLineType::RepeatBoth
                } else if m.end_repeat {
                    BarLineType::RepeatEnd
                } else if next_start_repeat {
                    BarLineType::RepeatStart
                } else {
                    let is_last = measure_infos.last().map(|mi| mi.end_tick) == Some(m.end_tick);
                    if is_last {
                        BarLineType::Final
                    } else {
                        BarLineType::Single
                    }
                }
            }
            None => BarLineType::Single,
        }
    };
    for staff_group in staff_groups.iter_mut() {
        let top_y = staff_group.staves.first().unwrap().staff_lines[0].y_position;
        let bottom_y = staff_group.staves.last().unwrap().staff_lines[4].y_position;
        let segments = create_bar_line_segments(content_width, top_y, bottom_y, &end_bar_type);
        let dots = compute_repeat_dots(content_width, top_y, units_per_space, &end_bar_type);
        let mut all_dots = dots;
        if staff_group.staves.len() >= 2 {
            for staff in &staff_group.staves[1..] {
                let staff_top = staff.staff_lines[0].y_position;
                all_dots.extend(compute_repeat_dots(
                    content_width,
                    staff_top,
                    units_per_space,
                    &end_bar_type,
                ));
            }
        }
        let end_barline = BarLine {
            segments,
            bar_type: end_bar_type,
            dots: all_dots,
        };
        staff_group.staves[0].bar_lines.push(end_barline);
    }
}
