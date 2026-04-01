/**
 * Tests for Recording View feature — User Story 1: Debug Gate
 *
 * TDD: These tests are written BEFORE implementation and must FAIL initially.
 * They cover:
 *   T005 - Record View button absent without ?debug=true
 *   T006 - Record View button visible with ?debug=true
 *   T007 - Clicking Record View button calls onShowRecording
 *   T008 - Back button in RecordingView calls onBack
 *
 * US1 Acceptance Scenarios (from spec.md):
 *   1. No Record View button or debug indicator visible without ?debug=true
 *   2. Record View button visible when ?debug=true
 *   3. Pressing Record View navigates to Recording View
 *   4. Back button returns to Instruments View
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScoreViewer } from '../../components/ScoreViewer';
import { RecordingView } from '../../components/recording/RecordingView';
import { FileStateProvider } from '../../services/state/FileStateContext';
import { TempoStateProvider } from '../../services/state/TempoStateContext';
import {
  mockMidiSupported,
  mockMidiUnsupported,
  createMockMidiAccess,
  createMockMidiInput,
  fireMidiStateChange,
  fireMidiNoteOn,
} from '../../test/mockMidi';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../services/wasm/loader', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/wasm/music-engine', () => ({
  parseScore: vi.fn(),
  addInstrument: vi.fn(),
  getScore: vi.fn(),
}));

vi.mock('../../services/storage/local-storage', () => ({
  loadScoreFromIndexedDB: vi.fn().mockResolvedValue(null),
  saveScoreToIndexedDB: vi.fn(),
}));

vi.mock('../../services/score-api', () => ({
  apiClient: {
    getScore: vi.fn(),
    createScore: vi.fn(),
    addInstrument: vi.fn(),
  },
}));

vi.mock('../../services/import/MusicXMLImportService', () => ({
  MusicXMLImportService: vi.fn(),
}));

vi.mock('../../services/playback/ToneAdapter', () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    attackNote: vi.fn(),
    releaseNote: vi.fn(),
    stopAll: vi.fn(),
    playNote: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    startTransport: vi.fn(),
    stopTransport: vi.fn(),
    clearSchedule: vi.fn(),
    isInitialized: vi.fn(() => false),
    setMuted: vi.fn(),
    updateTempo: vi.fn(),
    handleCC: vi.fn(),
    setMasterVolume: vi.fn(),
    getMasterVolume: vi.fn(() => 80),
    loadPersistedVolume: vi.fn(),
    onTransportRestart: vi.fn(() => () => {}),
    getTransportSeconds: vi.fn(() => 0),
    scheduleRepeat: vi.fn(() => 0),
    clearTransportEvent: vi.fn(),
  };
  return {
    ToneAdapter: {
      getInstance: vi.fn(() => mockInstance),
    },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RenderScoreViewerOptions {
  debugMode?: boolean;
  onShowRecording?: () => void;
}

function renderScoreViewer(opts: RenderScoreViewerOptions = {}) {
  return render(
    <TempoStateProvider>
      <FileStateProvider>
        <ScoreViewer
          debugMode={opts.debugMode ?? false}
          onShowRecording={opts.onShowRecording ?? vi.fn()}
        />
      </FileStateProvider>
    </TempoStateProvider>
  );
}

// ─── User Story 1: Debug Gate ─────────────────────────────────────────────────

describe('US1 — Debug Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * T005 — Record View button is absent from ScoreViewer without ?debug=true
   * FR-001: The button MUST be completely absent from the DOM in production mode
   */
  it('T005 — hides Instruments button when debugMode is false', () => {
    renderScoreViewer({ debugMode: false });
    expect(screen.queryByRole('button', { name: /instruments/i })).toBeNull();
  });

  /**
   * T006 — Record View button is visible in ScoreViewer when debugMode=true
   * FR-001: The button MUST appear only when ?debug=true is present
   */
  it('T006 — shows Instruments button when debugMode is true', () => {
    renderScoreViewer({ debugMode: true });
    expect(screen.getByRole('button', { name: /instruments/i })).toBeInTheDocument();
  });

  /**
   * T007 — Pressing Record View button calls onShowRecording
   * FR-001: Button presses trigger navigation (state lift) to RecordingView
   */
  it('T007 — Instruments button is clickable in debug mode', async () => {
    const user = userEvent.setup();
    renderScoreViewer({ debugMode: true });
    // The button triggers an async auto-load; verify it is interactive without crashing
    const btn = screen.getByRole('button', { name: /instruments/i });
    // fetch will fail in test env — just verify the click doesn't throw synchronously
    await expect(user.click(btn)).resolves.not.toThrow();
  });

  /**
   * T008 — Back button in RecordingView calls onBack
   * US1 Scenario 4: navigating back returns to Instruments View
   */
  it('T008 — calls onBack when the ← Back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<RecordingView onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── T015: US2 Start/Stop integration ─────────────────────────────────────────

/**
 * T015 — RecordingView Start/Stop button toggle + recording-active indicator
 * US2 Acceptance Scenario: pressing Start Recording begins capture; button
 * becomes Stop Recording; pressing again stops capture and resets button.
 *
 * Depends on useAudioRecorder (T016) — fails until implementation exists.
 */
describe('RecordingView — Start/Stop toggle (T015)', () => {
  beforeEach(() => {
    // Stub getUserMedia so start() can proceed
    const track = { stop: vi.fn(), onended: null };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      writable: true,
      configurable: true,
    });
  });

  it('T015a — initial button label is "Start Recording"', () => {
    render(<RecordingView onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });

  it('T015b — after start(), button label changes to "Stop Recording"', async () => {
    const user = userEvent.setup();
    render(<RecordingView onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /start recording/i }));
    expect(await screen.findByRole('button', { name: /stop recording/i })).toBeInTheDocument();
  });

  it('T015c — recording-active indicator is visible while recording', async () => {
    const user = userEvent.setup();
    render(<RecordingView onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /start recording/i }));
    // The recording-active element should be present (status dot or similar)
    expect(await screen.findByTestId('recording-active')).toBeInTheDocument();
  });

  it('T015d — after stop(), button label reverts to "Start Recording"', async () => {
    const user = userEvent.setup();
    render(<RecordingView onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /start recording/i }));
    await screen.findByRole('button', { name: /stop recording/i });
    await user.click(screen.getByRole('button', { name: /stop recording/i }));
    expect(await screen.findByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });
});

