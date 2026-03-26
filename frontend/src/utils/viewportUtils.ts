/**
 * Viewport Utilities
 * Feature 017 - Viewport queries and system virtualization
 */

import type { Viewport } from '../types/Viewport';
import type { System } from '../wasm/layout';

/**
 * Creates viewport from SVG element viewBox dimensions.
 *
 * @param svg - SVG element to measure viewBox
 * @param scrollY - Current scroll position in logical units (default: 0)
 * @returns Viewport matching SVG viewBox at scroll position
 */
export function createViewportFromSVG(
  svg: SVGSVGElement,
  scrollY: number = 0
): Viewport {
  const viewBox = svg.viewBox.baseVal;

  return {
    x: viewBox.x,
    y: scrollY,
    width: viewBox.width,
    height: viewBox.height,
  };
}

/**
 * Checks if system bounding box intersects viewport.
 * Used internally by getVisibleSystems() for binary search.
 *
 * @param systemY - System top Y coordinate (logical units)
 * @param systemHeight - System height (logical units)
 * @param viewport - Viewport to test against
 * @returns True if system is visible within viewport
 */
export function intersectsViewport(
  systemY: number,
  systemHeight: number,
  viewport: Viewport
): boolean {
  const systemBottom = systemY + systemHeight;
  const viewportBottom = viewport.y + viewport.height;

  return systemBottom > viewport.y && systemY < viewportBottom;
}

/**
 * Calculates total viewport area in square logical units.
 * Used for performance metrics (logical units/sec throughput).
 *
 * @param viewport - Viewport to measure
 * @returns Area in square logical units
 */
export function getViewportArea(viewport: Viewport): number {
  return viewport.width * viewport.height;
}

/**
 * Validates viewport for correctness.
 * Throws Error if validation fails.
 *
 * @param viewport - Viewport to validate
 * @throws Error if width or height is <= 0
 */
export function validateViewport(viewport: Viewport): void {
  if (viewport.width <= 0) {
    throw new Error(`Viewport.width must be > 0, got ${viewport.width}`);
  }

  if (viewport.height <= 0) {
    throw new Error(`Viewport.height must be > 0, got ${viewport.height}`);
  }
}

/**
 * Queries which systems intersect viewport using binary search.
 *
 * @param systems - All systems from GlobalLayout.systems (must be sorted by y)
 * @param viewport - Visible region
 * @returns Subset of systems intersecting viewport
 *
 * @performance O(log n) via binary search, <1ms for 200 systems
 */
export function getVisibleSystems(
  systems: System[],
  viewport: Viewport
): System[] {
  if (systems.length === 0) {
    return [];
  }

  let firstVisibleIndex = -1;
  let left = 0;
  let right = systems.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const system = systems[mid];
    const systemY = system.bounding_box.y;
    const systemHeight = system.bounding_box.height;

    if (intersectsViewport(systemY, systemHeight, viewport)) {
      firstVisibleIndex = mid;
      right = mid - 1;
    } else if (systemY + systemHeight <= viewport.y) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (firstVisibleIndex === -1) {
    return [];
  }

  const visibleSystems: System[] = [];
  for (let i = firstVisibleIndex; i < systems.length; i++) {
    const system = systems[i];
    const systemY = system.bounding_box.y;
    const systemHeight = system.bounding_box.height;

    if (!intersectsViewport(systemY, systemHeight, viewport)) {
      break;
    }

    visibleSystems.push(system);
  }

  return visibleSystems;
}
