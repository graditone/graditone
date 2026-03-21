/**
 * Regression test: Nocturne Op.9 No.2 M2 LH staccato dots must be ABOVE noteheads.
 *
 * stem-down → staccato on opposite side = above the notehead.
 * In positive-y-down SVG coordinates: dot.cy < notehead.cy means dot is above.
 *
 * The backend layout emits notation_dots as {x, y, radius} and the frontend
 * renders them as <circle cx cy r fill> inside the staff <g> element.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';

async function navigateToNocturne(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const launchBtn = page.getByTestId('plugin-launch-play-score');
  await expect(launchBtn).toBeVisible({ timeout: 10000 });
  await launchBtn.click();
  const chopinEntry = page.getByText('Chopin \u2014 Nocturne Op. 9 No. 2');
  await expect(chopinEntry).toBeVisible({ timeout: 10000 });
  await chopinEntry.click();
  await page.waitForSelector('svg .glyph-run text', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('Nocturne M2 LH staccato dot placement', () => {
  test('M2 LH staccato dots are above noteheads (circle cy values)', async ({ page }) => {
    // Capture all console messages for debug
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('STACCATO DEBUG')) {
        consoleLogs.push(text);
      }
    });

    await navigateToNocturne(page);

    // Take full-page screenshot first
    await page.screenshot({
      path: 'test-results/nocturne-m2-staccato-full.png',
      fullPage: false,
    });

    // Extract all circles and their nearby noteheads from the SVG
    // The bass staff (LH) is the second staff in the first staff group.
    // M2 circles are in the x-range corresponding to measure 2.
    const analysis = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return { error: 'no SVG found' };

      // Get all circles (notation dots) — small radius
      const circles = Array.from(svg.querySelectorAll('circle'));
      const allDots = circles
        .map(c => ({
          cx: parseFloat(c.getAttribute('cx') || '0'),
          cy: parseFloat(c.getAttribute('cy') || '0'),
          r: parseFloat(c.getAttribute('r') || '0'),
        }))
        .filter(d => d.r > 0 && d.r < 8);

      // Get all staff lines to identify the bass staff region
      const lines = Array.from(svg.querySelectorAll('line'));
      const staffLines = lines
        .filter(l => {
          const cls = l.getAttribute('class') || '';
          const x1 = parseFloat(l.getAttribute('x1') || '0');
          const x2 = parseFloat(l.getAttribute('x2') || '0');
          return (x2 - x1) > 100; // Long horizontal lines = staff lines
        })
        .map(l => ({
          y: parseFloat(l.getAttribute('y1') || '0'),
          x1: parseFloat(l.getAttribute('x1') || '0'),
          x2: parseFloat(l.getAttribute('x2') || '0'),
        }));

      // Group staff lines by approximate y-clusters (within 100 units = one staff)
      // Sort by y first
      staffLines.sort((a, b) => a.y - b.y);

      // Get glyph text elements (noteheads) - look for SMuFL noteheads
      // U+E0A4 = filled notehead, U+E0A3 = half notehead
      const NOTEHEAD_FILLED = '\uE0A4';
      const NOTEHEAD_HALF = '\uE0A3';
      const textEls = Array.from(svg.querySelectorAll('.glyph-run text, text'));
      const noteheads = textEls
        .filter(t => {
          const text = t.textContent || '';
          return text.includes(NOTEHEAD_FILLED) || text.includes(NOTEHEAD_HALF);
        })
        .map(t => ({
          x: parseFloat(t.getAttribute('x') || '0'),
          y: parseFloat(t.getAttribute('y') || '0'),
          text: t.textContent || '',
        }));

      // For each dot, find the nearest notehead by x-position (within 15 units)
      // and report whether dot is above or below the notehead
      const dotNoteAssociations = allDots.map(dot => {
        // Find the nearest notehead horizontally
        let nearest = null as { x: number; y: number; dist: number } | null;
        for (const nh of noteheads) {
          const xDist = Math.abs(dot.cx - nh.x);
          if (xDist < 25) {
            // Among noteheads close in x, find the one closest in y
            // (but we want to check ALL nearby to understand multi-note chords)
            if (!nearest || xDist < nearest.dist) {
              nearest = { x: nh.x, y: nh.y, dist: xDist };
            }
          }
        }
        return {
          dot_cx: dot.cx,
          dot_cy: dot.cy,
          dot_r: dot.r,
          nearest_nh_x: nearest?.x ?? null,
          nearest_nh_y: nearest?.y ?? null,
          dotAboveNotehead: nearest ? dot.cy < nearest.y : null,
        };
      });

      return {
        error: null,
        totalDots: allDots.length,
        totalNoteheads: noteheads.length,
        totalStaffLines: staffLines.length,
        // Return first 50 dots for analysis
        dots: allDots.slice(0, 80),
        // Return first few noteheads
        noteheads: noteheads.slice(0, 40),
        // Staff line info
        staffLineYs: staffLines.slice(0, 20).map(l => l.y),
        // Associations
        dotNoteAssociations: dotNoteAssociations.slice(0, 80),
      };
    });

    console.log('Staccato analysis:', JSON.stringify(analysis, null, 2));

    // Take score area screenshot
    const scoreArea = page.locator('.score-scroll-container').first();
    if (await scoreArea.isVisible()) {
      await scoreArea.screenshot({
        path: 'test-results/nocturne-m2-staccato-score.png',
      });
    }

    expect(analysis.error).toBeNull();

    // Log dots in the bass staff region (y > 300 for system 1, roughly)
    // The bass staff is below the treble staff
    const bassRegionDots = analysis.dotNoteAssociations!.filter(
      d => d.dot_cy > 250
    );
    console.log('Bass region dots:', JSON.stringify(bassRegionDots, null, 2));

    // Check that dots associated with noteheads are ABOVE them (cy < nh_y)
    const dotsWithNearby = bassRegionDots.filter(d => d.nearest_nh_y !== null);
    
    // Write analysis to file for inspection
    const report = {
      consoleLogs,
      totalDots: analysis.totalDots,
      totalNoteheads: analysis.totalNoteheads,
      staffLineYs: analysis.staffLineYs,
      allDots: analysis.dots,
      allNoteheads: analysis.noteheads,
      bassRegionDots,
      dotsWithNearby,
    };
    fs.writeFileSync('test-results/staccato-analysis.json', JSON.stringify(report, null, 2));
    
    // Assert M2 LH staccato dots are above noteheads
    for (const d of dotsWithNearby) {
      // Only check dots that are likely staccato (near noteheads vertically)
      const yDiff = Math.abs(d.dot_cy - d.nearest_nh_y!);
      if (yDiff < 60) { // within 3 staff spaces
        expect(
          d.dot_cy,
          `Staccato dot at (${d.dot_cx.toFixed(1)}, ${d.dot_cy.toFixed(1)}) should be ABOVE notehead at y=${d.nearest_nh_y!.toFixed(1)} (stem-down → dot above)`
        ).toBeLessThan(d.nearest_nh_y!);
      }
    }
  });
});
