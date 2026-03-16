// MusicXML intermediate data structures - feature 006-musicxml-import

use std::collections::HashMap;

/// Beam state at a specific beam level for a note
///
/// Maps directly to MusicXML `<beam>` element text content.
/// A note can have multiple beam annotations (one per beam level).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BeamType {
    /// Start of a beam group at this level
    Begin,
    /// Middle note — beam passes through
    Continue,
    /// End of a beam group at this level
    End,
    /// Partial beam extending forward (right)
    ForwardHook,
    /// Partial beam extending backward (left)
    BackwardHook,
}

/// A single beam annotation on a parsed MusicXML note
///
/// Represents one `<beam number="N">type</beam>` element.
/// `number` is the beam level (1=8th, 2=16th, 3=32nd, etc.)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BeamData {
    /// Beam level (1=8th, 2=16th, 3=32nd, 4=64th, 5=128th)
    pub number: u8,
    /// Beam state at this note for this level
    pub beam_type: BeamType,
}

/// Raw MusicXML document structure after parsing
#[derive(Debug, Clone)]
pub struct MusicXMLDocument {
    /// Document format version (e.g., "3.1", "4.0")
    pub version: String,

    /// Encoding metadata
    pub encoding: EncodingMetadata,

    /// List of parts (instruments) in the score
    pub parts: Vec<PartData>,

    /// Default tempo if not specified in parts (defaults to 120 BPM)
    pub default_tempo: f64,

    /// Mapping of part ID to part name (e.g., "P1" -> "Violin")
    /// Populated during part-list parsing (T092 - User Story 3)
    pub part_names: HashMap<String, String>,

    /// Feature 022: Title from <work>/<work-title> element
    pub work_title: Option<String>,

    /// Feature 022: Title from <movement-title> element
    pub movement_title: Option<String>,

    /// Feature 022: Composer from <identification>/<creator type="composer">
    pub composer: Option<String>,
}

/// Metadata from <encoding> element
#[derive(Debug, Clone, Default)]
pub struct EncodingMetadata {
    pub software: Option<String>, // e.g., "MuseScore 4.2.1"
    pub encoding_date: Option<String>,
    pub supports: Vec<String>, // MusicXML feature flags
}

/// Represents a <part> element (single instrument)
#[derive(Debug, Clone)]
pub struct PartData {
    /// Part ID (e.g., "P1", "P2")
    pub id: String,

    /// Instrument name (e.g., "Piano", "Violin", "Flute")
    pub name: String,

    /// List of measures in this part
    pub measures: Vec<MeasureData>,

    /// Number of staves (1 for single staff, 2 for grand staff, etc.)
    pub staff_count: usize,
}

// Intermediate types for <ending> element parsing (Feature 047)

/// Classification of an <ending> element's type attribute
#[derive(Debug, Clone, PartialEq)]
pub enum EndingParseType {
    Start,
    Stop,
    Discontinue,
}

/// Intermediate data from a single <ending> element during barline parsing
#[derive(Debug, Clone)]
pub struct RawEndingData {
    /// From MusicXML `number` attribute (typically 1 or 2)
    pub number: u8,
    /// Parsed from MusicXML `type` attribute
    pub end_type: EndingParseType,
}

/// Represents a <measure> element
#[derive(Debug, Clone)]
pub struct MeasureData {
    /// Measure number (1-indexed)
    pub number: i32,

    /// Timing context from <attributes> element
    pub attributes: Option<AttributesData>,

    /// All elements in this measure (notes, rests, etc.)
    pub elements: Vec<MeasureElement>,

    /// True if this measure has a start-repeat barline (Feature 041)
    pub start_repeat: bool,

    /// True if this measure has an end-repeat barline (Feature 041)
    pub end_repeat: bool,

    /// Ending elements (<ending>) parsed from barlines (Feature 047)
    pub endings: Vec<RawEndingData>,

    /// Tempo from <sound tempo="..."/> element at measure level (Feature 001-score-tempo)
    pub sound_tempo: Option<f64>,

    /// Tempo from <metronome><per-minute>...</per-minute></metronome> (Feature 001-score-tempo)
    pub metronome_tempo: Option<f64>,
}

/// Timing and notation attributes from <attributes> element
#[derive(Debug, Clone, Default)]
pub struct AttributesData {
    /// Divisions (ticks per quarter note in source file)
    pub divisions: Option<i32>,

