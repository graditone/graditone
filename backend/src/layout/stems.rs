//! Stem Module
//!
//! Handles stem direction calculation and stem geometry generation for noteheads.
//! Stems extend 70 logical units (3.5 staff spaces) from the notehead.
//!
//! Direction rules:
//! - Notes on or above middle line (B4 for treble): stem down
//! - Notes below middle line: stem up
//! - Stems up attach to right side of notehead
//! - Stems down attach to left side of notehead

use serde::{Deserialize, Serialize};

/// Stem direction relative to notehead
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StemDirection {
    Up,
    Down,
}

/// Stem geometry representation
///
/// Encoded as special glyph with codepoint U+0000 for rendering pipeline.
/// The stem is a vertical line from notehead to stem end.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stem {
    /// X position (center of stem line)
    pub x: f32,
    /// Y position of stem start (at notehead)
    pub y_start: f32,
    /// Y position of stem end (70 units away)
    pub y_end: f32,
    /// Stem direction (Up or Down)
    pub direction: StemDirection,
    /// Line thickness in logical units
    pub thickness: f32,
}

impl Stem {
    /// Standard stem length in logical units (3.5 staff spaces = 70 units at ups=20)
    pub const STEM_LENGTH: f32 = 70.0;

    /// Standard stem thickness in logical units
    pub const STEM_THICKNESS: f32 = 1.5;

    /// Half-width of rendered noteheadBlack (U+E0A4) — distance from center to edge.
    /// Bravura bBoxNE[0] = 1.18 staff spaces. At font-size 80 (1 staff space = 20 units),
    /// full width = 1.18 * 20 = 23.6. With text-anchor=middle rendering, the center
    /// of the glyph is at the X coordinate, so half-width = 23.6 / 2 = 11.8.
    pub const NOTEHEAD_WIDTH: f32 = 11.8;

    /// Minimum stem length for beamed notes (2.5 staff spaces = 50 logical units)
    pub const MIN_BEAMED_STEM_LENGTH: f32 = 50.0;

    /// Minimum stem length for notes on ledger lines (3.0 staff spaces = 60 logical units)
    pub const MIN_LEDGER_STEM_LENGTH: f32 = 60.0;
}

/// Compute stem direction based on notehead pitch position
///
/// # Arguments
/// * `notehead_y` - Vertical position of notehead in logical units
/// * `staff_middle_y` - Vertical position of staff middle line (B4 for treble, D3 for bass)
///
/// # Returns
/// StemDirection::Up if note below middle, StemDirection::Down if on or above middle
///
/// # Rules (SMuFL standard)
/// - Middle line or above (smaller or equal y in screen coords) → stem down
/// - Below middle line (larger y in screen coords) → stem up
///
/// In positive-Y-down screen coordinates:
/// - Smaller y = visually higher on the staff = above middle → stem down
/// - Larger y = visually lower on the staff = below middle → stem up
pub fn compute_stem_direction(notehead_y: f32, staff_middle_y: f32) -> StemDirection {
    if notehead_y <= staff_middle_y {
        StemDirection::Down // on or above middle line → stem down (toward center)
    } else {
        StemDirection::Up // below middle line → stem up (toward center)
    }
}

