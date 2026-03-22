//! Core layout types
//!
//! Defines all entities in the spatial model hierarchy:
//! GlobalLayout → Systems → StaffGroups → Staves → GlyphRuns → Glyphs

use serde::{Deserialize, Serialize, Serializer};

/// Custom serializer for f32 that rounds to 2 decimal places
///
/// This ensures deterministic JSON output by eliminating floating-point
/// precision artifacts (e.g., 10.000000001 → 10.0)
fn round_f32<S>(value: &f32, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let rounded = (value * 100.0).round() / 100.0;
    serializer.serialize_f32(rounded)
}

/// Root container for entire score layout
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalLayout {
    /// Ordered array of systems from top to bottom
    pub systems: Vec<System>,
    /// Width of widest system in logical units
    #[serde(serialize_with = "round_f32")]
    pub total_width: f32,
    /// Sum of all system heights + inter-system spacing in logical units
    #[serde(serialize_with = "round_f32")]
    pub total_height: f32,
    /// Scaling factor: how many logical units = 1 staff space (default: 10.0)
    #[serde(serialize_with = "round_f32")]
    pub units_per_space: f32,
}

/// System containing 1-N measures of music arranged horizontally
///
/// Primary virtualization boundary for efficient rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct System {
    /// 0-based system number (sequential: 0, 1, 2, ...)
    pub index: usize,
    /// Screen region occupied by system (for viewport intersection checks)
    pub bounding_box: BoundingBox,
    /// Instruments/staff groups in this system
    pub staff_groups: Vec<StaffGroup>,
    /// Musical time span covered by system (in 960 PPQ ticks)
    pub tick_range: TickRange,
    /// Measure number displayed at start of system (1-based)
    pub measure_number: Option<MeasureNumber>,
    /// Volta bracket layouts positioned over this system (Feature 047)
    #[serde(default)]
    pub volta_bracket_layouts: Vec<VoltaBracketLayout>,
    /// Ottava bracket layouts positioned over this system (8va/8vb)
    #[serde(default)]
    pub ottava_bracket_layouts: Vec<OttavaBracketLayout>,
}

/// Positioned measure number at the start of a system
///
/// Displays the 1-based measure number above the topmost staff line,
/// horizontally aligned with the clef glyph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeasureNumber {
    /// 1-based measure number
    pub number: u32,
    /// Absolute (x, y) coordinates for rendering
    pub position: Point,
}

/// A positioned volta bracket in layout coordinates (Feature 047)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoltaBracketLayout {
    /// Ending number (1 or 2)
    pub number: u8,
    /// Display label ("1." or "2.")
    pub label: String,
    /// x-position of the left edge of the horizontal bracket line
    #[serde(serialize_with = "round_f32")]
    pub x_start: f32,
    /// x-position of the right edge of the horizontal bracket line
    #[serde(serialize_with = "round_f32")]
    pub x_end: f32,
    /// y-position above the topmost staff line
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// true = vertical closing stroke at right end; false = open (discontinue)
    pub closed_right: bool,
}

/// A positioned ottava bracket in layout coordinates (8va/8vb)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OttavaBracketLayout {
    /// Display label ("8va", "8vb", "15ma", etc.)
    pub label: String,
    /// x-position of the left edge
    #[serde(serialize_with = "round_f32")]
    pub x_start: f32,
    /// x-position of the right edge
    #[serde(serialize_with = "round_f32")]
    pub x_end: f32,
    /// y-position of the bracket line
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// true = bracket above staff (8va), false = below (8vb)
    pub above: bool,
    /// true = vertical closing stroke at right end; false = continues to next system
    pub closed_right: bool,
    /// Staff index within the instrument (0 = treble, 1 = bass)
    pub staff_index: usize,
}

/// Groups related staves for multi-staff instruments
///
/// Piano has 2 staves (treble + bass), solo instruments have 1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffGroup {
    /// Links to CompiledScore.Instrument.id
    pub instrument_id: String,
    /// Human-readable instrument name (FR-009)
    pub instrument_name: String,
    /// 1-2 staves per group (MVP limit)
    pub staves: Vec<Staff>,
    /// Visual grouping indicator
    pub bracket_type: BracketType,
    /// Bracket/brace glyph with positioning and scale (calculated by layout engine)
    pub bracket_glyph: Option<BracketGlyph>,
    /// Positioned instrument name label for rendering (FR-003)
    pub name_label: Option<NameLabel>,
}

/// Positioned text label for instrument name at system start
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NameLabel {
    /// The instrument name text to render
    pub text: String,
    /// Absolute (x, y) coordinates for rendering
    pub position: Point,
    /// Font size in logical units
    #[serde(serialize_with = "round_f32")]
    pub font_size: f32,
    /// Font family (e.g., "serif")
    pub font_family: String,
    /// RGBA text color
    pub color: Color,
}

