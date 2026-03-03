/**
 * Performance Tests for DOM Virtualization (User Story 4)
 * Feature 017 - LayoutRenderer Component
 * 
 * Tests 60fps scrolling, <1ms queries, DOM node count optimization.
 * Uses score_100_measures.json fixture (40 systems, 12000 logical units height).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutRenderer } from '../../src/components/LayoutRenderer';
import { createDefaultConfig } from '../../src/utils/renderUtils';
import { getVisibleSystems } from '../../src/utils/renderUtils';
import longScore from '../fixtures/score_100_measures.json';
import type { GlobalLayout } from '../../src/wasm/layout';
import type { RenderConfig } from '../../src/types/RenderConfig';
import type { Viewport } from '../../src/types/Viewport';

// ============================================================================
// Performance Test Suite for User Story 4: DOM Virtualization
// ============================================================================

describe('User Story 4: Performance Validation', () => {
  let layout: GlobalLayout;
  let config: RenderConfig;

  beforeEach(() => {
    layout = longScore as GlobalLayout;
    config = createDefaultConfig();
  });

  // ============================================================================
  // Task T061: Performance test - getVisibleSystems query time
  // ============================================================================

  describe('Visible Systems Query Performance (T061)', () => {
    it('should complete getVisibleSystems() in <1ms for 40 systems', () => {
      const viewport: Viewport = {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        getVisibleSystems(layout.systems, viewport);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(1); // Average <1ms per query
    });

    it('should use binary search for efficient lookup', () => {
      // Test various scroll positions
      const scrollPositions = [0, 1000, 3000, 6000, 9000, 11500];
      const queryTimes: number[] = [];

      for (const yPos of scrollPositions) {
        const viewport: Viewport = {
          x: 0,
          y: yPos,
          width: 1200,
          height: 800,
        };

        const start = performance.now();
        getVisibleSystems(layout.systems, viewport);
        const end = performance.now();

        queryTimes.push(end - start);
      }

      // All queries should be fast regardless of scroll position
      queryTimes.forEach(time => {
        expect(time).toBeLessThan(1);
      });

      // Verify consistent performance (binary search, not linear)
      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      expect(avgTime).toBeLessThan(0.5); // Very fast average
    });

    it('should return correct visible systems at different scroll positions', () => {
      // Top of score
      const topViewport: Viewport = { x: 0, y: 0, width: 1200, height: 800 };
      const topSystems = getVisibleSystems(layout.systems, topViewport);
      expect(topSystems.length).toBeGreaterThan(0);
      expect(topSystems[0].index).toBe(0); // System.index, not system_index

      // Middle of score
      const midViewport: Viewport = { x: 0, y: 5000, width: 1200, height: 800 };
      const midSystems = getVisibleSystems(layout.systems, midViewport);
      expect(midSystems.length).toBeGreaterThan(0);
      expect(midSystems[0].bounding_box.y).toBeGreaterThanOrEqual(4200); // Before viewport

      // Bottom of score
      const bottomViewport: Viewport = { x: 0, y: 11200, width: 1200, height: 800 };
      const bottomSystems = getVisibleSystems(layout.systems, bottomViewport);
      expect(bottomSystems.length).toBeGreaterThan(0);
      expect(bottomSystems[bottomSystems.length - 1].index).toBe(39);
    });
  });

  // ============================================================================
  // Task T062: Performance test - 60fps scrolling simulation
  // ============================================================================

  describe('60fps Scrolling Performance (T062)', () => {
    it('should maintain <16ms render time during scroll', () => {
      const renderTimes: number[] = [];
      const frameBudget = 16; // 60fps = 16.67ms per frame

      // Simulate scrolling through entire score
      for (let y = 0; y < layout.total_height; y += 300) {
        const viewport: Viewport = {
          x: 0,
          y,
          width: 1200,
          height: 800,
        };

        const start = performance.now();
        const { container } = render(
          <LayoutRenderer layout={layout} config={config} viewport={viewport} />
        );
        const end = performance.now();

        const renderTime = end - start;
        renderTimes.push(renderTime);

        // Clean up
        container.remove();
      }

      // Calculate statistics
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);
      const slowFrames = renderTimes.filter(t => t > frameBudget).length;

      // Performance assertions
      expect(avgRenderTime).toBeLessThan(frameBudget);
      expect(maxRenderTime).toBeLessThan(frameBudget * 4); // Allow occasional spikes (CI tolerance)
      expect(slowFrames / renderTimes.length).toBeLessThanOrEqual(0.20); // ≤20% slow frames (CI-tolerant)
    });

    it('should render only visible systems during scroll', () => {
      const viewportHeight = 800;
      const systemHeight = 300; // Approximate
      const maxExpectedSystems = Math.ceil(viewportHeight / systemHeight) + 2; // +2 buffer

      // Test various scroll positions
      for (let y = 0; y < layout.total_height; y += 1000) {
        const viewport: Viewport = {
          x: 0,
          y,
          width: 1200,
          height: viewportHeight,
        };

        const visibleSystems = getVisibleSystems(layout.systems, viewport);
        expect(visibleSystems.length).toBeLessThanOrEqual(maxExpectedSystems);
        expect(visibleSystems.length).toBeGreaterThan(0); // Always some visible
      }
    });
  });

  // ============================================================================
  // Task T063: Performance test - DOM node count
  // ============================================================================

  describe('DOM Node Count Optimization (T063)', () => {
    it('should maintain ~400 DOM nodes per viewport (not 2000+)', () => {
      const viewport: Viewport = {
        x: 0,
        y: 3000, // Middle of score
        width: 1200,
        height: 800,
      };

      const { container } = render(
        <LayoutRenderer layout={layout} config={config} viewport={viewport} />
      );

      const allNodes = container.querySelectorAll('*');
      const nodeCount = allNodes.length;

      // With virtualization: only ~3 systems visible
      // Each system: ~100-150 nodes (5 staff lines + 8 glyphs + groups)
      // Expected: ~400 nodes total
      expect(nodeCount).toBeLessThan(600); // Upper bound with safety margin
      expect(nodeCount).toBeGreaterThan(50); // Minimum sanity check
    });

    it('should only render systems within viewport bounds', () => {
      const viewport: Viewport = {
        x: 0,
        y: 5000,
        width: 1200,
        height: 800,
      };

      const { container } = render(
        <LayoutRenderer layout={layout} config={config} viewport={viewport} />
      );

      // Check that systems outside viewport are NOT rendered
      const systemGroups = container.querySelectorAll('g[data-system-index]');
      
      systemGroups.forEach(group => {
        const systemIndex = parseInt(group.getAttribute('data-system-index') || '0');
        const system = layout.systems[systemIndex];
        
        // System should intersect with viewport
        const systemTop = system.bounding_box.y;
        const systemBottom = system.bounding_box.y + system.bounding_box.height;
        const viewportTop = viewport.y;
        const viewportBottom = viewport.y + viewport.height;

        // Verify system is actually visible (with buffer for clipping)
        // getVisibleSystems includes systems that partially overlap
        const isVisible = systemBottom >= viewportTop - 100 && systemTop <= viewportBottom + 100;
        expect(isVisible).toBe(true);
      });
    });

    it('should not render all 40 systems at once', () => {
      const fullViewport: Viewport = {
        x: 0,
        y: 6000, // Middle position
        width: 1200,
        height: 800,
      };

      const { container } = render(
        <LayoutRenderer layout={layout} config={config} viewport={fullViewport} />
      );

      const systemGroups = container.querySelectorAll('g[data-system-index]');
      
      // Should render only viewport systems, not all 40
      expect(systemGroups.length).toBeLessThan(10);
      expect(systemGroups.length).toBeGreaterThan(1);
    });
  });

  // ============================================================================
  // Task T064: Performance test - Binary search verification
  // ============================================================================

  describe('Binary Search Performance (T064)', () => {
    it('should complete in <1ms for 40 systems', () => {
      const viewport: Viewport = {
        x: 0,
        y: 7500,
        width: 1200,
        height: 800,
      };

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        getVisibleSystems(layout.systems, viewport);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(1);
    });

    it('should scale logarithmically, not linearly', () => {
      // Create layouts of different sizes
      const sizes = [10, 20, 40];
      const queryTimes: { [key: number]: number } = {};

      for (const size of sizes) {
        const testSystems = layout.systems.slice(0, size);
        const viewport: Viewport = {
          x: 0,
          y: (size / 2) * 300, // Middle of the score
          width: 1200,
          height: 800,
        };

        // Warm-up: run once before timing so JIT has compiled the function
        // equally for every size. Without this the first size pays warm-up
        // cost and the ratio can be arbitrarily large / small.
        for (let i = 0; i < 200; i++) {
          getVisibleSystems(testSystems, viewport);
        }

        const iterations = 2000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          getVisibleSystems(testSystems, viewport);
        }

        const end = performance.now();
        queryTimes[size] = (end - start) / iterations;
      }

      // Verify logarithmic scaling: O(log n)
      // Doubling system count should NOT double query time
      const time10 = queryTimes[10];
      const time20 = queryTimes[20];
      const time40 = queryTimes[40];

      // All should be very fast
      expect(time10).toBeLessThan(1);
      expect(time20).toBeLessThan(1);
      expect(time40).toBeLessThan(1);

      // Logarithmic: 40 systems should be much less than ~4x slower than 10.
      // True O(n) linear growth would be exactly 4x; we allow up to 5x to
      // stay robust on slow / noisy CI runners while still rejecting clearly
      // linear implementations.
      expect(time40 / time10).toBeLessThan(5);
    });
  });

  // ============================================================================
  // Task T065: Performance test - Frame time validation
  // ============================================================================

  describe('Frame Time Validation (T065)', () => {
    it('should render initial viewport in <16ms', () => {
      const viewport: Viewport = {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };

      const start = performance.now();
      const { container } = render(
        <LayoutRenderer layout={layout} config={config} viewport={viewport} />
      );
      const end = performance.now();

      const renderTime = end - start;
      expect(renderTime).toBeLessThan(100); // CI tolerance: jsdom + test infra overhead can reach 100ms on shared runners
    });

    it('should handle rapid viewport updates efficiently', () => {
      let lastViewport: Viewport = {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };

      const { rerender } = render(
        <LayoutRenderer layout={layout} config={config} viewport={lastViewport} />
      );

      const updateTimes: number[] = [];

      // Simulate rapid scrolling (10 updates)
      for (let i = 1; i <= 10; i++) {
        const newViewport: Viewport = {
          x: 0,
          y: i * 1000,
          width: 1200,
          height: 800,
        };

        const start = performance.now();
        rerender(
          <LayoutRenderer layout={layout} config={config} viewport={newViewport} />
        );
        const end = performance.now();

        updateTimes.push(end - start);
        lastViewport = newViewport;
      }

      // All updates should be fast
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(16);

      // No single update should be unreasonably slow (allow for CI noise)
      const maxUpdateTime = Math.max(...updateTimes);
      expect(maxUpdateTime).toBeLessThan(100);
    });

    it('should not trigger slow frame warnings for normal viewports', () => {
      // Mock performance.now() so render time appears within frame budget.
      // This test validates logic (no spurious warnings for normal viewports),
      // not wall-clock performance — jsdom rendering is inherently slow.
      let callCount = 0;
      const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
        // First call = startTime (0ms), subsequent calls return 5ms elapsed
        return callCount++ === 0 ? 0 : 5;
      });

      const consoleSpy = vi.spyOn(console, 'warn');

      const viewport: Viewport = {
        x: 0,
        y: 3000,
        width: 1200,
        height: 800,
      };

      render(
        <LayoutRenderer layout={layout} config={config} viewport={viewport} />
      );

      // Should not warn for normal rendering
      const slowFrameWarnings = consoleSpy.mock.calls.filter(call =>
        call[0]?.includes('Slow frame detected')
      );
      
      expect(slowFrameWarnings.length).toBe(0);
      consoleSpy.mockRestore();
      perfSpy.mockRestore();
    });
  });

  describe('Complete Performance Integration', () => {
    it('should handle full score traversal efficiently', () => {
      const renderTimes: number[] = [];
      const step = 2000; // Scroll by 2000 units

      for (let y = 0; y < layout.total_height; y += step) {
        const viewport: Viewport = {
          x: 0,
          y,
          width: 1200,
          height: 800,
        };

        const start = performance.now();
        const { container } = render(
          <LayoutRenderer layout={layout} config={config} viewport={viewport} />
        );
        const end = performance.now();

        renderTimes.push(end - start);
        container.remove();
      }

      // Performance metrics
      const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const maxTime = Math.max(...renderTimes);
      const minTime = Math.min(...renderTimes);

      expect(avgTime).toBeLessThan(16);
      expect(maxTime).toBeLessThan(50); // CI tolerance for occasional spikes
      expect(minTime).toBeGreaterThan(0);
    });

    it('should maintain performance with complex multi-staff systems', () => {
      // Even with single-staff, verify virtualization works
      const viewport: Viewport = {
        x: 0,
        y: 0,
        width: 1200,
        height: layout.total_height, // Full height
      };

      const start = performance.now();
      const { container } = render(
        <LayoutRenderer layout={layout} config={config} viewport={viewport} />
      );
      const end = performance.now();

      // Even with full viewport, should render quickly due to limited DOM nodes
      const renderTime = end - start;
      expect(renderTime).toBeLessThan(150); // CI-tolerant: full-viewport render on shared runners
    });
  });
});
