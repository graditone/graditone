//! Glyph positioning
//!
//! Positions glyphs based on pitch (vertical) and timing (horizontal).

use crate::layout::metrics::get_glyph_bbox;
use crate::layout::types::{BoundingBox, Glyph, LedgerLine, Point, SourceReference};

/// Convert pitch to y-coordinate on staff
///
/// Uses standard music notation positioning based on clef type and diatonic scale degrees.
/// Staff lines represent the diatonic scale (C-D-E-F-G-A-B), not chromatic semitones.
///
/// Treble clef (G clef) positions:
/// - F5 (MIDI 77) = top line (y=0)
/// - E5 (MIDI 76) = space (y=20)
/// - D5 (MIDI 74) = 2nd line (y=40)
/// - C5 (MIDI 72) = space (y=60)
/// - B4 (MIDI 71) = middle line (y=80)
/// - A4 (MIDI 69) = space (y=100)
/// - G4 (MIDI 67) = 4th line (y=120)
/// - F4 (MIDI 65) = space (y=140)
/// - E4 (MIDI 64) = bottom line (y=160)
///
/// Bass clef (F clef) positions:
/// - A3 (MIDI 57) = top line (y=0)
/// - G3 (MIDI 55) = space (y=20)
/// - F3 (MIDI 53) = 2nd line (y=40)
/// - E3 (MIDI 52) = space (y=60)
/// - D3 (MIDI 50) = middle line (y=80)
/// - C3 (MIDI 48) = space (y=100)
/// - B2 (MIDI 47) = 4th line (y=120)
/// - A2 (MIDI 45) = space (y=140)
/// - G2 (MIDI 43) = bottom line (y=160)
///
/// # Arguments
/// * `pitch` - MIDI pitch number (60 = middle C, 69 = A440)
/// * `clef_type` - Type of clef ("Treble", "Bass", "Alto", "Tenor")
/// * `units_per_space` - Scaling factor (default: 20.0 logical units = 1 staff space)
///
/// # Returns
/// Y-coordinate in logical units (system-relative, positive = downward)
pub fn pitch_to_y(pitch: u8, clef_type: &str, units_per_space: f32) -> f32 {
    pitch_to_y_with_spelling(pitch, clef_type, units_per_space, None)
}

/// Convert MIDI pitch to Y coordinate, optionally using explicit note spelling
///
/// When `spelling` is provided (step letter + alter), the note is positioned on the
/// correct diatonic line/space for its spelled name. Without spelling, sharps are assumed
/// for chromatic pitches (e.g., MIDI 63 = D# not Eb).
pub fn pitch_to_y_with_spelling(
    pitch: u8,
    clef_type: &str,
    units_per_space: f32,
    spelling: Option<(char, i8)>,
) -> f32 {
    // Convert MIDI pitch to diatonic staff position
    // Each octave has 7 diatonic notes (C=0, D=1, E=2, F=3, G=4, A=5, B=6)

    // Map step letter to diatonic position within octave
    fn step_to_diatonic(step: char) -> f32 {
        match step {
            'C' => 0.0,
            'D' => 1.0,
            'E' => 2.0,
            'F' => 3.0,
            'G' => 4.0,
            'A' => 5.0,
            'B' => 6.0,
            _ => 0.0,
        }
    }

    let (diatonic_pos_in_octave, octave) = if let Some((step, _alter)) = spelling {
        // Use explicit spelling to determine staff position
        let diatonic = step_to_diatonic(step);
        // MIDI octave: C4 = 60, so octave = pitch / 12
        // But we need to handle boundary: B# is in the next octave, Cb is in the previous
        let midi_octave = (pitch / 12) as i32;
        // Check for octave boundary crossings:
        // - Cb/Cbb: spelled as C but sounds as B (one octave lower MIDI-wise)
        //   MIDI gives us octave of B, but the note is spelled as C in that same octave
        // - B#/B##: spelled as B but sounds as C (one octave higher MIDI-wise)
        //   MIDI gives us octave of C, but the note is spelled as B in the previous octave
        let adjusted_octave = if step == 'B' && (pitch % 12) < 2 {
            // B# or B## — MIDI pitch is in C/C# range but note is spelled as B
            // Use the octave below the MIDI octave
            midi_octave - 1
        } else if step == 'C' && (pitch % 12) > 10 {
            // Cb or Cbb — MIDI pitch is in B/Bb range but note is spelled as C
            // Use the octave above the MIDI octave
            midi_octave + 1
        } else {
            midi_octave
        };
        (diatonic, adjusted_octave)
    } else {
        // Fallback: infer from MIDI pitch class (assumes sharps for chromatic notes)
        const DIATONIC_POSITIONS: [f32; 12] = [
            0.0, // C
            0.0, // C# (same Y position as C, sharp drawn separately)
            1.0, // D
            1.0, // D# (same Y position as D, sharp drawn separately)
            2.0, // E
            3.0, // F
            3.0, // F# (same Y position as F, sharp drawn separately)
            4.0, // G
            4.0, // G# (same Y position as G, sharp drawn separately)
            5.0, // A
            5.0, // A# (same Y position as A, sharp drawn separately)
            6.0, // B
        ];
        let pitch_class = (pitch % 12) as usize;
        let octave = (pitch / 12) as i32;
        (DIATONIC_POSITIONS[pitch_class], octave)
    };

    // Total diatonic steps from C(-1) (MIDI 0)
    let diatonic_steps_from_c_minus1 = (octave * 7) as f32 + diatonic_pos_in_octave;

    // Determine reference pitch for top line based on clef type
    let reference_diatonic = match clef_type {
        "Bass" => {
            // Bass clef: A3 (MIDI 57) = top line at y=0
            // MIDI 57: octave = 57/12 = 4, pitch_class = 57%12 = 9 (A)
            // Diatonic position: 4 * 7 + 5 (A=5) = 33 diatonic steps from C(-1)
            4.0 * 7.0 + 5.0 // = 33
        }
        "Alto" => {
            // Alto clef: G4 (MIDI 67) = top line at y=0
            // MIDI 67: octave = 67/12 = 5, pitch_class = 67%12 = 7 (G)
            // Diatonic position: 5 * 7 + 4 (G=4) = 39 diatonic steps from C(-1)
            5.0 * 7.0 + 4.0 // = 39
        }
        "Tenor" => {
            // Tenor clef: E4 (MIDI 64) = top line at y=0
            // MIDI 64: octave = 64/12 = 5, pitch_class = 64%12 = 4 (E)
            // Diatonic position: 5 * 7 + 2 (E=2) = 37 diatonic steps from C(-1)
            5.0 * 7.0 + 2.0 // = 37
        }
        _ => {
            // Treble clef (default): F5 (MIDI 77) = top line at y=0
            // MIDI 77: octave = 77/12 = 6, pitch_class = 77%12 = 5 (F)
            // Diatonic position: 6 * 7 + 3 (F=3) = 45 diatonic steps from C(-1)
            6.0 * 7.0 + 3.0 // = 45
        }
    };

    // Staff spaces from reference pitch (down = positive)
    // Each diatonic step = 0.5 staff spaces (half a line gap)
    // Adjacent staff lines are 2 diatonic steps = 1 staff space apart
    let staff_spaces_from_reference = reference_diatonic - diatonic_steps_from_c_minus1;

    // Convert to logical units:
    // - Multiply by 0.5 to convert diatonic steps to half-spaces (line gap = 1 ups, 2 steps per gap)
    // - Subtract 0.5 staff spaces to compensate for SMuFL glyph baseline positioning
    (staff_spaces_from_reference * 0.5 - 0.5) * units_per_space
}

