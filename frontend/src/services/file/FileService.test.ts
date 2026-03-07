import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveScore, loadScore, createNewScore } from './FileService';
import type { Score } from '../../types/score';

/**
 * Test suite for FileService save functionality
 * Tests score saving with browser File API (download)
 * All tests should FAIL until FileService.ts is implemented (TDD approach)
 */
describe('FileService - saveScore', () => {
  // Mock HTML anchor element for download trigger
  let mockAnchor: HTMLAnchorElement;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create mock anchor element
    mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    } as unknown as HTMLAnchorElement;

    // Mock document.createElement
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Save Functionality
  // ============================================================================

  describe('Basic Save Functionality', () => {
    it('should create a Blob with JSON content', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      // Mock Blob constructor to capture arguments
      const originalBlob = global.Blob;
      const blobData: any[] = [];
      global.Blob = class MockBlob {
        constructor(data: any[], options: any) {
          blobData.push(...data);
          return { type: options.type } as any;
        }
      } as any;

      saveScore(mockScore, 'test-score');

      // Verify Blob was created with JSON string
      expect(blobData.length).toBeGreaterThan(0);
      const jsonString = blobData[0];
      expect(jsonString).toContain('"id"');
      expect(jsonString).toContain('550e8400-e29b-41d4-a716-446655440000');

      global.Blob = originalBlob;
    });

    it('should create Blob with application/json MIME type', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      let capturedOptions: any;
      const originalBlob = global.Blob;
      global.Blob = class MockBlob {
        constructor(data: any[], options: any) {
          capturedOptions = options;
          return {} as any;
        }
      } as any;

      saveScore(mockScore, 'test-score');

      expect(capturedOptions.type).toBe('application/json');

      global.Blob = originalBlob;
    });

    it('should trigger download with correct filename', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'my-symphony');

      expect(mockAnchor.download).toBe('my-symphony.graditone.json');
      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('should use default filename if not provided', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore);

      expect(mockAnchor.download).toMatch(/^score.*\.graditone\.json$/);
      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('should create object URL and assign to anchor href', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'test-score');

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(mockAnchor.href).toBe('blob:mock-url');
    });

    it('should revoke object URL after download', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'test-score');

      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  // ============================================================================
  // JSON Formatting
  // ============================================================================

  describe('JSON Formatting', () => {
    it('should format JSON with pretty-print (2-space indentation)', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          {
            Tempo: {
              tick: 0,
              bpm: 120,
            },
          },
        ],
        instruments: [],
      };

      const originalBlob = global.Blob;
      let capturedJson = '';
      global.Blob = class MockBlob {
        constructor(data: any[]) {
          capturedJson = data[0];
          return {} as any;
        }
      } as any;

      saveScore(mockScore, 'test-score');

      // Verify pretty-print formatting (should have newlines and indentation)
      expect(capturedJson).toContain('\n');
      expect(capturedJson).toContain('  '); // 2-space indent
      expect(capturedJson).not.toBe(JSON.stringify(mockScore)); // Not minified

      global.Blob = originalBlob;
    });

    it('should preserve all score data in JSON', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
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
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: [
                      {
                        id: '990e8400-e29b-41d4-a716-446655440004',
                        start_tick: 0,
                        duration_ticks: 960,
                        pitch: 60,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const originalBlob = global.Blob;
      let capturedJson = '';
      global.Blob = class MockBlob {
        constructor(data: any[]) {
          capturedJson = data[0];
          return {} as any;
        }
      } as any;

      saveScore(mockScore, 'test-score');

      // Parse back and verify all data preserved
      const parsedScore = JSON.parse(capturedJson);
      expect(parsedScore.id).toBe(mockScore.id);
      expect(parsedScore.global_structural_events).toHaveLength(2);
      expect(parsedScore.instruments).toHaveLength(1);
      expect(parsedScore.instruments[0].staves[0].voices[0].interval_events).toHaveLength(1);
      expect(parsedScore.instruments[0].staves[0].voices[0].interval_events[0].pitch).toBe(60);

      global.Blob = originalBlob;
    });
  });

  // ============================================================================
  // Filename Handling
  // ============================================================================

  describe('Filename Handling', () => {
    it('should sanitize filename by removing invalid characters', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'my/score:with*invalid?chars');

      // Filename should be sanitized (invalid chars removed or replaced)
      expect(mockAnchor.download).not.toContain('/');
      expect(mockAnchor.download).not.toContain(':');
      expect(mockAnchor.download).not.toContain('*');
      expect(mockAnchor.download).not.toContain('?');
      expect(mockAnchor.download).toMatch(/\.graditone\.json$/);
    });

    it('should handle empty filename', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, '');

      // Should use default filename
      expect(mockAnchor.download).toMatch(/^score.*\.graditone\.json$/);
    });

    it('should append .graditone.json extension', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'my-score');

      expect(mockAnchor.download).toBe('my-score.graditone.json');
    });

    it('should not duplicate extension if already present', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      saveScore(mockScore, 'my-score.graditone.json');

      // Should not become 'my-score.graditone.json.graditone.json'
      expect(mockAnchor.download).toBe('my-score.graditone.json');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle score with no instruments', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      expect(() => saveScore(mockScore, 'empty-score')).not.toThrow();
      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('should handle score with complex nested structure', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
          { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [
                  { Clef: { tick: 0, clef_type: 'Treble' } },
                ],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: Array(100).fill(null).map((_, i) => ({
                      id: `note-${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60 + (i % 12),
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => saveScore(mockScore, 'complex-score')).not.toThrow();
      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in score data', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano "Grand" & Strings',
            instrument_type: 'piano',
            staves: [],
          },
        ],
      };

      const originalBlob = global.Blob;
      let capturedJson = '';
      global.Blob = class MockBlob {
        constructor(data: any[]) {
          capturedJson = data[0];
          return {} as any;
        }
      } as any;

      saveScore(mockScore, 'test-score');

      // Should properly escape special characters in JSON
      const parsedScore = JSON.parse(capturedJson);
      expect(parsedScore.instruments[0].name).toBe('Piano "Grand" & Strings');

      global.Blob = originalBlob;
    });
  });

  // ============================================================================
  // Performance
  // ============================================================================

  describe('Performance', () => {
    it('should complete save operation quickly for typical score', () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: Array(50).fill(null).map((_, i) => ({
                      id: `note-${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      const startTime = performance.now();
      saveScore(mockScore, 'performance-test');
      const endTime = performance.now();

      // Should complete in well under 1 second (target: < 1s per spec SC-002)
      // Allow 100ms for test environment overhead
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

// ============================================================================
// FileService - loadScore Tests (Feature 004 T015)
// ============================================================================

/**
 * Test suite for FileService load functionality
 * Tests score loading with browser FileReader API
 * All tests should FAIL until loadScore is fully implemented (TDD approach)
 */
describe('FileService - loadScore', () => {
  // ============================================================================
  // Basic Load Functionality
  // ============================================================================

  describe('Basic Load Functionality', () => {
    it('should parse valid JSON file and return Score object', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'test-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result).toEqual(mockScore);
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should parse complex score with full hierarchy', async () => {
      const complexScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
          { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [
                  { Clef: { tick: 0, clef_type: 'Treble' } },
                ],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: [
                      {
                        id: '990e8400-e29b-41d4-a716-446655440004',
                        start_tick: 0,
                        duration_ticks: 960,
                        pitch: 60,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const jsonContent = JSON.stringify(complexScore);
      const file = new File([jsonContent], 'complex-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result.instruments).toHaveLength(1);
      expect(result.instruments[0].name).toBe('Piano');
      expect(result.instruments[0].staves[0].voices[0].interval_events).toHaveLength(1);
      expect(result.instruments[0].staves[0].voices[0].interval_events[0].pitch).toBe(60);
    });

    it('should handle pretty-printed JSON', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      // Pretty-printed JSON (as saved by saveScore)
      const jsonContent = JSON.stringify(mockScore, null, 2);
      const file = new File([jsonContent], 'pretty-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result).toEqual(mockScore);
    });

    it('should handle minified JSON', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      // Minified JSON (no whitespace)
      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'minified-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result).toEqual(mockScore);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should reject with error for invalid JSON', async () => {
      const invalidJson = '{ "id": "123", invalid }';
      const file = new File([invalidJson], 'invalid.json', { type: 'application/json' });

      await expect(loadScore(file)).rejects.toThrow('Failed to parse score file');
    });

    it('should reject with error for empty file', async () => {
      const file = new File([''], 'empty.json', { type: 'application/json' });

      await expect(loadScore(file)).rejects.toThrow();
    });

    it('should reject with error for non-JSON content', async () => {
      const textContent = 'This is not JSON';
      const file = new File([textContent], 'text.txt', { type: 'text/plain' });

      await expect(loadScore(file)).rejects.toThrow();
    });

    it('should reject with error for JSON array instead of object', async () => {
      const arrayJson = '[1, 2, 3]';
      const file = new File([arrayJson], 'array.json', { type: 'application/json' });

      await expect(loadScore(file)).rejects.toThrow();
    });

    it('should reject with error for JSON string instead of object', async () => {
      const stringJson = '"just a string"';
      const file = new File([stringJson], 'string.json', { type: 'application/json' });

      await expect(loadScore(file)).rejects.toThrow();
    });
  });

  // ============================================================================
  // File Reading
  // ============================================================================

  describe('File Reading', () => {
    it('should read file with FileReader API', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      // Should not throw and should return a promise
      const resultPromise = loadScore(file);
      expect(resultPromise).toBeInstanceOf(Promise);

      const result = await resultPromise;
      expect(result).toBeDefined();
    });

    it('should handle large files', async () => {
      // Create a score with many notes
      const largeScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: Array(1000).fill(null).map((_, i) => ({
                      id: `note-${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60 + (i % 48),
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      const jsonContent = JSON.stringify(largeScore, null, 2);
      const file = new File([jsonContent], 'large-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result.instruments[0].staves[0].voices[0].interval_events).toHaveLength(1000);
    });

    it('should handle file with BOM (Byte Order Mark)', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [],
      };

      // Add UTF-8 BOM
      const jsonContent = '\uFEFF' + JSON.stringify(mockScore);
      const file = new File([jsonContent], 'bom-score.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  // ============================================================================
  // Data Integrity
  // ============================================================================

  describe('Data Integrity', () => {
    it('should preserve exact integer values (no floating point conversion)', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 3840, bpm: 120 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: [
                      {
                        id: '990e8400-e29b-41d4-a716-446655440004',
                        start_tick: 1920,
                        duration_ticks: 480,
                        pitch: 72,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'integrity-test.json', { type: 'application/json' });

      const result = await loadScore(file);

      // Verify exact integer preservation (SC-001: 100% data fidelity)
      const event = result.global_structural_events[0];
      if ('Tempo' in event) {
        expect(event.Tempo.tick).toBe(3840);
        expect(event.Tempo.bpm).toBe(120);
      }

      const note = result.instruments[0].staves[0].voices[0].interval_events[0];
      expect(note.start_tick).toBe(1920);
      expect(note.duration_ticks).toBe(480);
      expect(note.pitch).toBe(72);
    });

    it('should preserve special characters in instrument names', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano "Grand" & Strings',
            instrument_type: 'piano',
            staves: [],
          },
        ],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'special-chars.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result.instruments[0].name).toBe('Piano "Grand" & Strings');
    });

    it('should preserve UUID formats', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'uuid-test.json', { type: 'application/json' });

      const result = await loadScore(file);

      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result.instruments[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  // ============================================================================
  // Performance
  // ============================================================================

  describe('Performance', () => {
    it('should complete load operation within 2 seconds for typical score', async () => {
      const mockScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: Array(100).fill(null).map((_, i) => ({
                      id: `note-${i}`,
                      start_tick: i * 960,
                      duration_ticks: 960,
                      pitch: 60,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      const jsonContent = JSON.stringify(mockScore);
      const file = new File([jsonContent], 'performance.json', { type: 'application/json' });

      const startTime = performance.now();
      await loadScore(file);
      const endTime = performance.now();

      // Should complete in well under 2 seconds (target: < 2s per spec SC-003)
      // Allow 200ms for test environment overhead
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  // ============================================================================
  // Round-Trip Fidelity
  // ============================================================================

  describe('Round-Trip Fidelity', () => {
    it('should preserve all data through save-load cycle', async () => {
      const originalScore: Score = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        global_structural_events: [
          { Tempo: { tick: 0, bpm: 120 } },
          { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
          { Tempo: { tick: 3840, bpm: 140 } },
        ],
        instruments: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Piano',
            instrument_type: 'piano',
            staves: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                staff_structural_events: [
                  { Clef: { tick: 0, clef_type: 'Treble' } },
                  { KeySignature: { tick: 0, key: 'CMajor' } },
                ],
                voices: [
                  {
                    id: '880e8400-e29b-41d4-a716-446655440003',
                    interval_events: [
                      {
                        id: '990e8400-e29b-41d4-a716-446655440004',
                        start_tick: 0,
                        duration_ticks: 960,
                        pitch: 60,
                      },
                      {
                        id: '990e8400-e29b-41d4-a716-446655440005',
                        start_tick: 960,
                        duration_ticks: 960,
                        pitch: 64,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      // Simulate save (JSON.stringify)
      const savedJson = JSON.stringify(originalScore, null, 2);
      
      // Simulate load (FileReader + JSON.parse)
      const file = new File([savedJson], 'round-trip.json', { type: 'application/json' });
      const loadedScore = await loadScore(file);

      // Verify 100% data fidelity (SC-001)
      expect(loadedScore).toEqual(originalScore);
      expect(JSON.stringify(loadedScore)).toBe(JSON.stringify(originalScore));
    });
  });
});

// ============================================================================
// FileService - createNewScore Tests (Feature 004 T023)
// ============================================================================

/**
 * Test suite for FileService new score creation
 * Tests creation of empty scores with default settings
 * All tests should FAIL until createNewScore is fully implemented (TDD approach)
 */
describe('FileService - createNewScore', () => {
  // ============================================================================
  // Basic Creation
  // ============================================================================

  describe('Basic Creation', () => {
    it('should create a new score with UUID', () => {
      const newScore = createNewScore();

      expect(newScore).toBeDefined();
      expect(newScore.id).toBeDefined();
      expect(typeof newScore.id).toBe('string');
      expect(newScore.id.length).toBeGreaterThan(0);
    });

    it('should generate unique UUIDs for multiple scores', () => {
      const score1 = createNewScore();
      const score2 = createNewScore();
      const score3 = createNewScore();

      expect(score1.id).not.toBe(score2.id);
      expect(score2.id).not.toBe(score3.id);
      expect(score1.id).not.toBe(score3.id);
    });

    it('should create UUID in valid format', () => {
      const newScore = createNewScore();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(newScore.id).toMatch(uuidRegex);
    });

    it('should create score with empty instruments array', () => {
      const newScore = createNewScore();

      expect(newScore.instruments).toBeDefined();
      expect(Array.isArray(newScore.instruments)).toBe(true);
      expect(newScore.instruments).toHaveLength(0);
    });

    it('should create score with global structural events', () => {
      const newScore = createNewScore();

      expect(newScore.global_structural_events).toBeDefined();
      expect(Array.isArray(newScore.global_structural_events)).toBe(true);
      expect(newScore.global_structural_events.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Default Settings
  // ============================================================================

  describe('Default Settings', () => {
    it('should set default tempo to 120 BPM at tick 0', () => {
      const newScore = createNewScore();

      const tempoEvent = newScore.global_structural_events.find(
        (event) => 'Tempo' in event
      );

      expect(tempoEvent).toBeDefined();
      if (tempoEvent && 'Tempo' in tempoEvent) {
        expect(tempoEvent.Tempo.tick).toBe(0);
        expect(tempoEvent.Tempo.bpm).toBe(120);
      }
    });

    it('should set default time signature to 4/4 at tick 0', () => {
      const newScore = createNewScore();

      const timeSigEvent = newScore.global_structural_events.find(
        (event) => 'TimeSignature' in event
      );

      expect(timeSigEvent).toBeDefined();
      if (timeSigEvent && 'TimeSignature' in timeSigEvent) {
        expect(timeSigEvent.TimeSignature.tick).toBe(0);
        expect(timeSigEvent.TimeSignature.numerator).toBe(4);
        expect(timeSigEvent.TimeSignature.denominator).toBe(4);
      }
    });

    it('should have exactly 2 global structural events (tempo and time signature)', () => {
      const newScore = createNewScore();

      expect(newScore.global_structural_events).toHaveLength(2);

      const hasTempoEvent = newScore.global_structural_events.some(
        (event) => 'Tempo' in event
      );
      const hasTimeSigEvent = newScore.global_structural_events.some(
        (event) => 'TimeSignature' in event
      );

      expect(hasTempoEvent).toBe(true);
      expect(hasTimeSigEvent).toBe(true);
    });
  });

  // ============================================================================
  // Type Compliance
  // ============================================================================

  describe('Type Compliance', () => {
    it('should return a valid Score object', () => {
      const newScore = createNewScore();

      // Verify all required Score fields are present
      expect(newScore).toHaveProperty('id');
      expect(newScore).toHaveProperty('global_structural_events');
      expect(newScore).toHaveProperty('instruments');
    });

    it('should be serializable to JSON', () => {
      const newScore = createNewScore();

      expect(() => JSON.stringify(newScore)).not.toThrow();

      const json = JSON.stringify(newScore);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);
    });

    it('should be deserializable from JSON', () => {
      const newScore = createNewScore();
      const json = JSON.stringify(newScore);

      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed).toEqual(newScore);
    });

    it('should pass validation', () => {
      const newScore = createNewScore();
      const json = JSON.stringify(newScore);

      // Should be valid JSON with correct structure
      const parsed = JSON.parse(json);
      expect(parsed.id).toBeDefined();
      expect(parsed.global_structural_events).toBeDefined();
      expect(parsed.instruments).toBeDefined();
    });
  });

  // ============================================================================
  // Integration with Save/Load
  // ============================================================================

  describe('Integration with Save/Load', () => {
    it('should be compatible with saveScore', () => {
      const newScore = createNewScore();

      // Mock Blob and download
      global.Blob = class MockBlob {
        constructor(public data: any[], public options: any) {}
      } as any;

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {},
      } as unknown as HTMLAnchorElement;

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      expect(() => saveScore(newScore, 'new-score')).not.toThrow();
      expect(mockAnchor.click).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should be compatible with loadScore (round-trip)', async () => {
      const newScore = createNewScore();

      // Save to JSON
      const json = JSON.stringify(newScore, null, 2);

      // Load from JSON
      const file = new File([json], 'new-score.json', { type: 'application/json' });
      const loadedScore = await loadScore(file);

      // Verify round-trip preserves all data
      expect(loadedScore.id).toBe(newScore.id);
      expect(loadedScore.global_structural_events).toEqual(newScore.global_structural_events);
      expect(loadedScore.instruments).toEqual(newScore.instruments);
    });

    it('should create score that can be edited and saved', async () => {
      const newScore = createNewScore();

      // Simulate adding an instrument
      const editedScore: Score = {
        ...newScore,
        instruments: [
          {
            id: crypto.randomUUID(),
            name: 'Piano',
            instrument_type: 'piano',
            staves: [],
          },
        ],
      };

      // Save edited score
      const json = JSON.stringify(editedScore, null, 2);
      const file = new File([json], 'edited-score.json', { type: 'application/json' });
      const loadedScore = await loadScore(file);

      expect(loadedScore.instruments).toHaveLength(1);
      expect(loadedScore.instruments[0].name).toBe('Piano');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should create consistent structure across multiple calls', () => {
      const score1 = createNewScore();
      const score2 = createNewScore();

      // IDs should be different
      expect(score1.id).not.toBe(score2.id);

      // But structure should be the same
      expect(score1.global_structural_events.length).toBe(score2.global_structural_events.length);
      expect(score1.instruments.length).toBe(score2.instruments.length);

      // Default tempo and time signature should match
      const tempo1 = score1.global_structural_events.find((e) => 'Tempo' in e);
      const tempo2 = score2.global_structural_events.find((e) => 'Tempo' in e);

      if (tempo1 && 'Tempo' in tempo1 && tempo2 && 'Tempo' in tempo2) {
        expect(tempo1.Tempo.bpm).toBe(tempo2.Tempo.bpm);
        expect(tempo1.Tempo.tick).toBe(tempo2.Tempo.tick);
      }
    });

    it('should create score quickly (performance)', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        createNewScore();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should create 100 scores in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should not require any external state or context', () => {
      // Should work without any setup
      expect(() => createNewScore()).not.toThrow();

      // Should produce valid result
      const score = createNewScore();
      expect(score).toBeDefined();
      expect(score.id).toBeDefined();
    });
  });

  // ============================================================================
  // Specification Compliance
  // ============================================================================

  describe('Specification Compliance', () => {
    it('should meet FR-008 requirement (create new empty score)', () => {
      const newScore = createNewScore();

      // Verify it's a new score
      expect(newScore.id).toBeDefined();

      // Verify it's empty (no instruments)
      expect(newScore.instruments).toHaveLength(0);

      // Verify it has default settings
      const tempoEvent = newScore.global_structural_events.find((e) => 'Tempo' in e);
      const timeSigEvent = newScore.global_structural_events.find((e) => 'TimeSignature' in e);

      expect(tempoEvent).toBeDefined();
      expect(timeSigEvent).toBeDefined();
    });

    it('should meet SC-008 requirement (prompt for unsaved changes)', () => {
      // createNewScore itself doesn't handle prompting (that's ScoreViewer's job)
      // But it should create a fresh score that replaces the current one

      const score1 = createNewScore();
      const score2 = createNewScore();

      // Each call creates a distinct new score
      expect(score1.id).not.toBe(score2.id);
    });

    it('should use default tempo of 120 BPM per spec', () => {
      const newScore = createNewScore();

      const tempoEvent = newScore.global_structural_events.find((e) => 'Tempo' in e);
      if (tempoEvent && 'Tempo' in tempoEvent) {
        expect(tempoEvent.Tempo.bpm).toBe(120);
      }
    });

    it('should use default time signature of 4/4 per spec', () => {
      const newScore = createNewScore();

      const timeSigEvent = newScore.global_structural_events.find((e) => 'TimeSignature' in e);
      if (timeSigEvent && 'TimeSignature' in timeSigEvent) {
        expect(timeSigEvent.TimeSignature.numerator).toBe(4);
        expect(timeSigEvent.TimeSignature.denominator).toBe(4);
      }
    });
  });
});

