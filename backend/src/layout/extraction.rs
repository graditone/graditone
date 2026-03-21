//! Data extraction layer
//!
//! Converts raw JSON score data into typed internal representations.
//! Contains tick-to-measure conversion helpers, instrument/staff/voice
//! data structures, and the primary extraction functions.

/// Compute the start tick of a measure, accounting for pickup/anacrusis.
pub(crate) fn measure_start_tick(
    measure_index: usize,
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if pickup_ticks > 0 {
        if measure_index == 0 {
            0
        } else {
            pickup_ticks + (measure_index as u32 - 1) * ticks_per_measure
        }
    } else {
        measure_index as u32 * ticks_per_measure
    }
}

/// Compute the end tick of a measure, accounting for pickup/anacrusis.
pub(crate) fn measure_end_tick(
    measure_index: usize,
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if pickup_ticks > 0 {
        if measure_index == 0 {
            pickup_ticks
        } else {
            pickup_ticks + measure_index as u32 * ticks_per_measure
        }
    } else {
        (measure_index as u32 + 1) * ticks_per_measure
    }
}

/// Map a tick position to its measure index, accounting for pickup/anacrusis.
pub(crate) fn tick_to_measure_index(tick: u32, pickup_ticks: u32, ticks_per_measure: u32) -> usize {
    if pickup_ticks > 0 {
        if tick < pickup_ticks {
            0
        } else {
            ((tick - pickup_ticks) / ticks_per_measure) as usize + 1
        }
    } else {
        (tick / ticks_per_measure) as usize
    }
}

/// Measure start tick using actual boundaries if available, formula fallback.
pub(crate) fn actual_start(
    measure_index: usize,
    measure_end_ticks: &[u32],
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if !measure_end_ticks.is_empty()
        && measure_index > 0
        && measure_index <= measure_end_ticks.len()
    {
        measure_end_ticks[measure_index - 1]
    } else if measure_index == 0 {
        0
    } else {
        measure_start_tick(measure_index, pickup_ticks, ticks_per_measure)
    }
}

/// Measure end tick using actual boundaries if available, formula fallback.
pub(crate) fn actual_end(
    measure_index: usize,
    measure_end_ticks: &[u32],
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if measure_index < measure_end_ticks.len() {
        measure_end_ticks[measure_index]
    } else {
        measure_end_tick(measure_index, pickup_ticks, ticks_per_measure)
    }
}

/// Map tick to measure index using actual boundaries, with formula fallback.
pub(crate) fn actual_tick_to_measure(
    tick: u32,
    measure_end_ticks: &[u32],
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> usize {
    if !measure_end_ticks.is_empty() {
        // Binary search: find the first measure whose end_tick > tick
        match measure_end_ticks.binary_search(&(tick + 1)) {
            Ok(i) => i,
            Err(i) => i.min(measure_end_ticks.len().saturating_sub(1)),
        }
    } else {
        tick_to_measure_index(tick, pickup_ticks, ticks_per_measure)
    }
}

/// Represents an instrument with its staves extracted from CompiledScore
#[derive(Debug, Clone)]
pub(crate) struct InstrumentData {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) staves: Vec<StaffData>,
}

/// Represents a staff with voices and notes
#[derive(Debug, Clone)]
pub(crate) struct StaffData {
    pub(crate) voices: Vec<VoiceData>,
    pub(crate) clef: String,       // e.g., "Treble", "Bass", "Alto", "Tenor"
    pub(crate) time_numerator: u8, // e.g., 4 for 4/4 time
    pub(crate) time_denominator: u8, // e.g., 4 for 4/4 time
    pub(crate) key_sharps: i8, // Initial key: positive for sharps, negative for flats, 0 for C major
    /// Key signature changes sorted by tick. Empty if no mid-piece changes.
    pub(crate) key_signature_events: Vec<(u32, i8)>,
    /// Clef changes sorted by tick. Empty if no mid-piece changes.
    pub(crate) clef_events: Vec<(u32, String)>,
    /// Octave shift regions for this staff: (start_tick, end_tick, display_shift).
    /// display_shift: -8 = 8va (display one octave lower), +8 = 8vb (display one octave higher).
    pub(crate) octave_shift_regions: Vec<(u32, u32, i8)>,
}

