// Repeat barline domain types - Feature 041

use serde::{Deserialize, Serialize};

/// Type of repeat barline
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RepeatBarlineType {
    /// Repeat from this point forward (thick-thin bar with dots on right)
    Start,
    /// Repeat back to nearest preceding Start (thin-thick bar with dots on left)
    End,
    /// End of one section and start of another (combined thick bars at one position)
    Both,
}

/// A repeat barline anchored to a specific measure in the score
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepeatBarline {
    /// 0-based measure index within the score
    pub measure_index: u32,
    /// Tick position at the start of this measure (inclusive)
    pub start_tick: u32,
    /// Tick position at the end of this measure (exclusive)
    pub end_tick: u32,
    /// Whether this is a start-repeat, end-repeat, or both
    pub barline_type: RepeatBarlineType,
}

// Volta bracket domain types - Feature 047

/// The type of the right end of a volta bracket
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoltaEndType {
    /// Right side closed with a vertical stroke (MusicXML type="stop")
    Stop,
    /// Right side open, no closing vertical stroke (MusicXML type="discontinue")
    Discontinue,
}

/// A volta bracket (first or second ending) anchored to a tick range in the score
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VoltaBracket {
    /// Ending number: 1 = first ending, 2 = second ending
    pub number: u8,
    /// 0-based measure index of the first measure under the bracket
    pub start_measure_index: u32,
    /// 0-based measure index of the last measure under the bracket (inclusive)
    pub end_measure_index: u32,
    /// Tick position at the start of the bracket (inclusive)
    pub start_tick: u32,
    /// Tick position at the end of the bracket (exclusive)
    pub end_tick: u32,
    /// Whether the right end of the bracket is closed (stop) or open (discontinue)
    pub end_type: VoltaEndType,
}
