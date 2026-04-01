/**
 * RecordingView — Debug-mode-only microphone/MIDI recording and pitch detection page.
 *
 * Accessed from ScoreViewer when ?debug=true is present in the URL.
 * A "Record View" button in the ScoreViewer toolbar opens this page.
 * All audio resources are released when the user navigates back.
 *
 * FR-001: Only reachable via the debug-gated "Record View" button.
 * FR-002: Explicit Start/Stop toggle button; mic never opens automatically.
 *
 * Extended for feature 029-midi-input:
 *   - Automatically selects MIDI on mount if a device is connected
 *   - Shows a persistent InputSourceBadge
 *   - Auto-switches to MIDI on hot-connect with an info banner
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioRecorder } from '../../services/recording/useAudioRecorder';
import { useMidiInput } from '../../services/recording/useMidiInput';
import { OscilloscopeCanvas } from './OscilloscopeCanvas';
import { NoteHistoryList } from './NoteHistoryList';
import { RecordingStaff } from './RecordingStaff';
import { InputSourceBadge } from './InputSourceBadge';
import { MidiVisualizationPlaceholder } from './MidiVisualizationPlaceholder';
import type { InputSource, MidiNoteEvent, MidiConnectionEvent, NoteOnset } from '../../types/recording';
import type { MidiCCEvent } from '../../services/recording/midiUtils';
import { ToneAdapter } from '../../services/playback/ToneAdapter';
import './RecordingView.css';

interface RecordingViewProps {
  /** Called when the user taps "← Instruments" to return to ScoreViewer */
  onBack: () => void;
}

