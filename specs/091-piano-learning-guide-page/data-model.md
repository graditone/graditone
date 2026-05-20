# Data Model: Piano Learning Guide Page — Feature 091

This feature introduces **no new domain entities, no new storage keys, and no
schema changes**. The guide page is a purely presentational component.

---

## New UI Component

### PianoLearningGuidePage

- **Type**: React functional component (`.tsx`)
- **File**: `frontend/src/components/PianoLearningGuidePage.tsx`
- **CSS**: `frontend/src/components/PianoLearningGuidePage.css`
- **Props**: `{ onBack: () => void }` — callback to return to score viewer
- **State**: none (static content)
- **Dependencies**: `useTranslation` from `../../i18n/index`

---

## i18n Keys (en.json additions)

All new keys use the `guide.piano.*` namespace:

```json
{
  "guide.piano.page_title": "Learning Piano with Graditone",
  "guide.piano.page_subtitle": "How Graditone helps you practice and improve",
  "guide.piano.back_button": "← Back",

  "guide.piano.section_highlights_title": "Core Practice Features",
  "guide.piano.highlight_notes_title": "Note Highlighting",
  "guide.piano.highlight_notes_benefit": "Highlighted notes follow playback in real time — always know exactly where you are in the score.",
  "guide.piano.highlight_tempo_title": "Tempo Control",
  "guide.piano.highlight_tempo_benefit": "Slow down to 10% of the original speed to learn difficult passages, then gradually build up to 200%.",
  "guide.piano.highlight_loops_title": "Loop Regions",
  "guide.piano.highlight_loops_benefit": "Mark the start and end of any section and loop it continuously to drill tricky bars.",
  "guide.piano.highlight_vkeyboard_title": "Virtual Keyboard",
  "guide.piano.highlight_vkeyboard_benefit": "See the notes lit up on an on-screen piano keyboard as they play — perfect for ear training and hand position awareness.",

  "guide.piano.section_piano_title": "Piano-Specific Features",
  "guide.piano.piano_stacked_title": "Grand Staff View",
  "guide.piano.piano_stacked_benefit": "View treble and bass clef staves simultaneously — the way piano music is meant to be read.",
  "guide.piano.piano_dynamics_title": "Dynamics Playback",
  "guide.piano.piano_dynamics_benefit": "Playback respects the score's dynamics (pp to ff, crescendo, diminuendo) so you hear the music as written.",
  "guide.piano.piano_onehand_title": "One-Hand Playback",
  "guide.piano.piano_onehand_benefit": "Isolate either the treble or bass clef for playback — useful for practicing hands separately.",
  "guide.piano.piano_midi_title": "MIDI Keyboard Input",
  "guide.piano.piano_midi_benefit": "Connect a MIDI keyboard to play along with the score and hear your notes through the app.",
  "guide.piano.piano_midi_prerequisite": "Requires a MIDI keyboard connected via USB or a MIDI adapter supported by your device and browser.",

  "guide.piano.section_workflow_title": "Practice Workflow",
  "guide.piano.workflow_step1": "Load a piano score — drag and drop a MusicXML file or choose from the built-in scales and demo pieces.",
  "guide.piano.workflow_step2": "Listen to the full piece at normal tempo to get familiar with it before you start practicing.",
  "guide.piano.workflow_step3": "Reduce the tempo to a comfortable learning speed using the tempo slider.",
  "guide.piano.workflow_step4": "Tap two notes in the score to set the start and end of a loop region around the passage you want to drill.",
  "guide.piano.workflow_step5": "Open the Practice plugin to train note by note with real-time MIDI feedback.",
  "guide.piano.workflow_step6": "Gradually increase the tempo as you gain confidence until you reach the target performance speed.",

  "guide.piano.section_tips_title": "Practice Tips",
  "guide.piano.tip1": "Start slow — use the tempo control to set a pace where you can play every note cleanly before speeding up.",
  "guide.piano.tip2": "Practice hands separately — use one-hand playback to focus on treble or bass clef in isolation.",
  "guide.piano.tip3": "Loop the hard bars — set a loop region around the 2–4 measures that trip you up and repeat them until they feel easy.",
  "guide.piano.tip4": "Use the virtual keyboard — watch how notes map to hand positions while the score plays to build your spatial awareness."
}
```

---

## App.tsx Changes

- **New state**: `const [showGuide, setShowGuide] = useState(false)`
- **New early return block**: renders `<PianoLearningGuidePage onBack={() => setShowGuide(false)} />` when `showGuide === true`
- **New header button**: "📖 Learn Piano" button added to app header `<nav>`, `onClick={() => setShowGuide(true)}`

---

## Affected Entities (unchanged shape)

### i18n Translation Files
- `frontend/src/i18n/locales/en.json` — 30 new keys added
- `frontend/src/i18n/locales/es.json` — 30 matching ES stub keys added (prefixed `[ES]` pending translation)
- `TranslationKey` type is auto-derived at compile time — no manual type changes needed