/// Compute glyph bounding box using SMuFL metrics
///
/// Fetches glyph metrics from embedded Bravura font and scales to font size
///
/// # Arguments
/// * `glyph_name` - SMuFL glyph name (e.g., "noteheadBlack")
/// * `position` - (x, y) coordinates of glyph anchor point
/// * `font_size` - Font size in logical units (typically 40.0 = 4 staff spaces)
/// * `units_per_space` - Scaling factor
///
/// # Returns
/// Bounding box in logical units relative to system coordinates
pub fn compute_glyph_bounding_box(
    glyph_name: &str,
    position: &Point,
    font_size: f32,
    units_per_space: f32,
) -> BoundingBox {
    let metrics_bbox = get_glyph_bbox(glyph_name);

    // Scale metrics bbox by font size / units_per_space
    let scale = font_size / (4.0 * units_per_space); // Font size is in 4 staff spaces

    BoundingBox {
        x: position.x + metrics_bbox.x * scale,
        y: position.y + metrics_bbox.y * scale,
        width: metrics_bbox.width * scale,
        height: metrics_bbox.height * scale,
    }
}

/// Position noteheads for a set of notes
///
/// Creates Glyph structs for noteheads using pitch-to-y mapping and horizontal spacing
///
/// # Arguments
/// * `notes` - Note events with pitch, start_tick, duration
/// * `horizontal_offsets` - Pre-computed x offsets for each note
/// * `clef_type` - Type of clef for pitch positioning ("Treble", "Bass", etc.)
/// * `units_per_space` - Scaling factor
/// * `instrument_id` - Instrument ID for source reference
/// * `staff_index` - Staff index for source reference
/// * `voice_index` - Voice index for source reference
/// * `staff_vertical_offset` - Vertical offset in logical units for this staff
/// * `beamed_note_indices` - Set of note indices that are part of beam groups
///   (these use bare noteheadBlack instead of combined head+stem+flag glyphs)
///
/// # Returns
/// Vector of positioned glyph structs
#[allow(clippy::too_many_arguments)]
pub fn position_noteheads(
    notes: &[super::NoteData], // (pitch, start_tick, duration, spelling)
    horizontal_offsets: &[f32],
    clef_types: &[&str],
    units_per_space: f32,
    instrument_id: &str,
    staff_index: usize,
    voice_index: usize,
    staff_vertical_offset: f32,
    beamed_note_indices: &std::collections::HashSet<usize>,
) -> Vec<Glyph> {
    notes
        .iter()
        .zip(horizontal_offsets.iter())
        .enumerate()
        .map(|(i, ((pitch, _start, duration, spelling), &x))| {
            // Use explicit spelling for Y position when available (e.g., Eb vs D#)
            let clef_type = clef_types[i];
            let y = pitch_to_y_with_spelling(*pitch, clef_type, units_per_space, *spelling)
                + staff_vertical_offset;
            let position = Point { x, y };

            // T021-T022: Choose notehead codepoint based on duration_ticks
            // For beamed notes (in beamed_note_indices), use bare noteheadBlack (U+E0A4)
            // instead of combined head+stem+flag glyphs
            let is_beamed = beamed_note_indices.contains(&i) && *duration < 960;

            // Determine stem direction based on note position relative to staff middle line.
            // Middle line (3rd line, 0-indexed 2) is at staff_vertical_offset + 2.0*ups, but
            // pitch_to_y includes a -0.5*ups offset, so threshold is staff_vertical_offset + 1.5*ups.
            let stem_middle_y = staff_vertical_offset + 1.5 * units_per_space;
            let stem_down = y <= stem_middle_y;

            let (codepoint, glyph_name) = if is_beamed {
                ('\u{E0A4}', "noteheadBlack")
            } else if *duration >= 3840 {
                ('\u{E0A2}', "noteheadWhole")
            } else if *duration >= 1920 {
                if stem_down {
                    ('\u{E1D4}', "noteHalfDown")
                } else {
                    ('\u{E1D3}', "noteHalfUp")
                }
            } else if *duration >= 960 {
                if stem_down {
                    ('\u{E1D6}', "noteQuarterDown")
                } else {
                    ('\u{E1D5}', "noteQuarterUp")
                }
            } else if *duration >= 480 {
                if stem_down {
                    ('\u{E1D8}', "note8thDown")
                } else {
                    ('\u{E1D7}', "note8thUp")
                }
            } else if stem_down {
                ('\u{E1DA}', "note16thDown")
            } else {
                ('\u{E1D9}', "note16thUp")
            };

            let bounding_box = compute_glyph_bounding_box(
                glyph_name,
                &position,
                40.0, // Standard font size
                units_per_space,
            );

            Glyph {
                position,
                bounding_box,
                codepoint: codepoint.to_string(),
                source_reference: SourceReference {
                    instrument_id: instrument_id.to_string(),
                    staff_index,
                    voice_index,
                    event_index: i,
                },
                font_size: None,
            }
        })
        .collect()
}

/// Position clef at system start (T030-T031)
///
/// Places clef glyph at specified x-position with correct vertical alignment for clef type.
///
/// # Arguments
/// * `clef_type` - Type of clef ("Treble", "Bass", "Alto", "Tenor")
/// * `x_position` - Horizontal position in logical units
/// * `units_per_space` - Scaling factor (20 units = 1 staff space)
/// * `staff_vertical_offset` - Vertical offset in logical units for this staff
///
/// # Returns
/// Glyph positioned at correct location with appropriate SMuFL codepoint
pub fn position_clef(
    clef_type: &str,
    x_position: f32,
    units_per_space: f32,
    staff_vertical_offset: f32,
) -> Glyph {
    // SMuFL codepoints for clefs
    let (codepoint, y_position) = match clef_type {
        "Treble" => {
            // G clef centered on line 3 (G4), y from pitch_to_y
            ('\u{E050}', 50.0)
        }
        "Bass" => {
            // F clef centered on line 1 (F3), y from pitch_to_y
            ('\u{E062}', 10.0)
        }
        "Alto" => {
            // C clef centered on middle line (C4), y from pitch_to_y
            ('\u{E05C}', 30.0)
        }
        "Tenor" => {
            // C clef on 4th line (C4), y from pitch_to_y
            ('\u{E05D}', 10.0)
        }
        _ => {
            // Default to treble clef
            ('\u{E050}', 50.0)
        }
    };

    let position = Point {
        x: x_position,
        y: y_position + staff_vertical_offset,
    };

    let bounding_box = compute_glyph_bounding_box(
        "gClef", // Generic name for metrics lookup
        &position,
        40.0,
        units_per_space,
    );

    Glyph {
        position,
        bounding_box,
        codepoint: codepoint.to_string(),
        source_reference: SourceReference {
            instrument_id: "structural".to_string(),
            staff_index: 0,
            voice_index: 0,
            event_index: 0,
        },
        font_size: None,
    }
}

/// Position a smaller courtesy/cautionary clef for mid-system clef changes.
///
/// Rendered at 75% of the normal clef size, following standard engraving practice
/// where clef changes within a system use a smaller clef glyph.
pub fn position_courtesy_clef(
    clef_type: &str,
    x_position: f32,
    units_per_space: f32,
    staff_vertical_offset: f32,
) -> Glyph {
    let scale = 0.75;
    let courtesy_font_size = 60.0; // 75% of normal 80

    let (codepoint, y_position) = match clef_type {
        "Treble" => ('\u{E050}', 50.0),
        "Bass" => ('\u{E062}', 10.0),
        "Alto" => ('\u{E05C}', 30.0),
        "Tenor" => ('\u{E05D}', 10.0),
        _ => ('\u{E050}', 50.0),
    };

    // Adjust y to vertically center the smaller glyph on the same staff line
    let y_adjust = (1.0 - scale) * 10.0; // half-space nudge toward center
    let position = Point {
        x: x_position,
        y: y_position + y_adjust + staff_vertical_offset,
    };

    let bounding_box = compute_glyph_bounding_box(
        "gClef",
        &position,
        40.0 * scale, // smaller bounding box
        units_per_space,
    );

    Glyph {
        position,
        bounding_box,
        codepoint: codepoint.to_string(),
        source_reference: SourceReference {
            instrument_id: "structural".to_string(),
            staff_index: 0,
            voice_index: 0,
            event_index: 0,
        },
        font_size: Some(courtesy_font_size),
    }
}

