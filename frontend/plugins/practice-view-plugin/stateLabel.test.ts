import { describe, it, expect } from 'vitest';
import { formatStateLabel } from './stateLabel';

describe('formatStateLabel', () => {
  it('formats a positive deviation (late) with a plus sign', () => {
    expect(formatStateLabel(120)).toBe('+120 ms');
  });

  it('formats a negative deviation (early) with a minus sign', () => {
    expect(formatStateLabel(-80)).toBe('-80 ms');
  });

  it('formats a zero deviation without a sign', () => {
    expect(formatStateLabel(0)).toBe('0 ms');
  });
});