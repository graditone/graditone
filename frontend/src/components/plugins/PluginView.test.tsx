/**
 * PluginView error boundary tests — T011
 * Feature 030: Plugin Architecture (US1 — Play Virtual Keyboard)
 *
 * Constitution Principle V: tests written before PluginView.tsx implementation.
 *
 * Covers (per tasks.md T011):
 * - Renders children normally when no error occurs
 * - Catches thrown error and shows plugin name + error message
 * - "Reload plugin" button resets boundary and remounts children
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PluginView } from './PluginView';
import { LocaleProvider } from '../../i18n/index';
import type { PluginManifest } from '../plugin-api/index';

const makeManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  pluginApiVersion: '1',
  entryPoint: 'index.js',
  origin: 'builtin',
  ...overrides,
});

/** Component that renders normally. */
const SafeChild = () => <div>Safe content</div>;

/** Component that throws immediately during render. */
const CrashingChild = ({ shouldCrash }: { shouldCrash: boolean }) => {
  if (shouldCrash) throw new Error('Test error from plugin');
  return <div>Recovered content</div>;
};

const W = ({ children }: { children: React.ReactNode }) => <LocaleProvider locale="en">{children}</LocaleProvider>;

describe('PluginView', () => {
  // Suppress React's console.error output for expected error boundary tests
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('normal rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <W><PluginView plugin={makeManifest()}>
          <SafeChild />
        </PluginView></W>
      );
      expect(screen.getByText('Safe content')).toBeInTheDocument();
    });

    it('does not show the error UI when no error occurs', () => {
      render(
        <W><PluginView plugin={makeManifest()}>
          <SafeChild />
        </PluginView></W>
      );
      expect(screen.queryByText(/encountered an error/i)).not.toBeInTheDocument();
    });
  });

  describe('error boundary', () => {
    it('catches a render error and shows the plugin name in the error message', () => {
      render(
        <W><PluginView plugin={makeManifest({ name: 'Test Plugin' })}>
          <CrashingChild shouldCrash={true} />
        </PluginView></W>
      );
      expect(screen.getByText(/Test Plugin/)).toBeInTheDocument();
      expect(screen.getByText(/encountered an error/i)).toBeInTheDocument();
    });

    it('shows the error message from the thrown error', () => {
      render(
        <W><PluginView plugin={makeManifest()}>
          <CrashingChild shouldCrash={true} />
        </PluginView></W>
      );
      expect(screen.getByText(/Test error from plugin/)).toBeInTheDocument();
    });

    it('shows a "Reload plugin" button when in error state', () => {
      render(
        <W><PluginView plugin={makeManifest()}>
          <CrashingChild shouldCrash={true} />
        </PluginView></W>
      );
      expect(screen.getByRole('button', { name: /reload plugin/i })).toBeInTheDocument();
    });
  });

  describe('reload behaviour', () => {
    it('resets error state and remounts children when Reload plugin is clicked', () => {
      // Use a mutable flag so we can stop crashing BEFORE clicking reload.
      // This simulates: user "fixes" the issue, then clicks Reload.
      let shouldCrash = true;
      const ControlledCrash = () => {
        if (shouldCrash) throw new Error('Test error from plugin');
        return <div>Recovered content</div>;
      };

      render(
        <W><PluginView plugin={makeManifest()}>
          <ControlledCrash />
        </PluginView></W>
      );

      // Verify error state is active
      expect(screen.getByRole('button', { name: /reload plugin/i })).toBeInTheDocument();

      // Resolve the crash condition, then click Reload —
      // boundary resets, same component re-renders without crashing.
      shouldCrash = false;
      fireEvent.click(screen.getByRole('button', { name: /reload plugin/i }));

      expect(screen.getByText('Recovered content')).toBeInTheDocument();
      expect(screen.queryByText(/encountered an error/i)).not.toBeInTheDocument();
    });
  });
});