/// Convert a number (0-99) to a vector of SMuFL time signature digit codepoints.
/// SMuFL codepoints: U+E080 = 0, U+E081 = 1, ..., U+E089 = 9
fn number_to_smufl_codepoints(n: u8) -> Vec<char> {
    if n >= 10 {
        let tens = n / 10;
        let ones = n % 10;
        vec![
            char::from_u32(0xE080 + tens as u32).unwrap_or('?'),
            char::from_u32(0xE080 + ones as u32).unwrap_or('?'),
        ]
    } else {
        vec![char::from_u32(0xE080 + n as u32).unwrap_or('?')]
    }
}

/// Position time signature at system start (T032-T033)
///
/// Creates two stacked glyphs for numerator and denominator.
///
/// # Arguments
/// * `numerator` - Top number (beats per measure)
/// * `denominator` - Bottom number (note value)
/// * `x_position` - Horizontal position in logical units
/// * `units_per_space` - Scaling factor
/// * `staff_vertical_offset` - Vertical offset in logical units for this staff
///
/// # Returns
/// Vector of 2 glyphs (numerator above middle line, denominator below)
pub fn position_time_signature(
    numerator: u8,
    denominator: u8,
    x_position: f32,
    units_per_space: f32,
    staff_vertical_offset: f32,
) -> Vec<Glyph> {
    let mut glyphs = Vec::new();

    // SMuFL time signature digits: U+E080-U+E089 (0-9)
    // For multi-digit numbers (e.g. 12), emit one glyph per digit
    let numerator_codepoints = number_to_smufl_codepoints(numerator);
    let denominator_codepoints = number_to_smufl_codepoints(denominator);

    // Approximate width of one SMuFL time-sig digit (units_per_space-relative)
    let digit_width = units_per_space * 1.4;

    // Numerator in upper half of staff (between lines 0-2, centered at y=10)
    let num_total_width = numerator_codepoints.len() as f32 * digit_width;
    let num_start_x = x_position - num_total_width / 2.0 + digit_width / 2.0;
    for (di, cp) in numerator_codepoints.iter().enumerate() {
        let pos = Point {
            x: num_start_x + di as f32 * digit_width,
            y: 10.0 + staff_vertical_offset,
        };
        let bbox = compute_glyph_bounding_box("timeSig0", &pos, 40.0, units_per_space);
        glyphs.push(Glyph {
            position: pos,
            bounding_box: bbox,
            codepoint: cp.to_string(),
            source_reference: SourceReference {
                instrument_id: "structural".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 0,
            },
            font_size: None,
        });
    }

    // Denominator in lower half of staff (between lines 2-4, centered at y=50)
    let den_total_width = denominator_codepoints.len() as f32 * digit_width;
    let den_start_x = x_position - den_total_width / 2.0 + digit_width / 2.0;
    for (di, cp) in denominator_codepoints.iter().enumerate() {
        let pos = Point {
            x: den_start_x + di as f32 * digit_width,
            y: 50.0 + staff_vertical_offset,
        };
        let bbox = compute_glyph_bounding_box("timeSig0", &pos, 40.0, units_per_space);
        glyphs.push(Glyph {
            position: pos,
            bounding_box: bbox,
            codepoint: cp.to_string(),
            source_reference: SourceReference {
                instrument_id: "structural".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 0,
            },
            font_size: None,
        });
    }

    glyphs
}

/// Position key signature accidentals (T034-T035)
///
/// Places sharps or flats at correct staff positions for the given clef type.
///
/// # Arguments
/// * `sharps` - Number of sharps (positive) or flats (negative), 0 for C major/A minor
/// * `clef_type` - Type of clef determines vertical positions
/// * `x_start` - Starting horizontal position
/// * `units_per_space` - Scaling factor
/// * `staff_vertical_offset` - Vertical offset in logical units for this staff
///
/// # Returns
/// Vector of glyphs positioned at correct line/space positions
pub fn position_key_signature(
    sharps: i8,
    clef_type: &str,
    x_start: f32,
    units_per_space: f32,
    staff_vertical_offset: f32,
) -> Vec<Glyph> {
    let mut glyphs = Vec::new();

    if sharps == 0 {
        return glyphs; // C major/A minor has no accidentals
    }

    // SMuFL accidental glyphs
    let codepoint = if sharps > 0 {
        '\u{E262}' // accidentalSharp
    } else {
        '\u{E260}' // accidentalFlat
    };

    // Position tables per clef: y offsets relative to staff_vertical_offset.
    // Derived from standard key-signature placement conventions (Gould "Behind Bars" p.86).
    // Each clef uses the standard zigzag pattern that keeps accidentals within the staff.
    // Sharps order: F C G D A E B | Flats order: B E A D G C F
    //
    // Staff position → y mapping (per-clef, with -0.5 staff-space glyph offset):
    //   Treble: F5=-10, E5=0, D5=10, C5=20, B4=30, A4=40, G4=50, F4=60, E4=70
    //   Bass:   A3=-10, G3=0, F3=10, E3=20, D3=30, C3=40, B2=50, A2=60, G2=70
    //   Alto:   G4=-10, F4=0, E4=10, D4=20, C4=30, B3=40, A3=50, G3=60, F3=70
    //   Tenor:  E4=-10, D4=0, C4=10, B3=20, A3=30, G3=40, F3=50, E3=60, D3=70
    let (sharp_positions, flat_positions) = match clef_type {
        "Bass" => (
            //       F♯3   C♯3   G♯3   D♯3   A♯2   E♯3   B♯2
            vec![10.0, 40.0, 0.0, 30.0, 60.0, 20.0, 50.0],
            //       B♭2   E♭3   A♭2   D♭3   G♭2   C♭3   F♭3
            vec![50.0, 20.0, 60.0, 30.0, 70.0, 40.0, 10.0],
        ),
        "Alto" => (
            //       F♯4   C♯4   G♯4   D♯4   A♯3   E♯4   B♯3
            vec![0.0, 30.0, -10.0, 20.0, 50.0, 10.0, 40.0],
            //       B♭3   E♭4   A♭3   D♭4   G♭3   C♭4   F♭3
            vec![40.0, 10.0, 50.0, 20.0, 60.0, 30.0, 70.0],
        ),
        "Tenor" => (
            //       F♯3   C♯4   G♯3   D♯3   A♯3   E♯4   B♯3
            vec![50.0, 10.0, 40.0, 70.0, 30.0, -10.0, 20.0],
            //       B♭3   E♭4   A♭3   D♭4   G♭3   C♭4   F♭3
            vec![20.0, -10.0, 30.0, 0.0, 40.0, 10.0, 50.0],
        ),
        _ => (
            // Treble clef (default fallback)
            //       F♯5   C♯5   G♯5   D♯5   A♯4   E♯5   B♯4
            vec![-10.0, 20.0, -20.0, 10.0, 40.0, 0.0, 30.0],
            //       B♭4   E♭5   A♭4   D♭5   G♭4   C♭5   F♭4
            vec![30.0, 0.0, 40.0, 10.0, 50.0, 20.0, 60.0],
        ),
    };

    // Select positions based on sharps/flats
    let positions = if sharps > 0 {
        &sharp_positions
    } else {
        &flat_positions
    };

    let count = sharps.unsigned_abs() as usize;
    let horizontal_spacing = 15.0; // Space between accidentals

    for (i, &y_pos) in positions
        .iter()
        .enumerate()
        .take(count.min(positions.len()))
    {
        let position = Point {
            x: x_start + (i as f32 * horizontal_spacing),
            y: y_pos + staff_vertical_offset,
        };

        let bbox = compute_glyph_bounding_box("accidentalSharp", &position, 40.0, units_per_space);

        glyphs.push(Glyph {
            position,
            bounding_box: bbox,
            codepoint: codepoint.to_string(),
            source_reference: SourceReference {
                instrument_id: "structural".to_string(),
                staff_index: 0,
                voice_index: 0,
                event_index: 0,
            },
            font_size: None,
        });
    }

    glyphs
}

