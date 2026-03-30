import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Re-export Web MIDI API stubs so test files can import from '../test/mockMidi'
// (T005 — feature 029-midi-input)
export {
  mockMidiSupported,
  mockMidiUnsupported,
  createMockMidiAccess,
  createMockMidiInput,
  fireMidiNoteOn,
  fireMidiNoteOff,
  fireMidiStateChange,
} from './mockMidi';
export type { MockMidiInput, MockMidiAccess } from './mockMidi';

// ─── Web Audio API mocks (happy-dom ships no Web Audio support) ───────────────

export interface AudioContextMock {
  sampleRate: number;
  state: AudioContextState;
  destination: object;
  createAnalyser: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createBiquadFilter: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  audioWorklet: { addModule: ReturnType<typeof vi.fn> };
  _workletNodePort: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((evt: MessageEvent) => void) | null;
  };
}

/** Create a fresh AudioContext mock. Call in beforeEach for isolation. */
export function makeAudioContextMock(): AudioContextMock {
  const workletNodePort = {
    postMessage: vi.fn(),
    onmessage: null as ((evt: MessageEvent) => void) | null,
  };
  const workletNode = {
    port: workletNodePort,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    sampleRate: 44100,
    state: 'running' as AudioContextState,
    destination: {},
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatTimeDomainData: vi.fn((buf: Float32Array) => buf.fill(0)),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createMediaStreamSource: vi.fn(() => source),
    createBiquadFilter: vi.fn(() => ({
      type: 'allpass',
      frequency: { value: 0 },
      Q: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    _workletNodePort: workletNodePort,
    // Store for tests to reference the node
    __workletNode: workletNode,
    __source: source,
  } as unknown as AudioContextMock;
}

let _audioCtxMock: AudioContextMock | null = null;

/** Stub globalThis.AudioContext with a fresh mock before each test. */
function installAudioContextMock() {
  _audioCtxMock = makeAudioContextMock();
  const captured = _audioCtxMock;
  // Must use a regular function (not arrow) so it can be called with `new`
  vi.stubGlobal('AudioContext', vi.fn(function AudioContextMock() { return captured; }));
  const workletNode = (captured as unknown as Record<string, unknown>)['__workletNode'];
  vi.stubGlobal('AudioWorkletNode', vi.fn(function AudioWorkletNodeMock() { return workletNode; }));
}

/**
 * Stub navigator.mediaDevices.getUserMedia.
 * Pass a MediaStream mock for success, or a DOMException for rejection.
 */
export function stubGetUserMedia(
  stream: Partial<MediaStream> | null,
  error?: DOMException
): ReturnType<typeof vi.fn> {
  const mockStream = stream ?? {
    getTracks: vi.fn(() => [{ stop: vi.fn(), onended: null }]),
    getAudioTracks: vi.fn(() => [{ stop: vi.fn(), onended: null }]),
  };
  const impl = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue(mockStream);
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: impl },
    writable: true,
    configurable: true,
  });
  return impl;
}

/** Stub Canvas 2D context — required because happy-dom returns undefined for getContext. */
export function stubCanvas2D() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '#000',
    lineWidth: 1,
    canvas: { width: 800, height: 200 },
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return ctx;
}

/** Stub requestAnimationFrame to fire the callback once synchronously. */
export function stubRAF() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

// Install AudioContext mock globally before every test
beforeEach(() => {
  installAudioContextMock();
});

// ─────────────────────────────────────────────────────────────────────────────

// Polyfill for ImageData (needed for canvas-based tests)
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(width: number, height: number);
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      height?: number
    ) {
      if (typeof dataOrWidth === 'number') {
        // new ImageData(width, height)
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        // new ImageData(data, width, height?)
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? Math.floor(this.data.length / (this.width * 4));
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Mock Tone.js to avoid module resolution issues in tests
vi.mock('tone', () => ({
  default: {},
  Sampler: vi.fn(),
  PolySynth: vi.fn(),
  Synth: vi.fn(),
  Limiter: vi.fn(() => ({ toDestination: vi.fn(() => ({})) })),
  Frequency: vi.fn(() => ({ toNote: vi.fn(() => 'C4') })),
  Destination: {
    mute: false,
    volume: { value: -12 },
  },
  Transport: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    schedule: vi.fn(),
    clear: vi.fn(),
    seconds: 0,
    bpm: { value: 120 },
  },
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn(() => 0),
  loaded: vi.fn().mockResolvedValue(undefined),
  context: {
    resume: vi.fn().mockResolvedValue(undefined),
  },
}));

// Cleanup after each test case
afterEach(() => {
  cleanup();
});
