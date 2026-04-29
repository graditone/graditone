use crate::domain::{
    errors::DomainError,
    ids::{InstrumentId, StaffId},
    staff::Staff,
};
use serde::{Deserialize, Serialize};

/// Instrument contains one or more staves
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Instrument {
    pub id: InstrumentId,
    pub name: String,
    /// Type of instrument for playback (e.g., "piano", "violin", "guitar").
    /// Feature 003: Music Playback - now populated from classify_instrument_type().
    /// Feature 088: Multi-instrument playback support.
    pub instrument_type: String,
    pub staves: Vec<Staff>,
}

impl Instrument {
    /// Create a new instrument with one default staff.
    /// `name` is used to infer the instrument type via `classify_instrument_type`.
    pub fn new(name: String) -> Self {
        let instrument_type = classify_instrument_type(&name, None);
        Self {
            id: InstrumentId::new(),
            name,
            instrument_type,
            staves: vec![Staff::new()],
        }
    }

    /// Create an instrument with an explicitly provided instrument type (e.g., from MusicXML import).
    pub fn new_with_type(name: String, instrument_type: String) -> Self {
        Self {
            id: InstrumentId::new(),
            name,
            instrument_type,
            staves: vec![Staff::new()],
        }
    }

    /// Add an additional staff to the instrument
    pub fn add_staff(&mut self, staff: Staff) {
        self.staves.push(staff);
    }

    /// Get a staff by ID (immutable)
    pub fn get_staff(&self, id: StaffId) -> Result<&Staff, DomainError> {
        self.staves
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| DomainError::NotFound(format!("Staff with id {} not found", id)))
    }

    /// Get a staff by ID (mutable)
    pub fn get_staff_mut(&mut self, id: StaffId) -> Result<&mut Staff, DomainError> {
        self.staves
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| DomainError::NotFound(format!("Staff with id {} not found", id)))
    }
}

/// Classify instrument type from a part name and optional MIDI program number.
///
/// Returns a canonical lowercase type string suitable for playback timbre selection.
/// MIDI program number takes precedence over name matching when both are present.
/// Unknown instruments fall back to `"default"` — never returns an empty string.
///
/// Feature 088: Multi-instrument playback support.
///
/// # Examples
/// ```
/// use musicore_backend::domain::instrument::classify_from_instrument_sound;
/// assert_eq!(classify_from_instrument_sound("strings.violin"), Some("violin"));
/// assert_eq!(classify_from_instrument_sound("keyboard.piano.grand"), Some("piano"));
/// assert_eq!(classify_from_instrument_sound("theremin"), None);
/// ```
pub fn classify_from_instrument_sound(sound: &str) -> Option<&'static str> {
    let lower = sound.to_lowercase();
    // Check most-specific prefixes first so "strings.violin" beats "strings".
    if lower.starts_with("strings.violin") {
        return Some("violin");
    }
    if lower.starts_with("strings.viola") {
        return Some("viola");
    }
    if lower.starts_with("strings.cello") || lower.starts_with("strings.violoncello") {
        return Some("cello");
    }
    if lower.starts_with("strings.contrabass") || lower.starts_with("strings.double-bass") {
        return Some("contrabass");
    }
    if lower.starts_with("keyboard.piano") || lower.starts_with("keyboard.harpsichord") {
        return Some("piano");
    }
    if lower.starts_with("pluck.guitar") || lower.starts_with("guitar") {
        return Some("guitar");
    }
    if lower.starts_with("wind.flutes") || lower.starts_with("flute") {
        return Some("flute");
    }
    if lower.starts_with("wind.reed.oboe") || lower.starts_with("oboe") {
        return Some("oboe");
    }
    if lower.starts_with("wind.reed.clarinet") || lower.starts_with("clarinet") {
        return Some("clarinet");
    }
    if lower.starts_with("brass.trumpet") || lower.starts_with("trumpet") {
        return Some("trumpet");
    }
    None
}