/// Position accidentals before noteheads
///
/// Determines which notes need accidentals based on key signature and
/// measure context, then creates positioned glyph structs.
///
/// Accidental rules:
/// - Notes altered from the key signature need an accidental
/// - Accidentals carry through the measure (same pitch = no repeat)
/// - A natural sign cancels a key signature accidental
/// - Barline boundaries (every 3840 ticks in 4/4) reset accidental state
///
/// # Arguments
/// * `notes` - Note events (pitch, start_tick, duration)
/// * `horizontal_offsets` - Pre-computed x offsets for each note
/// * `clef_type` - Clef type for pitch positioning
/// * `units_per_space` - Scaling factor
/// * `instrument_id` - Instrument ID for source reference
/// * `staff_index` - Staff index for source reference
/// * `voice_index` - Voice index for source reference
/// * `staff_vertical_offset` - Vertical offset for this staff
/// * `key_sharps` - Key signature (positive = sharps, negative = flats, 0 = C major)
///
/// # Returns
/// Vector of accidental glyphs positioned to the left of their noteheads
#[allow(clippy::too_many_arguments)]
pub fn position_note_accidentals(
    notes: &[super::NoteData],
    horizontal_offsets: &[f32],
    clef_types: &[&str],
    units_per_space: f32,
    instrument_id: &str,
    staff_index: usize,
    voice_index: usize,
    staff_vertical_offset: f32,
    key_sharps: i8,
    ticks_per_measure: u32,
    key_signature_events: &[(u32, i8)],
) -> Vec<Glyph> {
    use std::collections::HashMap;

    // Build set of pitch classes affected by key signature
    // Sharp order: F C G D A E B (pitch classes: 5,0,7,2,9,4,11)
    // Flat order:  B E A D G C F (pitch classes: 11,4,9,2,7,0,5)
    let sharp_order: [u8; 7] = [5, 0, 7, 2, 9, 4, 11]; // F, C, G, D, A, E, B
    let flat_order: [u8; 7] = [11, 4, 9, 2, 7, 0, 5]; // B, E, A, D, G, C, F

    // Helper to build key_alterations from a key_sharps value
    let build_key_alterations = |ks: i8| -> HashMap<u8, i8> {
        let mut ka = HashMap::new();
        if ks > 0 {
            for &pc in sharp_order.iter().take(ks as usize) {
                ka.insert(pc, 1);
            }
        } else if ks < 0 {
            for &pc in flat_order.iter().take(ks.unsigned_abs() as usize) {
                ka.insert(pc, -1);
            }
        }
        ka
    };

    // key_alterations maps pitch_class -> alteration (+1 = sharp, -1 = flat)
    let mut key_alterations = build_key_alterations(key_sharps);
    let mut active_key_sharps = key_sharps;

    // Map pitch classes to their "natural" (white key) MIDI value
    // C=0, D=2, E=4, F=5, G=7, A=9, B=11
    let natural_pitch_classes: [u8; 12] = [
        0,  // C  -> natural = C(0)
        0,  // C# -> natural = C(0), so alteration = +1
        2,  // D  -> natural = D(2)
        2,  // D# -> natural = D(2), so alteration = +1
        4,  // E  -> natural = E(4)
        5,  // F  -> natural = F(5)
        5,  // F# -> natural = F(5), so alteration = +1
        7,  // G  -> natural = G(7)
        7,  // G# -> natural = G(7), so alteration = +1
        9,  // A  -> natural = A(9)
        9,  // A# -> natural = A(9), so alteration = +1
        11, // B  -> natural = B(11)
    ];

    // Compute the chromatic alteration of each pitch class
    // 0 = natural, +1 = sharp, -1 = flat
    let chromatic_alteration: [i8; 12] = [
        0, // C  = natural
        1, // C# = sharp
        0, // D  = natural
        1, // D# = sharp (enharmonic Eb = flat, but MIDI doesn't distinguish)
        0, // E  = natural
        0, // F  = natural
        1, // F# = sharp
        0, // G  = natural
        1, // G# = sharp (enharmonic Ab = flat)
        0, // A  = natural
        1, // A# = sharp (enharmonic Bb = flat)
        0, // B  = natural
    ];

    // For flats in the key signature, we need to interpret certain pitch classes as flats
    // E.g., in F major (1 flat = Bb), MIDI pitch class 10 is Bb (flat), not A#
    // The key signature tells us which way to spell ambiguous pitches

    let mut accidental_glyphs = Vec::new();

    // Track accidentals stated so far in the current measure
    // Maps pitch_class -> last stated alteration in this measure
    let mut measure_accidental_state: HashMap<u8, i8> = HashMap::new();
    let mut current_measure: u32 = u32::MAX; // Force reset on first note

    // Position accidental to the left of notehead.
    // At font-size 80: notehead half-width ~12 units, accidental half-width ~10 units,
    // standard gap ~3 units.  Total center-to-center offset: -(12 + 3 + 10) = -25.
    let accidental_x_offset = -25.0;

    for (i, ((pitch, start_tick, _duration, spelling), &notehead_x)) in
        notes.iter().zip(horizontal_offsets.iter()).enumerate()
    {
        let pitch = *pitch;
        let start_tick = *start_tick;
        let pitch_class = pitch % 12;

        // Check for measure boundary (reset accidental state)
        let measure = start_tick / ticks_per_measure;
        if measure != current_measure {
            measure_accidental_state.clear();
            current_measure = measure;

            // Check if key signature changed at this measure's tick
            if !key_signature_events.is_empty() {
                let measure_tick = measure * ticks_per_measure;
                // Find the last key event at or before this measure's start
                let mut new_key = key_sharps; // default to initial
                for &(event_tick, sharps) in key_signature_events {
                    if event_tick <= measure_tick {
                        new_key = sharps;
                    } else {
                        break;
                    }
                }
                if new_key != active_key_sharps {
                    active_key_sharps = new_key;
                    key_alterations = build_key_alterations(active_key_sharps);
                }
            }
        }

        // Determine the note's actual alteration
        // If explicit spelling is available from MusicXML, use it; otherwise infer from MIDI
        let note_alteration = if let Some((_step, alter)) = spelling {
            *alter
        } else {
            chromatic_alteration[pitch_class as usize]
        };

        // Derive the diatonic (white-key) pitch class for this note.
        // When explicit spelling is available, use the step letter directly;
        // otherwise fall back to the sharp-biased natural_pitch_classes table.
        let diatonic_pc = if let Some((step, _alter)) = spelling {
            match step {
                'C' => 0u8,
                'D' => 2,
                'E' => 4,
                'F' => 5,
                'G' => 7,
                'A' => 9,
                'B' => 11,
                _ => natural_pitch_classes[pitch_class as usize],
            }
        } else {
            natural_pitch_classes[pitch_class as usize]
        };

        // What does the key signature say about this diatonic note?
        let key_says = key_alterations.get(&diatonic_pc).copied().unwrap_or(0);

        // A note needs an accidental if:
        // 1. It has an alteration not covered by the key signature, OR
        // 2. It is natural but the key signature would alter it (needs a natural sign)

        let needs_accidental;
        let accidental_type: i8; // +1=sharp, -1=flat, 0=natural

        if note_alteration == key_says {
            // Note matches what the key signature prescribes → no accidental
            needs_accidental = false;
            accidental_type = 0;
        } else {
            // Note differs from key signature → show accidental
            needs_accidental = true;
            accidental_type = note_alteration;
        }

        if !needs_accidental {
            continue;
        }

        // Check measure-scoped state: skip if same accidental already stated for this pitch
        if let Some(&prev) = measure_accidental_state.get(&pitch_class) {
            if prev == accidental_type {
                continue; // Already stated this accidental in this measure
            }
        }

        // Record this accidental in the measure state
        measure_accidental_state.insert(pitch_class, accidental_type);

        // Choose SMuFL codepoint
        let (codepoint, glyph_name) = match accidental_type {
            1 => ('\u{E262}', "accidentalSharp"),
            -1 => ('\u{E260}', "accidentalFlat"),
            _ => ('\u{E261}', "accidentalNatural"),
        };

        // Position accidental at same Y as notehead, offset to the left
        let clef_type = clef_types[i];
        let y = pitch_to_y_with_spelling(pitch, clef_type, units_per_space, *spelling)
            + staff_vertical_offset;
        let position = Point {
            x: notehead_x + accidental_x_offset,
            y,
        };

        let bounding_box = compute_glyph_bounding_box(glyph_name, &position, 40.0, units_per_space);

        accidental_glyphs.push(Glyph {
            position,
            bounding_box,
            codepoint: codepoint.to_string(),
            source_reference: SourceReference {
                instrument_id: instrument_id.to_string(),
                staff_index,
                voice_index,
                event_index: i,
            },
            font_size: None,
        });
    }

    accidental_glyphs
}

