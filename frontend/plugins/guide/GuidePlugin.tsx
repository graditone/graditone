/**
 * GuidePlugin.tsx — Feature 001-docs-plugin: Graditone Documentation Plugin
 *
 * Stateless React component rendering the complete Guide view.
 * Single scrollable page with five sections: overview, playback, practice,
 * train, and MusicXML loading.
 *
 * Receives no props — all content is static and fully offline (FR-010, FR-011).
 * CSS uses --color-* custom properties so the active landing theme cascades in
 * automatically (same pattern as TrainPlugin.css and plugin-dialog.css).
 */

import './GuidePlugin.css';

export function GuidePlugin() {
  return (
    <div className="guide-plugin">
      <div className="guide-plugin__inner">

      {/* ── Section 1: What is Graditone? ─────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-what">
        <h2 id="guide-h-what">What is Graditone?</h2>
        <p>
          Graditone is a tablet-native app for interactive music scores, designed
          for practice and performance. Load any MusicXML score, hear it played
          back with real-time note highlighting, and train note-by-note with
          MIDI-driven step practice or ear-training exercises.
        </p>
        <p>
          Graditone works fully offline — once loaded, no internet connection is
          required.
        </p>
      </section>

      {/* ── Section 2: Playing a Score ───────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-play">
        <h2 id="guide-h-play">Playing a Score</h2>
        <p>Open the <strong>Play</strong> plugin (🎼) to load and play a score.</p>
        <ul>
          <li><strong>Tap a note</strong> — seek playback to that note and highlight it.</li>
          <li><strong>Long-press a note</strong> — pin it (green highlight); sets the loop start point.</li>
          <li><strong>Long-press a second note</strong> — define a loop region between the two pinned notes.</li>
          <li><strong>Tap inside the loop region</strong> — clear the loop and return to free playback.</li>
        </ul>
        <p>Use the tempo slider in the playback toolbar to slow down or speed up playback for practice.</p>
      </section>

      {/* ── Section 3: Practice Mode ──────────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-practice">
        <h2 id="guide-h-practice">Practice Mode</h2>
        <p>Open the <strong>Practice</strong> plugin to practise a score note by note.</p>
        <ol>
          <li>Select a score from the library.</li>
          <li>Connect your MIDI keyboard (USB or Bluetooth) to your device.</li>
          <li>Tap <strong>Practice</strong> — the first target note is highlighted on the staff.</li>
          <li>Play the highlighted note on your MIDI keyboard to advance. The app waits until you play the correct pitch.</li>
          <li>Continue until the end of the score. Your progress is shown in the toolbar.</li>
        </ol>
        <p>Practice also works without a loaded score — play freely and see each detected note displayed on the staff in real time.</p>
      </section>

      {/* ── Section 4: Train ──────────────────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-train">
        <h2 id="guide-h-train">Train</h2>
        <p>Open the <strong>Train</strong> plugin (🎹) to sharpen your note-reading with ear-training exercises.</p>
        <p><strong>Complexity levels</strong> — tap one to preset tempo, note count, and mode:</p>
        <ul>
          <li><strong>Low</strong> — 8 notes · C4 scale · Step mode · 40 BPM</li>
          <li><strong>Mid</strong> — 16 notes · Random · Step mode · 80 BPM</li>
          <li><strong>High</strong> — 20 notes · Random · Flow mode · 100 BPM</li>
        </ul>
        <p>Your selected level is remembered across sessions.</p>
        <p><strong>Training modes</strong>:</p>
        <ul>
          <li><strong>Step</strong> — the app waits for you to play the correct note before advancing.</li>
          <li><strong>Flow</strong> — the exercise plays through in real time; you play along and receive a score at the end.</li>
        </ul>
        <p><strong>Exercise presets</strong>:</p>
        <ul>
          <li><strong>Random</strong> — random notes from the selected clef and octave range.</li>
          <li><strong>C4 Scale</strong> — notes from the C4 major scale (good for beginners).</li>
          <li><strong>Score</strong> — notes extracted from the currently loaded score.</li>
        </ul>
        <p><strong>Input sources</strong>: Connect a MIDI keyboard (USB or Bluetooth) for best pitch accuracy. Alternatively, use the device microphone for acoustic instruments.</p>
      </section>

      {/* ── Section 5: Loading a Score ───────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-loading">
        <h2 id="guide-h-loading">Loading a Score</h2>
        <p>
          Graditone loads <strong>MusicXML</strong> files (<code>.mxl</code>,{' '}
          <code>.musicxml</code>, <code>.xml</code>) — the industry-standard open
          format exported by <strong>MuseScore</strong> (free), Sibelius, Finale,
          Dorico, and hundreds of other notation apps.
        </p>
        <p>
          <strong>Preloaded demo scores</strong> — no upload needed. Tap{' '}
          <strong>Load score</strong> inside the Play or Train plugin to choose
          from the built-in library: Bach Invention No.&nbsp;1, Beethoven Für Elise,
          Burgmuller Arabesque, Chopin Nocturne Op.&nbsp;9 No.&nbsp;2, and
          Pachelbel Canon in D.
        </p>
        <p><strong>Loading your own MusicXML file</strong>:</p>
        <ol>
          <li>Export your score as MusicXML from your notation software (in MuseScore: <em>File → Export → MusicXML</em>).</li>
          <li>In the Play or Train plugin, tap <strong>Load score → Load from file…</strong>.</li>
          <li>Select the <code>.mxl</code> or <code>.musicxml</code> file from your device.</li>
          <li>The score loads immediately and is saved in the browser — it will be available next time you open Graditone, even offline.</li>
        </ol>
        <p>Free MusicXML scores are available at <strong>musescore.com</strong>, <strong>imslp.org</strong>, and <strong>kern.humdrum.org</strong>.</p>
      </section>

      </div>
    </div>
  );
}
