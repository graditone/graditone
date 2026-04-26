/**
 * TempoStateContext Tests
 * 
 * Feature 008 - Tempo Change: Unit tests for tempo state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TempoStateProvider, useTempoState } from './TempoStateContext';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <TempoStateProvider>{children}</TempoStateProvider>
);

describe('TempoStateContext', () => {
  describe('default state', () => {
    it('should initialize with 1.0 multiplier (100%)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(1.0);
    });

    it('should initialize with 120 BPM original tempo', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      expect(result.current.tempoState.originalTempo).toBe(120);
    });

    it('should provide all required methods', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      expect(typeof result.current.setTempoMultiplier).toBe('function');
      expect(typeof result.current.adjustTempo).toBe('function');
      expect(typeof result.current.resetTempo).toBe('function');
      expect(typeof result.current.getEffectiveTempo).toBe('function');
      expect(typeof result.current.setOriginalTempo).toBe('function');
    });
  });

  describe('setTempoMultiplier', () => {
    it('should update tempo multiplier', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.8);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.8);
    });

    it('should clamp multiplier to minimum 0.1 (Feature 083: extended range)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.05);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.1);
    });

    it('should clamp multiplier to maximum 2.0', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(2.5);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(2.0);
    });
  });

  describe('adjustTempo', () => {
    it('should increase tempo by 1% (+1)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.adjustTempo(1);
      });
      
      // Snapping rounds to nearest integer BPM: 120 * 1.01 = 121.2 → 121 BPM
      expect(result.current.getEffectiveTempo()).toBe(121);
    });

    it('should decrease tempo by 1% (-1)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.adjustTempo(-1);
      });
      
      // Snapping rounds to nearest integer BPM: 120 * 0.99 = 118.8 → 119 BPM
      expect(result.current.getEffectiveTempo()).toBe(119);
    });

    it('should increase tempo by 10% (+10)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.adjustTempo(10);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(1.10);
    });

    it('should decrease tempo by 10% (-10)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.adjustTempo(-10);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.90);
    });

    it('should clamp to 0.1 when adjusting below minimum (Feature 083: extended range)', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.15);
      });
      
      act(() => {
        result.current.adjustTempo(-10); // Would go to 0.05, clamps to 0.1
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.1);
    });

    it('should clamp to 2.0 when adjusting above maximum', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(1.9);
      });
      
      act(() => {
        result.current.adjustTempo(20); // Would go to 2.1
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(2.0);
    });
  });

  describe('resetTempo', () => {
    it('should reset multiplier to 1.0', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.7);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.7);
      
      act(() => {
        result.current.resetTempo();
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(1.0);
    });

    it('should not change original tempo', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(140);
        result.current.setTempoMultiplier(0.8);
      });
      
      act(() => {
        result.current.resetTempo();
      });
      
      expect(result.current.tempoState.originalTempo).toBe(140);
      expect(result.current.tempoState.tempoMultiplier).toBe(1.0);
    });
  });

  describe('getEffectiveTempo', () => {
    it('should calculate effective tempo correctly', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(120);
        result.current.setTempoMultiplier(0.8);
      });
      
      expect(result.current.getEffectiveTempo()).toBe(96);
    });

    it('should return original tempo at 100%', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(120);
      });
      
      expect(result.current.getEffectiveTempo()).toBe(120);
    });

    it('should handle different tempo values', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(90);
        result.current.setTempoMultiplier(1.5);
      });
      
      expect(result.current.getEffectiveTempo()).toBe(135);
    });

    it('should round to whole BPM', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(120);
        result.current.setTempoMultiplier(0.855); // 120 * 0.855 = 102.6
      });
      
      expect(result.current.getEffectiveTempo()).toBe(103);
    });
  });

  describe('setOriginalTempo', () => {
    it('should update original tempo', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setOriginalTempo(140);
      });
      
      expect(result.current.tempoState.originalTempo).toBe(140);
    });

    it('should not affect tempo multiplier', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.8);
        result.current.setOriginalTempo(140);
      });
      
      expect(result.current.tempoState.tempoMultiplier).toBe(0.8);
    });

    it('should update effective tempo calculation', () => {
      const { result } = renderHook(() => useTempoState(), { wrapper });
      
      act(() => {
        result.current.setTempoMultiplier(0.5);
        result.current.setOriginalTempo(100);
      });
      
      expect(result.current.getEffectiveTempo()).toBe(50);
      
      act(() => {
        result.current.setOriginalTempo(200);
      });
      
      expect(result.current.getEffectiveTempo()).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useTempoState());
      }).toThrow('useTempoState must be used within TempoStateProvider');
    });
  });
});
