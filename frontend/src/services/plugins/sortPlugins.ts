/**
 * sortPluginsByOrder — Feature 036
 *
 * Sorts plugin entries by manifest.order ascending, then by id alphabetically.
 * Plugins without a valid finite order value are placed after all ordered plugins.
 */
import type { BuiltinPluginEntry } from './builtinPlugins';

function effectiveOrder(e: BuiltinPluginEntry): number {
  const o = e.manifest.order;
  if (o === undefined) return Infinity;
  if (typeof o !== 'number' || !isFinite(o)) {
    console.warn(`[sortPlugins] Plugin "${e.manifest.id}" has invalid order value:`, o);
    return Infinity;
  }
  return o;
}

export function sortPluginsByOrder(entries: BuiltinPluginEntry[]): BuiltinPluginEntry[] {
  return [...entries].sort((a, b) => {
    const oa = effectiveOrder(a);
    const ob = effectiveOrder(b);
    if (oa !== ob) return oa - ob;
    return a.manifest.id.localeCompare(b.manifest.id);
  });
}
