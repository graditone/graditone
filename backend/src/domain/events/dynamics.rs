//! Dynamic marking and gradual dynamic domain types.
//!
//! Feature: 063-midi-volume-control
//! Models sustained volume instructions (pp, mf, ff, etc.) and gradual
//! volume transitions (crescendo, diminuendo) extracted from MusicXML scores.

use crate::domain::value_objects::Tick;
use serde::{Deserialize, Serialize};

/// Standard dynamic level markings from softest to loudest.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DynamicLevel {
    PPP,
    PP,
    P,
    MP,
    MF,
    F,
    FF,
    FFF,
}

impl DynamicLevel {
    /// Returns the standard MIDI velocity for this dynamic level.
    pub fn default_velocity(&self) -> u8 {
        match self {
            DynamicLevel::PPP => 16,
            DynamicLevel::PP => 33,
            DynamicLevel::P => 49,
            DynamicLevel::MP => 64,
            DynamicLevel::MF => 80,
            DynamicLevel::F => 96,
            DynamicLevel::FF => 112,
            DynamicLevel::FFF => 127,
        }
    }

    /// Parses a MusicXML dynamics child element name to a DynamicLevel.
    /// Returns None for unrecognised markings (e.g. sfz, fp — out of scope).
    pub fn from_musicxml(name: &str) -> Option<Self> {
        match name {
            "ppp" => Some(DynamicLevel::PPP),
            "pp" => Some(DynamicLevel::PP),
            "p" => Some(DynamicLevel::P),
            "mp" => Some(DynamicLevel::MP),
            "mf" => Some(DynamicLevel::MF),
            "f" => Some(DynamicLevel::F),
            "ff" => Some(DynamicLevel::FF),
            "fff" => Some(DynamicLevel::FFF),
            _ => None,
        }
    }
}

/// A sustained volume instruction at a specific score position.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DynamicMarking {
    /// The dynamic level (pp, mf, ff, etc.)
    pub marking: DynamicLevel,
    /// MIDI velocity value (1–127)
    pub velocity: u8,
    /// Absolute tick position where this dynamic takes effect
    pub start_tick: Tick,
    /// Staff number (1-based)
    pub staff: u8,
}

impl DynamicMarking {
    pub fn new(marking: DynamicLevel, velocity: u8, start_tick: Tick, staff: u8) -> Self {
        Self {
            marking,
            velocity: velocity.clamp(1, 127),
            start_tick,
            staff,
        }
    }
}

/// Direction of a gradual dynamic change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GradualDirection {
    Crescendo,
    Diminuendo,
}

/// A volume transition (crescendo or diminuendo) spanning a range of tick positions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GradualDynamic {
    /// Crescendo or Diminuendo
    pub direction: GradualDirection,
    /// Absolute tick position where the wedge begins
    pub start_tick: Tick,
    /// Absolute tick position where the wedge ends
    pub stop_tick: Tick,
    /// Staff number (1-based)
    pub staff: u8,
    /// MusicXML wedge number (for matching start/stop pairs)
    pub number: u8,
}

impl GradualDynamic {
    pub fn new(
        direction: GradualDirection,
        start_tick: Tick,
        stop_tick: Tick,
        staff: u8,
        number: u8,
    ) -> Self {
        Self {
            direction,
            start_tick,
            stop_tick,
            staff,
            number,
        }
    }
}