/// Position ledger lines for notes above or below the 5-line staff
///
/// Ledger lines are short horizontal lines drawn at every staff-space interval
/// between the staff boundary and the note position, for notes outside the
/// standard 5-line range.
///
/// Staff lines span y=0 (top) to y=4*units_per_space = 80 (bottom) relative
/// to the staff's vertical offset. Notes above the top line (y < 0) or below
/// the bottom line (y > 80) need ledger lines.
///
/// # Arguments
/// * `notes` - Note events (pitch, start_tick, duration)
/// * `horizontal_offsets` - Pre-computed x offsets for each note
/// * `clef_type` - Clef type for pitch positioning
/// * `units_per_space` - Scaling factor (20.0 = 1 staff space)
/// * `staff_vertical_offset` - Vertical offset for this staff
///
/// # Returns
/// Vector of LedgerLine structs for notes outside staff range
pub fn position_ledger_lines(
    notes: &[super::NoteData],
    horizontal_offsets: &[f32],
    clef_types: &[&str],
    units_per_space: f32,
    staff_vertical_offset: f32,
) -> Vec<LedgerLine> {
    let mut ledger_lines = Vec::new();

    // Staff line positions relative to staff_vertical_offset:
    // Top line: y = staff_vertical_offset + 0
    // Bottom line: y = staff_vertical_offset + 4 * units_per_space (= 80 at ups=20)
    let top_line_y = staff_vertical_offset;
    let bottom_line_y = staff_vertical_offset + 4.0 * units_per_space;

    // Ledger line half-width: notehead is ~1.18 staff spaces wide (half = 0.59),
    // plus a standard 0.5 staff-space overhang on each side = 1.1 total.
    // This ensures the line visibly extends beyond the notehead on both sides.
    let ledger_half_width = 1.1 * units_per_space;

    // Use a set to deduplicate ledger lines at the same (x, y) position
    // (multiple notes at the same tick/pitch shouldn't duplicate ledger lines)
    let mut seen: std::collections::HashSet<(i32, i32)> = std::collections::HashSet::new();

    for (i, ((pitch, _start_tick, _duration, spelling), &notehead_x)) in
        notes.iter().zip(horizontal_offsets.iter()).enumerate()
    {
        let clef_type = clef_types[i];
        let note_y = pitch_to_y_with_spelling(*pitch, clef_type, units_per_space, *spelling)
            + staff_vertical_offset;

        if note_y < top_line_y {
            // Note is above the staff — draw ledger lines at every 1*units_per_space above top line
            let mut y = top_line_y - units_per_space;
            while y >= note_y - units_per_space * 0.25 {
                let key = (notehead_x as i32, (y * 10.0) as i32);
                if seen.insert(key) {
                    ledger_lines.push(LedgerLine {
                        y_position: y,
                        start_x: notehead_x - ledger_half_width,
                        end_x: notehead_x + ledger_half_width,
                    });
                }
                y -= units_per_space;
            }
        } else if note_y > bottom_line_y {
            // Note is below the staff — draw ledger lines at every 1*units_per_space below bottom line
            let mut y = bottom_line_y + units_per_space;
            while y <= note_y + units_per_space * 0.25 {
                let key = (notehead_x as i32, (y * 10.0) as i32);
                if seen.insert(key) {
                    ledger_lines.push(LedgerLine {
                        y_position: y,
                        start_x: notehead_x - ledger_half_width,
                        end_x: notehead_x + ledger_half_width,
                    });
                }
                y += units_per_space;
            }
        }
    }

    ledger_lines
}

/// Position structural glyphs (clefs, key sigs, time sigs) at system start
///
/// Stub for now - will be implemented when needed
pub fn position_structural_glyphs() {
    // Stub implementation - structural glyphs positioning
    // For MVP, we'll skip structural glyphs and implement this in future iterations
}

// ── REST GLYPH FUNCTIONS ──────────────────────────────────────────────────────

/// Approximate visual width of a rest glyph in logical units (for x-centering).
const REST_GLYPH_WIDTH: f32 = 20.0;

/// Select the SMuFL rest glyph codepoint from a `note_type` string.
///
/// Falls back to duration-based selection when `note_type` is `None` or unrecognised.
pub fn rest_glyph_codepoint(note_type: Option<&str>, duration_ticks: u32) -> char {
    match note_type {
        Some("whole") => '\u{E4E3}',
        Some("half") => '\u{E4E4}',
        Some("quarter") => '\u{E4E5}',
        Some("eighth") => '\u{E4E6}',
        Some("16th") => '\u{E4E7}',
        Some("32nd") => '\u{E4E8}',
        Some("64th") => '\u{E4E9}',
        _ => {
            if duration_ticks >= 3840 {
                '\u{E4E3}'
            } else if duration_ticks >= 1920 {
                '\u{E4E4}'
            } else if duration_ticks >= 960 {
                '\u{E4E5}'
            } else if duration_ticks >= 480 {
                '\u{E4E6}'
            } else if duration_ticks >= 240 {
                '\u{E4E7}'
            } else if duration_ticks >= 120 {
                '\u{E4E8}'
            } else {
                '\u{E4E9}'
            }
        }
    }
}

/// Compute the Y-position for a rest glyph (before adding `staff_vertical_offset`).
///
/// Base positions use the standard single-voice rest placement:
/// - Whole rest (`duration_ticks ≥ 3840`): `1.0 × units_per_space` — hangs from the 2nd staff line.
/// - All other rests: `2.0 × units_per_space` — centred on the middle staff line.
///
/// Multi-voice offset: voice 1 (odd) shifts up by one space; voice 2 (even) shifts down.
pub fn rest_y(
    duration_ticks: u32,
    voice_number: usize,
    multi_voice: bool,
    units_per_space: f32,
) -> f32 {
    let base_y = if duration_ticks >= 3840 {
        1.0 * units_per_space
    } else {
        2.0 * units_per_space
    };
    if multi_voice {
        if voice_number % 2 == 1 {
            base_y - units_per_space
        } else {
            base_y + units_per_space
        }
    } else {
        base_y
    }
}

/// Return `true` if `duration_ticks` spans a complete measure in the given time signature.
///
/// A full measure in 4/4 time = `4 × (3840 / 4)` = 3840 ticks.
/// A full measure in 3/4 time = `3 × (3840 / 4)` = 2880 ticks.
pub fn is_full_measure_rest(duration_ticks: u32, time_numerator: u8, time_denominator: u8) -> bool {
    let full = (time_numerator as u32) * (3840 / (time_denominator as u32));
    duration_ticks >= full
}

