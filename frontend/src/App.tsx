import { useState, useEffect, useCallback, useRef } from 'react'
import * as _ReactNS from 'react'
import { ScoreViewer } from './components/ScoreViewer'
import { RecordingView } from './components/recording/RecordingView'
import { OfflineBanner } from './components/OfflineBanner'
import { IOSInstallModal } from './components/IOSInstallModal'
import { FileStateProvider } from './services/state/FileStateContext'
import { TempoStateProvider } from './services/state/TempoStateContext'
import { initWasm } from './services/wasm/loader'
import { BUILTIN_PLUGINS, type BuiltinPluginEntry } from './services/plugins/builtinPlugins'
import { sortPluginsByOrder } from './services/plugins/sortPlugins'
import { pluginRegistry } from './services/plugins/PluginRegistry'
import { PluginView, V3PluginWrapper, createBoundScoreRenderer, type V3ProxyRefs } from './components/plugins/PluginView'
import { PluginNavEntry } from './components/plugins/PluginNavEntry'
import { PluginImporterDialog } from './components/plugins/PluginImporterDialog'
import { PluginRemoverDialog } from './components/plugins/PluginRemoverDialog'
import { ScoreSelectorPlugin } from './components/plugins/ScoreSelectorPlugin'
import type { PluginContext, PluginNoteEvent, GraditonePlugin } from './plugin-api/index'
import { PluginStaffViewer } from './plugin-api/PluginStaffViewer'
import { createNoOpScorePlayer, createScorePlayerProxy } from './plugin-api/scorePlayerContext'
import { createNoOpMetronome, createMetronomeProxy } from './plugin-api/metronomeContext'
import { ToneAdapter } from './services/playback/ToneAdapter'
import { pluginMicBroadcaster } from './services/recording/PluginMicBroadcaster'
import { useMidiInput } from './services/recording/useMidiInput'
import { getThemeFromHash, isThemeInHash } from './themes/landing-themes'
import packageJson from '../package.json'
import './App.css'

// Expose the host's React instance on window so imported plugins loaded as Blob
// URL ESM modules can share it via their react-shim.js alias (avoids the
// "Cannot read properties of null (reading 'useState')" dual-React error).
;(window as unknown as Record<string, unknown>).__GRADITON_REACT__ = _ReactNS

/**
 * Graditone - Music Score Editor
 * 
 * Main application component that renders the score viewer.
 * Connects to backend API at http://localhost:8080
 * 
 * Feature 008: Added TempoStateProvider for tempo change support
 * Feature 011: Added WASM music engine initialization
 * Feature 013: Added onboarding with demo music on first run
 */
