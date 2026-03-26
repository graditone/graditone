#!/usr/bin/env python3
"""
Generate piano_30_measures_dense.json test fixture for US3 batching tests.

Creates a 30-measure piano score with ~800 noteheads (eighth notes in both hands)
to test glyph batching efficiency.
"""

import json
import uuid

def generate_dense_fixture():
    """Generate 30-measure piano score with dense eighth notes."""
    
    # Constants
    MEASURES = 30
    TICKS_PER_MEASURE = 3840  # 4/4 time
    EIGHTH_NOTE_DURATION = 480  # 960 / 2
    NOTES_PER_MEASURE = 8  # 8 eighth notes per measure
    
    # Base IDs
    score_id = "aa0e8400-e29b-41d4-a716-446655440000"
    instrument_id = "bb0e8400-e29b-41d4-a716-446655440001"
    treble_staff_id = "cc0e8400-e29b-41d4-a716-446655440002"
    bass_staff_id = "dd0e8400-e29b-41d4-a716-446655440003"
    treble_voice_id = "ee0e8400-e29b-41d4-a716-446655440004"
    bass_voice_id = "ff0e8400-e29b-41d4-a716-446655440005"
    
    # Generate notes for treble clef (right hand) - C4 to C5 scale pattern
    treble_pitches = [60, 62, 64, 65, 67, 69, 71, 72]  # C4 to C5
    treble_notes = []
    note_counter = 10
    
    for measure in range(MEASURES):
        measure_start = measure * TICKS_PER_MEASURE
        for note_idx in range(NOTES_PER_MEASURE):
            tick = measure_start + (note_idx * EIGHTH_NOTE_DURATION)
            pitch = treble_pitches[note_idx % len(treble_pitches)]
            
            treble_notes.append({
                "id": f"tn{note_counter:04d}-8400-e29b-41d4-a716-446655440000",
                "start_tick": {"value": tick},
                "duration_ticks": EIGHTH_NOTE_DURATION,
                "pitch": {"value": pitch}
            })
            note_counter += 1
    
    # Generate notes for bass clef (left hand) - C3 to C4 scale pattern
    bass_pitches = [48, 50, 52, 53, 55, 57, 59, 60]  # C3 to C4
    bass_notes = []
    note_counter = 10000
    
    for measure in range(MEASURES):
        measure_start = measure * TICKS_PER_MEASURE
        for note_idx in range(NOTES_PER_MEASURE):
            tick = measure_start + (note_idx * EIGHTH_NOTE_DURATION)
            pitch = bass_pitches[note_idx % len(bass_pitches)]
            
            bass_notes.append({
                "id": f"bn{note_counter:04d}-8400-e29b-41d4-a716-446655440000",
                "start_tick": {"value": tick},
                "duration_ticks": EIGHTH_NOTE_DURATION,
                "pitch": {"value": pitch}
            })
            note_counter += 1
    
    # Build complete score structure
    score = {
        "id": score_id,
        "global_structural_events": [
            {
                "Tempo": {
                    "tick": {"value": 0},
                    "bpm": {"value": 120}
                }
            },
            {
                "TimeSignature": {
                    "tick": {"value": 0},
                    "numerator": 4,
                    "denominator": 4
                }
            }
        ],
        "instruments": [
            {
                "id": instrument_id,
                "name": "Piano",
                "instrument_type": "piano",
                "staves": [
                    {
                        "id": treble_staff_id,
                        "staff_structural_events": [
                            {
                                "Clef": {
                                    "tick": {"value": 0},
                                    "clef": "Treble"
                                }
                            },
                            {
                                "KeySignature": {
                                    "tick": {"value": 0},
                                    "fifths": 0
                                }
                            }
                        ],
                        "voices": [
                            {
                                "id": treble_voice_id,
                                "interval_events": treble_notes
                            }
                        ]
                    },
                    {
                        "id": bass_staff_id,
                        "staff_structural_events": [
                            {
                                "Clef": {
                                    "tick": {"value": 0},
                                    "clef": "Bass"
                                }
                            },
                            {
                                "KeySignature": {
                                    "tick": {"value": 0},
                                    "fifths": 0
                                }
                            }
                        ],
                        "voices": [
                            {
                                "id": bass_voice_id,
                                "interval_events": bass_notes
                            }
                        ]
                    }
                ]
            }
        ]
    }
    
    total_notes = len(treble_notes) + len(bass_notes)
    print(f"Generated fixture:")
    print(f"  Measures: {MEASURES}")
    print(f"  Treble notes: {len(treble_notes)}")
    print(f"  Bass notes: {len(bass_notes)}")
    print(f"  Total notes: {total_notes}")
    print(f"  Duration: {MEASURES * TICKS_PER_MEASURE} ticks")
    
    return score

if __name__ == "__main__":
    fixture = generate_dense_fixture()
    
    output_path = "backend/tests/fixtures/piano_30_measures_dense.json"
    with open(output_path, 'w') as f:
        json.dump(fixture, f, indent=2)
    
    print(f"\nWritten to: {output_path}")
