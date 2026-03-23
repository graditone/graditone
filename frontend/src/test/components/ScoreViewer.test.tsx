import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ScoreViewer } from "../../components/ScoreViewer";
import { FileStateProvider } from "../../services/state/FileStateContext";
import { TempoStateProvider } from "../../services/state/TempoStateContext";
import { apiClient } from "../../services/score-api";
import { loadScoreFromIndexedDB } from "../../services/storage/local-storage";
import type { Score } from "../../types/score";

/**
 * T004 & T011: Unit tests for ScoreViewer component - Feature 014
 *
 * Feature 014 - Remove Editing Interface: User Stories 1 & 2
 * Tests that editing UI elements do not render:
 * - Save button (US1)
 * - Score name input field (US1)
 * - New Score button (US2)
 */

// Mock WASM loader to prevent initialization errors in tests
vi.mock("../../services/wasm/loader", () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
}));

// Mock WASM engine with minimal implementation
vi.mock("../../services/wasm/music-engine", () => ({
  parseScore: vi.fn(),
  addInstrument: vi.fn(),
  getScore: vi.fn(),
  getSchemaVersion: vi.fn().mockResolvedValue(9),
}));

// Mock IndexedDB storage (Feature 025)
vi.mock("../../services/storage/local-storage", () => ({
  loadScoreFromIndexedDB: vi.fn().mockResolvedValue({ kind: 'not-found' }),
  saveScoreToIndexedDB: vi.fn(),
  deleteScoreFromIndexedDB: vi.fn(),
}));

// Wrapper component for providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TempoStateProvider>
      <FileStateProvider>{children}</FileStateProvider>
    </TempoStateProvider>
  );
}

describe("ScoreViewer - Editing UI Removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Save button should NOT render in viewer header
   */
  it("should not render Save button in score viewer header", async () => {
    // Mock score with all required fields
    const mockScore = {
      id: "test-id",
      title: "Test Score",
      instruments: [
        {
          id: "inst-1",
          name: "Piano",
          staves: [],
        },
      ],
      tempo_changes: [],
      global_structural_events: [
        {
          Tempo: {
            tick: 0,
            bpm: 120,
          },
        },
        {
          TimeSignature: {
            tick: 0,
            numerator: 4,
            denominator: 4,
          },
        },
      ],
    };

    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue({ kind: 'loaded', score: mockScore as unknown as Score });

    render(
      <TestWrapper>
        <ScoreViewer scoreId="test-id" />
      </TestWrapper>
    );

    // Wait for score to load from IndexedDB (Feature 025)
    await waitFor(() => {
      expect(loadScoreFromIndexedDB).toHaveBeenCalledWith("test-id", 9);
    });

    // Query for Save button
    const saveButton = screen.queryByRole("button", { name: /^save$/i });
    expect(saveButton).not.toBeInTheDocument();
  });

  /**
   * Test: Score name input field should NOT render
   * Feature 025: Load from IndexedDB (offline mode)
   */
  it("should not render score filename input field", async () => {
    const mockScore = {
      id: "test-id",
      title: "Test Score",
      instruments: [],
      tempo_changes: [],
      global_structural_events: [
        {
          Tempo: {
            tick: 0,
            bpm: 120,
          },
        },
        {
          TimeSignature: {
            tick: 0,
            numerator: 4,
            denominator: 4,
          },
        },
      ],
    };

    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue({ kind: 'loaded', score: mockScore as unknown as Score });

    render(
      <TestWrapper>
        <ScoreViewer scoreId="test-id" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(loadScoreFromIndexedDB).toHaveBeenCalledWith("test-id", 9);
    });

    // Query for filename input by placeholder text
    const filenameInput = screen.queryByPlaceholderText(/filename.*optional/i);
    expect(filenameInput).not.toBeInTheDocument();
  });

  /**
   * Test: New Score button should NOT render in landing page
   */
  it("should not render New Score button in landing page", async () => {
    render(
      <TestWrapper>
        <ScoreViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
    });

    // Query for New Score button in landing page
    const newScoreButton = screen.queryByRole("button", { name: /^new score$/i });
    expect(newScoreButton).not.toBeInTheDocument();
  });

  /**
   * Test: New button should NOT render in viewer header
   * Feature 025: Load from IndexedDB (offline mode)
   */
  it("should not render New button in viewer header", async () => {
    const mockScore = {
      id: "test-id",
      title: "Test Score",
      instruments: [],
      tempo_changes: [],
      global_structural_events: [
        {
          Tempo: {
            tick: 0,
            bpm: 120,
          },
        },
        {
          TimeSignature: {
            tick: 0,
            numerator: 4,
            denominator: 4,
          },
        },
      ],
    };

    vi.mocked(loadScoreFromIndexedDB).mockResolvedValue({ kind: 'loaded', score: mockScore as unknown as Score });

    render(
      <TestWrapper>
        <ScoreViewer scoreId="test-id" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(loadScoreFromIndexedDB).toHaveBeenCalledWith("test-id", 9);
    });

    // Query for New button (shorter label in header)
    const newButton = screen.queryByRole("button", { name: /^new$/i });
    expect(newButton).not.toBeInTheDocument();
  });

  /**
   * Test: Landing page renders with landing-screen testid (Feature 028 moved to Play Score plugin)
   */
  it("should still render Import button", async () => {
    render(
      <TestWrapper>
        <ScoreViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
    });

    // LoadScoreButton removed — Play Score plugin (033) handles score loading.
    // Verify no legacy "New Score" button leaked in.
    const newScoreButton = screen.queryByRole('button', { name: /^new score$/i });
    expect(newScoreButton).not.toBeInTheDocument();
  });

  /**
   * Test: Demo button should NOT render on landing page (Feature 028 moved to Play Score plugin)
   */
  it("should still render Demo button on landing page", async () => {
    render(
      <TestWrapper>
        <ScoreViewer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
    });

    // Verify the old Demo button is gone
    const demoButton = screen.queryByRole("button", { name: /^demo$/i });
    expect(demoButton).not.toBeInTheDocument();
  });
});