/// Position rest glyphs for a single staff within a system's tick range.
///
/// Full-measure rests are horizontally centred within their measure using the
/// x-extent of all notes in that measure (falling back to `left_margin` when
/// the measure contains no notes at all).
/// Multi-voice rests are offset vertically from the standard rest position.
#[allow(clippy::too_many_arguments)]
pub(super) fn position_rests_for_staff(
    staff_rests: &[super::RestLayoutEvent],
    tick_range_start: u32,
    tick_range_end: u32,
    note_positions: &std::collections::HashMap<u32, f32>,
    time_numerator: u8,
    time_denominator: u8,
    multi_voice: bool,
    units_per_space: f32,
    staff_vertical_offset: f32,
    left_margin: f32,
    instrument_id: &str,
    staff_index: usize,
    measure_x_bounds: &std::collections::HashMap<u32, (f32, f32)>,
) -> Vec<Glyph> {
    let ticks_per_measure = (time_numerator as u32) * (3840 / (time_denominator as u32));

    let rests_in_range: Vec<&super::RestLayoutEvent> = staff_rests
        .iter()
        .filter(|r| r.start_tick >= tick_range_start && r.start_tick < tick_range_end)
        .collect();

    let mut glyphs = Vec::with_capacity(rests_in_range.len());

    for (event_index, rest) in rests_in_range.iter().enumerate() {
        let codepoint = rest_glyph_codepoint(rest.note_type.as_deref(), rest.duration_ticks);
        let y = rest_y(
            rest.duration_ticks,
            rest.voice,
            multi_voice,
            units_per_space,
        ) + staff_vertical_offset;

        let x = if is_full_measure_rest(rest.duration_ticks, time_numerator, time_denominator) {
            let measure_start = (rest.start_tick / ticks_per_measure) * ticks_per_measure;
            let measure_end = measure_start + ticks_per_measure;

            let xs: Vec<f32> = note_positions
                .iter()
                .filter(|&(&t, _)| t >= measure_start && t < measure_end)
                .map(|(_, &x)| x)
                .collect();

            if xs.is_empty() {
                // No notes in this measure — center rest within measure boundaries
                measure_x_bounds
                    .get(&measure_start)
                    .map(|(start_x, end_x)| (start_x + end_x) / 2.0 - REST_GLYPH_WIDTH / 2.0)
                    .unwrap_or(left_margin + 90.0)
            } else {
                let start_x = xs.iter().cloned().fold(f32::MAX, f32::min);
                let end_x = xs.iter().cloned().fold(f32::MIN, f32::max) + 30.0;
                start_x + (end_x - start_x - REST_GLYPH_WIDTH) / 2.0
            }
        } else {
            // Beat-aligned: use note position at or just before the rest's start_tick
            note_positions
                .iter()
                .filter(|&(&t, _)| t <= rest.start_tick)
                .max_by_key(|&(&t, _)| t)
                .map(|(_, &x)| x)
                .unwrap_or(left_margin)
        };

        glyphs.push(Glyph {
            position: Point { x, y },
            bounding_box: BoundingBox {
                x,
                y,
                width: REST_GLYPH_WIDTH,
                height: units_per_space,
            },
            codepoint: codepoint.to_string(),
            source_reference: SourceReference {
                instrument_id: instrument_id.to_string(),
                staff_index,
                voice_index: rest.voice.saturating_sub(1),
                event_index,
            },
            font_size: None,
        });
    }

    glyphs
}

#[cfg(test)]
mod tests {
    use super::*;

    /// T017: Unit test for pitch_to_y() with correct treble clef positions
    #[test]
    fn test_pitch_to_y_treble_staff() {
        let units_per_space = 20.0;

        // Treble staff lines (from top to bottom), with -0.5 offset for glyph centering:
        // F5 (MIDI 77) = top line at y=-10
        assert_eq!(
            pitch_to_y(77, "Treble", units_per_space),
            -10.0,
            "F5 should be on top line (y=-10)"
        );

        // D5 (MIDI 74) = 2nd line at y=10
        assert_eq!(
            pitch_to_y(74, "Treble", units_per_space),
            10.0,
            "D5 should be on 2nd line (y=10)"
        );

        // B4 (MIDI 71) = 3rd line at y=30
        assert_eq!(
            pitch_to_y(71, "Treble", units_per_space),
            30.0,
            "B4 should be on 3rd line (y=30)"
        );

        // G4 (MIDI 67) = 4th line at y=50
        assert_eq!(
            pitch_to_y(67, "Treble", units_per_space),
            50.0,
            "G4 should be on 4th line (y=50)"
        );

        // E4 (MIDI 64) = bottom line at y=70
        assert_eq!(
            pitch_to_y(64, "Treble", units_per_space),
            70.0,
            "E4 should be on bottom line (y=70)"
        );

        // C5 (MIDI 72) = space between 2nd and 3rd lines at y=20
        assert_eq!(
            pitch_to_y(72, "Treble", units_per_space),
            20.0,
            "C5 should be in space (y=20)"
        );

        // Middle C4 (MIDI 60) = ledger line below staff at y=90
        assert_eq!(
            pitch_to_y(60, "Treble", units_per_space),
            90.0,
            "Middle C should be below staff (y=90)"
        );

        // G5 (MIDI 79) = space above top line at y=-20
        assert_eq!(
            pitch_to_y(79, "Treble", units_per_space),
            -20.0,
            "G5 should be above staff (y=-20)"
        );
    }

    /// T017: Test pitch_to_y() with different units_per_space values
    #[test]
    fn test_pitch_to_y_scale_independence() {
        let pitch = 60; // Middle C4 (ledger line below treble staff)

        // With units_per_space = 20, C4 should be 4.5 half-spaces below F5 = 90 units
        assert_eq!(pitch_to_y(pitch, "Treble", 20.0), 90.0);

        // With units_per_space = 10, C4 should be 4.5 half-spaces below F5 = 45 units
        assert_eq!(pitch_to_y(pitch, "Treble", 10.0), 45.0);

        // With units_per_space = 25, C4 should be 4.5 half-spaces below F5 = 112.5 units
        assert_eq!(pitch_to_y(pitch, "Treble", 25.0), 112.5);
    }

    /// T018: Unit test for notehead codepoint selection based on duration
    #[test]
    fn test_notehead_codepoint_by_duration() {
        // Define test cases: (duration_ticks, expected_codepoint, note_name)
        let test_cases = vec![
            (3840, '\u{E0A2}', "whole note"),    // 4 beats at 960 PPQ
            (1920, '\u{E0A3}', "half note"),     // 2 beats at 960 PPQ
            (960, '\u{E0A4}', "quarter note"),   // 1 beat at 960 PPQ
            (480, '\u{E0A4}', "eighth note"),    // 0.5 beat (should use filled notehead)
            (240, '\u{E0A4}', "sixteenth note"), // 0.25 beat (should use filled notehead)
        ];

        for (duration_ticks, expected_codepoint, note_name) in test_cases {
            let codepoint = get_notehead_codepoint(duration_ticks);
            assert_eq!(
                codepoint, expected_codepoint,
                "{} (duration={}) should use codepoint {:?}",
                note_name, duration_ticks, expected_codepoint
            );
        }
    }

    /// T018: Helper function for notehead codepoint selection
    /// This will be integrated into position_noteheads() in T021-T022
    fn get_notehead_codepoint(duration_ticks: u32) -> char {
        if duration_ticks >= 3840 {
            '\u{E0A2}' // U+E0A2 noteheadWhole
        } else if duration_ticks >= 1920 {
            '\u{E0A3}' // U+E0A3 noteheadHalf
        } else {
            '\u{E0A4}' // U+E0A4 noteheadBlack (quarter, eighth, sixteenth, etc.)
        }
    }