/// Create stem geometry for a notehead
///
/// # Arguments
/// * `notehead_x` - Horizontal position of notehead center
/// * `notehead_y` - Vertical position of notehead center
/// * `direction` - Stem direction (computed from pitch)
/// * `notehead_width` - Width of notehead glyph (for attachment point calculation)
///
/// # Returns
/// Stem struct with calculated geometry
///
/// # Attachment Logic
/// SMuFL noteheads have their origin at the left edge of the glyph.
/// - Stems up: attach to right edge of notehead (x + width)
/// - Stems down: attach to left edge of notehead (x)
/// - Stem extends 70 logical units (3.5 staff spaces) from notehead
pub fn create_stem(
    notehead_x: f32,
    notehead_y: f32,
    direction: StemDirection,
    notehead_width: f32,
) -> Stem {
    // Calculate stem x position based on direction.
    // Frontend renders noteheads with text-anchor=middle, so the glyph center is at X.
    // notehead_width = half the rendered glyph width (center-to-edge distance).
    // - Up stems attach at right edge: center + half_width
    // - Down stems attach at left edge: center - half_width
    let stem_x = match direction {
        StemDirection::Up => notehead_x + notehead_width,
        StemDirection::Down => notehead_x - notehead_width,
    };

    // Calculate stem y positions (stems go up = negative y, down = positive y)
    let (y_start, y_end) = match direction {
        StemDirection::Up => (notehead_y, notehead_y - Stem::STEM_LENGTH),
        StemDirection::Down => (notehead_y, notehead_y + Stem::STEM_LENGTH),
    };

    Stem {
        x: stem_x,
        y_start,
        y_end,
        direction,
        thickness: Stem::STEM_THICKNESS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// T041: Unit test for compute_stem_direction() based on pitch relative to middle line
    #[test]
    fn test_compute_stem_direction_above_middle() {
        let staff_middle_y = 80.0; // Middle line of staff

        // Note above middle line (y=60 < 80 in screen coords) → stem down
        let notehead_y = 60.0;
        assert_eq!(
            compute_stem_direction(notehead_y, staff_middle_y),
            StemDirection::Down,
            "Notes above middle line should have stem down"
        );
    }

    #[test]
    fn test_compute_stem_direction_on_middle() {
        let staff_middle_y = 80.0;

        // Note on middle line (e.g., B4 for treble) should have stem down
        let notehead_y = 80.0;
        assert_eq!(
            compute_stem_direction(notehead_y, staff_middle_y),
            StemDirection::Down,
            "Notes on middle line should have stem down"
        );
    }

    #[test]
    fn test_compute_stem_direction_below_middle() {
        let staff_middle_y = 80.0;

        // Note below middle line (y=90 > 80 in screen coords) → stem up
        let notehead_y = 90.0;
        assert_eq!(
            compute_stem_direction(notehead_y, staff_middle_y),
            StemDirection::Up,
            "Notes below middle line should have stem up"
        );
    }

    /// T042: Unit test for create_stem() verifying 35 logical unit length and attachment point
    #[test]
    fn test_create_stem_up() {
        let notehead_x = 100.0;
        let notehead_y = 60.0;
        let notehead_width = 11.8;
        let direction = StemDirection::Up;

        let stem = create_stem(notehead_x, notehead_y, direction, notehead_width);

        // Verify stem attaches to right edge of notehead (center + half_width with text-anchor=middle)
        assert!(
            (stem.x - 111.8).abs() < 0.01,
            "Stem up should attach to right edge (x + half_width), got {}",
            stem.x
        );

        // Verify stem extends 70 units upward (negative y direction)
        assert_eq!(stem.y_start, 60.0, "Stem should start at notehead y");
        assert_eq!(
            stem.y_end, -10.0,
            "Stem should extend 70 units up (60 - 70)"
        );

        assert_eq!(stem.direction, StemDirection::Up);
        assert_eq!(stem.thickness, Stem::STEM_THICKNESS);
    }

    #[test]
    fn test_create_stem_down() {
        let notehead_x = 100.0;
        let notehead_y = 100.0;
        let notehead_width = 11.8;
        let direction = StemDirection::Down;

        let stem = create_stem(notehead_x, notehead_y, direction, notehead_width);

        // Verify stem attaches to left edge of notehead (center - half_width with text-anchor=middle)
        assert!(
            (stem.x - 88.2).abs() < 0.01,
            "Stem down should attach to left edge (x - half_width), got {}",
            stem.x
        );

        // Verify stem extends 70 units downward (positive y direction)
        assert_eq!(stem.y_start, 100.0, "Stem should start at notehead y");
        assert_eq!(
            stem.y_end, 170.0,
            "Stem should extend 70 units down (100 + 70)"
        );

        assert_eq!(stem.direction, StemDirection::Down);
        assert_eq!(stem.thickness, Stem::STEM_THICKNESS);
    }

    #[test]
    fn test_stem_length_constant() {
        assert_eq!(
            Stem::STEM_LENGTH,
            70.0,
            "Stem length should be 70 logical units (3.5 staff spaces at ups=20)"
        );
    }

    /// T020: Regression test — stem length must meet the 3.5 staff space standard.
    ///
    /// At units_per_space=20, standard engraving requires stems of 3.5 sp = 70 logical units
    /// (Gould §3; Musescore default behaviour). STEM_LENGTH=35 is 1.75 sp — half the standard.
    ///
    /// This test FAILS before T021 (STEM_LENGTH=35.0 < 70.0).
    /// This test PASSES after T021 (STEM_LENGTH=70.0 ≥ 70.0).
    #[test]
    fn test_stem_length_standard_note() {
        assert!(
            Stem::STEM_LENGTH >= 70.0,
            "STEM_LENGTH must be ≥ 70.0 units (3.5 sp at ups=20). \
             Current value {} is {} staff spaces — half the engraving standard. \
             Fix: change STEM_LENGTH to 70.0 in stems.rs",
            Stem::STEM_LENGTH,
            Stem::STEM_LENGTH / 20.0,
        );
    }
}