impl StaffData {
    /// Get the active key signature (sharps count) at a given tick.
    pub(crate) fn get_key_at_tick(&self, tick: u32) -> i8 {
        if self.key_signature_events.is_empty() {
            return self.key_sharps;
        }
        // Find the last event whose tick <= the query tick
        let mut result = self.key_sharps;
        for &(event_tick, sharps) in &self.key_signature_events {
            if event_tick <= tick {
                result = sharps;
            } else {
                break;
            }
        }
        result
    }

    /// Get the active clef at a given tick.
    pub(crate) fn get_clef_at_tick(&self, tick: u32) -> &str {
        if self.clef_events.is_empty() {
            return &self.clef;
        }
        let mut result = &self.clef;
        for (event_tick, clef) in &self.clef_events {
            if *event_tick <= tick {
                result = clef;
            } else {
                break;
            }
        }
        result
    }

    /// Return the display pitch for a note, applying octave shift transposition.
    /// If the note at `tick` falls within an octave-shift region, the pitch is
    /// shifted by the corresponding number of semitones.
    #[allow(dead_code)]
    pub(crate) fn display_pitch(&self, pitch: u8, tick: u32) -> u8 {
        for &(start, end, shift) in &self.octave_shift_regions {
            if tick >= start && tick < end {
                let semitones: i16 = match shift {
                    -8 => -12,
                    8 => 12,
                    -15 => -24,
                    15 => 24,
                    _ => 0,
                };
                return (pitch as i16 + semitones).clamp(0, 127) as u8;
            }
        }
        pitch
    }

    /// Return the clef active strictly *before* `tick` (exclusive).
    /// Used for system-start clefs so the system shows the "incoming" clef
    /// rather than a clef change that happens exactly at the system start.
    pub(crate) fn get_clef_before_tick(&self, tick: u32) -> &str {
        if self.clef_events.is_empty() {
            return &self.clef;
        }
        let mut result = &self.clef;
        for (event_tick, clef) in &self.clef_events {
            if *event_tick < tick {
                result = clef;
            } else {
                break;
            }
        }
        result
    }
}

/// Represents a voice with interval events (notes) and rest events
#[derive(Debug, Clone)]
pub(crate) struct VoiceData {
    pub(crate) notes: Vec<NoteEvent>,
    pub(crate) rests: Vec<RestLayoutEvent>,
}

/// Rest event extracted from ScoreDto JSON for layout processing
#[derive(Debug, Clone)]
pub(crate) struct RestLayoutEvent {
    pub(crate) start_tick: u32,
    pub(crate) duration_ticks: u32,
    pub(crate) note_type: Option<String>,
    /// MusicXML voice number (1-indexed): odd = Voice 1 (up), even = Voice 2 (down)
    pub(crate) voice: usize,
    /// True when the MusicXML source has `<rest measure="yes"/>`.
    pub(crate) is_measure_rest: bool,
}

/// Note data tuple: (pitch, start_tick, duration_ticks, spelling, staccato, dot_count, has_explicit_accidental)
///
/// Spelling is an optional (step_letter, alter) pair from MusicXML,
/// e.g. ('E', -1) for Eb, ('D', 1) for D#.
pub type NoteData = (u8, u32, u32, Option<(char, i8)>, bool, u8, bool);

/// Represents a single note event
#[derive(Debug, Clone)]
pub(crate) struct NoteEvent {
    pub(crate) pitch: u8,
    pub(crate) start_tick: u32,
    pub(crate) duration_ticks: u32,
    /// Explicit spelling from MusicXML: (step_letter, alter) e.g. ('E', -1) for Eb
    pub(crate) spelling: Option<(char, i8)>,
    /// Beam annotations from MusicXML import (empty = needs algorithmic grouping)
    pub(crate) beam_info: Vec<(u8, String)>, // (beam_level, beam_type_string)
    /// Staccato articulation
    pub(crate) staccato: bool,
    /// Number of augmentation dots (0, 1, or 2)
    pub(crate) dot_count: u8,
    /// Domain Note ID (UUID string) for tie arc linking
    pub(crate) note_id: String,
    /// If this note starts/continues a tie, the ID of the next tied note
    pub(crate) tie_next: Option<String>,
    /// If a slur starts on this note, the ID of the note where it ends
    pub(crate) slur_next: Option<String>,
    /// Slur direction from MusicXML: Some(true)=above, Some(false)=below, None=auto
    pub(crate) slur_above: Option<bool>,
    /// Grace note (ornamental, no rhythmic duration)
    pub(crate) is_grace: bool,
    /// Explicit accidental from MusicXML (courtesy/editorial — always display)
    pub(crate) has_explicit_accidental: bool,
    /// Explicit stem direction from MusicXML `<stem>` element.
    /// `Some(true)` = stem down, `Some(false)` = stem up, `None` = not specified.
    pub(crate) stem_down: Option<bool>,
}