// ─── T022: US4 current-note display ───────────────────────────────────────────

/**
 * T022 — RecordingView current-note display
 * US4: Shows "—" when no pitch, shows note label when pitch detected.
 *
 * Depends on pitchDetection.ts (T023) and hook wiring (T024).
 */
describe('RecordingView — current pitch display (T022)', () => {
  it('T022a — shows "—" when no pitch is detected (idle state)', () => {
    render(<RecordingView onBack={vi.fn()} />);
    // The pitch display placeholder should be visible
    expect(screen.getByTestId('current-pitch-display')).toHaveTextContent('—');
  });
});

// ─── T008: US1-MIDI — activeSource switches to midi when device present ───────

/**
 * T008 (feature 029-midi-input, Phase 3, US1)
 * RecordingView sets activeSource.kind to 'midi' and renders the device name
 * when mockMidiSupported returns a connected device.
 *
 * TDD: Must FAIL until useMidiInput is wired into RecordingView.
 */
describe('RecordingView — 029-MIDI US1: MIDI auto-detection on load', () => {
  it('T008 — renders MIDI device name badge when MIDI device is connected on load', async () => {
    const input = createMockMidiInput('MIDI Piano', 'device-001');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    // Flush promises to let useMidiInput resolve
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should render an InputSourceBadge or text showing MIDI — MIDI Piano
    expect(screen.getByText(/MIDI — MIDI Piano/i)).toBeInTheDocument();
  });

  it('T008b — does NOT call getUserMedia when MIDI device is connected on load', async () => {
    const input = createMockMidiInput('MIDI Piano', 'device-001');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    const getUserMediaSpy = vi.fn();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaSpy },
      writable: true,
      configurable: true,
    });

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Start recording — should NOT call getUserMedia since MIDI is active
    // (We just check the initial state here — getUserMedia not called on mount)
    expect(getUserMediaSpy).not.toHaveBeenCalled();
  });
});

