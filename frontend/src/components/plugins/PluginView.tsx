/**
 * PluginView — per-plugin error boundary (T017)
 * V3PluginWrapper — functional host for Plugin API v3 hooks (T006)
 * Feature 030: Plugin Architecture
 *
 * PluginView: wraps any plugin component in a React class-based error boundary.
 * On crash: displays plugin name + error message + "Reload plugin" button.
 * "Reload plugin" resets boundary state so the plugin's component is remounted.
 *
 * V3PluginWrapper: functional HOC for v3 core plugins (pluginApiVersion === '3').
 * Calls useScorePlayerBridge() inside TempoStateProvider, keeps proxy refs current,
 * and wraps the plugin's Component in the PluginView error boundary.
 *
 * This is intentionally a separate class from ErrorBoundary.tsx so it can
 * render the plugin name + caught error in its fallback without modifying
 * the existing ErrorBoundary API. (FR-020 / research.md R-005)
 */

import { Component, useRef, type ReactNode, type ReactElement } from 'react';
import type { PluginManifest, PluginScoreRendererProps } from '../../plugin-api/index';
import type { PluginScorePlayerContext, PluginMetronomeContext } from '../../plugin-api/types';
import { useScorePlayerBridge, type ScorePlayerInternal } from '../../plugin-api/scorePlayerContext';
import { useMetronomeBridge } from '../../plugin-api/metronomeContext';
import { ScoreRendererPlugin } from './ScoreRendererPlugin';

export interface PluginViewProps {
  /** Manifest of the plugin whose Component is being wrapped. */
  plugin: PluginManifest;
  children: ReactNode;
}

interface PluginViewState {
  hasError: boolean;
  error: Error | null;
}

export class PluginView extends Component<PluginViewProps, PluginViewState> {
  constructor(props: PluginViewProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PluginViewState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[PluginView] Plugin "${this.props.plugin.name}" crashed:`, error);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { plugin, children } = this.props;

    if (hasError) {
      return (
        <div className="plugin-error" style={styles.container}>
          <div style={styles.card}>
            <p style={styles.message}>
              Plugin &ldquo;{plugin.name}&rdquo; encountered an error:{' '}
              {error?.message ?? 'Unknown error'}
            </p>
            <button onClick={this.handleReset} style={styles.button}>
              Reload plugin
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: '20px',
    background: '#f9f9f9',
  },
  card: {
    maxWidth: '480px',
    padding: '20px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  message: {
    margin: '0 0 16px',
    fontSize: '0.95rem',
    color: '#555',
    lineHeight: '1.5',
  },
  button: {
    padding: '8px 20px',
    fontSize: '0.875rem',
    fontWeight: 'bold' as const,
    color: '#fff',
    background: '#1976D2',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

// ---------------------------------------------------------------------------
// V3 Plugin infrastructure (T006)
// ---------------------------------------------------------------------------

/**
 * Mutable refs shared between App.tsx context assembly and V3PluginWrapper.
 *
 * - `scorePlayerRef`: App.tsx provides a stable proxy backed by this ref.
 *   V3PluginWrapper sets `.current = bridge.api` during render so the proxy
 *   always delegates to the real hook-backed implementation.
 *
 * - `internalRef`: V3PluginWrapper sets `.current = bridge.internal` during
 *   render. The BoundScoreRenderer (created by `createBoundScoreRenderer`)
 *   closes over this ref and reads it on every render.
 *
 * - `metronomeRef`: App.tsx injects `createMetronomeProxy(metronomeRef)` into
 *   PluginContext. V3PluginWrapper sets `.current = useMetronomeBridge(api)`
 *   so all plugin metronome calls reach the real hook-backed engine.
 */
export type V3ProxyRefs = {
  scorePlayerRef: { current: PluginScorePlayerContext };
  internalRef: { current: ScorePlayerInternal | null };
  metronomeRef: { current: PluginMetronomeContext };
};

/**
 * Create a stable `ScoreRenderer` component that reads internal bridge state
 * from a ref. Call this ONCE (in App.tsx's useEffect) per v3 plugin, store the
 * result in `context.components.ScoreRenderer`, and pass the `internalRef` to
 * `V3PluginWrapper` via `V3ProxyRefs`.
 *
 * The returned component is stable (same function identity) — it reads from
 * `internalRef.current` on each invocation so it always uses the latest state.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createBoundScoreRenderer(
  internalRef: { current: ScorePlayerInternal | null }
): (props: PluginScoreRendererProps) => ReactElement {
  return function BoundScoreRenderer(props: PluginScoreRendererProps) {
    const internal = internalRef.current;
    if (!internal || !internal.score) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#888' }}>
          Loading score…
        </div>
      );
    }
    return (
      <ScoreRendererPlugin
        {...props}
        score={internal.score}
        allNotes={internal.notes}
        rawNotes={internal.rawNotes}
        tickSourceRef={internal.tickSourceRef}
        playbackStatus={internal.playbackStatus}
      />
    );
  };
}

// ---------------------------------------------------------------------------
// V3PluginWrapper — functional component (must be inside TempoStateProvider)
// ---------------------------------------------------------------------------

export interface V3PluginWrapperProps {
  /** Plugin manifest (forwarded to PluginView error boundary). */
  plugin: PluginManifest;
  /** Proxy refs shared with App.tsx context assembly. */
  proxyRefs: V3ProxyRefs;
  /** Plugin component to render (coreEntry.plugin.Component). */
  children: ReactNode;
}

/**
 * Functional wrapper for Plugin API v3 core plugins.
 *
 * Responsibilities:
 *  1. Calls `useScorePlayerBridge()` to get the real hook-backed scorePlayer
 *     and internal score/notes/tickSourceRef state.
 *  2. Keeps `proxyRefs` current every render (synchronous side-effect — safe
 *     because it only writes to React-external refs, not React state).
 *  3. Wraps children in the `PluginView` class error boundary.
 *
 * Must be rendered inside `<TempoStateProvider>`.
 */
export function V3PluginWrapper({ plugin, proxyRefs, children }: V3PluginWrapperProps) {
  const { api, internal } = useScorePlayerBridge();

  // Build the real hook-backed metronome API, subscribed to the score player
  // for BPM tracking (T020 — FR-007a: metronome follows tempo changes).
  const metronomeApi = useMetronomeBridge(api);

  // Update proxy refs synchronously during render — runs before children render
  // so PlayScorePluginWithContext always reads the live bridge when it renders.
  // eslint-disable-next-line react-hooks/immutability
  proxyRefs.scorePlayerRef.current = api;
  // eslint-disable-next-line react-hooks/immutability
  proxyRefs.internalRef.current = internal;
  // eslint-disable-next-line react-hooks/immutability
  proxyRefs.metronomeRef.current = metronomeApi;

  // Keep internalRef stable across re-renders (for BoundScoreRenderer closure)
  const internalRefStable = useRef(internal);
  internalRefStable.current = internal;

  return (
    <PluginView plugin={plugin}>
      {children}
    </PluginView>
  );
}
