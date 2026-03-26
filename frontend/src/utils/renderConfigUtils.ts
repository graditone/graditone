/**
 * RenderConfig Factories and Validation
 * Feature 017 - Configuration management for SVG rendering
 */

import type { RenderConfig } from '../types/RenderConfig';

/**
 * Creates default RenderConfig for typical tablet display.
 *
 * @returns RenderConfig with standard values
 */
export function createDefaultConfig(): RenderConfig {
  return {
    fontSize: 20,
    fontFamily: 'Bravura',
    backgroundColor: '#FFFFFF',
    staffLineColor: '#000000',
    glyphColor: '#000000',
  };
}

/**
 * Creates dark mode RenderConfig variant.
 *
 * @param fontSize - Optional zoom level (default: 20)
 * @returns RenderConfig with dark mode colors
 */
export function createDarkModeConfig(fontSize: number = 20): RenderConfig {
  return {
    fontSize,
    fontFamily: 'Bravura',
    backgroundColor: '#1E1E1E',
    staffLineColor: '#CCCCCC',
    glyphColor: '#FFFFFF',
  };
}

/**
 * Validates RenderConfig for correctness.
 * Throws Error if validation fails.
 *
 * @param config - Configuration to validate
 * @throws Error if fontSize <= 0
 * @throws Error if fontFamily is empty
 * @throws Error if any color is invalid CSS
 */
export function validateRenderConfig(config: RenderConfig): void {
  if (config.fontSize <= 0) {
    throw new Error(
      `RenderConfig.fontSize must be > 0, got ${config.fontSize}`
    );
  }

  if (!config.fontFamily || config.fontFamily.trim().length === 0) {
    throw new Error('RenderConfig.fontFamily must be non-empty');
  }

  const colors = [
    { name: 'backgroundColor', value: config.backgroundColor },
    { name: 'staffLineColor', value: config.staffLineColor },
    { name: 'glyphColor', value: config.glyphColor },
  ];

  for (const { name, value } of colors) {
    if (!isValidCSSColor(value)) {
      throw new Error(
        `RenderConfig.${name} must be valid CSS color, got "${value}"`
      );
    }
  }
}

/**
 * Checks if a string is a valid CSS color.
 *
 * @param color - Color string to validate
 * @returns True if valid CSS color
 */
export function isValidCSSColor(color: string): boolean {
  const tempElement = document.createElement('div');
  tempElement.style.color = '';
  tempElement.style.color = color;

  return tempElement.style.color !== '';
}