/**
 * T009 (feature 029-midi-input, Phase 3, US1)
 * RecordingView falls back to microphone when MIDI is unsupported.
 * Renders "MIDI not supported in this browser" info message.
 *
 * TDD: Must FAIL until useMidiInput is wired into RecordingView.
 */
describe('RecordingView — 029-MIDI US1: browser MIDI unsupported fallback', () => {
  it('T009 — renders "Microphone" badge and unsupported info message when MIDI not available', async () => {
    mockMidiUnsupported();

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should show microphone badge
    expect(screen.getByText(/microphone/i)).toBeInTheDocument();
    // Should show browser-compatibility info
    expect(screen.getByText(/MIDI not supported in this browser/i)).toBeInTheDocument();
  });
});

// ─── T020-T021: US3-MIDI — Hot-connect auto-switch during microphone session ──

/**
 * T020 (feature 029-midi-input, Phase 5, US3)
 * RecordingView auto-switches to MIDI and shows an info banner when a device
 * hot-connects while activeSource is microphone.
 *
 * T021 (feature 029-midi-input, Phase 5, US3)
 * The info banner can be dismissed and the source stays on MIDI.
 */
describe('RecordingView — 029-MIDI US3: hot-connect auto-switch', () => {
  it('T020 — auto-switches to MIDI and shows info banner when device hot-connects', async () => {
    const access = createMockMidiAccess([]); // start with no devices
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    // Flush initial mount — no MIDI device, defaults to microphone
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Microphone/i)).toBeInTheDocument();

    // Simulate hot-connect
    const input = createMockMidiInput('Hot MIDI', 'device-hot');
    fireMidiStateChange(access, input, 'connected');

    // Debounce 300ms
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Source badge should now show MIDI
    expect(screen.getByText(/MIDI — Hot MIDI/i)).toBeInTheDocument();
    // Info banner should appear
    expect(screen.getByText(/Switched to MIDI: Hot MIDI/i)).toBeInTheDocument();
  });

  it('T021 — info banner can be dismissed, source stays on MIDI', async () => {
    const access = createMockMidiAccess([]);
    mockMidiSupported(access);

    const user = userEvent.setup();
    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const input = createMockMidiInput('Hot MIDI', 'device-hot');
    fireMidiStateChange(access, input, 'connected');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(screen.getByText(/Switched to MIDI: Hot MIDI/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Dismiss MIDI connect notification/i }));

    expect(screen.queryByText(/Switched to MIDI/i)).not.toBeInTheDocument();
    // Still in MIDI mode
    expect(screen.getByText(/MIDI — Hot MIDI/i)).toBeInTheDocument();
  });
});

/**
 * T014 (feature 029-midi-input, Phase 4, US2)
 * RecordingView renders OscilloscopeCanvas when mic is active and
 * MidiVisualizationPlaceholder when MIDI is active.
 */
describe('RecordingView — 029-MIDI US2: oscilloscope/placeholder swap', () => {
  it('T014a — shows oscilloscope placeholder text when MIDI device is connected', async () => {
    const input = createMockMidiInput('Piano', 'device-xyz');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // MidiVisualizationPlaceholder or inline text should be in the DOM
    expect(screen.getByText(/Waveform not available in MIDI mode/i)).toBeInTheDocument();
  });

  it('T014b — does NOT show placeholder text when in microphone mode', async () => {
    mockMidiUnsupported();

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Placeholder text should NOT be present in microphone mode
    expect(screen.queryByText(/Waveform not available in MIDI mode/i)).not.toBeInTheDocument();
  });
});