function App() {
  const [wasmLoading, setWasmLoading] = useState(true)
  const [wasmError, setWasmError] = useState<string | null>(null)
  
  // Feature 001-recording-view: Recording debug view (?debug=true)
  const [showRecording, setShowRecording] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  // Feature 030: Plugin navigation state
  const [allPlugins, setAllPlugins] = useState<BuiltinPluginEntry[]>([])
  const [activePlugin, setActivePlugin] = useState<string | null>(null)
  // T025: Show/hide plugin importer dialog
  const [showImporter, setShowImporter] = useState(false)
  const [showRemover, setShowRemover] = useState(false)
  // Feature 030: Increment to re-run loadPlugins (e.g. after a new plugin is imported)
  const [pluginsVersion, setPluginsVersion] = useState(0)

  // Feature 039: Theme state — lifted here so it persists across full-screen plugin views.
  const [activeThemeId, setActiveThemeId] = useState<string>(() => getThemeFromHash())
  // Easter-egg: only show the theme navbar when a theme hash is explicitly in the URL.
  const [showThemeNavbar, setShowThemeNavbar] = useState<boolean>(() => isThemeInHash())

  const handleThemeChange = useCallback((themeId: string) => {
    setActiveThemeId(themeId)
    window.location.hash = themeId
  }, [])

  useEffect(() => {
    function onHashChange() {
      setActiveThemeId(getThemeFromHash())
      setShowThemeNavbar(isThemeInHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Keep body[data-landing-theme] always in sync — never removed — so the theme
  // tokens cascade to app-header, full-screen plugins and all other descendants.
  useEffect(() => {
    document.body.dataset.landingTheme = activeThemeId
  }, [activeThemeId])

  // When a core plugin is active, apply fullscreen-play body class.
  // This is required for iOS Safari where `overflow-x: hidden` on the body
  // clips `position: fixed` elements — the class removes that restriction.
  useEffect(() => {
    const entry = allPlugins.find(p => p.manifest.id === activePlugin)
    const isFullScreen = entry?.manifest.view === 'full-screen'
    document.body.classList.toggle('fullscreen-play', !!isFullScreen)
    return () => {
      document.body.classList.remove('fullscreen-play')
      // Safety net: exit browser native fullscreen when component unmounts
      document.exitFullscreen?.().catch(() => {})
    }
  }, [activePlugin, allPlugins])

  // Feature 030 / 029: Fan out MIDI hardware events to all subscribed plugins.
  // A single Set of handlers is shared; each plugin context adds/removes its own.
  const midiPluginSubscribersRef = useRef<Set<(e: PluginNoteEvent) => void>>(new Set())

  // Feature 031: Per-plugin timer registry for offsetMs scheduled playback.
  // Maps pluginId → Set of pending setTimeout handles so stopPlayback() can
  // cancel all scheduled notes for a specific plugin without affecting others.
  const pluginTimersRef = useRef<Map<string, Set<ReturnType<typeof setTimeout>>>>(new Map())

  // T006 / Feature 033: Per-plugin proxy refs for v3 context injection.
  // scorePlayerRef: populated by V3PluginWrapper with the real hook-backed API.
  // internalRef: populated by V3PluginWrapper with bridge.internal for BoundScoreRenderer.
  const v3ProxyRefsMap = useRef<Map<string, V3ProxyRefs>>(new Map())
  useMidiInput({
    onNoteOn: (midiEvent) => {
      const event: PluginNoteEvent = {
        midiNote: midiEvent.noteNumber,
        timestamp: Date.now(),
        velocity: midiEvent.velocity,
        type: 'attack',
      }
      midiPluginSubscribersRef.current.forEach(h => h(event))
    },
    onNoteOff: (noteNumber) => {
      const event: PluginNoteEvent = {
        midiNote: noteNumber,
        timestamp: Date.now(),
        type: 'release',
      }
      midiPluginSubscribersRef.current.forEach(h => h(event))
    },
    onConnectionChange: () => {},
  })
  
  // Mobile debug console (eruda) - enable with ?debug=true
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      import('eruda').then(eruda => {
        eruda.default.init();
        console.log('[App] Eruda mobile debug console initialized');
        console.log('[App] Access console by tapping the floating button');
      });
    }
    
    // Feature 001-recording-view: Enable debug mode flag for Record View button
    if (urlParams.get('debug') === 'true') {
      setDebugMode(true);
    }
  }, []);
  
  useEffect(() => {
    // Initialize WASM module on app startup
    initWasm()
      .then(() => {
        console.log('[App] WASM engine ready')
        setWasmLoading(false)
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[App] WASM initialization failed:', errorMessage)
        setWasmError(errorMessage)
        setWasmLoading(false)
      })
  }, [])

  // Feature 030: Load plugins (builtins + persisted imported plugins) and call init()
  useEffect(() => {
    async function loadPlugins() {
      // Start with built-in plugins (always available, no IndexedDB needed)
      const entries: BuiltinPluginEntry[] = [...BUILTIN_PLUGINS]

      // Load persisted imported plugins dynamically from IndexedDB
      try {
        const imported = await pluginRegistry.list()
        for (const { manifest } of imported) {
          let plugin: GraditonePlugin
          try {
            const assets = await pluginRegistry.getAssets(manifest.id)
            const entryAsset = assets.find(a => a.name === manifest.entryPoint)
            if (!entryAsset) throw new Error(`Entry point "${manifest.entryPoint}" not found in stored assets`)
            const blob = new Blob([entryAsset.data], { type: 'application/javascript' })
            const blobUrl = URL.createObjectURL(blob)
            const mod = await import(/* @vite-ignore */ blobUrl)
            URL.revokeObjectURL(blobUrl)
            plugin = mod.default as GraditonePlugin
            console.log(`[App] Loaded imported plugin "${manifest.id}" from IndexedDB`)
          } catch (loadErr) {
            console.error(`[App] Failed to load plugin "${manifest.id}":`, loadErr)
            const pluginName = manifest.name
            plugin = {
              init: () => {},
              dispose: () => {},
              Component: () => (
                <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                  <p>&#x26A0;&#xFE0F; Failed to load &ldquo;{pluginName}&rdquo;.</p>
                  <p style={{ fontSize: '0.8em' }}>Check the browser console for details.</p>
                </div>
              ),
            }
          }
          entries.push({ manifest, plugin })
        }
        if (imported.length > 0) {
          console.log('[App] Loaded', imported.length, 'imported plugin(s) from registry')
        }
      } catch (err) {
        console.warn('[App] Could not load plugin registry:', err)
      }

      // Initialise each plugin with a PluginContext
      entries.forEach(({ manifest, plugin }) => {
        // T006 / Feature 033: Create proxy refs for v3 plugins.
        // scorePlayerRef starts as noOp; V3PluginWrapper replaces it with the
        // real hook-backed API on first render.
        const scorePlayerRef: { current: ReturnType<typeof createNoOpScorePlayer> } = {
          current: createNoOpScorePlayer(),
        };
        const internalRef: V3ProxyRefs['internalRef'] = { current: null };
        // Feature 035: metronomeRef starts as noOp; V3PluginWrapper replaces it
        // with the real hook-backed useMetronomeBridge API on first render.
        const metronomeRef: V3ProxyRefs['metronomeRef'] = { current: createNoOpMetronome() };
        v3ProxyRefsMap.current.set(manifest.id, { scorePlayerRef, internalRef, metronomeRef });
        const BoundScoreRenderer = createBoundScoreRenderer(internalRef);

        const context: PluginContext = {
          emitNote: (event) => {
            // Note events are handled inside the plugin's own view for US1.
            // Future: wire to WASM layout pipeline.
            console.debug('[PluginContext] emitNote from', manifest.id, event)
          },
          playNote: (event) => {
            // Delegate audio playback to the host's ToneAdapter (Salamander piano).
            // Only play if the adapter is already initialised — pre-warm is triggered
            // by handleSelectPlugin so samples should be loaded before the first
            // keypress. Skipping while loading prevents notes queueing up and
            // firing all at once when init finally completes.
            const adapter = ToneAdapter.getInstance()
            if (!adapter.isInitialized()) return
            if (event.type === 'release') {
              adapter.releaseNote(event.midiNote)
              return
            }
            // Feature 031 / R-002: offsetMs — deferred scheduled playback.
            // Register handles in pluginTimersRef so stopPlayback() can cancel.
            // Uses attackNote + a release setTimeout instead of Transport.schedule
            // so notes always play regardless of whether the Tone.js Transport is
            // running (the Transport is only started by score playback, not plugins).
            if (event.offsetMs && event.offsetMs > 0) {
              if (!pluginTimersRef.current.has(manifest.id)) {
                pluginTimersRef.current.set(manifest.id, new Set())
              }
              const timers = pluginTimersRef.current.get(manifest.id)!
              const duration = event.durationMs ?? 500
              const attackTimer = setTimeout(() => {
                timers.delete(attackTimer)
                adapter.attackNote(event.midiNote, event.velocity ?? 64)
                const releaseTimer = setTimeout(() => {
                  timers.delete(releaseTimer)
                  adapter.releaseNote(event.midiNote)
                }, duration)
                timers.add(releaseTimer)
              }, event.offsetMs)
              timers.add(attackTimer)
            } else {
              adapter.attackNote(event.midiNote, event.velocity ?? 64)
            }
          },
          // Feature 031 / R-003: Cancel all pending scheduled notes for this plugin
          // and silence any currently playing notes.
          stopPlayback: () => {
            const timers = pluginTimersRef.current.get(manifest.id)
            if (timers) {
              timers.forEach(clearTimeout)
              timers.clear()
            }
            ToneAdapter.getInstance().stopAll()
          },
          // Dismiss this plugin and return to the main app view.
          // Core plugins call this from their own UI instead of relying on the
          // host back-bar (which is hidden for core plugins).
          close: () => {
            // Exit browser native fullscreen if active
            document.exitFullscreen?.().catch(() => {})
            setActivePlugin(null)
          },
          // Feature 031 / R-001: Microphone pitch subscription — delegated to
          // the singleton PluginMicBroadcaster (one shared stream, many subscribers).
          recording: {
            subscribe: (handler) => pluginMicBroadcaster.subscribe(handler),
            onError: (handler) => pluginMicBroadcaster.onError(handler),
            stop: () => pluginMicBroadcaster.stop(),
          },
          components: {
            // Host-provided notation staff — plugins use this to visualise notes
            // without importing the layout engine or score types directly.
            StaffViewer: PluginStaffViewer,
            // Host-provided score renderer (v3). Backed by proxy — the real
            // ScoreRendererPlugin implementation is wired by V3PluginWrapper
            // after the bridge hook is called inside TempoStateProvider.
            ScoreRenderer: BoundScoreRenderer,
            // Host-provided score selection dialog (v4 — Feature 034).
            // Renders the preloaded catalogue + "Load from file" option.
            ScoreSelector: ScoreSelectorPlugin,
          },
          // v3 score player — proxy that delegates to hook-backed implementation
          // once V3PluginWrapper sets scorePlayerRef.current = bridge.api.
          // v2 plugins: noOp stub is visible but never called (no play-score UI).
          scorePlayer: createScorePlayerProxy(scorePlayerRef),
          // Feature 035: metronome — proxy delegates to hook-backed useMetronomeBridge
          // once V3PluginWrapper sets metronomeRef.current = metronomeApi.
          metronome: createMetronomeProxy(metronomeRef),
          midi: {
            subscribe: (handler) => {
              midiPluginSubscribersRef.current.add(handler)
              return () => { midiPluginSubscribersRef.current.delete(handler) }
            },
          },
          manifest,
        }
        plugin.init(context)
      })

      // Feature 036: sort plugins by manifest.order before setting state
      setAllPlugins(sortPluginsByOrder(entries))
    }

    loadPlugins()
  }, [pluginsVersion])

  // Feature 030: Navigate to a plugin view (clears other view flags)
  const handleSelectPlugin = useCallback((pluginId: string) => {
    setActivePlugin(pluginId)
    setShowRecording(false)
    // Apply fullscreen-play immediately (synchronous, before React re-render) so
    // that even if ScoreViewer's unmount cleanup removes the class afterwards,
    // the useEffect below will re-add it on the next commit.
    const entry = allPlugins.find(p => p.manifest.id === pluginId)
    if (entry?.manifest.view === 'full-screen') {
      document.body.classList.add('fullscreen-play')
      // Browser native fullscreen — must be called in the user-gesture (onClick)
      // context. iOS Safari doesn't support this; the CSS fallback handles it.
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
    // Pre-warm the audio engine as soon as the user navigates to any plugin view.
    // This starts loading Salamander samples immediately so they are ready by the
    // time the user presses a key. The gesture of clicking a nav entry satisfies
    // the browser autoplay policy.
    ToneAdapter.getInstance().init().catch(() => {})
  }, [allPlugins])

  // T024: Handle successful plugin import — close the dialog and re-run loadPlugins
  // to dynamically load the newly installed module from IndexedDB.
  const handleImportComplete = useCallback(() => {
    setShowImporter(false)
    setPluginsVersion(v => v + 1)
  }, [])

  const handleRemoveComplete = useCallback((removedId: string) => {
    if (activePlugin === removedId) setActivePlugin(null)
    setPluginsVersion(v => v + 1)
  }, [activePlugin])

  // Show loading state while WASM initializes
  if (wasmLoading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>
            <span className="app-title-initial">G</span>raditone{' '}
            <a 
              href="https://github.com/aylabs/graditone" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                fontSize: '0.375em', 
                color: '#999', 
                fontWeight: 'normal',
                textDecoration: 'none'
              }}
            >
              v{packageJson.version}
            </a>
          </h1>
        </header>
        <main style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '60vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '2rem' }}>🎼</div>
          <p>Loading music engine...</p>
        </main>
      </div>
    )
  }

  // Show error state if WASM fails to initialize
  if (wasmError) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>
            <span className="app-title-initial">G</span>raditone{' '}
            <a 
              href="https://github.com/aylabs/graditone" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                fontSize: '0.375em', 
                color: '#999', 
                fontWeight: 'normal',
                textDecoration: 'none'
              }}
            >
              v{packageJson.version}
            </a>
          </h1>
        </header>
        <main style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '60vh',
          flexDirection: 'column',
          gap: '1rem',
          padding: '2rem'
        }}>
          <div style={{ fontSize: '2rem', color: '#f44336' }}>⚠️</div>
          <h2 style={{ color: '#333' }}>Failed to Initialize Music Engine</h2>
          <p style={{ maxWidth: '600px', textAlign: 'center', color: '#333' }}>
            {wasmError?.includes('fetch') ? (
              <>
                <strong>Offline First Launch Detected</strong>
                <br /><br />
                This app requires <strong>one online visit</strong> to download the music engine before offline mode works.
                <br /><br />
                Please connect to the internet and reload the page.
              </>
            ) : (
              <>
                Your browser may not support WebAssembly, or there was an error loading the music engine.
              </>
            )}
          </p>
          <details style={{ maxWidth: '600px', marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#333' }}>Error Details</summary>
            <pre style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#f5f5f5', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.875rem',
              textAlign: 'left',
              color: '#333'
            }}>
              {wasmError}
            </pre>
          </details>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
            {wasmError?.includes('fetch') 
              ? 'After one online visit, all features work offline.' 
              : 'Try using a modern browser like Chrome, Firefox, Safari, or Edge.'
            }
          </p>
        </main>
      </div>
    )
  }

  // Normal app render once WASM is ready
  
  // Feature 001-recording-view: Show RecordingView when navigated to from ScoreViewer
  if (showRecording) {
    return (
      <RecordingView onBack={() => { setShowRecording(false); }} />
    )
  }

  // Core plugin fullscreen — early return replaces the entire app tree,
  // exactly like the old PracticeView / RecordingView pattern (position: fixed + inset: 0).
  if (activePlugin) {
    const coreEntry = allPlugins.find(p => p.manifest.id === activePlugin)
    if (coreEntry?.manifest.view === 'full-screen') {
      const FullScreenComponent = coreEntry.plugin.Component
      const isV3 = Number(coreEntry.manifest.pluginApiVersion) >= 3
      const proxyRefs = v3ProxyRefsMap.current.get(coreEntry.manifest.id)

      const innerContent = (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ls-bg, #fff)',
          zIndex: 100,
        }}>
          {isV3 && proxyRefs ? (
            // v3: V3PluginWrapper calls useScorePlayerBridge() and keeps proxy refs current.
            // Must be inside TempoStateProvider (added below).
            <V3PluginWrapper plugin={coreEntry.manifest} proxyRefs={proxyRefs}>
              <FullScreenComponent />
            </V3PluginWrapper>
          ) : (
            // v2: plain error boundary, no hook-based context injection needed.
            <PluginView plugin={coreEntry.manifest}>
              <FullScreenComponent />
            </PluginView>
          )}
        </div>
      )

      // v3 plugins need TempoStateProvider for useScorePlayerBridge (→ useTempoState).
      // v2 plugins don't use TempoState so we skip the provider for backward compat.
      return isV3 ? <TempoStateProvider>{innerContent}</TempoStateProvider> : innerContent
    }
  }

  return (
    <TempoStateProvider>
      <FileStateProvider>
        <div className="app">
          <OfflineBanner />
          <header className="app-header">
            <div className="app-header-brand">
              <div className="app-header-title-row">
                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Graditone logo" className="app-logo" />
                <h1>
                  <span className="app-title-initial">G</span>raditone{' '}
                  <a
                    href="https://github.com/aylabs/graditone"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.375em',
                      color: '#999',
                      fontWeight: 'normal',
                      textDecoration: 'none'
                    }}
                  >
                    v{packageJson.version}
                  </a>
                </h1>
              </div>
              <p className="app-slogan">The open platform for musical practice</p>
            </div>
            {/* Feature 030: Plugin navigation entries */}
            <nav
              aria-label="Installed plugins"
              className="plugin-nav"
            >
              {allPlugins.filter(p => p.manifest.type !== 'core' && !p.manifest.hidden).map(({ manifest }) => (
                <PluginNavEntry
                  key={manifest.id}
                  plugin={manifest}
                  isActive={activePlugin === manifest.id}
                  onSelect={() => handleSelectPlugin(manifest.id)}
                />
              ))}
            </nav>
            {/* T025: Plugin management buttons — always at the right edge */}
            <div className="plugin-manage-btns">
              <button
                type="button"
                aria-label="Import Plugin"
                title="Import Plugin"
                onClick={() => setShowImporter(true)}
                className="plugin-manage-btn"
              >
                +
              </button>
              <button
                type="button"
                aria-label="Remove Plugin"
                title="Remove Plugin"
                onClick={() => setShowRemover(true)}
                className="plugin-manage-btn"
              >
                −
              </button>
            </div>
          </header>
          {/* T024: Plugin importer dialog overlay */}
          {showImporter && (
            <PluginImporterDialog
              onImportComplete={handleImportComplete}
              onClose={() => setShowImporter(false)}
            />
          )}
          {showRemover && (
            <PluginRemoverDialog
              importedPlugins={allPlugins
                .map(e => e.manifest)
                .filter(m => m.origin === 'imported' && !m.hidden)}
              onRemoveComplete={(id) => { handleRemoveComplete(id); setShowRemover(false); }}
              onClose={() => setShowRemover(false)}
            />
          )}
          <main>
            {!activePlugin && (
              <ScoreViewer
                debugMode={debugMode}
                onShowRecording={() => { setShowRecording(true); setActivePlugin(null); }}
                corePlugins={allPlugins
                  .filter(p => p.manifest.type === 'core' && !p.manifest.hidden)
                  .map(p => ({ id: p.manifest.id, name: p.manifest.name, icon: p.manifest.icon }))}
                onLaunchPlugin={handleSelectPlugin}
                activeThemeId={activeThemeId}
                onThemeChange={handleThemeChange}
                showThemeNavbar={showThemeNavbar}
              />
            )}
          </main>
          {activePlugin && (() => {
            // Core plugins are handled by the early return above — this overlay
            // is only for non-core (common) plugins.
            const entry = allPlugins.find(p => p.manifest.id === activePlugin)
            if (!entry) return null
            const PluginComponent = entry.plugin.Component
            const isV3Common = Number(entry.manifest.pluginApiVersion) >= 3
            const proxyRefsCommon = v3ProxyRefsMap.current.get(entry.manifest.id)
            const innerPluginContent = (
              <div style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                backgroundColor: 'var(--ls-bg, #fff)',
              }}>
                {isV3Common && proxyRefsCommon ? (
                  // v3+ common plugins: wire up the score player proxy via V3PluginWrapper.
                  // Without this, getCatalogue() returns [] and loadScore() is a no-op
                  // because scorePlayerRef stays on the createNoOpScorePlayer() stub.
                  <V3PluginWrapper plugin={entry.manifest} proxyRefs={proxyRefsCommon}>
                    <PluginComponent />
                  </V3PluginWrapper>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 12px',
                        background: 'var(--ls-navbar-bg, #f5f5f5)',
                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setActivePlugin(null)}
                        aria-label="Return to score viewer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--ls-bg, #fff)',
                          border: '1px solid rgba(0,0,0,0.18)',
                          borderRadius: '6px',
                          color: 'var(--ls-heading, #333)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '5px 12px',
                          minHeight: '32px',
                          cursor: 'pointer',
                        }}
                      >
                        ← Back
                      </button>
                      <span style={{ color: 'var(--ls-body, #666)', fontSize: '0.8rem' }}>
                        {entry.manifest.name}
                      </span>
                    </div>
                    <PluginView plugin={entry.manifest}>
                      <PluginComponent />
                    </PluginView>
                  </>
                )}
              </div>
            )
            return innerPluginContent
          })()}
          <IOSInstallModal />
        </div>
      </FileStateProvider>
    </TempoStateProvider>
  )
}

export default App

