/**
 * DynamicsResolver — resolves MIDI velocity at any tick position for a given staff.
 *
 * Feature: 063-midi-volume-control
 *
 * Scans backward through DynamicMarking array and interpolates through
 * active GradualDynamic (wedge) regions. Falls back to DEFAULT_VELOCITY (80 = mf)
 * when no dynamics exist.
 */

import type { DynamicMarking, GradualDynamic } from '../../types/score';
import { DEFAULT_VELOCITY } from './volumeUtils';

export class DynamicsResolver {
  private readonly dynamics: DynamicMarking[];
  private readonly graduals: GradualDynamic[];

  constructor(dynamics: DynamicMarking[] = [], graduals: GradualDynamic[] = []) {
    // Ensure sorted by start_tick ascending
    this.dynamics = [...dynamics].sort((a, b) => a.start_tick - b.start_tick);
    this.graduals = [...graduals].sort((a, b) => a.start_tick - b.start_tick);
  }

  /**
   * Resolves the velocity at a given tick for a specific staff.
   *
   * @param tick Absolute tick position
   * @param staff 1-based staff number
   * @returns MIDI velocity (1–127)
   */
  resolve(tick: number, staff: number): number {
    // Find the active gradual dynamic (wedge) at this tick
    const activeGradual = this.graduals.find(
      (gd) => gd.staff === staff && gd.start_tick <= tick && tick < gd.stop_tick,
    );

    if (activeGradual) {
      return this.interpolateWedge(tick, staff, activeGradual);
    }

    // Find the most recent dynamic marking at or before this tick for this staff
    return this.lookupStatic(tick, staff);
  }

  /** Backward scan: find the most recent DynamicMarking at or before tick for staff. */
  private lookupStatic(tick: number, staff: number): number {
    let best: DynamicMarking | undefined;
    for (const dm of this.dynamics) {
      if (dm.staff === staff && dm.start_tick <= tick) {
        best = dm;
      }
    }
    return best?.velocity ?? DEFAULT_VELOCITY;
  }

  /** Linear interpolation within a wedge region. */
  private interpolateWedge(
    tick: number,
    staff: number,
    gd: GradualDynamic,
  ): number {
    const startVel = this.lookupStatic(gd.start_tick, staff);

    // Find the next marking at or after the wedge stop
    const endMarking = this.dynamics.find(
      (dm) => dm.staff === staff && dm.start_tick >= gd.stop_tick,
    );

    const endVel =
      endMarking?.velocity ??
      (gd.direction === 'crescendo'
        ? Math.min(startVel + 16, 127)
        : Math.max(startVel - 16, 1));

    const range = gd.stop_tick - gd.start_tick;
    if (range === 0) return startVel;

    const progress = (tick - gd.start_tick) / range;
    const interpolated = startVel + (endVel - startVel) * progress;
    return Math.round(Math.max(1, Math.min(127, interpolated)));
  }
}