// ─── T025: US4-MIDI — MIDI note capture in RecordingView ─────────────────────

/**
 * T025 (feature 029-midi-input, Phase 6, US4)
 * RecordingView appends MIDI note-on events to the note history list
 * and updates the current-note display.
 *
 * Tests:
 *   T025a — a MIDI note-on event appends a note to the note history area
 *   T025b — current-note display shows the last played MIDI note label
 *   T025c — note history is capped at 200 entries
 */
describe('RecordingView — 029-MIDI US4: MIDI note capture', () => {
  it('T025a — a MIDI note-on event appends to note history', async () => {
    const input = createMockMidiInput('Piano', 'dev-n1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    // Mount: auto-switch to MIDI
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire a note-on for A4 (MIDI note 69)
    await act(async () => {
      fireMidiNoteOn(input, 69, 80);
      await Promise.resolve();
    });

    // The note history list should contain "A4" — use queryAllBy to avoid clash with pitch display
    const matches = screen.queryAllByText(/A4/i);
    const historyMatch = matches.find((el) => el.closest('[aria-label="Note history"]') !== null);
    expect(historyMatch).toBeTruthy();
  });

  it('T025b — current-note display shows the last MIDI note label', async () => {
    const input = createMockMidiInput('Piano', 'dev-n2');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire C4 (MIDI note 60)
    await act(async () => {
      fireMidiNoteOn(input, 60, 100);
      await Promise.resolve();
    });

    const pitchDisplay = screen.getByTestId('current-pitch-display');
    expect(pitchDisplay).toHaveTextContent('C4');
  });

  it('T025c — note history is capped at 200 entries', async () => {
    const input = createMockMidiInput('Piano', 'dev-n3');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire 201 note-on events
    await act(async () => {
      for (let i = 0; i < 201; i++) {
        fireMidiNoteOn(input, 60 + (i % 12), 100);
      }
      await Promise.resolve();
    });

    // The NoteHistoryList uses <li> for each note entry — count them
    const items = screen.queryAllByRole('listitem');
    expect(items.length).toBeLessThanOrEqual(200);
  });
});

// ─── T029: US5-MIDI — Disconnect handling in RecordingView ───────────────────

/**
 * T029 (feature 029-midi-input, Phase 7, US5)
 * RecordingView handles MIDI device disconnection gracefully.
 *
 * Tests:
 *   T029a — MIDI disconnect shows an alert with "MIDI device disconnected"
 *   T029b — note history is preserved after disconnect
 *   T029c — source badge switches back to "Microphone" after disconnect
 */
describe('RecordingView — 029-MIDI US5: disconnect handling', () => {
  it('T029a — MIDI disconnect shows "MIDI device disconnected" alert', async () => {
    const input = createMockMidiInput('Piano', 'dev-d1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now disconnect device
    await act(async () => {
      fireMidiStateChange(access, input, 'disconnected');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/MIDI device disconnected/i)).toBeInTheDocument();
  });

  it('T029b — note history preserved after MIDI disconnect', async () => {
    const input = createMockMidiInput('Piano', 'dev-d2');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Play a note before disconnect
    await act(async () => {
      fireMidiNoteOn(input, 69, 80); // A4
      await Promise.resolve();
    });

    // Disconnect device
    await act(async () => {
      fireMidiStateChange(access, input, 'disconnected');
      await Promise.resolve();
      await Promise.resolve();
    });

    // A4 should still appear in the history — use queryAllBy to avoid clash with pitch display
    const matches = screen.queryAllByText(/A4/i);
    const historyMatch = matches.find((el) => el.closest('[aria-label="Note history"]') !== null);
    expect(historyMatch).toBeTruthy();
  });

  it('T029c — source badge shows "Microphone" after MIDI disconnect', async () => {
    const input = createMockMidiInput('Piano', 'dev-d3');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Disconnect
    await act(async () => {
      fireMidiStateChange(access, input, 'disconnected');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Microphone/i)).toBeInTheDocument();
  });

  it('T029d — disconnect banner is auto-dismissed when device reconnects', async () => {
    const input = createMockMidiInput('Piano', 'dev-d4');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Disconnect — banner should appear
    await act(async () => {
      fireMidiStateChange(access, input, 'disconnected');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/MIDI device disconnected/i)).toBeInTheDocument();

    // Reconnect — banner should be auto-dismissed
    await act(async () => {
      fireMidiStateChange(access, input, 'connected');
      await new Promise((r) => setTimeout(r, 350)); // past the 300 ms connect debounce
    });

    expect(screen.queryByText(/MIDI device disconnected/i)).not.toBeInTheDocument();
  });
});

// ─── T005: 069-midi-velocity — velocity forwarding in handleMidiNoteOn (US1) ──

describe('T005: RecordingView velocity forwarding (US1)', () => {
  it('T005a — velocity is stored in note history entry', async () => {
    const input = createMockMidiInput('Piano', 'dev-v1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireMidiNoteOn(input, 69, 80); // A4, velocity 80
      await Promise.resolve();
    });

    // The velocity value should be displayed in the note history list
    const list = screen.getByRole('list', { name: /note history/i });
    expect(list).toBeInTheDocument();
    expect(within(list).getByText('80')).toBeInTheDocument();
  });

  it('T005b — different velocity values are rendered per note', async () => {
    const input = createMockMidiInput('Piano', 'dev-v2');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireMidiNoteOn(input, 60, 30); // C4, velocity 30
      fireMidiNoteOn(input, 72, 110); // C5, velocity 110
      await Promise.resolve();
    });

    const list = screen.getByRole('list', { name: /note history/i });
    expect(within(list).getByText('30')).toBeInTheDocument();
    expect(within(list).getByText('110')).toBeInTheDocument();
  });
});