/// Classify instrument type from a part name and optional MIDI program number.
///
/// Returns a canonical lowercase type string suitable for playback timbre selection.
/// Unknown instruments fall back to `"default"` — never returns an empty string.
///
/// # Examples
/// ```
/// use musicore_backend::domain::instrument::classify_instrument_type;
/// assert_eq!(classify_instrument_type("Piano", None), "piano");
/// assert_eq!(classify_instrument_type("Violin I", None), "violin");
/// assert_eq!(classify_instrument_type("Unknown", None), "default");
/// assert_eq!(classify_instrument_type("", Some(41)), "violin"); // MIDI 41 = violin
/// ```
pub fn classify_instrument_type(name: &str, midi_program: Option<u8>) -> String {
    // MIDI program number takes precedence when present
    if let Some(program) = midi_program {
        match program {
            1..=8 => return "piano".to_string(),
            25..=32 => return "guitar".to_string(),
            41 => return "violin".to_string(),
            42 => return "viola".to_string(),
            43 => return "cello".to_string(),
            44 => return "contrabass".to_string(),
            57 => return "trumpet".to_string(),
            69 => return "oboe".to_string(),
            72 => return "clarinet".to_string(),
            74 => return "flute".to_string(),
            _ => {} // Fall through to name matching
        }
    }

    let lower = name.to_lowercase();

    // Order matters: check more specific patterns before general ones.
    // French names are included alongside Italian/English equivalents.
    if lower.contains("contrabass")
        || lower.contains("double bass")
        || lower.contains("contrebasse")
    {
        return "contrabass".to_string();
    }
    // "violoncell" matches both "violoncello" (It.) and "violoncelle" (Fr.)
    // Must come before the "violon" check to avoid "violon" stealing those.
    if lower.contains("violoncell") || lower.contains("cello") {
        return "cello".to_string();
    }
    if lower.contains("viola") {
        return "viola".to_string();
    }
    // "violon" (Fr.) must come after "violoncell" check above.
    if lower.contains("violino") || lower.contains("violin") || lower.contains("violon") {
        return "violin".to_string();
    }
    if lower.contains("piano")
        || lower.contains("keyboard")
        || lower.contains("clavier")
        || lower.contains("fortepiano")
    {
        return "piano".to_string();
    }
    if lower.contains("guitare") || lower.contains("guitar") {
        return "guitar".to_string();
    }
    if lower.contains("flauto") || lower.contains("flute") || lower.contains("flûte") {
        return "flute".to_string();
    }
    if lower.contains("oboe") || lower.contains("hautbois") {
        return "oboe".to_string();
    }
    if lower.contains("clarinette") || lower.contains("clarinet") {
        return "clarinet".to_string();
    }
    if lower.contains("trompette") || lower.contains("trumpet") {
        return "trumpet".to_string();
    }

    "default".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_piano_by_name() {
        assert_eq!(classify_instrument_type("Piano", None), "piano");
        assert_eq!(classify_instrument_type("PIANO", None), "piano");
        assert_eq!(classify_instrument_type("Grand Piano", None), "piano");
        assert_eq!(classify_instrument_type("keyboard", None), "piano");
        assert_eq!(classify_instrument_type("Clavier", None), "piano");
        assert_eq!(classify_instrument_type("Fortepiano", None), "piano");
    }

    #[test]
    fn test_classify_violin_by_name() {
        assert_eq!(classify_instrument_type("Violin", None), "violin");
        assert_eq!(classify_instrument_type("Violin I", None), "violin");
        assert_eq!(classify_instrument_type("VIOLIN II", None), "violin");
        assert_eq!(classify_instrument_type("Violino", None), "violin");
        assert_eq!(classify_instrument_type("Violino I", None), "violin");
        // French names
        assert_eq!(classify_instrument_type("Violon", None), "violin");
        assert_eq!(classify_instrument_type("VIOLON I", None), "violin");
    }

    #[test]
    fn test_classify_viola_by_name() {
        assert_eq!(classify_instrument_type("Viola", None), "viola");
        assert_eq!(classify_instrument_type("VIOLA", None), "viola");
    }

    #[test]
    fn test_classify_cello_by_name() {
        assert_eq!(classify_instrument_type("Cello", None), "cello");
        assert_eq!(classify_instrument_type("Violoncello", None), "cello");
        assert_eq!(classify_instrument_type("cello I", None), "cello");
        // French name — must not be confused with "violon" (violin)
        assert_eq!(classify_instrument_type("Violoncelle", None), "cello");
    }

    #[test]
    fn test_classify_contrabass_by_name() {
        assert_eq!(classify_instrument_type("Contrabass", None), "contrabass");
        assert_eq!(classify_instrument_type("Double Bass", None), "contrabass");
        assert_eq!(classify_instrument_type("Contrabass I", None), "contrabass");
        // French
        assert_eq!(classify_instrument_type("Contrebasse", None), "contrabass");
    }

    #[test]
    fn test_classify_guitar_by_name() {
        assert_eq!(classify_instrument_type("Guitar", None), "guitar");
        assert_eq!(classify_instrument_type("Guitare", None), "guitar");
    }

    #[test]
    fn test_classify_flute_by_name() {
        assert_eq!(classify_instrument_type("Flute", None), "flute");
        assert_eq!(classify_instrument_type("Flauto", None), "flute");
    }

    #[test]
    fn test_classify_trumpet_by_name() {
        assert_eq!(classify_instrument_type("Trumpet", None), "trumpet");
        assert_eq!(classify_instrument_type("Trompette", None), "trumpet");
    }

    #[test]
    fn test_classify_default_for_unknown() {
        assert_eq!(classify_instrument_type("Unknown", None), "default");
        assert_eq!(classify_instrument_type("", None), "default");
        assert_eq!(classify_instrument_type("Violyn", None), "default"); // misspelling
        assert_eq!(classify_instrument_type("Sousaphone", None), "default");
    }

    #[test]
    fn test_classify_by_midi_program_takes_precedence() {
        // MIDI 41 = violin, even if name says piano
        assert_eq!(classify_instrument_type("Piano", Some(41)), "violin");
        // MIDI 1 = piano
        assert_eq!(classify_instrument_type("Violin", Some(1)), "piano");
        // MIDI 43 = cello
        assert_eq!(classify_instrument_type("", Some(43)), "cello");
        // MIDI 74 = flute
        assert_eq!(classify_instrument_type("", Some(74)), "flute");
        // MIDI 69 = oboe
        assert_eq!(classify_instrument_type("", Some(69)), "oboe");
        // MIDI 72 = clarinet
        assert_eq!(classify_instrument_type("", Some(72)), "clarinet");
    }

    #[test]
    fn test_classify_midi_fallback_to_name_for_unknown_program() {
        // MIDI 100 (unknown) → falls through to name matching
        assert_eq!(classify_instrument_type("Piano", Some(100)), "piano");
        assert_eq!(classify_instrument_type("Violin", Some(100)), "violin");
        assert_eq!(classify_instrument_type("Unknown", Some(100)), "default");
    }

    #[test]
    fn test_instrument_new_uses_classify() {
        let piano = Instrument::new("Piano".to_string());
        assert_eq!(piano.instrument_type, "piano");

        let violin = Instrument::new("Violin I".to_string());
        assert_eq!(violin.instrument_type, "violin");

        let unknown = Instrument::new("Theremin".to_string());
        assert_eq!(unknown.instrument_type, "default");
    }

    #[test]
    fn test_instrument_new_with_type_overrides() {
        let inst = Instrument::new_with_type("Piano".to_string(), "violin".to_string());
        assert_eq!(inst.instrument_type, "violin");
    }

    #[test]
    fn test_classify_from_instrument_sound_strings() {
        assert_eq!(
            classify_from_instrument_sound("strings.violin"),
            Some("violin")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.violin.alto"),
            Some("violin")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.viola"),
            Some("viola")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.cello"),
            Some("cello")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.violoncello"),
            Some("cello")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.contrabass"),
            Some("contrabass")
        );
        assert_eq!(
            classify_from_instrument_sound("strings.double-bass"),
            Some("contrabass")
        );
    }

    #[test]
    fn test_classify_from_instrument_sound_keyboard() {
        assert_eq!(
            classify_from_instrument_sound("keyboard.piano"),
            Some("piano")
        );
        assert_eq!(
            classify_from_instrument_sound("keyboard.piano.grand"),
            Some("piano")
        );
        assert_eq!(
            classify_from_instrument_sound("keyboard.harpsichord"),
            Some("piano")
        );
    }

    #[test]
    fn test_classify_from_instrument_sound_winds() {
        assert_eq!(
            classify_from_instrument_sound("wind.flutes.flute"),
            Some("flute")
        );
        assert_eq!(
            classify_from_instrument_sound("wind.reed.oboe"),
            Some("oboe")
        );
        assert_eq!(
            classify_from_instrument_sound("wind.reed.clarinet.bb"),
            Some("clarinet")
        );
        assert_eq!(
            classify_from_instrument_sound("brass.trumpet.c"),
            Some("trumpet")
        );
    }

    #[test]
    fn test_classify_from_instrument_sound_unknown() {
        assert_eq!(classify_from_instrument_sound("theremin"), None);
        assert_eq!(classify_from_instrument_sound(""), None);
        assert_eq!(classify_from_instrument_sound("voice.soprano"), None);
    }

    #[test]
    fn test_classify_from_instrument_sound_case_insensitive() {
        assert_eq!(
            classify_from_instrument_sound("Strings.Violin"),
            Some("violin")
        );
        assert_eq!(
            classify_from_instrument_sound("KEYBOARD.PIANO"),
            Some("piano")
        );
    }
}