/// Bracket/brace glyph with vertical scaling information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracketGlyph {
    /// SMuFL codepoint (e.g., "\u{E000}" for brace)
    pub codepoint: String,
    /// X position (left margin)
    pub x: f32,
    /// Y position (vertical center point for transform)
    pub y: f32,
    /// Vertical scale factor (height / natural_glyph_height)
    pub scale_y: f32,
    /// Bounding box for the scaled glyph
    pub bounding_box: BoundingBox,
}

/// Single 5-line staff with positioned glyphs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    /// Exactly 5 horizontal lines (standard music staff)
    pub staff_lines: [StaffLine; 5],
    /// Batched glyphs for efficient rendering
    pub glyph_runs: Vec<GlyphRun>,
    /// Clefs, key signatures, time signatures at staff start
    pub structural_glyphs: Vec<Glyph>,
    /// Vertical bar lines that separate measures
    pub bar_lines: Vec<BarLine>,
    /// Ledger lines for notes above/below staff
    pub ledger_lines: Vec<LedgerLine>,
    /// Notation dots: augmentation dots (right of notehead) and staccato dots (above/below)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notation_dots: Vec<NotationDot>,
    /// Tie arcs: cubic Bézier curves connecting tied notes
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tie_arcs: Vec<TieArc>,
    /// Slur arcs: cubic Bézier curves connecting slurred notes (phrase marks)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub slur_arcs: Vec<TieArc>,
    /// Fingering glyphs: positioned numerals (1–5) above or below noteheads
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fingering_glyphs: Vec<FingeringGlyph>,
}

/// Short horizontal line for notes outside the 5-line staff range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerLine {
    /// Vertical position in logical units (system-relative)
    #[serde(serialize_with = "round_f32")]
    pub y_position: f32,
    /// Left edge of ledger line in logical units
    #[serde(serialize_with = "round_f32")]
    pub start_x: f32,
    /// Right edge of ledger line in logical units
    #[serde(serialize_with = "round_f32")]
    pub end_x: f32,
}

/// A dot rendered near a notehead: augmentation dot (to the right)
/// or staccato dot (above or below).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotationDot {
    /// Horizontal center of dot in logical units
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    /// Vertical center of dot in logical units
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// Dot radius in logical units
    #[serde(serialize_with = "round_f32")]
    pub radius: f32,
}

/// A positioned fingering numeral in the rendered score layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingeringGlyph {
    /// Horizontal centre of the numeral (same x as notehead)
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    /// Vertical position of the numeral; always outside staff lines
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// Finger number to display (1–5 for standard piano, other values possible)
    pub digit: u8,
    /// true = numeral above notehead, false = numeral below notehead
    pub above: bool,
}

/// A cubic Bézier curve connecting two tied notes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TieArc {
    /// Start point (right edge of first notehead)
    pub start: Point,
    /// End point (left edge of second notehead)
    pub end: Point,
    /// First Bézier control point
    pub cp1: Point,
    /// Second Bézier control point
    pub cp2: Point,
    /// True = arc curves above the notes, false = below
    pub above: bool,
    /// ID of the note that starts the tie
    pub note_id_start: String,
    /// ID of the note that ends the tie
    pub note_id_end: String,
}

/// Single horizontal line in a staff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffLine {
    /// Vertical position in logical units (system-relative)
    #[serde(serialize_with = "round_f32")]
    pub y_position: f32,
    /// Left edge of line in logical units
    #[serde(serialize_with = "round_f32")]
    pub start_x: f32,
    /// Right edge of line in logical units
    #[serde(serialize_with = "round_f32")]
    pub end_x: f32,
}

/// Vertical bar line that separates measures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarLine {
    /// Individual line segments (1 for Single, 2 for Double/Final/Repeat)
    pub segments: Vec<BarLineSegment>,
    /// Type of bar line (single, double, final, repeat)
    pub bar_type: BarLineType,
    /// Repeat dots for repeat barline types (empty for non-repeat types)
    #[serde(default)]
    pub dots: Vec<RepeatDotPosition>,
}

/// Individual line segment within a bar line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarLineSegment {
    /// Horizontal position in logical units
    #[serde(serialize_with = "round_f32")]
    pub x_position: f32,
    /// Top of bar line (y-coordinate of top staff line)
    #[serde(serialize_with = "round_f32")]
    pub y_start: f32,
    /// Bottom of bar line (y-coordinate of bottom staff line)
    #[serde(serialize_with = "round_f32")]
    pub y_end: f32,
    /// Stroke width (1.5 for thin, 4.0 for thick)
    #[serde(serialize_with = "round_f32")]
    pub stroke_width: f32,
}

/// Type of bar line
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum BarLineType {
    /// Single thin line (normal measure separator)
    Single,
    /// Double thin lines (section ending)
    Double,
    /// Thin + thick lines (final bar line at end of piece)
    Final,
    /// Thick-thin bar with repeat dots on the right (start repeating this section)
    RepeatStart,
    /// Thin-thick bar with repeat dots on the left (end of repeated section)
    RepeatEnd,
    /// Combined end-repeat + start-repeat at same position
    RepeatBoth,
}

