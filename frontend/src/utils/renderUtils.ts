/**
 * Rendering Utilities — Barrel Re-export
 * Feature 017/058 - Re-exports from focused utility modules
 *
 * Maintains backward compatibility for all existing consumers.
 * New code should import directly from the focused modules.
 */

export {
  createDefaultConfig,
  createDarkModeConfig,
  validateRenderConfig,
  isValidCSSColor,
} from './renderConfigUtils';

export {
  createViewportFromSVG,
  intersectsViewport,
  getViewportArea,
  validateViewport,
  getVisibleSystems,
} from './viewportUtils';

export {
  svgNS,
  createSVGElement,
  createSVGGroup,
} from './svgHelpers';