    /// Key signature
    pub key: Option<KeyData>,

    /// Time signature
    pub time: Option<TimeSignatureData>,

    /// Clefs for each staff (indexed by staff number - 1)
    pub clefs: Vec<ClefData>,

    /// Tempo marking (BPM)
    pub tempo: Option<f64>,
}

/// Key signature from <key> element
#[derive(Debug, Clone)]
pub struct KeyData {
    /// Circle of fifths (-7 to +7, 0 = C/Am)
    pub fifths: i32,

    /// Mode: "major", "minor", etc.
    pub mode: String,
}

/// Time signature from <time> element
#[derive(Debug, Clone)]
pub struct TimeSignatureData {
    /// Numerator (beats per measure)
    pub beats: i32,

    /// Denominator (note value that gets the beat)
    pub beat_type: i32,
}

/// Clef from <clef> element
#[derive(Debug, Clone)]
pub struct ClefData {
    /// Staff number (1-indexed, 1 = first staff)
    pub staff_number: usize,

    /// Clef sign: "G", "F", "C", etc.
    pub sign: String,

    /// Staff line the clef is placed on
    pub line: i32,
}

/// Element within a measure (note, rest, or other)
#[derive(Debug, Clone)]
pub enum MeasureElement {
    Note(NoteData),
    Rest(RestData),
    Backup(i32),                // Move timing backward by N duration units
    Forward(i32),               // Move timing forward by N duration units (rest in voice)
    Attributes(AttributesData), // Mid-measure attribute changes (clef, key, etc.)
}

/// The role this note plays in a tie relationship.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TieType {
    /// This note is the start of a tie.
    Start,
    /// This note is both the end of one tie and the start of the next (chain).
    Continue,
    /// This note is the end of a tie.
    Stop,
}

/// Visual arc placement for a tie, sourced from <notations><tied placement="..."/>.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TiePlacement {
    Above,
    Below,
}

/// Note from <note> element
#[derive(Debug, Clone)]
pub struct NoteData {
    /// Pitch information (None for unpitched percussion)
    pub pitch: Option<PitchData>,

    /// Duration in source file's divisions units
    pub duration: i32,

    /// Voice number (1-indexed, defaults to 1)
    pub voice: usize,

    /// Staff number (1-indexed, defaults to 1)
    pub staff: usize,

    /// Note type (e.g., "quarter", "eighth", "half")
    pub note_type: Option<String>,

    /// Is this a chord note? (starts at same time as previous note)
    pub is_chord: bool,

    /// Beam annotations parsed from `<beam>` elements (empty if no beams)
    pub beams: Vec<BeamData>,

    /// Staccato articulation from `<notations><articulations><staccato/>`
    pub staccato: bool,

    /// Number of augmentation dots from `<dot/>` elements
    pub dot_count: u8,

    /// Tie directive from the <tie> element — drives playback duration merging.
    pub tie_type: Option<TieType>,

    /// Arc placement hint from <notations><tied placement="above|below">.
    pub tie_placement: Option<TiePlacement>,
}

/// Pitch from <pitch> element
#[derive(Debug, Clone)]
pub struct PitchData {
    /// Step: 'C', 'D', 'E', 'F', 'G', 'A', 'B'
    pub step: char,

    /// Octave (C4 = middle C)
    pub octave: i32,

    /// Alteration: -2 (double flat), -1 (flat), 0 (natural), 1 (sharp), 2 (double sharp)
    pub alter: i32,
}

/// Rest from <note> element with <rest/> child
#[derive(Debug, Clone)]
pub struct RestData {
    /// Duration in source file's divisions units
    pub duration: i32,

    /// Voice number
    pub voice: usize,

    /// Staff number
    pub staff: usize,

    /// Note type string (e.g., "whole", "half", "quarter", "eighth", "16th", "32nd", "64th")
    pub note_type: Option<String>,
}

impl Default for MusicXMLDocument {
    fn default() -> Self {
        Self {
            version: "3.1".to_string(),
            encoding: EncodingMetadata::default(),
            parts: Vec::new(),
            default_tempo: 120.0,
            part_names: HashMap::new(),
            work_title: None,
            movement_title: None,
            composer: None,
        }
    }
}
