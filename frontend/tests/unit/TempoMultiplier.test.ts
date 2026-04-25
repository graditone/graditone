/**
 * Tempo Multiplier Calculation Tests
 * 
 * Feature 008 - Tempo Change: Unit tests for tempo multiplier calculations
 */

import { describe, it, expect } from 'vitest';
import {
  clampTempoMultiplier,
  multiplierToPercentage,
  percentageToMultiplier,
} from '../../src/utils/tempoCalculations';

describe('Tempo Multiplier Calculations', () => {
  describe('clampTempoMultiplier', () => {
    it('should return value within range unchanged', () => {
      expect(clampTempoMultiplier(1.0)).toBe(1.0);
      expect(clampTempoMultiplier(0.8)).toBe(0.8);
      expect(clampTempoMultiplier(1.5)).toBe(1.5);
    });

    it('should clamp values below minimum to 0.1 (Feature 083: extended range)', () => {
      expect(clampTempoMultiplier(0.05)).toBe(0.1);
      expect(clampTempoMultiplier(0.0)).toBe(0.1);
      expect(clampTempoMultiplier(-0.5)).toBe(0.1);
    });

    it('should clamp values above maximum to 2.0', () => {
      expect(clampTempoMultiplier(2.5)).toBe(2.0);
      expect(clampTempoMultiplier(3.0)).toBe(2.0);
      expect(clampTempoMultiplier(10.0)).toBe(2.0);
    });

    it('should handle boundary values correctly', () => {
      expect(clampTempoMultiplier(0.5)).toBe(0.5);
      expect(clampTempoMultiplier(2.0)).toBe(2.0);
    });
  });

  describe('multiplierToPercentage', () => {
    it('should convert multiplier to percentage', () => {
      expect(multiplierToPercentage(1.0)).toBe(100);
      expect(multiplierToPercentage(0.5)).toBe(50);
      expect(multiplierToPercentage(2.0)).toBe(200);
      expect(multiplierToPercentage(0.8)).toBe(80);
      expect(multiplierToPercentage(1.5)).toBe(150);
    });

    it('should round to whole numbers', () => {
      expect(multiplierToPercentage(0.855)).toBe(86);
      expect(multiplierToPercentage(1.234)).toBe(123);
    });
  });

  describe('percentageToMultiplier', () => {
    it('should convert percentage to multiplier', () => {
      expect(percentageToMultiplier(100)).toBe(1.0);
      expect(percentageToMultiplier(50)).toBe(0.5);
      expect(percentageToMultiplier(200)).toBe(2.0);
      expect(percentageToMultiplier(80)).toBe(0.8);
      expect(percentageToMultiplier(150)).toBe(1.5);
    });

    it('should handle decimal percentages', () => {
      expect(percentageToMultiplier(85.5)).toBe(0.855);
      expect(percentageToMultiplier(123.4)).toBe(1.234);
    });
  });

  describe('Integration: round-trip conversions', () => {
    it('should preserve values through round-trip conversion', () => {
      const original = 1.5;
      const percentage = multiplierToPercentage(original);
      const backToMultiplier = percentageToMultiplier(percentage);
      expect(backToMultiplier).toBeCloseTo(original, 2);
    });

    it('should handle clamping and conversion together', () => {
      const clamped = clampTempoMultiplier(2.5); // Should be 2.0
      const percentage = multiplierToPercentage(clamped);
      expect(percentage).toBe(200);
    });
  });
});