/// Position of a single repeat dot in layout coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepeatDotPosition {
    /// Horizontal center of dot in logical units (system-relative)
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    /// Vertical center of dot in logical units (system-relative)
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// Dot radius in logical units
    #[serde(serialize_with = "round_f32")]
    pub radius: f32,
}

/// Batches consecutive glyphs with identical drawing properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlyphRun {
    /// All glyphs in this batch (non-empty)
    pub glyphs: Vec<Glyph>,
    /// Font name (typically "Bravura" for SMuFL)
    pub font_family: String,
    /// Font size in logical units (typically 80.0 = 4 staff spaces per SMuFL standard)
    #[serde(serialize_with = "round_f32")]
    pub font_size: f32,
    /// RGBA color for all glyphs
    pub color: Color,
    /// Additional opacity multiplier (range [0.0, 1.0])
    #[serde(serialize_with = "round_f32")]
    pub opacity: f32,
}

/// Single drawable musical symbol with position and source linkage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Glyph {
    /// (x, y) coordinates in logical units (system-relative)
    pub position: Point,
    /// Hit-testing rectangle including ledger lines
    pub bounding_box: BoundingBox,
    /// SMuFL Unicode codepoint as string (e.g., "\u{E0A4}" = quarter notehead)
    pub codepoint: String,
    /// Link back to CompiledScore element for interaction
    pub source_reference: SourceReference,
    /// Optional font size override for this glyph (e.g., smaller courtesy clefs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f32>,
    /// Optional opacity override (0.0–1.0). None = fully opaque.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f32>,
}

/// 2D coordinate in logical units
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point {
    /// X-coordinate (left-to-right, positive = rightward)
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    /// Y-coordinate (top-to-bottom, positive = downward)
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
}

/// Rectangular hit-testing and clipping region
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BoundingBox {
    /// X-coordinate of top-left corner in logical units
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    /// Y-coordinate of top-left corner in logical units
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    /// Width in logical units
    #[serde(serialize_with = "round_f32")]
    pub width: f32,
    /// Height in logical units
    #[serde(serialize_with = "round_f32")]
    pub height: f32,
}

impl BoundingBox {
    /// Check if a point is inside this bounding box (inclusive)
    pub fn contains(&self, point: &Point) -> bool {
        point.x >= self.x
            && point.x <= self.x + self.width
            && point.y >= self.y
            && point.y <= self.y + self.height
    }

    /// Check if two bounding boxes intersect
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(self.x + self.width <= other.x
            || other.x + other.width <= self.x
            || self.y + self.height <= other.y
            || other.y + other.height <= self.y)
    }
}

/// Musical time span using 960 PPQ resolution
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TickRange {
    /// First tick in range (inclusive, 960 PPQ)
    pub start_tick: u32,
    /// Last tick in range (exclusive, 960 PPQ)
    pub end_tick: u32,
}

/// Links layout glyphs back to CompiledScore domain entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceReference {
    /// CompiledScore instrument identifier
    pub instrument_id: String,
    /// Staff number within instrument (0 = treble, 1 = bass for piano)
    pub staff_index: usize,
    /// Voice number within staff (0-3 for polyphonic notation)
    pub voice_index: usize,
    /// Index into voice's event array
    pub event_index: usize,
}

/// Visual grouping indicator for multi-staff instruments
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BracketType {
    /// Curved bracket (piano, harp)
    Brace,
    /// Square bracket (choir, strings)
    Bracket,
    /// No bracket (solo instruments)
    None,
}

/// RGBA color representation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Color {
    /// Red component (0-255)
    pub r: u8,
    /// Green component (0-255)
    pub g: u8,
    /// Blue component (0-255)
    pub b: u8,
    /// Alpha component (0-255, 255 = opaque)
    pub a: u8,
}

impl Color {
    /// Standard black color
    pub const BLACK: Color = Color {
        r: 0,
        g: 0,
        b: 0,
        a: 255,
    };
}

/// Configuration for layout computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    /// Maximum system width in logical units (default: 1600.0)
    pub max_system_width: f32,
    /// Scaling factor: logical units per staff space (default: 10.0)
    pub units_per_space: f32,
    /// Vertical spacing between systems in logical units (default: 150.0)
    pub system_spacing: f32,
    /// System height in logical units (default: 200.0 for grand staff)
    pub system_height: f32,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            max_system_width: 2400.0, // Wide enough for 3+ measures per system
            units_per_space: 20.0,    // SMuFL: font_size 80 = 4 spaces, so 1 space = 20 units
            system_spacing: 100.0,    // Spacing between systems (gap after system_height)
            system_height: 200.0,     // Base height for a single staff system
        }
    }
}
