import { describe, it, expect } from 'vitest';
import { DynamicsResolver } from '../../src/services/playback/DynamicsResolver';
import type { DynamicMarking, GradualDynamic } from '../../src/types/score';

describe('DynamicsResolver', () => {
  it('returns default velocity (80) when no dynamics exist', () => {
    const resolver = new DynamicsResolver([], []);
    expect(resolver.resolve(0, 1)).toBe(80);
    expect(resolver.resolve(5000, 1)).toBe(80);
  });

  it('returns the active static dynamic at a given tick', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'p', velocity: 49, start_tick: 0, staff: 1 },
      { marking: 'f', velocity: 96, start_tick: 3840, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics);

    expect(resolver.resolve(0, 1)).toBe(49);
    expect(resolver.resolve(1920, 1)).toBe(49);
    expect(resolver.resolve(3840, 1)).toBe(96);
    expect(resolver.resolve(7680, 1)).toBe(96);
  });

  it('interpolates velocity within a crescendo region', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'p', velocity: 49, start_tick: 0, staff: 1 },
      { marking: 'f', velocity: 96, start_tick: 3840, staff: 1 },
    ];
    const graduals: GradualDynamic[] = [
      { direction: 'crescendo', start_tick: 0, stop_tick: 3840, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics, graduals);

    // Start of crescendo
    expect(resolver.resolve(0, 1)).toBe(49);
    // Midpoint: (49 + 96) / 2 = 72.5 → 73
    expect(resolver.resolve(1920, 1)).toBe(73);
    // End of crescendo (exclusive, so right before)
    const nearEnd = resolver.resolve(3839, 1);
    expect(nearEnd).toBeGreaterThan(90);
    expect(nearEnd).toBeLessThanOrEqual(96);
  });

  it('interpolates velocity within a diminuendo region', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'f', velocity: 96, start_tick: 0, staff: 1 },
      { marking: 'pp', velocity: 33, start_tick: 3840, staff: 1 },
    ];
    const graduals: GradualDynamic[] = [
      { direction: 'diminuendo', start_tick: 0, stop_tick: 3840, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics, graduals);

    expect(resolver.resolve(0, 1)).toBe(96);
    // Midpoint: (96 + 33) / 2 = 64.5 → 65
    expect(resolver.resolve(1920, 1)).toBe(65);
  });

  it('returns default velocity when no dynamics precede a tick', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'ff', velocity: 112, start_tick: 10000, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics);

    // Before any marking
    expect(resolver.resolve(0, 1)).toBe(80);
    expect(resolver.resolve(5000, 1)).toBe(80);
    // At the marking
    expect(resolver.resolve(10000, 1)).toBe(112);
  });

  it('handles multi-staff independence', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'pp', velocity: 33, start_tick: 0, staff: 1 },
      { marking: 'ff', velocity: 112, start_tick: 0, staff: 2 },
    ];
    const resolver = new DynamicsResolver(dynamics);

    expect(resolver.resolve(0, 1)).toBe(33);
    expect(resolver.resolve(0, 2)).toBe(112);
  });

  it('handles seek/jump backward correctly', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'p', velocity: 49, start_tick: 0, staff: 1 },
      { marking: 'f', velocity: 96, start_tick: 3840, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics);

    // Forward seek
    expect(resolver.resolve(5000, 1)).toBe(96);
    // Jump backward
    expect(resolver.resolve(1000, 1)).toBe(49);
    // Jump forward again
    expect(resolver.resolve(3840, 1)).toBe(96);
  });

  it('infers target velocity when no marking follows a wedge', () => {
    const dynamics: DynamicMarking[] = [
      { marking: 'p', velocity: 49, start_tick: 0, staff: 1 },
    ];
    const graduals: GradualDynamic[] = [
      { direction: 'crescendo', start_tick: 0, stop_tick: 3840, staff: 1 },
    ];
    const resolver = new DynamicsResolver(dynamics, graduals);

    // Should interpolate toward 49 + 16 = 65 at the end
    const midVel = resolver.resolve(1920, 1);
    expect(midVel).toBeGreaterThan(49);
    expect(midVel).toBeLessThanOrEqual(65);
  });
});
