import { describe, it, expect } from 'vitest';
import { parseMidiCC } from '../../src/services/recording/midiUtils';

describe('parseMidiCC', () => {
  it('parses CC7 (channel volume) message', () => {
    // 0xB0 = CC on channel 1, controller 7, value 100
    const data = new Uint8Array([0xb0, 0x07, 0x64]);
    const result = parseMidiCC(data);
    expect(result).toEqual({ controller: 7, value: 100, channel: 1 });
  });

  it('parses CC11 (expression) message', () => {
    // 0xB2 = CC on channel 3, controller 11, value 80
    const data = new Uint8Array([0xb2, 0x0b, 0x50]);
    const result = parseMidiCC(data);
    expect(result).toEqual({ controller: 11, value: 80, channel: 3 });
  });

  it('returns null for note-on message', () => {
    const data = new Uint8Array([0x90, 0x3c, 0x64]);
    expect(parseMidiCC(data)).toBeNull();
  });

  it('returns null for note-off message', () => {
    const data = new Uint8Array([0x80, 0x3c, 0x00]);
    expect(parseMidiCC(data)).toBeNull();
  });

  it('returns null for data shorter than 3 bytes', () => {
    expect(parseMidiCC(new Uint8Array([0xb0, 0x07]))).toBeNull();
    expect(parseMidiCC(new Uint8Array([0xb0]))).toBeNull();
    expect(parseMidiCC(new Uint8Array([]))).toBeNull();
  });

  it('parses other CC numbers (e.g. CC1 mod wheel)', () => {
    const data = new Uint8Array([0xb0, 0x01, 0x7f]);
    const result = parseMidiCC(data);
    expect(result).toEqual({ controller: 1, value: 127, channel: 1 });
  });

  it('handles CC value 0', () => {
    const data = new Uint8Array([0xb0, 0x07, 0x00]);
    const result = parseMidiCC(data);
    expect(result).toEqual({ controller: 7, value: 0, channel: 1 });
  });

  it('extracts correct channel from status byte', () => {
    // 0xBF = CC on channel 16
    const data = new Uint8Array([0xbf, 0x07, 0x40]);
    const result = parseMidiCC(data);
    expect(result).toEqual({ controller: 7, value: 64, channel: 16 });
  });
});
