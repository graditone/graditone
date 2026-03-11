/**
 * ScoreViewer.upload.test.tsx — Unit tests for ScoreViewer upload path.
 * Feature 045: Persist Uploaded Scores — T009 / T013 / T020
 *
 * Tests that:
 *  T009: ScoreCache.cache() and addUserScore() are called after successful import
 *  T013: LoadScoreDialog receives userScores, onSelectUserScore, onDeleteUserScore props
 *  T020: handleUserScoreDelete removes metadata immediately, defers IndexedDB delete 5s,
 *        undo cancels the timer and restores the entry
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScoreViewer } from '../../components/ScoreViewer';
import { FileStateProvider } from '../../services/state/FileStateContext';
import { TempoStateProvider } from '../../services/state/TempoStateContext';
import type { ImportResult } from '../../services/import/MusicXMLImportService';
import type { Score } from '../../types/score';

// ── Mock WASM ─────────────────────────────────────────────────────────────────
vi.mock('../../services/wasm/loader', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/wasm/music-engine', () => ({
  parseScore: vi.fn(),
  addInstrument: vi.fn(),
  getScore: vi.fn(),
}));

// ── Mock IndexedDB storage ────────────────────────────────────────────────────
vi.mock('../../services/storage/local-storage', () => ({
  loadScoreFromIndexedDB: vi.fn().mockResolvedValue(null),
  saveScoreToIndexedDB: vi.fn().mockResolvedValue(undefined),
  deleteScoreFromIndexedDB: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock ScoreCache ───────────────────────────────────────────────────────────
vi.mock('../../services/score-cache', () => ({
  ScoreCache: {
    cache: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  },
}));

// ── Mock userScoreIndex ───────────────────────────────────────────────────────
vi.mock('../../services/userScoreIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/userScoreIndex')>();
  return {
    ...actual,
    addUserScore: vi.fn((id: string, name: string) => ({
      id,
      displayName: name,
      uploadedAt: new Date().toISOString(),
    })),
    removeUserScore: vi.fn(),
    listUserScores: vi.fn().mockReturnValue([]),
    getUserScore: vi.fn().mockReturnValue(undefined),
  };
});

// ── Mock LoadScoreDialog — exposes a button that triggers onImportComplete ────
// This isolates ScoreViewer behavior from dialog internals.
let capturedOnImportComplete: ((result: ImportResult) => void) | null = null;
let capturedUserScores: unknown[] | null = null;
let capturedOnSelectUserScore: ((id: string) => void) | null = null;
let capturedOnDeleteUserScore: ((id: string) => void) | null = null;

vi.mock('../../components/load-score/LoadScoreDialog', () => ({
  LoadScoreDialog: ({
    open,
    onImportComplete,
    userScores,
    onSelectUserScore,
    onDeleteUserScore,
  }: {
    open: boolean;
    onImportComplete: (result: ImportResult) => void;
    userScores?: unknown[];
    onSelectUserScore?: (id: string) => void;
    onDeleteUserScore?: (id: string) => void;
  }) => {
    capturedOnImportComplete = onImportComplete;
    capturedUserScores = userScores ?? null;
    capturedOnSelectUserScore = onSelectUserScore ?? null;
    capturedOnDeleteUserScore = onDeleteUserScore ?? null;
    return open ? (
      <div data-testid="mock-dialog">
        <button
          onClick={() => onImportComplete(makeMockImportResult())}
          aria-label="trigger-import"
        >
          Trigger Import
        </button>
      </div>
    ) : null;
  },
}));

// ── Mock API client ───────────────────────────────────────────────────────────
vi.mock('../../services/score-api', () => ({
  apiClient: {
    getScore: vi.fn(),
    createScore: vi.fn(),
    addInstrument: vi.fn(),
  },
}));

function makeMockScore(id = 'score-uuid-1'): Score {
  return {
    id,
    instruments: [],
    tempo_changes: [],
    global_structural_events: [
      { Tempo: { tick: 0, bpm: 120 } },
      { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
    ],
    repeat_barlines: [],
  } as unknown as Score;
}

function makeMockImportResult(scoreId = 'score-uuid-1'): ImportResult {
  return {
    score: makeMockScore(scoreId),
    metadata: {
      work_title: 'My Sonata',
      file_name: 'my_sonata.mxl',
    },
    statistics: {
      note_count: 42,
    },
  } as unknown as ImportResult;
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TempoStateProvider>
      <FileStateProvider>{children}</FileStateProvider>
    </TempoStateProvider>
  );
}

describe('ScoreViewer — upload path (T009)', () => {
  const mockLoadScore = async () => {
    // loadScoreFromIndexedDB is already mocked in the vi.mock call above.
    // We need it to return a score so ScoreViewer shows the instruments view.
    const { loadScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue(makeMockScore('initial-id'));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnImportComplete = null;
    capturedUserScores = null;
    capturedOnSelectUserScore = null;
    capturedOnDeleteUserScore = null;

    const lsMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    vi.stubGlobal('localStorage', lsMock);
  });

  it('calls ScoreCache.cache() with the imported score after successful import', async () => {
    const { ScoreCache } = await import('../../services/score-cache');
    await mockLoadScore();

    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    // Wait for score to load, then open dialog
    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);

    // Trigger import via mock dialog button
    const triggerBtn = await screen.findByRole('button', { name: /trigger-import/i });
    await userEvent.click(triggerBtn);

    await waitFor(() => {
      expect(ScoreCache.cache).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(ScoreCache.cache).mock.calls[0][0].id).toBe('score-uuid-1');
  });

  it('calls addUserScore() with correct id and displayName after import', async () => {
    const { addUserScore } = await import('../../services/userScoreIndex');
    await mockLoadScore();

    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);
    const triggerBtn = await screen.findByRole('button', { name: /trigger-import/i });
    await userEvent.click(triggerBtn);

    await waitFor(() => {
      expect(addUserScore).toHaveBeenCalledWith('score-uuid-1', 'My Sonata');
    });
  });

  it('does NOT call ScoreCache.cache() when no import has occurred', async () => {
    const { ScoreCache } = await import('../../services/score-cache');
    render(
      <TestWrapper>
        <ScoreViewer />
      </TestWrapper>
    );
    expect(ScoreCache.cache).not.toHaveBeenCalled();
  });
});

describe('ScoreViewer — LoadScoreDialog props (T013)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnImportComplete = null;
    capturedUserScores = null;
    capturedOnSelectUserScore = null;
    capturedOnDeleteUserScore = null;

    const lsMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    vi.stubGlobal('localStorage', lsMock);
  });

  it('passes userScores array to LoadScoreDialog', async () => {
    const { loadScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue(makeMockScore('initial-id'));

    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);

    await waitFor(() => {
      expect(capturedUserScores).not.toBeNull();
    });
    expect(Array.isArray(capturedUserScores)).toBe(true);
  });

  it('passes onSelectUserScore callback to LoadScoreDialog', async () => {
    const { loadScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue(makeMockScore('initial-id'));

    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);

    await waitFor(() => {
      expect(capturedOnSelectUserScore).not.toBeNull();
    });
    expect(typeof capturedOnSelectUserScore).toBe('function');
  });

  it('passes onDeleteUserScore callback to LoadScoreDialog', async () => {
    const { loadScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue(makeMockScore('initial-id'));

    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);

    await waitFor(() => {
      expect(capturedOnDeleteUserScore).not.toBeNull();
    });
    expect(typeof capturedOnDeleteUserScore).toBe('function');
  });
});

// ─── T020: Delete with undo ──────────────────────────────────────────────────
// Tests for handleUserScoreDelete / handleUndoDelete in ScoreViewer.
//
// Strategy:
//   • Render ScoreViewer with scoreId so instruments view shows.
//   • useUserScores initialises from listUserScores() mock → has a score to delete.
//   • Trigger delete via capturedOnDeleteUserScore(id) wrapped in act().
//   • For timer-dependent assertions, install fake timers after initial render
//     (so async score load / waitFor / findByRole work with real timers first).

describe('ScoreViewer — delete with undo (T020)', () => {
  const SCORE_ID = 'user-score-uuid-1';
  const DISPLAY_NAME = 'My Uploaded Sonata';

  async function setupMocks() {
    const { listUserScores } = await import('../../services/userScoreIndex');
    const userScoreEntry = { id: SCORE_ID, displayName: DISPLAY_NAME, uploadedAt: new Date().toISOString() };
    vi.mocked(listUserScores).mockReturnValue([userScoreEntry]);

    const { loadScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue(makeMockScore('initial-id'));
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedOnImportComplete = null;
    capturedUserScores = null;
    capturedOnSelectUserScore = null;
    capturedOnDeleteUserScore = null;

    const lsMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    vi.stubGlobal('localStorage', lsMock);
    await setupMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Render ScoreViewer with a loaded score and open the dialog, then return.
   * Uses real timers throughout so async operations complete normally.
   */
  async function renderAndOpenDialog() {
    render(
      <TestWrapper>
        <ScoreViewer scoreId="initial-id" />
      </TestWrapper>
    );

    const loadBtn = await screen.findByRole('button', { name: /load score/i });
    await userEvent.click(loadBtn);

    await waitFor(() => {
      expect(capturedOnDeleteUserScore).not.toBeNull();
    });
  }

  /**
   * Trigger delete inside act() so React flushes state (setSuccessMessage).
   */
  async function triggerDelete() {
    await act(async () => {
      capturedOnDeleteUserScore!(SCORE_ID);
    });
  }

  it('calls removeUserScore() immediately when delete is triggered', async () => {
    const { removeUserScore } = await import('../../services/userScoreIndex');
    await renderAndOpenDialog();
    await triggerDelete();
    expect(removeUserScore).toHaveBeenCalledWith(SCORE_ID);
  });

  it('does NOT call deleteScoreFromIndexedDB immediately after delete', async () => {
    const { deleteScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    await renderAndOpenDialog();

    // Install fake timers before triggering delete to freeze the deferred call
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] });

    await act(async () => {
      capturedOnDeleteUserScore!(SCORE_ID);
    });

    expect(deleteScoreFromIndexedDB).not.toHaveBeenCalled();
  });

  it('calls deleteScoreFromIndexedDB after 5 seconds without undo', async () => {
    const { deleteScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    await renderAndOpenDialog();

    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] });

    await act(async () => {
      capturedOnDeleteUserScore!(SCORE_ID);
    });

    expect(deleteScoreFromIndexedDB).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(deleteScoreFromIndexedDB).toHaveBeenCalledWith(SCORE_ID);
    expect(deleteScoreFromIndexedDB).toHaveBeenCalledTimes(1);
  });

  it('shows the Undo button in the success message after delete', async () => {
    await renderAndOpenDialog();
    await triggerDelete();

    // Success message with Undo button should be rendered
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('does NOT call deleteScoreFromIndexedDB when undo is clicked before 5 seconds', async () => {
    const { deleteScoreFromIndexedDB } = await import('../../services/storage/local-storage');
    await renderAndOpenDialog();

    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] });

    await act(async () => {
      capturedOnDeleteUserScore!(SCORE_ID);
    });

    await vi.advanceTimersByTimeAsync(2000);

    const undoBtn = screen.getByRole('button', { name: /undo/i });
    await act(async () => {
      undoBtn.click();
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(deleteScoreFromIndexedDB).not.toHaveBeenCalled();
  });

  it('calls addUserScore() to restore the entry when undo is clicked', async () => {
    const { addUserScore } = await import('../../services/userScoreIndex');
    await renderAndOpenDialog();

    vi.mocked(addUserScore).mockClear();

    await triggerDelete();

    const undoBtn = screen.getByRole('button', { name: /undo/i });
    await act(async () => {
      undoBtn.click();
    });

    expect(addUserScore).toHaveBeenCalledWith(SCORE_ID, DISPLAY_NAME);
  });
});
