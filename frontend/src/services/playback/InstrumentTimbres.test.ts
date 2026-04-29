/**
 * Tests for InstrumentTimbres — timbre registry for multi-instrument playback.
 * Feature 088: Piano and Violin Playback Support
 */

import { describe, it, expect } from 'vitest';
import { getTimbre, TimbreSource } from './InstrumentTimbres';

describe('getTimbre', () => {
  it('returns sampler timbre for piano', () => {
    const t = getTimbre('piano');
    expect(t.source).toBe<TimbreSource>('sampler');
    expect(t.volumeDb).toBe(0);
    expect(t.envelope).toBeUndefined();
    expect(t.oscillatorType).toBeUndefined();
  });

  it('returns sampler timbre for violin with sample URLs', () => {
    const t = getTimbre('violin');
    expect(t.source).toBe<TimbreSource>('sampler');
    expect(t.oscillatorType).toBeUndefined();
    expect(t.envelope).toBeUndefined();
    expect(t.sampleBaseUrl).toBe('audio/violin/');
    expect(t.sampleUrls).toBeDefined();
    expect(t.sampleUrls?.['G3']).toBe('G3.mp3');
    expect(t.sampleUrls?.['A4']).toBe('A4.mp3');
    expect(t.sampleUrls?.['C7']).toBe('C7.mp3');
    expect(t.volumeDb).toBe(-3);
  });

  it('returns polysynth/sawtooth for viola', () => {
    const t = getTimbre('viola');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('sawtooth');
    expect(t.envelope?.attack).toBe(0.08);
    expect(t.volumeDb).toBe(-8);
  });

  it('returns polysynth/sawtooth for cello', () => {
    const t = getTimbre('cello');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('sawtooth');
    expect(t.envelope?.sustain).toBe(0.90);
    expect(t.volumeDb).toBe(-8);
  });

  it('returns polysynth/sawtooth for contrabass', () => {
    const t = getTimbre('contrabass');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('sawtooth');
    expect(t.envelope?.attack).toBe(0.12);
    expect(t.volumeDb).toBe(-6);
  });

  it('returns polysynth/triangle for guitar', () => {
    const t = getTimbre('guitar');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('triangle');
    expect(t.envelope?.attack).toBe(0.01);
    expect(t.volumeDb).toBe(-3);
  });

  it('returns polysynth/sine for flute', () => {
    const t = getTimbre('flute');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('sine');
    expect(t.envelope?.attack).toBe(0.05);
    expect(t.volumeDb).toBe(-6);
  });

  it('returns polysynth/triangle for oboe', () => {
    const t = getTimbre('oboe');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('triangle');
    expect(t.envelope?.attack).toBe(0.04);
    expect(t.volumeDb).toBe(-6);
  });

  it('returns polysynth/triangle for clarinet', () => {
    const t = getTimbre('clarinet');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('triangle');
    expect(t.envelope?.attack).toBe(0.04);
    expect(t.volumeDb).toBe(-6);
  });

  it('returns polysynth/sawtooth for trumpet', () => {
    const t = getTimbre('trumpet');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('sawtooth');
    expect(t.envelope?.attack).toBe(0.03);
    expect(t.volumeDb).toBe(-4);
  });

  it('returns default polysynth/triangle for unknown types', () => {
    const t = getTimbre('default');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('triangle');
    expect(t.volumeDb).toBe(-3);
  });

  it('returns default timbre for completely unknown strings', () => {
    const t = getTimbre('theremin');
    expect(t.source).toBe('polysynth');
    expect(t.oscillatorType).toBe('triangle');
    expect(t.volumeDb).toBe(-3);
  });

  it('returns immutable config objects (no shared references)', () => {
    const t1 = getTimbre('violin');
    const t2 = getTimbre('violin');
    expect(t1).toEqual(t2);
    // Mutating sampleUrls on one copy must not affect the registry
    if (t1.sampleUrls) {
      (t1.sampleUrls as Record<string, string>)['G3'] = 'MUTATED.mp3';
    }
    const t3 = getTimbre('violin');
    // Registry entry must be unchanged
    expect(t3.sampleUrls?.['G3']).toBe('G3.mp3');
  });
});
