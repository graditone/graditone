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