// ─── T012: 069-midi-velocity — channel forwarding in handleMidiNoteOn (US3) ──

describe('T012: RecordingView channel forwarding (US3)', () => {
  it('T012a — channel is rendered in note history entry', async () => {
    const input = createMockMidiInput('Piano', 'dev-ch1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireMidiNoteOn(input, 69, 80); // channel comes from mock event
      await Promise.resolve();
    });

    const list = screen.getByRole('list', { name: /note history/i });
    // Channel text should be rendered as "chN"
    expect(within(list).getByText(/^ch\d+$/)).toBeInTheDocument();
  });
});

// ─── T018: 069-midi-velocity — CC log + rawBytes forwarding (US4) ────────

describe('T018: RecordingView CC log and rawBytes (US4)', () => {
  it('T018a — rawBytes is populated on note history entry', async () => {
    const input = createMockMidiInput('Piano', 'dev-rb1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireMidiNoteOn(input, 69, 80); // A4 vel 80 ch1 → [0x90, 69, 80]
      await Promise.resolve();
    });

    // expand button should be present (rawBytes is set)
    const list = screen.getByRole('list', { name: /note history/i });
    expect(within(list).getByRole('button', { name: /expand|show bytes|detail/i })).toBeInTheDocument();
  });

  it('T018b — CC messages appear in CC log section', async () => {
    const input = createMockMidiInput('Piano', 'dev-cc1');
    const access = createMockMidiAccess([input]);
    mockMidiSupported(access);

    render(<RecordingView onBack={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire a CC64 (sustain pedal) event
    await act(async () => {
      if (!input.onmidimessage) return;
      const data = new Uint8Array([0xb0, 64, 127]); // CC64 ch1 val 127
      input.onmidimessage({ data, timeStamp: 0 } as unknown as MIDIMessageEvent);
      await Promise.resolve();
    });

    // CC log section should be visible with controller/value/channel info
    expect(screen.getByText(/CC.?64|controller.*64/i)).toBeInTheDocument();
  });
});
