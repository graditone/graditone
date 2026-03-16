//! Glyph Batching Module (User Story 3)
//!
//! Groups consecutive glyphs with identical drawing properties into GlyphRuns,
//! reducing Canvas draw calls from 800+ to <80 for typical scores.
//!
//! Batching algorithm:
//! 1. Sort glyphs by x-position (left-to-right drawing order)
//! 2. Group consecutive glyphs with matching font_family, font_size, color, opacity
//! 3. Start new run when properties change

use crate::layout::types::{Color, Glyph, GlyphRun};

/// Batch glyphs into runs with identical drawing properties
///
/// Takes a vector of glyphs and groups consecutive glyphs that share
/// font_family, font_size, color, and opacity into GlyphRuns.
///
/// # Arguments
/// * `glyphs` - Vector of positioned glyphs, will be sorted by x-position
///
/// # Returns
/// Vector of GlyphRuns, each containing consecutive glyphs with identical properties
///
/// # Example
/// ```ignore
/// let runs = batch_glyphs(vec![glyph1, glyph2, glyph3]);
/// // Results in 1 run if all glyphs have identical properties,
/// // or multiple runs if properties differ
/// ```
pub fn batch_glyphs(mut glyphs: Vec<Glyph>) -> Vec<GlyphRun> {
    if glyphs.is_empty() {
        return Vec::new();
    }

    // Sort glyphs by x-position for left-to-right drawing order
    glyphs.sort_by(|a, b| {
        a.position
            .x
            .partial_cmp(&b.position.x)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut runs = Vec::new();
    let mut current_run_glyphs = vec![glyphs[0].clone()];

    // Extract properties from first glyph to start first run
    let mut current_props = extract_glyph_properties(&glyphs[0]);

    for glyph in glyphs.into_iter().skip(1) {
        let glyph_props = extract_glyph_properties(&glyph);

        if can_batch(&current_props, &glyph_props) {
            // Same properties - add to current run
            current_run_glyphs.push(glyph);
        } else {
            // Properties changed - finalize current run and start new one
            runs.push(create_glyph_run(current_run_glyphs, current_props));
            current_run_glyphs = vec![glyph.clone()];
            current_props = glyph_props;
        }
    }

    // Add final run
    if !current_run_glyphs.is_empty() {
        runs.push(create_glyph_run(current_run_glyphs, current_props));
    }

    runs
}

/// Drawing properties used for batching decisions
#[derive(Debug, Clone, PartialEq)]
struct GlyphProperties {
    font_family: String,
    font_size: f32,
    color: Color,
    opacity: f32,
    codepoint: String, // Include codepoint to separate different glyphs
}

/// Extract drawing properties from a glyph
///
/// SMuFL standard: font-size = 4 staff spaces (1em = 4 staff spaces).
/// At this font size, noteheads render at their designed 2 staff-space height.
fn extract_glyph_properties(glyph: &Glyph) -> GlyphProperties {
    // SMuFL standard: 1em = 4 staff spaces = 4 × 20 = 80 logical units
    // Noteheads are designed to be 2 staff spaces at this font size.
    // Per-glyph font_size override (e.g., scaled chord noteheads) is respected.
    GlyphProperties {
        font_family: "Bravura".to_string(),
        font_size: glyph.font_size.unwrap_or(80.0),
        color: Color {
            r: 0,
            g: 0,
            b: 0,
            a: 255,
        },
        opacity: 1.0,
        codepoint: glyph.codepoint.clone(),
    }
}

/// T072: Check if two glyphs can be batched together
///
/// Glyphs can batch if they have identical:
/// - font_family
/// - font_size
/// - color (RGBA)
/// - opacity
/// - codepoint
fn can_batch(props1: &GlyphProperties, props2: &GlyphProperties) -> bool {
    props1.font_family == props2.font_family
        && (props1.font_size - props2.font_size).abs() < 0.01
        && props1.color == props2.color
        && (props1.opacity - props2.opacity).abs() < 0.01
        && props1.codepoint == props2.codepoint
}

/// Create a GlyphRun from glyphs and their shared properties
fn create_glyph_run(glyphs: Vec<Glyph>, props: GlyphProperties) -> GlyphRun {
    GlyphRun {
        glyphs,
        font_family: props.font_family,
        font_size: props.font_size,
        color: props.color,
        opacity: props.opacity,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::layout::types::{BoundingBox, Point, SourceReference};

    #[test]
    fn test_can_batch_identical() {
        let props1 = GlyphProperties {
            font_family: "Bravura".to_string(),
            font_size: 40.0,
            color: Color {
                r: 0,
                g: 0,
                b: 0,
                a: 255,
            },
            opacity: 1.0,
            codepoint: String::from('\u{E0A4}'),
        };
        let props2 = props1.clone();

        assert!(
            can_batch(&props1, &props2),
            "Identical properties should batch"
        );
    }

    #[test]
    fn test_can_batch_different_font() {
        let props1 = GlyphProperties {
            font_family: "Bravura".to_string(),
            font_size: 40.0,
            color: Color {
                r: 0,
                g: 0,
                b: 0,
                a: 255,
            },
            opacity: 1.0,
            codepoint: String::from('\u{E0A4}'),
        };
        let props2 = GlyphProperties {
            font_family: "Arial".to_string(),
            ..props1.clone()
        };

        assert!(
            !can_batch(&props1, &props2),
            "Different fonts should not batch"
        );
    }

    #[test]
    fn test_can_batch_different_size() {
        let props1 = GlyphProperties {
            font_family: "Bravura".to_string(),
            font_size: 40.0,
            color: Color {
                r: 0,
                g: 0,
                b: 0,
                a: 255,
            },
            opacity: 1.0,
            codepoint: String::from('\u{E0A4}'),
        };
        let props2 = GlyphProperties {
            font_size: 32.0,
            ..props1.clone()
        };

        assert!(
            !can_batch(&props1, &props2),
            "Different sizes should not batch"
        );
    }

    #[test]
    fn test_batch_empty_input() {
        let runs = batch_glyphs(vec![]);
        assert_eq!(runs.len(), 0, "Empty input should produce no runs");
    }

    #[test]
    fn test_batch_single_glyph() {
        let glyph = Glyph {
            position: Point { x: 100.0, y: 200.0 },
            bounding_box: BoundingBox {
                x: 95.0,
                y: 195.0,
                width: 40.0,
                height: 40.0,
            },
            codepoint: String::from('\u{E0A4}'),
            source_reference: SourceReference {
                instrument_id: "test".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 0,
            },
            font_size: None,
        };

        let runs = batch_glyphs(vec![glyph]);
        assert_eq!(runs.len(), 1, "Single glyph should produce one run");
        assert_eq!(runs[0].glyphs.len(), 1, "Run should contain one glyph");
    }

    #[test]
    fn test_batch_sorts_by_x_position() {
        let glyph1 = Glyph {
            position: Point { x: 300.0, y: 200.0 },
            bounding_box: BoundingBox {
                x: 295.0,
                y: 195.0,
                width: 40.0,
                height: 40.0,
            },
            codepoint: String::from('\u{E0A4}'),
            source_reference: SourceReference {
                instrument_id: "test".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 2,
            },
            font_size: None,
        };

        let glyph2 = Glyph {
            position: Point { x: 100.0, y: 200.0 },
            bounding_box: BoundingBox {
                x: 95.0,
                y: 195.0,
                width: 40.0,
                height: 40.0,
            },
            codepoint: String::from('\u{E0A4}'),
            source_reference: SourceReference {
                instrument_id: "test".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 0,
            },
            font_size: None,
        };

        let glyph3 = Glyph {
            position: Point { x: 200.0, y: 200.0 },
            bounding_box: BoundingBox {
                x: 195.0,
                y: 195.0,
                width: 40.0,
                height: 40.0,
            },
            codepoint: String::from('\u{E0A4}'),
            source_reference: SourceReference {
                instrument_id: "test".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 1,
            },
            font_size: None,
        };

        // Input glyphs out of order (300, 100, 200)
        let runs = batch_glyphs(vec![glyph1, glyph2, glyph3]);

        assert_eq!(runs.len(), 1, "All glyphs should batch into one run");
        assert_eq!(runs[0].glyphs.len(), 3, "Run should contain 3 glyphs");

        // Verify sorted order (100, 200, 300)
        assert_eq!(runs[0].glyphs[0].position.x, 100.0);
        assert_eq!(runs[0].glyphs[1].position.x, 200.0);
        assert_eq!(runs[0].glyphs[2].position.x, 300.0);
    }
}