export function RecordingView({ onBack }: RecordingViewProps) {
  const { session, waveform, currentPitch, noteHistory, audioChunksRef, start, stop, clearHistory, clearAudioChunks } = useAudioRecorder();

  const isRecording = session.state === 'recording';
  const hasError = session.state === 'error';
  const errorMessage = session.errorMessage;

  // T030: iOS Safari detection — warn about limited AudioWorklet support
  const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent));

  // ─── 029-midi-input: MIDI source state ──────────────────────────────────────

  const [activeSource, setActiveSource] = useState<InputSource>({ kind: 'microphone' });
  // Ref kept in sync with activeSource so callbacks can read it without stale closures
  const activeSourceRef = useRef<InputSource>({ kind: 'microphone' });
  useEffect(() => {
    activeSourceRef.current = activeSource;
  });
  const [midiNotSupported, setMidiNotSupported] = useState(false);
  // MIDI note history entries appended via MIDI note-on events
  const [midiNoteHistory, setMidiNoteHistory] = useState<NoteOnset[]>([]);
  // Current note display when MIDI is active
  const [midiCurrentLabel, setMidiCurrentLabel] = useState<string | null>(null);
  // Info banner shown on hot-connect switch (auto-dismiss by user)
  const [midiConnectInfo, setMidiConnectInfo] = useState<string | null>(null);
  // Error message shown when MIDI device disconnects unexpectedly
  const [midiDisconnectError, setMidiDisconnectError] = useState<string | null>(null);
  // CC message history (Feature 069 US4)
  const [midiCCHistory, setMidiCCHistory] = useState<MidiCCEvent[]>([]);
  // Currently held MIDI note number (for staff display). null = no note held.
  const [midiHeldNoteNumber, setMidiHeldNoteNumber] = useState<number | null>(null);

  const handleMidiNoteOn = useCallback((event: MidiNoteEvent) => {
    const noteMatch = /^([A-G]#?)(-?\d+)$/.exec(event.label);
    const onset: NoteOnset = {
      label: event.label,
      note: noteMatch ? noteMatch[1] : event.label,
      octave: noteMatch ? parseInt(noteMatch[2], 10) : 4,
      confidence: 1.0,
      elapsedMs: event.timestampMs,
      velocity: event.velocity,
      channel: event.channel,
      rawBytes: event.rawBytes,
    };
    setMidiNoteHistory((prev) => {
      const next = [...prev, onset];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
    setMidiCurrentLabel(event.label);
    setMidiHeldNoteNumber(event.noteNumber);
    // Play back the note so velocity impact can be heard
    ToneAdapter.getInstance().init().then(() => {
      ToneAdapter.getInstance().attackNote(event.noteNumber, event.velocity);
    });
  }, []);

  const handleMidiNoteOff = useCallback((noteNumber: number) => {
    ToneAdapter.getInstance().releaseNote(noteNumber);
    setMidiHeldNoteNumber((prev) => (prev === noteNumber ? null : prev));
  }, []);

  const handleMidiCC = useCallback((event: MidiCCEvent) => {
    setMidiCCHistory((prev) => {
      const next = [...prev, event];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const handleMidiConnectionChange = useCallback((event: MidiConnectionEvent) => {
    console.log('[RecordingView] onConnectionChange', event.kind, event.device.name, 'activeSource:', activeSourceRef.current.kind);
    if (event.kind === 'connected') {
      // Auto-dismiss any previous disconnect banner for this device
      setMidiDisconnectError(null);
      // Hot-connect: auto-switch to MIDI and show info banner
      if (activeSourceRef.current.kind === 'microphone') {
        console.log('[RecordingView] hot-connect: auto-switching to MIDI for', event.device.name);
        stop();
        setActiveSource({ kind: 'midi', deviceName: event.device.name, deviceId: event.device.id });
        setMidiConnectInfo(`Switched to MIDI: ${event.device.name}`);
      } else {
        console.log('[RecordingView] hot-connect ignored — already in MIDI mode');
      }
    } else if (event.kind === 'disconnected') {
      // Disconnection while in MIDI mode → fall back to microphone with error banner
      if (
        activeSourceRef.current.kind === 'midi' &&
        activeSourceRef.current.deviceId === event.device.id
      ) {
        setMidiDisconnectError(`MIDI device disconnected: ${event.device.name}`);
        setActiveSource({ kind: 'microphone' });
      }
    }
  }, []);

  const { devices: midiDevices, isSupported: midiSupported } = useMidiInput({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
    onConnectionChange: handleMidiConnectionChange,
    onCC: handleMidiCC,
    sessionStartMs: session.startTimestamp ?? 0,
  });

  // Automatically select MIDI on mount when devices are found.
  useEffect(() => {
    const connectedDevices = midiDevices.filter((d) => d.state === 'connected');
    if (connectedDevices.length > 0) {
      setActiveSource((current) => {
        if (current.kind === 'microphone') {
          return { kind: 'midi', deviceName: connectedDevices[0].name, deviceId: connectedDevices[0].id };
        }
        return current;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevices]);

  // Surface browser incompatibility info
  useEffect(() => {
    if (!midiSupported) {
      setMidiNotSupported(true);
    }
  }, [midiSupported]);

  // Synthetic PitchSample derived from the held MIDI note (drives RecordingStaff while MIDI active)
  const midiCurrentPitch = useMemo(() => {
    if (midiHeldNoteNumber === null) return null;
    const PITCH_CLASSES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
    const note = PITCH_CLASSES[midiHeldNoteNumber % 12];
    const octave = Math.floor(midiHeldNoteNumber / 12) - 1;
    return {
      hz: 440 * Math.pow(2, (midiHeldNoteNumber - 69) / 12),
      confidence: 1.0,
      note,
      octave,
      label: `${note}${octave}`,
    };
  }, [midiHeldNoteNumber]);

  // Combined clear: wipes both mic and MIDI histories + staff notation
  const [staffClearTrigger, setStaffClearTrigger] = useState(0);
  const handleClearAll = useCallback(() => {
    clearHistory();
    setMidiNoteHistory([]);
    setMidiCCHistory([]);
    setStaffClearTrigger(n => n + 1);
  }, [clearHistory]);

  // ─── Derived display values ──────────────────────────────────────────────────

  // Combine mic / MIDI current note display
  const displayCurrentPitch =
    activeSource.kind === 'midi' ? midiCurrentLabel : currentPitch?.label ?? null;

  // Combine mic / MIDI note history
  // After MIDI disconnect, source reverts to microphone but we keep showing
  // midiNoteHistory until the user explicitly clears it, so history is preserved.
  const displayNoteHistory =
    activeSource.kind === 'midi' || midiNoteHistory.length > 0 ? midiNoteHistory : noteHistory;

  // ─── Release resources when navigating back ──────────────────────────────────

  // Release resources when navigating back
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <div className="recording-view">
      <header className="recording-view__header">
        <button
          className="recording-view__back-btn"
          onClick={onBack}
          aria-label="← Back"
        >
          ← Back
        </button>
        <h1 className="recording-view__title">Recording View</h1>
        <span className="recording-view__debug-badge">debug</span>
      </header>

      <main className="recording-view__body">
        {/* T030: iOS Safari warning banner */}
        {isIOS && (
          <div className="recording-view__ios-warning" role="alert">
            iOS Safari has limited AudioWorklet support — some features may not work
          </div>
        )}

        {/* 029-midi-input: MIDI not supported info message */}
        {midiNotSupported && (
          <div className="recording-view__midi-info" role="status">
            MIDI not supported in this browser
          </div>
        )}

        {/* 029-midi-input: Source indicator badge — always visible */}
        <InputSourceBadge source={activeSource} />

        {/* Error display */}
        {hasError && (
          <div className="recording-view__error" role="alert">
            {errorMessage}
          </div>
        )}

        {/* 029-midi-input: MIDI hot-connect info banner */}
        {midiConnectInfo && (
          <div className="recording-view__midi-disconnect-error" role="status">
            {midiConnectInfo}
            <button
              className="recording-view__midi-dismiss-btn"
              onClick={() => setMidiConnectInfo(null)}
              aria-label="Dismiss MIDI connect notification"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 029-midi-input T031: MIDI disconnect error banner */}
        {midiDisconnectError && (
          <div className="recording-view__midi-disconnect-error" role="alert">
            {midiDisconnectError}
            <button
              className="recording-view__midi-dismiss-btn"
              onClick={() => setMidiDisconnectError(null)}
              aria-label="Dismiss MIDI disconnect error"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Compact top row: oscilloscope (mic) or placeholder (MIDI) + current pitch side-by-side */}
        <div className="recording-view__top-row">
          {activeSource.kind === 'midi' ? (
            <MidiVisualizationPlaceholder />
          ) : (
            <OscilloscopeCanvas waveform={waveform} height={50} />
          )}
          <div
            className="recording-view__pitch-display"
            data-testid="current-pitch-display"
            aria-label="Current pitch"
          >
            {displayCurrentPitch ?? '—'}
          </div>
        </div>

        {/* Live staff — detected notes with quantized durations */}
        <RecordingStaff
          currentPitch={activeSource.kind === 'midi' ? midiCurrentPitch : currentPitch}
          audioChunksRef={audioChunksRef}
          clearAudioChunks={clearAudioChunks}
          clearTrigger={staffClearTrigger}
        />

        {/* US2: Start/Stop toggle — placed below the staff */}
        <div className="recording-view__controls">
          <button
            className={`recording-view__toggle-btn${isRecording ? ' recording-view__toggle-btn--stop' : ''}`}
            onClick={isRecording ? stop : start}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          {isRecording && (
            <span
              className="recording-view__active-dot"
              data-testid="recording-active"
              aria-label="recording active"
            />
          )}
        </div>

        {/* US5: Note history list */}
        <NoteHistoryList entries={displayNoteHistory} onClear={handleClearAll} />

        {/* US4 (Feature 069): CC message log */}
        {midiCCHistory.length > 0 && (
          <section aria-label="CC log">
            <ul className="note-history-list__cc-log">
              {midiCCHistory.map((cc, idx) => (
                <li key={idx} className="note-history-list__cc-entry">
                  CC{cc.controller} val={cc.value} Ch {cc.channel}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
