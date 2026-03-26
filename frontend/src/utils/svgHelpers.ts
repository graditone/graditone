/**
 * SVG Element Factories
 * Feature 017 - SVG namespace and element creation utilities
 */

/**
 * SVG namespace constant for createElementNS().
 *
 * @constant
 */
export const svgNS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG element with proper namespace.
 *
 * @param tagName - SVG tag name (e.g., 'line', 'text', 'g')
 * @returns SVG element
 */
export function createSVGElement<K extends keyof SVGElementTagNameMap>(
  tagName: K
): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNS, tagName);
}

/**
 * Creates an SVG <g> group element.
 * Convenience wrapper for createSVGElement('g').
 *
 * @returns SVG group element
 */
export function createSVGGroup(): SVGGElement {
  return createSVGElement('g');
}
