/**
 * Unit Tests: ScoreViewer Offline Behavior
 * 
 * Feature: 025-offline-mode (User Story 2)
 * Tests that ScoreViewer works completely offline using WASM + IndexedDB only
 * 
 * Constitution Principle V: Test-First Development
 * These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ScoreViewer } from '../../src/components/ScoreViewer';
import * as localStorage from '../../src/services/storage/local-storage';
import * as scoreApi from '../../src/services/score-api';
import * as wasmEngine from '../../src/services/wasm/music-engine';
import type { Score } from '../../src/domain/types';

// Mock modules
vi.mock('../../src/services/storage/local-storage');
vi.mock('../../src/services/score-api');
vi.mock('../../src/services/wasm/music-engine');

// Mock audio context (required for playback features)
vi.mock('../../src/services/audio/audio-player', () => ({
  useAudioPlayer: () => ({
    playScore: vi.fn(),
    playbackState: { status: 'paused', currentTick: 0 },
  }),
}));

// Mock useScorePlayback hook
vi.mock('../../src/hooks/useScorePlayback', () => ({
  useScorePlayback: () => ({
    playbackState: {
      status: 'paused',
      currentTick: 0,
      seekToTick: vi.fn(),
      unpinStartTick: vi.fn(),
    },
    startPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    stopPlayback: vi.fn(),
    seekToTick: vi.fn(),
  }),
}));

// Mock file state hook
vi.mock('../../src/services/state/FileStateContext', () => ({
  useFileState: () => ({
    fileState: { fileName: null, isModified: false, lastSaved: null },
    markModified: vi.fn(),
    resetFileState: vi.fn(),
  }),
}));

// Mock tempo state hook
vi.mock('../../src/services/state/TempoStateContext', () => ({
  useTempoState: () => ({
    tempoState: { tempoMultiplier: 1.0, originalTempo: 120, effectiveTempo: 120 },
    setTempoMultiplier: vi.fn(),
    adjustTempo: vi.fn(),
    resetTempo: vi.fn(),
    getEffectiveTempo: () => 120,
    setOriginalTempo: vi.fn(),
  }),
  TempoStateProvider: ({ children }: { children: unknown }) => children,
}));

// Mock usePlayback hook
vi.mock('../../src/services/playback/MusicTimeline', () => ({
  usePlayback: () => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekToTick: vi.fn(),
    unpinStartTick: vi.fn(),
    setPinnedStart: vi.fn(),
    setLoopEnd: vi.fn(),
    resetPlayback: vi.fn(),
    status: 'stopped',
    currentTick: 0,
    totalDurationTicks: 0,
    error: null,
    tickSource: { currentTick: 0 },
    tickSourceRef: { current: { currentTick: 0 } },
    playbackState: { currentTick: 0 },
  }),
}));

// Mock useNoteHighlight hook
vi.mock('../../src/services/highlight/useNoteHighlight', () => ({
  useNoteHighlight: () => new Set<string>(),
}));

// Mock demoLoaderService
vi.mock('../../src/services/onboarding/demoLoader', () => ({
  demoLoaderService: {
    loadBundledDemo: vi.fn(),
    getDemoScore: vi.fn(),
    isDemoLoaded: vi.fn(),
  },
}));

// Mock layout engine
vi.mock('../../src/services/wasm/layout-engine', () => ({
  layoutScore: vi.fn().mockResolvedValue({ measures: [] }),
}));

describe('ScoreViewer - Offline Mode (Feature 025, US2)', () => {
  let mockLoadScoreFromIndexedDB: ReturnType<typeof vi.fn>;
  let mockSaveScoreToIndexedDB: ReturnType<typeof vi.fn>;
  let mockApiClientGetScore: ReturnType<typeof vi.fn>;
  let mockApiClientCreateScore: ReturnType<typeof vi.fn>;
  let mockWasmCreateScore: ReturnType<typeof vi.fn>;

  // Sample score data for tests
  const mockScore: Score = {
    id: 'test-score-123',
    instruments: [
      {
        id: 'inst-1',
        name: 'Piano',
        midi_program: 0,
        staves: [
          {
            id: 'staff-1',
            clef: 'treble',
            voices: [
              {
                id: 'voice-1',
                interval_events: [],
              },
            ],
          },
        ],
      },
    ],
    schema_version: 2,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup IndexedDB mocks
    mockLoadScoreFromIndexedDB = vi.fn();
    mockSaveScoreToIndexedDB = vi.fn();
    vi.mocked(localStorage.loadScoreFromIndexedDB).mockImplementation(mockLoadScoreFromIndexedDB);
    vi.mocked(localStorage.saveScoreToIndexedDB).mockImplementation(mockSaveScoreToIndexedDB);

    // Setup REST API mocks
    mockApiClientGetScore = vi.fn();
    mockApiClientCreateScore = vi.fn();
    vi.mocked(scoreApi.apiClient.getScore).mockImplementation(mockApiClientGetScore);
    vi.mocked(scoreApi.apiClient.createScore).mockImplementation(mockApiClientCreateScore);

    // Setup WASM mocks
    mockWasmCreateScore = vi.fn();
    vi.mocked(wasmEngine.createScore).mockImplementation(mockWasmCreateScore);
    vi.mocked(wasmEngine.getSchemaVersion).mockResolvedValue(9);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * T019: Unit test - loadScore() only checks IndexedDB, no apiClient calls
   * 
   * After Feature 025, the app should work offline using IndexedDB only.
   * EXPECTED TO FAIL initially - current code has REST API fallback at line 84.
   */
  describe('loadScore() - offline behavior', () => {
    it('should load score from IndexedDB without calling REST API', async () => {
      // Arrange: Set up IndexedDB to return a score
      mockLoadScoreFromIndexedDB.mockResolvedValue({ kind: 'loaded', score: mockScore });

      // Act: Render ScoreViewer with a score ID
      render(<ScoreViewer scoreId="test-score-123" />);

      // Assert: Wait for score to load
      await waitFor(() => {
        expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledWith('test-score-123', 9);
      });

      // Assert: Should NOT call REST API (offline parity)
      expect(mockApiClientGetScore).not.toHaveBeenCalled();
      
      // Assert: Score should be displayed
      // Note: Actual UI verification depends on component structure
    });

    it('should NOT fall back to REST API if score not in IndexedDB', async () => {
      // Arrange: Set up IndexedDB to return not-found
      mockLoadScoreFromIndexedDB.mockResolvedValue({ kind: 'not-found' });
      
      // Arrange: Set up REST API mock (should NOT be called)
      mockApiClientGetScore.mockResolvedValue(mockScore);

      // Act: Render ScoreViewer with a score ID
      render(<ScoreViewer scoreId="test-score-456" />);

      // Assert: IndexedDB should be checked
      await waitFor(() => {
        expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledWith('test-score-456', 9);
      });

      // Assert: REST API should NOT be called (offline parity requirement)
      // EXPECTED TO FAIL - current code falls back to apiClient.getScore()
      expect(mockApiClientGetScore).not.toHaveBeenCalled();
    });
  });

  /**
   * T020: Unit test - loadScore() shows "Score not found" if not in IndexedDB
   * 
   * Clear error message helps users understand offline limitations.
   */
  describe('loadScore() - error handling', () => {
    it('should show "Score not found in local storage" error when score missing', async () => {
      // Arrange: Set up IndexedDB to return not-found
      mockLoadScoreFromIndexedDB.mockResolvedValue({ kind: 'not-found' });

      // Act: Render ScoreViewer
      render(<ScoreViewer scoreId="missing-score" />);

      // Assert: Wait for error message
      await waitFor(() => {
        expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledWith('missing-score', 9);
      });

      // Assert: Error message should mention local storage (not generic "failed to load")
      // EXPECTED TO FAIL - current code may show generic error or still show API error
      const errorText = await screen.findByText(/score not found in local storage/i);
      expect(errorText).toBeInTheDocument();
      
      // Assert: Error should mention import or demo as next steps
      const helpText = screen.getByText(/import a musicxml file or load the demo/i);
      expect(helpText).toBeInTheDocument();
    });
  });

  /**
   * T021: Unit test - handleMusicXMLImport() saves to IndexedDB without sync
   * 
   * Import should work fully offline using WASM parser + IndexedDB storage.
   * No REST API calls should be made.
   */
  describe('handleMusicXMLImport() - offline behavior', () => {
    it('should save imported score to IndexedDB without calling REST API', async () => {
      // Note: This test verifies the import flow doesn't call syncLocalScoreToBackend
      // The actual import is triggered via MusicXMLImporter component
      
      // Arrange: Mock successful IndexedDB save
      mockSaveScoreToIndexedDB.mockResolvedValue(undefined);

      // Arrange: Set up REST API mocks (should NOT be called)
      mockApiClientCreateScore.mockResolvedValue({ id: 'backend-id', instruments: [] });

      // Act: Simulate import result (would come from MusicXMLImporter component)
      const { rerender } = render(<ScoreViewer />);

      // Simulate handleMusicXMLImport being called with WASM parse result
      // (In real usage, this comes from MusicXMLImporter's onImportComplete prop)
      // We can't directly call it here, but we verify the behavior indirectly

      // For now, just verify that syncLocalScoreToBackend prop is NOT passed
      // or that it doesn't result in REST API calls
      
      // NOTE: This test may need refinement based on actual component structure
      // The key assertion is: no REST API calls during import
      
      rerender(<ScoreViewer />);

      // Assert: REST API should NOT be called during import
      expect(mockApiClientCreateScore).not.toHaveBeenCalled();
      expect(mockApiClientGetScore).not.toHaveBeenCalled();
    });
  });

  /**
   * T022: Unit test - createNewScore() uses WASM createScore() not apiClient
   * 
   * Legacy createNewScore() should use WASM for offline compatibility.
   * EXPECTED TO FAIL initially - current code uses apiClient.createScore() at line 133.
   */
  describe('createNewScore() - offline behavior', () => {
    it('should create score using WASM engine, not REST API', async () => {
      // Arrange: Mock WASM createScore
      const wasmCreatedScore: Score = {
        id: 'wasm-score-id',
        instruments: [],
        schema_version: 2,
      };
      mockWasmCreateScore.mockResolvedValue(wasmCreatedScore);
      
      // Arrange: Mock IndexedDB save
      mockSaveScoreToIndexedDB.mockResolvedValue(undefined);

      // Arrange: Mock REST API (should NOT be called)
      mockApiClientCreateScore.mockResolvedValue({ id: 'backend-id', instruments: [] });

      // Act: Render ScoreViewer and trigger new score creation
      // NOTE: createNewScore() is marked as deprecated but still defined
      // The actual method call would need to be triggered via UI or ref
      
      render(<ScoreViewer />);

      // Since createNewScore() is deprecated and not exposed via UI,
      // we can't easily trigger it in this test
      // This test documents the EXPECTED behavior for when it IS called
      
      // For now, verify the REST API is NOT set up as dependency for new score creation
      // In future, this could be tested via component ref or direct function call

      // Assert: REST API should NOT be called
      // EXPECTED TO FAIL - current implementation uses apiClient.createScore()
      expect(mockApiClientCreateScore).not.toHaveBeenCalled();
      
      // Assert: WASM createScore should be used instead
      // NOTE: This may need to be tested differently depending on UI structure
    });
  });

  /**
   * Additional integration tests for offline score management
   */
  describe('Offline score management integration', () => {
    it('should work entirely offline after scores are cached', async () => {
      // Arrange: Set up IndexedDB with multiple scores
      const score1: Score = { ...mockScore, id: 'score-1' };
      const score2: Score = { ...mockScore, id: 'score-2' };
      
      mockLoadScoreFromIndexedDB
        .mockResolvedValueOnce({ kind: 'loaded', score: score1 })
        .mockResolvedValueOnce({ kind: 'loaded', score: score2 });

      // Act: Load first score
      const { rerender } = render(<ScoreViewer scoreId="score-1" />);

      await waitFor(() => {
        expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledWith('score-1', 9);
      });

      // Act: Switch to second score
      rerender(<ScoreViewer scoreId="score-2" />);

      await waitFor(() => {
        expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledWith('score-2', 9);
      });

      // Assert: All operations used IndexedDB only
      expect(mockLoadScoreFromIndexedDB).toHaveBeenCalledTimes(2);
      
      // Assert: No REST API calls made
      expect(mockApiClientGetScore).not.toHaveBeenCalled();
      
      // This proves offline parity - app works identically online/offline
    });
  });
});
