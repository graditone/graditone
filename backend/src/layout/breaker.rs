//! System breaking algorithm
//!
//! Implements greedy measure-by-measure breaking at measure boundaries.

use crate::layout::types::{BoundingBox, System, TickRange};

/// Represents a measure with computed width and tick span
pub struct MeasureInfo {
    /// Width of measure in logical units
    pub width: f32,
    /// First tick in measure (inclusive)
    pub start_tick: u32,
    /// Last tick after measure (exclusive)
    pub end_tick: u32,
    /// True if this measure has a start-repeat barline on its left edge
    pub start_repeat: bool,
    /// True if this measure has an end-repeat barline on its right edge
    pub end_repeat: bool,
}

/// Break measures into systems using greedy algorithm
///
/// Starts new system when adding next measure would exceed max_width.
/// Single oversized measures get their own system.
///
/// # Arguments
/// * `measures` - Array of measures with computed widths and tick ranges
/// * `max_width` - Maximum system width in logical units
/// * `system_height` - Height of each system in logical units (for bounding box)
/// * `system_spacing` - Vertical spacing between systems in logical units
///
/// # Returns
/// Vector of systems with computed bounding boxes and tick ranges
pub fn break_into_systems(
    measures: &[MeasureInfo],
    max_width: f32,
    system_height: f32,
    system_spacing: f32,
) -> Vec<System> {
    if measures.is_empty() {
        return vec![];
    }

    let mut systems = Vec::new();
    let mut current_system_measures = Vec::new();
    let mut current_width = 0.0;

    for measure in measures {
        // Check if adding this measure would exceed max_width
        let would_exceed =
            !current_system_measures.is_empty() && current_width + measure.width > max_width;

        if would_exceed {
            // Finish current system — justify to max_width so all systems are equal width
            systems.push(create_system(
                systems.len(),
                &current_system_measures,
                max_width,
                system_height,
                system_spacing,
            ));

            // Start new system with current measure
            current_system_measures.clear();
            current_width = 0.0;
        }

        // Add measure to current system
        current_system_measures.push(measure);
        current_width += measure.width;

        // Handle oversized single measure case
        if current_width > max_width && current_system_measures.len() == 1 {
            // Force system with just this oversized measure
            systems.push(create_system(
                systems.len(),
                &current_system_measures,
                current_width,
                system_height,
                system_spacing,
            ));
            current_system_measures.clear();
            current_width = 0.0;
        }
    }

    // Add final system if measures remain — justify to max_width for equal-width systems
    if !current_system_measures.is_empty() {
        systems.push(create_system(
            systems.len(),
            &current_system_measures,
            max_width,
            system_height,
            system_spacing,
        ));
    }

    systems
}

/// Helper function to create a System from accumulated measures
fn create_system(
    index: usize,
    measures: &[&MeasureInfo],
    width: f32,
    height: f32,
    spacing: f32,
) -> System {
    // Compute tick range from first and last measures
    let start_tick = measures.first().unwrap().start_tick;
    let end_tick = measures.last().unwrap().end_tick;

    // Compute vertical position (y coordinate)
    let y_position = index as f32 * (height + spacing);

    System {
        index,
        bounding_box: BoundingBox {
            x: 0.0,
            y: y_position,
            width,
            height,
        },
        staff_groups: vec![], // Will be populated during layout computation
        tick_range: TickRange {
            start_tick,
            end_tick,
        },
        measure_number: None, // Will be computed during layout computation
        volta_bracket_layouts: vec![], // Will be populated during layout computation
    }
}