    /// T019: Integration test for notehead positioning
    #[test]
    fn test_position_noteheads_integration() {
        let units_per_space = 20.0;
        let notes = vec![
            (60, 0, 960, None),    // Middle C, quarter note
            (62, 960, 960, None),  // D4, quarter note
            (64, 1920, 960, None), // E4, quarter note
        ];
        let horizontal_offsets = vec![0.0, 100.0, 200.0];

        let glyphs = position_noteheads(
            &notes,
            &horizontal_offsets,
            &vec!["Treble"; notes.len()],
            units_per_space,
            "test-instrument",
            0,
            0,
            0.0,                               // staff_vertical_offset
            &std::collections::HashSet::new(), // no beamed notes
        );

        // Verify correct number of glyphs
        assert_eq!(glyphs.len(), 3, "Should produce 3 noteheads");

        // Verify first notehead (Middle C4 at x=0)
        // C4 = ledger line below staff, 4.5 half-spaces below F5
        assert_eq!(glyphs[0].position.x, 0.0, "First note x-position");
        assert_eq!(glyphs[0].position.y, 90.0, "Middle C4 should be at y=90");
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E1D5}'),
            "Quarter note uses black notehead with stem up (below middle)"
        );

        // Verify second notehead (D4 at x=100)
        // D4 = 4.0 half-spaces below F5
        assert_eq!(glyphs[1].position.x, 100.0, "Second note x-position");
        assert_eq!(glyphs[1].position.y, 80.0, "D4 should be at y=80");

        // Verify third notehead (E4 at x=200)
        // E4 = bottom line, 3.5 half-spaces below F5
        assert_eq!(glyphs[2].position.x, 200.0, "Third note x-position");
        assert_eq!(
            glyphs[2].position.y, 70.0,
            "E4 should be on bottom line (y=70)"
        );
    }

    /// T026: Unit test for position_clef() with various clef types
    #[test]
    fn test_position_clef_treble() {
        let units_per_space = 20.0;
        let x_position = 20.0;

        let glyph = position_clef("Treble", x_position, units_per_space, 0.0);

        // Treble clef should be on 2nd line (G4 line)
        // 2nd line is at y=60 (with -0.5 offset: 50)
        assert_eq!(glyph.position.x, 20.0, "Treble clef x-position");
        assert_eq!(
            glyph.position.y, 50.0,
            "Treble clef centered on 2nd line (G4)"
        );
        assert_eq!(
            glyph.codepoint,
            String::from('\u{E050}'),
            "Treble clef codepoint"
        );
    }

    #[test]
    fn test_position_clef_bass() {
        let units_per_space = 20.0;
        let x_position = 20.0;

        let glyph = position_clef("Bass", x_position, units_per_space, 0.0);

        // Bass clef should be on 4th line (F3 line)
        // 4th line is at y=20 (with -0.5 offset: 10)
        assert_eq!(glyph.position.x, 20.0, "Bass clef x-position");
        assert_eq!(
            glyph.position.y, 10.0,
            "Bass clef centered on 4th line (F3)"
        );
        assert_eq!(
            glyph.codepoint,
            String::from('\u{E062}'),
            "Bass clef codepoint"
        );
    }

    #[test]
    fn test_position_clef_alto() {
        let units_per_space = 20.0;
        let x_position = 20.0;

        let glyph = position_clef("Alto", x_position, units_per_space, 0.0);

        // Alto clef should be centered on middle line (C4)
        // Middle line is at y=40 (with -0.5 offset: 30)
        assert_eq!(glyph.position.x, 20.0, "Alto clef x-position");
        assert_eq!(
            glyph.position.y, 30.0,
            "Alto clef centered on middle line (C4)"
        );
        assert_eq!(
            glyph.codepoint,
            String::from('\u{E05C}'),
            "Alto clef codepoint"
        );
    }

    #[test]
    fn test_position_clef_tenor() {
        let units_per_space = 20.0;
        let x_position = 20.0;

        let glyph = position_clef("Tenor", x_position, units_per_space, 0.0);

        // Tenor clef should be centered on 4th line (A3)
        // 4th line is at y=20 (with -0.5 offset: 10)
        assert_eq!(glyph.position.x, 20.0, "Tenor clef x-position");
        assert_eq!(
            glyph.position.y, 10.0,
            "Tenor clef centered on 4th line (A3)"
        );
        assert_eq!(
            glyph.codepoint,
            String::from('\u{E05D}'),
            "Tenor clef codepoint"
        );
    }

    /// T027: Unit test for position_time_signature() with stacked digits
    #[test]
    fn test_position_time_signature_4_4() {
        let units_per_space = 20.0;
        let x_position = 100.0;

        let glyphs = position_time_signature(4, 4, x_position, units_per_space, 0.0);

        // Should return 2 glyphs (numerator and denominator)
        assert_eq!(
            glyphs.len(),
            2,
            "Time signature has 2 glyphs (numerator + denominator)"
        );

        // Numerator (4) above middle line
        assert_eq!(glyphs[0].position.x, 100.0, "Numerator x-position");
        assert_eq!(glyphs[0].position.y, 10.0, "Numerator above middle line");
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E084}'),
            "Numerator digit 4"
        );

        // Denominator (4) below middle line
        assert_eq!(glyphs[1].position.x, 100.0, "Denominator x-position");
        assert_eq!(glyphs[1].position.y, 50.0, "Denominator below middle line");
        assert_eq!(
            glyphs[1].codepoint,
            String::from('\u{E084}'),
            "Denominator digit 4"
        );
    }

    #[test]
    fn test_position_time_signature_3_4() {
        let units_per_space = 20.0;
        let x_position = 100.0;

        let glyphs = position_time_signature(3, 4, x_position, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 2, "Time signature has 2 glyphs");
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E083}'),
            "Numerator digit 3"
        );
        assert_eq!(
            glyphs[1].codepoint,
            String::from('\u{E084}'),
            "Denominator digit 4"
        );
    }

    #[test]
    fn test_position_time_signature_6_8() {
        let units_per_space = 20.0;
        let x_position = 100.0;

        let glyphs = position_time_signature(6, 8, x_position, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 2, "Time signature has 2 glyphs");
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E086}'),
            "Numerator digit 6"
        );
        assert_eq!(
            glyphs[1].codepoint,
            String::from('\u{E088}'),
            "Denominator digit 8"
        );
    }

    /// T028: Unit test for position_key_signature() with sharps/flats
    #[test]
    fn test_position_key_signature_g_major() {
        let units_per_space = 20.0;
        let x_start = 150.0;

        // G major has 1 sharp (F#)
        let glyphs = position_key_signature(1, "Treble", x_start, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 1, "G major has 1 sharp");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E262}'), "Sharp glyph");
        assert_eq!(glyphs[0].position.x, 150.0, "Sharp x-position");
        // F# in treble clef is on top line
        assert_eq!(glyphs[0].position.y, -10.0, "F# on top line in treble clef");
    }

    #[test]
    fn test_position_key_signature_d_major() {
        let units_per_space = 20.0;
        let x_start = 150.0;

        // D major has 2 sharps (F#, C#)
        let glyphs = position_key_signature(2, "Treble", x_start, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 2, "D major has 2 sharps");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E262}'), "First sharp");
        assert_eq!(
            glyphs[1].codepoint,
            String::from('\u{E262}'),
            "Second sharp"
        );
        // Sharps should be horizontally spaced
        assert!(
            glyphs[1].position.x > glyphs[0].position.x,
            "Sharps spaced horizontally"
        );
    }

    #[test]
    fn test_position_key_signature_f_major() {
        let units_per_space = 20.0;
        let x_start = 150.0;

        // F major has 1 flat (Bb)
        let glyphs = position_key_signature(-1, "Treble", x_start, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 1, "F major has 1 flat");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E260}'), "Flat glyph");
        assert_eq!(glyphs[0].position.x, 150.0, "Flat x-position");
        // Bb in treble clef is on middle line
        assert_eq!(
            glyphs[0].position.y, 30.0,
            "Bb on middle line in treble clef"
        );
    }

    #[test]
    fn test_position_key_signature_c_major() {
        let units_per_space = 20.0;
        let x_start = 150.0;

        // C major has no sharps or flats
        let glyphs = position_key_signature(0, "Treble", x_start, units_per_space, 0.0);

        assert_eq!(glyphs.len(), 0, "C major has no accidentals");
    }

    // ================================================================
    // T009–T014: Regression tests for Bug 1 (clef type ignored)
    // All must FAIL before T015 fix, PASS after.
    // ================================================================

    #[test]
    fn test_position_key_signature_bass_1_sharp() {
        // Bass clef: F3 is on line 2 from top → y = 10.0
        let glyphs = position_key_signature(1, "Bass", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "G major has 1 sharp");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E262}'), "Sharp glyph");
        assert_eq!(glyphs[0].position.y, 10.0, "F3 on bass clef line 2");
    }

    #[test]
    fn test_position_key_signature_bass_1_flat() {
        // Bass clef: Bb2 is on line 4 from top → y = 50.0
        let glyphs = position_key_signature(-1, "Bass", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "F major has 1 flat");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E260}'), "Flat glyph");
        assert_eq!(glyphs[0].position.y, 50.0, "Bb2 on bass clef line 4");
    }

    #[test]
    fn test_position_key_signature_alto_1_sharp() {
        // Alto clef: F♯4 is in space 4 from top → y = 0.0
        let glyphs = position_key_signature(1, "Alto", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "G major has 1 sharp");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E262}'), "Sharp glyph");
        assert_eq!(glyphs[0].position.y, 0.0, "F4 on alto clef space 4");
    }

    #[test]
    fn test_position_key_signature_alto_1_flat() {
        // Alto clef: B♭3 is in space 2 from bottom → y = 40.0
        let glyphs = position_key_signature(-1, "Alto", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "F major has 1 flat");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E260}'), "Flat glyph");
        assert_eq!(glyphs[0].position.y, 40.0, "Bb3 on alto clef space 2");
    }

    #[test]
    fn test_position_key_signature_tenor_1_sharp() {
        // Tenor clef: F♯3 at pos -2 from middle → y = 50.0
        let glyphs = position_key_signature(1, "Tenor", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "G major has 1 sharp");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E262}'), "Sharp glyph");
        assert_eq!(glyphs[0].position.y, 50.0, "F3 on tenor clef line 2");
    }

    #[test]
    fn test_position_key_signature_tenor_1_flat() {
        // Tenor clef: Bb3 is on line 2 from top → y = 20.0
        let glyphs = position_key_signature(-1, "Tenor", 120.0, 20.0, 0.0);
        assert_eq!(glyphs.len(), 1, "F major has 1 flat");
        assert_eq!(glyphs[0].codepoint, String::from('\u{E260}'), "Flat glyph");
        assert_eq!(glyphs[0].position.y, 20.0, "Bb3 on tenor clef line 2");
    }

    /// T016: Beamed eighth note should use bare noteheadBlack (U+E0A4)
    #[test]
    fn test_beamed_eighth_uses_bare_notehead() {
        let units_per_space = 20.0;
        let notes = vec![
            (60, 0, 480, None),   // C4 eighth note
            (62, 480, 480, None), // D4 eighth note
        ];
        let offsets = vec![0.0, 100.0];
        let mut beamed = std::collections::HashSet::new();
        beamed.insert(0);
        beamed.insert(1);

        let glyphs = position_noteheads(
            &notes,
            &offsets,
            &vec!["Treble"; notes.len()],
            units_per_space,
            "inst",
            0,
            0,
            0.0,
            &beamed,
        );

        assert_eq!(glyphs.len(), 2);
        // Beamed eighths → bare noteheadBlack U+E0A4
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E0A4}'),
            "Beamed eighth should use bare noteheadBlack"
        );
        assert_eq!(
            glyphs[1].codepoint,
            String::from('\u{E0A4}'),
            "Beamed eighth should use bare noteheadBlack"
        );
    }

    /// T016: Unbeamed eighth note should use combined glyph (U+E1D7)
    #[test]
    fn test_unbeamed_eighth_uses_combined_glyph() {
        let units_per_space = 20.0;
        let notes = vec![
            (60, 0, 480, None), // C4 eighth note, NOT in beamed set
        ];
        let offsets = vec![0.0];
        let beamed = std::collections::HashSet::new(); // empty

        let glyphs = position_noteheads(
            &notes,
            &offsets,
            &vec!["Treble"; notes.len()],
            units_per_space,
            "inst",
            0,
            0,
            0.0,
            &beamed,
        );

        assert_eq!(glyphs.len(), 1);
        // Unbeamed eighth → combined note8thUp U+E1D7 (C4 below middle → stem up)
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E1D7}'),
            "Unbeamed eighth below middle should use stem-up combined glyph"
        );
    }

    /// T016: Quarter note is NOT affected by beam status
    #[test]
    fn test_quarter_note_unchanged_by_beam_set() {
        let units_per_space = 20.0;
        let notes = vec![
            (60, 0, 960, None), // C4 quarter note
        ];
        let offsets = vec![0.0];
        let mut beamed = std::collections::HashSet::new();
        beamed.insert(0); // mark as beamed — but duration >= 960 so it should be ignored

        let glyphs = position_noteheads(
            &notes,
            &offsets,
            &vec!["Treble"; notes.len()],
            units_per_space,
            "inst",
            0,
            0,
            0.0,
            &beamed,
        );

        assert_eq!(glyphs.len(), 1);
        // Quarter note → combined noteQuarterUp U+E1D5 (C4 below middle → stem up)
        assert_eq!(
            glyphs[0].codepoint,
            String::from('\u{E1D5}'),
            "Quarter note should use stem-up combined glyph when below middle"
        );
    }

    // ── REST UNIT TESTS ──────────────────────────────────────────────────────

    /// T-REST-01 / T-REST-02 / T-REST-03: All seven note_type strings map to correct codepoints.
    #[test]
    fn test_rest_glyph_codepoint_by_note_type() {
        assert_eq!(rest_glyph_codepoint(Some("whole"), 0), '\u{E4E3}', "whole");
        assert_eq!(rest_glyph_codepoint(Some("half"), 0), '\u{E4E4}', "half");
        assert_eq!(
            rest_glyph_codepoint(Some("quarter"), 0),
            '\u{E4E5}',
            "quarter"
        );
        assert_eq!(
            rest_glyph_codepoint(Some("eighth"), 0),
            '\u{E4E6}',
            "eighth"
        );
        assert_eq!(rest_glyph_codepoint(Some("16th"), 0), '\u{E4E7}', "16th");
        assert_eq!(rest_glyph_codepoint(Some("32nd"), 0), '\u{E4E8}', "32nd");
        assert_eq!(rest_glyph_codepoint(Some("64th"), 0), '\u{E4E9}', "64th");
    }

    /// T-REST-04: None note_type falls back to duration_ticks.
    #[test]
    fn test_rest_glyph_codepoint_fallback() {
        assert_eq!(
            rest_glyph_codepoint(None, 3840),
            '\u{E4E3}',
            "whole via ticks"
        );
        assert_eq!(
            rest_glyph_codepoint(None, 1920),
            '\u{E4E4}',
            "half via ticks"
        );
        assert_eq!(
            rest_glyph_codepoint(None, 960),
            '\u{E4E5}',
            "quarter via ticks"
        );
        assert_eq!(
            rest_glyph_codepoint(None, 480),
            '\u{E4E6}',
            "eighth via ticks"
        );
        assert_eq!(
            rest_glyph_codepoint(None, 240),
            '\u{E4E7}',
            "16th via ticks"
        );
        assert_eq!(
            rest_glyph_codepoint(None, 120),
            '\u{E4E8}',
            "32nd via ticks"
        );
        assert_eq!(rest_glyph_codepoint(None, 60), '\u{E4E9}', "64th via ticks");
    }

    /// T-REST-05: Full-measure detection in 4/4 (3840 ticks).
    #[test]
    fn test_is_full_measure_rest_4_4_true() {
        assert!(is_full_measure_rest(3840, 4, 4));
    }

    /// T-REST-06: Non-full-measure in 4/4.
    #[test]
    fn test_is_full_measure_rest_4_4_false() {
        assert!(!is_full_measure_rest(960, 4, 4));
    }

    /// T-REST-07: Full-measure detection in 3/4 (2880 ticks).
    #[test]
    fn test_is_full_measure_rest_3_4_true() {
        assert!(is_full_measure_rest(2880, 3, 4));
        assert!(!is_full_measure_rest(960, 3, 4));
    }

    /// T-REST-08: Whole rest Y in single-voice = 1.0 × units_per_space.
    #[test]
    fn test_rest_y_whole_single_voice() {
        let ups = 20.0_f32;
        assert_eq!(rest_y(3840, 1, false, ups), 1.0 * ups);
    }

    /// T-REST-09: Quarter rest Y in single-voice = 2.0 × units_per_space.
    #[test]
    fn test_rest_y_quarter_single_voice() {
        let ups = 20.0_f32;
        assert_eq!(rest_y(960, 1, false, ups), 2.0 * ups);
    }

    /// T-REST-10: Voice 1 in multi-voice shifted up by one space.
    #[test]
    fn test_rest_y_voice1_multi_voice() {
        let ups = 20.0_f32;
        // base = 2.0*ups, offset = -ups → result = ups
        assert_eq!(rest_y(960, 1, true, ups), ups);
    }

    /// T-REST-11: Voice 2 in multi-voice shifted down by one space.
    #[test]
    fn test_rest_y_voice2_multi_voice() {
        let ups = 20.0_f32;
        // base = 2.0*ups, offset = +ups → result = 3.0*ups
        assert_eq!(rest_y(960, 2, true, ups), 3.0 * ups);
    }
}
