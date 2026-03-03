/**
 * Tests for sortPluginsByOrder — Feature 036
 * Constitution Principle V: Tests written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sortPluginsByOrder } from './sortPlugins';
import type { BuiltinPluginEntry } from './builtinPlugins';
import type { PluginManifest } from '../../plugin-api/index';

function entry(id: string, order?: number | unknown): BuiltinPluginEntry {
  const manifest = {
    id,
    name: id,
    version: '1.0.0',
    pluginApiVersion: '1',
    entryPoint: 'index.tsx',
    description: '',
    type: 'core' as const,
    view: 'full-screen' as const,
    origin: 'builtin' as const,
    ...(order !== undefined ? { order: order as number } : {}),
  } satisfies PluginManifest;
  return {
    manifest,
    plugin: { init: () => {}, dispose: () => {}, Component: () => null },
  };
}

describe('sortPluginsByOrder', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns an empty array unchanged', () => {
    expect(sortPluginsByOrder([])).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    const input = [entry('a', 1)];
    expect(sortPluginsByOrder(input)).toEqual(input);
  });

  it('sorts ordered plugins in ascending order', () => {
    const input = [entry('c', 3), entry('a', 1), entry('b', 2)];
    const result = sortPluginsByOrder(input);
    expect(result.map((e) => e.manifest.id)).toEqual(['a', 'b', 'c']);
  });

  it('places unordered plugins after all ordered plugins', () => {
    const input = [entry('unordered'), entry('z', 9), entry('a', 1)];
    const result = sortPluginsByOrder(input);
    expect(result.map((e) => e.manifest.id)).toEqual(['a', 'z', 'unordered']);
  });

  it('multiple unordered plugins trail all ordered plugins', () => {
    const input = [entry('z-unordered'), entry('a-ordered', 1), entry('m-unordered')];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('a-ordered');
    expect(result.slice(1).map((e) => e.manifest.id)).toEqual(['m-unordered', 'z-unordered']);
  });

  it('breaks ties in order by id alphabetically', () => {
    const input = [entry('zebra', 2), entry('alpha', 2), entry('monkey', 2)];
    const result = sortPluginsByOrder(input);
    expect(result.map((e) => e.manifest.id)).toEqual(['alpha', 'monkey', 'zebra']);
  });

  it('treats NaN order as absent and emits console.warn', () => {
    const input = [entry('ordered', 1), entry('nan-order', NaN)];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('ordered');
    expect(result[1].manifest.id).toBe('nan-order');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nan-order'),
      NaN,
    );
  });

  it('treats Infinity order as absent and emits console.warn', () => {
    const input = [entry('ordered', 1), entry('inf', Infinity)];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('ordered');
    expect(result[1].manifest.id).toBe('inf');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('treats -Infinity order as absent and emits console.warn', () => {
    const input = [entry('ordered', 1), entry('neg-inf', -Infinity)];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('ordered');
    expect(result[1].manifest.id).toBe('neg-inf');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('treats a non-number order as absent (no crash)', () => {
    const badEntry = entry('bad');
    // Force a non-number value bypassing TypeScript
    (badEntry.manifest as unknown as Record<string, unknown>)['order'] = 'not-a-number';
    const input = [entry('ordered', 1), badEntry];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('ordered');
    expect(result[1].manifest.id).toBe('bad');
  });

  it('accepts negative order values (placed before order: 0)', () => {
    const input = [entry('zero', 0), entry('neg', -1), entry('pos', 1)];
    const result = sortPluginsByOrder(input);
    expect(result.map((e) => e.manifest.id)).toEqual(['neg', 'zero', 'pos']);
  });

  it('accepts order: 0 as a valid ordered position', () => {
    const input = [entry('b', 1), entry('a', 0)];
    const result = sortPluginsByOrder(input);
    expect(result.map((e) => e.manifest.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [entry('b', 2), entry('a', 1)];
    const originalOrder = input.map((e) => e.manifest.id);
    sortPluginsByOrder(input);
    expect(input.map((e) => e.manifest.id)).toEqual(originalOrder);
  });

  it('real-world scenario: Play(1) and Train(2) order correctly', () => {
    const input = [entry('train-view', 2), entry('play-score', 1), entry('virtual-keyboard')];
    const result = sortPluginsByOrder(input);
    expect(result[0].manifest.id).toBe('play-score');
    expect(result[1].manifest.id).toBe('train-view');
    expect(result[2].manifest.id).toBe('virtual-keyboard');
  });
});