pub(crate) fn extract_measures(
    score: &serde_json::Value,
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Vec<(Vec<u32>, Vec<u32>, u32)> {
    let mut note_measures: Vec<Vec<u32>> = Vec::new();
    let mut rest_measures: Vec<Vec<u32>> = Vec::new();
    // Collect (pitch, spelling) per tick per measure for chord-second detection
    #[allow(clippy::type_complexity)]
    let mut pitches_by_measure: std::collections::HashMap<
        usize,
        std::collections::HashMap<u32, Vec<(u8, Option<(char, i8)>)>>,
    > = std::collections::HashMap::new();

    // Extract notes from all instruments
    if let Some(instruments) = score["instruments"].as_array() {
        for instrument in instruments {
            if let Some(staves) = instrument["staves"].as_array() {
                // Collect all unique timing positions across all staves
                // (treble + bass notes at same tick = one horizontal position)
                // Map: tick -> max duration at that tick (use max so wider notes win)
                let mut all_notes_by_measure: std::collections::HashMap<
                    usize,
                    std::collections::HashMap<u32, u32>,
                > = std::collections::HashMap::new();
                let mut all_rests_by_measure: std::collections::HashMap<
                    usize,
                    std::collections::HashMap<u32, u32>,
                > = std::collections::HashMap::new();

                for staff in staves {
                    if let Some(voices) = staff["voices"].as_array() {
                        for voice in voices {
                            // --- Notes ---
                            // Try both "interval_events" (Score format) and "notes" (converted format)
                            let notes_array = voice["interval_events"]
                                .as_array()
                                .or_else(|| voice["notes"].as_array());

                            if let Some(notes) = notes_array {
                                for note in notes {
                                    // Grace notes don't occupy rhythmic space
                                    if note["is_grace"].as_bool().unwrap_or(false) {
                                        continue;
                                    }

                                    // Support multiple field name formats:
                                    // Format 1 (Score): start_tick, duration_ticks
                                    // Format 2 (LayoutView): tick, duration
                                    // Format 3 (nested): start_tick.value
                                    let start_tick = note["start_tick"]
                                        .as_u64()
                                        .or_else(|| note["tick"].as_u64())
                                        .or_else(|| note["start_tick"]["value"].as_u64())
                                        .unwrap_or(0)
                                        as u32;

                                    let duration = note["duration_ticks"]
                                        .as_u64()
                                        .or_else(|| note["duration"].as_u64())
                                        .unwrap_or(960)
                                        as u32;

                                    // Determine which measure this note belongs to
                                    let measure_index = actual_tick_to_measure(
                                        start_tick,
                                        measure_end_ticks,
                                        pickup_ticks,
                                        ticks_per_measure,
                                    );

                                    // Track tick → duration (keep max duration at each tick position)
                                    let entry = all_notes_by_measure
                                        .entry(measure_index)
                                        .or_default()
                                        .entry(start_tick)
                                        .or_insert(0);
                                    *entry = (*entry).max(duration);

                                    // Collect pitch+spelling for chord-second detection
                                    let pitch = if let Some(p) = note["pitch"].as_u64() {
                                        p as u8
                                    } else {
                                        note["pitch"]["value"].as_u64().unwrap_or(60) as u8
                                    };
                                    let spelling = note["spelling"]["step"]
                                        .as_str()
                                        .and_then(|s| s.chars().next())
                                        .and_then(|step| {
                                            note["spelling"]["alter"]
                                                .as_i64()
                                                .map(|alter| (step, alter as i8))
                                        });
                                    pitches_by_measure
                                        .entry(measure_index)
                                        .or_default()
                                        .entry(start_tick)
                                        .or_default()
                                        .push((pitch, spelling));
                                }
                            }

                            // --- Rests ---
                            if let Some(rest_events) = voice["rest_events"].as_array() {
                                for rest in rest_events {
                                    let start_tick = rest["start_tick"]
                                        .as_u64()
                                        .or_else(|| rest["start_tick"]["value"].as_u64())
                                        .unwrap_or(0)
                                        as u32;

                                    let duration =
                                        rest["duration_ticks"].as_u64().unwrap_or(960) as u32;

                                    let measure_index = actual_tick_to_measure(
                                        start_tick,
                                        measure_end_ticks,
                                        pickup_ticks,
                                        ticks_per_measure,
                                    );

                                    let entry = all_rests_by_measure
                                        .entry(measure_index)
                                        .or_default()
                                        .entry(start_tick)
                                        .or_insert(0);
                                    *entry = (*entry).max(duration);
                                }
                            }
                        }
                    }
                }

                // Convert tick→duration maps to flat duration lists for compute_measure_width
                let max_measure = all_notes_by_measure
                    .keys()
                    .chain(all_rests_by_measure.keys())
                    .copied()
                    .max()
                    .unwrap_or(0);

                for measure_index in 0..=max_measure {
                    while note_measures.len() <= measure_index {
                        note_measures.push(Vec::new());
                    }
                    while rest_measures.len() <= measure_index {
                        rest_measures.push(Vec::new());
                    }

                    if let Some(tick_durations) = all_notes_by_measure.get(&measure_index) {
                        for dur in tick_durations.values() {
                            note_measures[measure_index].push(*dur);
                        }
                    }
                    if let Some(tick_durations) = all_rests_by_measure.get(&measure_index) {
                        for dur in tick_durations.values() {
                            rest_measures[measure_index].push(*dur);
                        }
                    }
                }
            }
        }
    }

    // If no measures found, return empty default measures
    if note_measures.is_empty() && rest_measures.is_empty() {
        // 10 measures with 4 quarter notes each (no rests)
        (0..10).map(|_| (vec![960; 4], Vec::new(), 0u32)).collect()
    } else {
        let len = note_measures.len().max(rest_measures.len());
        note_measures.resize(len, Vec::new());
        rest_measures.resize(len, Vec::new());

        // Count chord-second ticks per measure (matching note_layout chord-second detection)
        let chord_seconds: Vec<u32> = (0..len)
            .map(|mi| {
                let tick_pitches = match pitches_by_measure.get(&mi) {
                    Some(tp) => tp,
                    None => return 0,
                };
                let mut count = 0u32;
                for notes in tick_pitches.values() {
                    if notes.len() < 2 {
                        continue;
                    }
                    let mut diatonic: Vec<i32> = notes
                        .iter()
                        .map(|&(pitch, ref spelling)| {
                            if let Some((step, alter)) = spelling {
                                let step_pos: i32 = match step {
                                    'C' => 0,
                                    'D' => 1,
                                    'E' => 2,
                                    'F' => 3,
                                    'G' => 4,
                                    'A' => 5,
                                    'B' => 6,
                                    _ => 0,
                                };
                                let base_pitch = pitch as i32 - *alter as i32;
                                let octave = base_pitch / 12 - 1;
                                octave * 7 + step_pos
                            } else {
                                let octave = (pitch / 12) as i32 - 1;
                                let pc = pitch % 12;
                                let step_pos: i32 = match pc {
                                    0 => 0,
                                    1 | 2 => 1,
                                    3 | 4 => 2,
                                    5 => 3,
                                    6 | 7 => 4,
                                    8 | 9 => 5,
                                    10 | 11 => 6,
                                    _ => 0,
                                };
                                octave * 7 + step_pos
                            }
                        })
                        .collect();
                    diatonic.sort();
                    diatonic.dedup();
                    for w in diatonic.windows(2) {
                        if w[1] - w[0] <= 1 {
                            count += 1;
                            break;
                        }
                    }
                }
                count
            })
            .collect();

        note_measures
            .into_iter()
            .zip(rest_measures)
            .zip(chord_seconds)
            .map(|((n, r), cs)| (n, r, cs))
            .collect()
    }
}

/// Extract instruments from CompiledScore JSON
pub(crate) fn extract_instruments(
    score: &serde_json::Value,
    global_time_numerator: u32,
    global_time_denominator: u32,
) -> Vec<InstrumentData> {
    let mut instruments = Vec::new();

    if let Some(instruments_array) = score["instruments"].as_array() {
        for instrument in instruments_array {
            let id = instrument["id"].as_str().unwrap_or("unknown").to_string();
            let name = instrument["name"]
                .as_str()
                .unwrap_or("Instrument")
                .to_string();
            let mut staves = Vec::new();

            if let Some(staves_array) = instrument["staves"].as_array() {
                for staff in staves_array {
                    let mut voices = Vec::new();

                    // Extract structural metadata (with defaults)
                    let clef = staff["clef"].as_str().unwrap_or("Treble").to_string();
                    // Use time signature from global_structural_events;
                    // fall back to staff-level for test fixtures that set it there
                    let time_numerator = if global_time_numerator != 4
                        || global_time_denominator != 4
                    {
                        global_time_numerator as u8
                    } else {
                        staff["time_signature"]["numerator"]
                            .as_u64()
                            .unwrap_or(global_time_numerator as u64) as u8
                    };
                    let time_denominator = if global_time_numerator != 4
                        || global_time_denominator != 4
                    {
                        global_time_denominator as u8
                    } else {
                        staff["time_signature"]["denominator"]
                            .as_u64()
                            .unwrap_or(global_time_denominator as u64) as u8
                    };
                    let key_sharps = staff["key_signature"]["sharps"].as_i64().unwrap_or(0) as i8;

                    if let Some(voices_array) = staff["voices"].as_array() {
                        for voice in voices_array {
                            let mut notes = Vec::new();

                            // Support both "notes" (LayoutView format) and "interval_events" (CompiledScore format)
                            // Check "notes" first for frontend fixtures, fall back to "interval_events" for backward compatibility

                            let note_array = voice["notes"]
                                .as_array()
                                .or_else(|| voice["interval_events"].as_array());

                            if let Some(notes_data) = note_array {
                                for note_item in notes_data {
                                    // Handle both formats:
                                    // Format 1 (notes): {tick: 0, duration: 960, pitch: 60}
                                    // Format 2 (interval_events): {start_tick: {value: 0}, duration_ticks: 960, pitch: {value: 60}}

                                    let pitch = if let Some(p) = note_item["pitch"].as_u64() {
                                        p as u8 // Format 1: direct value
                                    } else {
                                        note_item["pitch"]["value"].as_u64().unwrap_or(60) as u8 // Format 2: nested
                                    };

                                    let start_tick = if let Some(t) = note_item["tick"].as_u64() {
                                        t as u32 // Format 1: "tick"
                                    } else {
                                        note_item["start_tick"]
                                            .as_u64()
                                            .or_else(|| note_item["start_tick"]["value"].as_u64())
                                            .unwrap_or(0)
                                            as u32 // Format 2: plain int or nested
                                    };

                                    let duration_ticks = if let Some(d) =
                                        note_item["duration"].as_u64()
                                    {
                                        d as u32 // Format 1: "duration"
                                    } else {
                                        note_item["duration_ticks"].as_u64().unwrap_or(960) as u32 // Format 2
                                    };

                                    // Extract optional note spelling (step + alter) from MusicXML
                                    let spelling = note_item["spelling"]["step"]
                                        .as_str()
                                        .and_then(|s| s.chars().next())
                                        .and_then(|step| {
                                            note_item["spelling"]["alter"]
                                                .as_i64()
                                                .map(|alter| (step, alter as i8))
                                        });

                                    notes.push(NoteEvent {
                                        pitch,
                                        start_tick,
                                        duration_ticks,
                                        spelling,
                                        beam_info: {
                                            let mut beams = Vec::new();
                                            if let Some(beam_array) = note_item["beams"].as_array()
                                            {
                                                for beam_item in beam_array {
                                                    let number =
                                                        beam_item["number"].as_u64().unwrap_or(1)
                                                            as u8;
                                                    let beam_type = beam_item["beam_type"]
                                                        .as_str()
                                                        .unwrap_or("")
                                                        .to_string();
                                                    beams.push((number, beam_type));
                                                }
                                            }
                                            beams
                                        },
                                        staccato: note_item["staccato"].as_bool().unwrap_or(false),
                                        dot_count: note_item["dot_count"].as_u64().unwrap_or(0)
                                            as u8,
                                        note_id: note_item["id"].as_str().unwrap_or("").to_string(),
                                        tie_next: note_item["tie_next"]
                                            .as_str()
                                            .map(|s| s.to_string()),
                                        slur_next: note_item["slur_next"]
                                            .as_str()
                                            .map(|s| s.to_string()),
                                        slur_above: note_item["slur_above"].as_bool(),
                                        is_grace: note_item["is_grace"].as_bool().unwrap_or(false),
                                        has_explicit_accidental:
                                            note_item["has_explicit_accidental"]
                                                .as_bool()
                                                .unwrap_or(false),
                                        stem_down: note_item["stem_down"].as_bool(),
                                    });
                                }
                            }

                            voices.push(VoiceData {
                                notes,
                                rests: {
                                    let mut rests = Vec::new();
                                    if let Some(rest_events) = voice["rest_events"].as_array() {
                                        for rest_item in rest_events {
                                            let start_tick = rest_item["start_tick"]
                                                .as_u64()
                                                .or_else(|| {
                                                    rest_item["start_tick"]["value"].as_u64()
                                                })
                                                .unwrap_or(0)
                                                as u32;
                                            let duration_ticks =
                                                rest_item["duration_ticks"].as_u64().unwrap_or(960)
                                                    as u32;
                                            let note_type = rest_item["note_type"]
                                                .as_str()
                                                .map(|s| s.to_string());
                                            let voice_num =
                                                rest_item["voice"].as_u64().unwrap_or(1) as usize;
                                            let is_measure_rest = rest_item["is_measure_rest"]
                                                .as_bool()
                                                .unwrap_or(false);
                                            rests.push(RestLayoutEvent {
                                                start_tick,
                                                duration_ticks,
                                                note_type,
                                                voice: voice_num,
                                                is_measure_rest,
                                            });
                                        }
                                    }
                                    rests
                                },
                            });
                        }
                    }

                    // Parse key signature change events (for mid-piece key changes)
                    let mut key_signature_events: Vec<(u32, i8)> = Vec::new();
                    if let Some(events_array) = staff["key_signature_events"].as_array() {
                        for ev in events_array {
                            let tick = ev["tick"].as_u64().unwrap_or(0) as u32;
                            let sharps = ev["sharps"].as_i64().unwrap_or(0) as i8;
                            key_signature_events.push((tick, sharps));
                        }
                    }
                    // Also extract from staff_structural_events (DTO path)
                    if let Some(events_array) = staff["staff_structural_events"].as_array() {
                        for ev in events_array {
                            if let Some(ks_obj) = ev.get("KeySignature") {
                                let tick = ks_obj["tick"]
                                    .as_u64()
                                    .or_else(|| ks_obj["tick"]["value"].as_u64())
                                    .unwrap_or(0) as u32;
                                let sharps = ks_obj["sharps"].as_i64().unwrap_or(0) as i8;
                                key_signature_events.push((tick, sharps));
                            }
                        }
                    }
                    key_signature_events.sort_by_key(|&(t, _)| t);
                    key_signature_events.dedup_by_key(|&mut (t, _)| t);

                    // Parse clef change events (for mid-piece clef changes)
                    // Clef events may be stored in two places:
                    //  1. A flat "clef_events" array (legacy path)
                    //  2. Inside "staff_structural_events" as {"Clef": {"tick":..,"clef":..}}
                    let mut clef_events: Vec<(u32, String)> = Vec::new();
                    if let Some(events_array) = staff["clef_events"].as_array() {
                        for ev in events_array {
                            let tick = ev["tick"]
                                .as_u64()
                                .or_else(|| ev["tick"]["value"].as_u64())
                                .unwrap_or(0) as u32;
                            let clef_name = ev["clef"].as_str().unwrap_or("Treble").to_string();
                            clef_events.push((tick, clef_name));
                        }
                    }
                    // Also extract from staff_structural_events (DTO path)
                    if let Some(events_array) = staff["staff_structural_events"].as_array() {
                        for ev in events_array {
                            if let Some(clef_obj) = ev.get("Clef") {
                                let tick = clef_obj["tick"]
                                    .as_u64()
                                    .or_else(|| clef_obj["tick"]["value"].as_u64())
                                    .unwrap_or(0) as u32;
                                let clef_name =
                                    clef_obj["clef"].as_str().unwrap_or("Treble").to_string();
                                clef_events.push((tick, clef_name));
                            }
                        }
                    }
                    clef_events.sort_by_key(|(t, _)| *t);
                    clef_events.dedup_by_key(|(t, _)| *t);

                    staves.push(StaffData {
                        voices,
                        clef,
                        time_numerator,
                        time_denominator,
                        key_sharps,
                        key_signature_events,
                        clef_events,
                        octave_shift_regions: Vec::new(),
                    });
                }
            }

            instruments.push(InstrumentData { id, name, staves });
        }
    }

    instruments
}
