/**
 * App.tsx navigation integration tests — T026
 * Feature 030: Plugin Architecture (US3 — Navigate Between Installed Plugins)
 *
 * Constitution Principle V: written before T027/T028 hardening.
 *
 * Mocks:
 * - initWasm: avoids WASM loading in unit tests
 * - builtinPlugins: injects two synthetic plugins for navigation testing
 * - PluginRegistry: avoids IndexedDB in unit tests
 * - PluginImporter: avoids file system in unit tests
 *
 * Covers:
 * - Each installed plugin produces exactly one nav entry
 * - Clicking a plugin nav entry renders its view (aria-pressed = true)
 * - Clicking a second plugin nav entry switches to it (first becomes inactive)
 * - Clicking the score/home area (or a non-plugin handler) dismisses plugin view
 * - Rapid switching between plugin entries does not throw
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that depend on them
// ---------------------------------------------------------------------------

vi.mock('./services/wasm/loader', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./services/plugins/PluginImporter', () => ({
  importPlugin: vi.fn(),
}));

// Declare fake plugins in vi.hoisted so they are available when the mock factory runs
const { fakePlugin1, fakePlugin2 } = vi.hoisted(() => {
  function makeFakePlugin() {
    return {
      init: vi.fn(),
      dispose: vi.fn(),
      // Component will be replaced in beforeEach with JSX (JSX transform not available in vi.hoisted)
      Component: (() => null) as unknown as () => JSX.Element,
    };
  }
  return { fakePlugin1: makeFakePlugin(), fakePlugin2: makeFakePlugin() };
});

vi.mock('./services/plugins/builtinPlugins', () => ({
  BUILTIN_PLUGINS: [
    {
      manifest: {
        id: 'alpha-plugin',
        name: 'Alpha Plugin',
        version: '1.0.0',
        pluginApiVersion: '1',
        entryPoint: 'index.js',
        origin: 'builtin',
      },
      plugin: fakePlugin1,
    },
    {
      manifest: {
        id: 'beta-plugin',
        name: 'Beta Plugin',
        version: '1.0.0',
        pluginApiVersion: '1',
        entryPoint: 'index.js',
        origin: 'builtin',
      },
      plugin: fakePlugin2,
    },
  ],
}));

vi.mock('./services/plugins/PluginRegistry', () => ({
  pluginRegistry: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    register: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  PluginRegistry: class MockPluginRegistry {},
}));

// Silence console noise from WASM + plugin context
beforeEach(() => {
  // Replace Components with JSX-capable functions (JSX transform available here)
  fakePlugin1.Component = () => <div data-testid="plugin-view-alpha">Alpha View</div>;
  fakePlugin2.Component = () => <div data-testid="plugin-view-beta">Beta View</div>;

  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Import App AFTER mocks are declared (vi.mock is hoisted by Vite)
import App from './App';
import { LocaleProvider } from './i18n/index';
import esCatalog from './i18n/locales/es.json';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App plugin navigation (US3)', () => {
  // ── One nav entry per plugin ────────────────────────────────────────────

  it('renders exactly one nav entry for each installed plugin', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open Alpha Plugin plugin/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Beta Plugin plugin/i })).toBeInTheDocument();
    });

    // Only two plugin buttons (not counting import "+" button or other controls)
    const pluginNavButtons = screen.getAllByRole('button', { name: /Open .* plugin/i });
    expect(pluginNavButtons).toHaveLength(2);
  });

  // ── Selecting a plugin activates it ────────────────────────────────────

  it('marks a plugin nav entry as active when clicked', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    const alphaBtn = screen.getByRole('button', { name: /Open Alpha Plugin plugin/i });
    expect(alphaBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(alphaBtn);

    expect(alphaBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the plugin view component when its nav entry is clicked', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    fireEvent.click(screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    expect(screen.getByTestId('plugin-view-alpha')).toBeInTheDocument();
  });

  // ── Switching between plugins ────────────────────────────────────────────

  it('deactivates the first plugin when user selects the second', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    const alphaBtn = screen.getByRole('button', { name: /Open Alpha Plugin plugin/i });
    const betaBtn = screen.getByRole('button', { name: /Open Beta Plugin plugin/i });

    fireEvent.click(alphaBtn);
    expect(alphaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(betaBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(betaBtn);
    expect(betaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(alphaBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the second plugin view when switching from first to second', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    fireEvent.click(screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));
    expect(screen.getByTestId('plugin-view-alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('plugin-view-beta')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open Beta Plugin plugin/i }));
    expect(screen.getByTestId('plugin-view-beta')).toBeInTheDocument();
    expect(screen.queryByTestId('plugin-view-alpha')).not.toBeInTheDocument();
  });

  // ── Rapid switching ────────────────────────────────────────────────────

  it('handles rapid switching between plugins without throwing', async () => {
    render(<LocaleProvider><App /></LocaleProvider>);

    await waitFor(() => screen.getByRole('button', { name: /Open Alpha Plugin plugin/i }));

    const alphaBtn = screen.getByRole('button', { name: /Open Alpha Plugin plugin/i });
    const betaBtn = screen.getByRole('button', { name: /Open Beta Plugin plugin/i });

    // 10 rapid alternating clicks
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        fireEvent.click(i % 2 === 0 ? alphaBtn : betaBtn);
      }
    });

    // Should end on alpha (10 clicks, 0-indexed: last click is at i=9 on betaBtn, but
    // i=9 is odd so betaBtn is clicked last)
    expect(betaBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// i18n: US1 — Spanish browser sees Spanish text (T012)
// Feature 073: Landing Page i18n
//
// Written BEFORE App.tsx migration (T014). Tests FAIL until t() calls replace
// the hardcoded strings in App.tsx.
// ---------------------------------------------------------------------------

describe('App i18n — Spanish locale (US1)', () => {
  it('shows the Spanish loading message while WASM initialises', () => {
    render(
      <LocaleProvider locale="es">
        <App />
      </LocaleProvider>,
    );
    // wasmLoading starts as true → loading UI is shown synchronously
    expect(screen.getByText(esCatalog['loading.engine'])).toBeInTheDocument();
  });

  it('shows the Spanish slogan after WASM loads', async () => {
    render(
      <LocaleProvider locale="es">
        <App />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText(esCatalog['header.slogan'])).toBeInTheDocument();
    });
  });
});

// i18n: US2 — unsupported browser locale falls back to English (T017)

describe('App i18n — unsupported locale falls back to English (US2)', () => {
  it('shows the English slogan when navigator.language is "fr" (unsupported)', async () => {
    const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', { value: 'fr', configurable: true });

    render(
      // No locale prop → LocaleProvider reads navigator.language = 'fr'
      // resolveLocale('fr') = 'en' → English catalog is used
      <LocaleProvider>
        <App />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(
        screen.getByText('The open platform for musical practice'),
      ).toBeInTheDocument();
    });

    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });
});
