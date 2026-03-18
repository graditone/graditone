//! Staff lines and system assembly
//!
//! Creates the five staff lines for each staff, renders measure number
//! annotations and volta brackets, and expands system bounding boxes
//! to accommodate stems, beams, and other overhanging elements.

use crate::layout::types::StaffLine;

/// Create staff lines for a single staff
pub(crate) fn create_staff_lines(
    staff_vertical_offset: f32,
    system_width: f32,
    units_per_space: f32,
) -> [StaffLine; 5] {
    // Create 5 evenly spaced lines (1 staff space apart)
    // A notehead fills exactly this gap, matching standard engraving
    let mut lines = Vec::new();
    for line_index in 0..5 {
        let y_position = staff_vertical_offset + (line_index as f32 * units_per_space);
        lines.push(StaffLine {
            y_position,
            start_x: 0.0,
            end_x: system_width,
        });
    }

    // Convert Vec to array (guaranteed to have exactly 5 elements)
    lines.try_into().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// T011: Unit test for create_staff_lines() verifying 5 lines with 20-unit spacing
    #[test]
    fn test_create_staff_lines_spacing() {
        let units_per_space = 20.0;
        let system_width = 1200.0;

        let lines = create_staff_lines(0.0, system_width, units_per_space);

        // Verify exactly 5 lines
        assert_eq!(lines.len(), 5, "Should have exactly 5 staff lines");

        // Verify y-positions with 20-unit spacing (1 * units_per_space)
        assert_eq!(lines[0].y_position, 0.0, "Line 0 should be at y=0");
        assert_eq!(lines[1].y_position, 20.0, "Line 1 should be at y=20");
        assert_eq!(lines[2].y_position, 40.0, "Line 2 should be at y=40");
        assert_eq!(lines[3].y_position, 60.0, "Line 3 should be at y=60");
        assert_eq!(lines[4].y_position, 80.0, "Line 4 should be at y=80");

        // Verify all lines span full system width
        for (i, line) in lines.iter().enumerate() {
            assert_eq!(line.start_x, 0.0, "Line {} should start at x=0", i);
            assert_eq!(
                line.end_x, system_width,
                "Line {} should end at system_width",
                i
            );
        }
    }

    /// T011: Unit test for multi-staff layout with correct vertical offsetting
    #[test]
    fn test_create_staff_lines_multi_staff() {
        let units_per_space = 20.0;
        let system_width = 1200.0;

        // First staff at vertical offset 0
        let staff_0 = create_staff_lines(0.0, system_width, units_per_space);
        assert_eq!(staff_0[0].y_position, 0.0);
        assert_eq!(staff_0[4].y_position, 80.0);

        // Second staff - offset by 20 staff spaces (400 units)
        let expected_offset = 20.0 * units_per_space; // 400 units
        let staff_1 = create_staff_lines(expected_offset, system_width, units_per_space);
        assert_eq!(staff_1[0].y_position, expected_offset);
        assert_eq!(staff_1[4].y_position, expected_offset + 80.0);
    }

    /// T011: Unit test for different units_per_space values
    #[test]
    fn test_create_staff_lines_scale_independence() {
        let system_width = 1200.0;

        // Test with different scale (units_per_space = 10)
        let lines_scale_10 = create_staff_lines(0.0, system_width, 10.0);
        assert_eq!(lines_scale_10[0].y_position, 0.0);
        assert_eq!(lines_scale_10[1].y_position, 10.0); // 1 * 10
        assert_eq!(lines_scale_10[4].y_position, 40.0); // 4 * 10

        // Test with different scale (units_per_space = 25)
        let lines_scale_25 = create_staff_lines(0.0, system_width, 25.0);
        assert_eq!(lines_scale_25[0].y_position, 0.0);
        assert_eq!(lines_scale_25[1].y_position, 25.0); // 1 * 25
        assert_eq!(lines_scale_25[4].y_position, 100.0); // 4 * 25
    }
}
