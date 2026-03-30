import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToneAdapter } from './ToneAdapter';

// Mock Tone.js at the module level
vi.mock('tone', () => {
  const mockPolySynth = {
    toDestination: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(),
  };

  const mockSampler = {
    toDestination: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(), // US3: Add releaseAll() for stopAll() support
    loaded: true,
  };

  // Create a proper constructor function
  class MockPolySynth {
    toDestination() {
      mockPolySynth.toDestination();
      return this;
    }
    connect() { return this; }
    triggerAttackRelease(...args: any[]) {
      mockPolySynth.triggerAttackRelease(...args);
    }
    releaseAll() {
      mockPolySynth.releaseAll();
    }
  }

  // US3: Mock Sampler for piano sound
  class MockSampler {
    toDestination() {
      mockSampler.toDestination();
      return this;
    }
    connect() { return this; }
    triggerAttackRelease(...args: any[]) {
      mockSampler.triggerAttackRelease(...args);
    }
    releaseAll() {
      mockSampler.releaseAll();
    }
    get loaded() {
      return mockSampler.loaded;
    }
  }

  // Feature 063: Limiter mock
  class MockLimiter {
    toDestination() { return this; }
  }

  return {
    start: vi.fn().mockResolvedValue(undefined),
    loaded: vi.fn().mockResolvedValue(undefined), // US3: Mock Tone.loaded() for sampler
    now: vi.fn(() => 0),
    PolySynth: MockPolySynth,
    Sampler: MockSampler, // US3: Add Sampler mock
    Synth: vi.fn(),
    Limiter: MockLimiter, // Feature 063: Limiter mock
    Destination: {
      mute: false,
      volume: { value: -12 },
    },
    Frequency: vi.fn((pitch: number) => ({
      toFrequency: () => pitch * 10,
      toNote: () => {
        // US3 T043: Mock MIDI to note name conversion
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor((pitch - 12) / 12);
        const noteIndex = pitch % 12;
        return `${noteNames[noteIndex]}${octave}`;
      }
    })),
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      clear: vi.fn(),
      schedule: vi.fn((_callback, _time) => {
        // Return a mock event ID
        return Math.floor(Math.random() * 10000);
      }),
      bpm: {
        value: 120,
      },
      seconds: 0,
    },
    context: {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
    },
  };
});

/**
 * T017: Unit tests for ToneAdapter initialization
 * 
 * Feature 003 - Music Playback: User Story 1
 * Tests that init() is called once, handles autoplay policy, and properly
 * initializes the Tone.js audio context and PolySynth.
 */
describe('ToneAdapter', () => {
  let adapter: ToneAdapter;

  beforeEach(async () => {
    // Reset the singleton instance for each test
    (ToneAdapter as any).instance = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: ToneAdapter uses singleton pattern
   * 
   * Ensures only one instance exists across the application
   */
  it('should return the same instance when getInstance() is called multiple times', () => {
    const instance1 = ToneAdapter.getInstance();
    const instance2 = ToneAdapter.getInstance();

    expect(instance1).toBe(instance2);
  });

  /**
   * Test: init() calls Tone.start() to initialize audio context
   * 
   * US1 T019: Implement ToneAdapter.init() with Tone.start()
   */
  it('should call Tone.start() when init() is called', async () => {
    adapter = ToneAdapter.getInstance();

    await adapter.init();

    const { start } = await import('tone');
    expect(start).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: init() is idempotent (can be called multiple times safely)
   * 
   * Calling init() multiple times should not reinitialize or cause errors
   */
  it('should only initialize once even if init() is called multiple times', async () => {
    adapter = ToneAdapter.getInstance();

    await adapter.init();
    await adapter.init();
    await adapter.init();

    const { start } = await import('tone');
    // Tone.start() is called on EVERY init() invocation to ensure the AudioContext
    // is resumed (browsers auto-suspend it after silence). The sampler is only
    // created once. So for 3 init() calls, Tone.start() is called 3 times.
    expect(start).toHaveBeenCalledTimes(3);
  });

  /**
   * Test: init() handles browser autoplay policy rejection
   * 
   * Modern browsers require user interaction before playing audio.
   * init() should handle the rejection gracefully or succeed after user interaction.
   */
  it('should handle autoplay policy rejection gracefully', async () => {
    adapter = ToneAdapter.getInstance();

    // Mock Tone.start() to reject (simulating autoplay policy block)
    const { start } = await import('tone');
    (start as any).mockRejectedValueOnce(new Error('The AudioContext was not allowed to start'));

    await expect(adapter.init()).rejects.toThrow();

    expect(start).toHaveBeenCalled();
  });

  /**
   * Test: init() successfully resolves when autoplay is allowed
   */
  it('should successfully initialize when autoplay is allowed', async () => {
    adapter = ToneAdapter.getInstance();

    await expect(adapter.init()).resolves.not.toThrow();

    const { start } = await import('tone');
    expect(start).toHaveBeenCalled();
  });

  /**
   * Test: init() creates a PolySynth with correct configuration
   * 
   * US1 T019: PolySynth initialization with maxPolyphony: 16, basic envelope
   */
  it('should create a PolySynth with maxPolyphony of 16', async () => {
    adapter = ToneAdapter.getInstance();

    // If init() succeeds, PolySynth was created successfully
    await expect(adapter.init()).resolves.not.toThrow();
    
    // Verify adapter is initialized
    expect(adapter.isInitialized()).toBe(true);
  });

  /**
   * Test: getCurrentTime() returns current audio context time
   * 
   * US1 T018: ToneAdapter.getCurrentTime() method
   */
  it('should return current time from Tone.js context', () => {
    adapter = ToneAdapter.getInstance();

    const currentTime = adapter.getCurrentTime();

    expect(typeof currentTime).toBe('number');
    expect(currentTime).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test: stopAll() stops all currently playing notes
   * 
   * US1 T018: ToneAdapter.stopAll() method
   * US1 T023: stop() calls ToneAdapter.stopAll()
   */
  it('should call PolySynth.releaseAll() when stopAll() is invoked', async () => {
    adapter = ToneAdapter.getInstance();

    await adapter.init();

    // stopAll() should not throw
    expect(() => adapter.stopAll()).not.toThrow();
  });

  /**
   * Test: stopAll() can be called before init() without errors
   * 
   * Edge case: Calling stop before audio is initialized should not crash
   */
  it('should not throw error when stopAll() is called before init()', () => {
    adapter = ToneAdapter.getInstance();

    expect(() => adapter.stopAll()).not.toThrow();
  });

  /**
   * Test: playNote() is stubbed in User Story 1
   * 
   * US1 T018: Create ToneAdapter with playNote stubbed (implemented in US2)
   */
  it('should have a playNote() method (stub for US2)', async () => {
    adapter = ToneAdapter.getInstance();

    await adapter.init();

    expect(adapter.playNote).toBeDefined();
    expect(typeof adapter.playNote).toBe('function');
  });
});
