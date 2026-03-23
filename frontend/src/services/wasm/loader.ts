// WASM Loader - Feature 011-wasm-music-engine
// Handles WASM module initialization and loading

// WASM module interface - represents the exported functions from Rust
interface WasmModule {
  default: () => Promise<void>;
  // Phase 3: MusicXML Parsing
  parse_musicxml: (xmlContent: string) => unknown;
  // Phase 4: Domain Operations
  create_score: (title?: string) => unknown;
  add_instrument: (score: unknown, name: string) => unknown;
  add_staff: (score: unknown, instrumentId: string) => unknown;
  add_voice: (score: unknown, staffId: string) => unknown;
  add_note: (score: unknown, voiceId: string, note: unknown) => unknown;
  add_tempo_event: (score: unknown, tick: number, bpm: number) => unknown;
  add_time_signature_event: (score: unknown, tick: number, numerator: number, denominator: number) => unknown;
  add_clef_event: (score: unknown, staffId: string, tick: number, clefType: string) => unknown;
  add_key_signature_event: (score: unknown, staffId: string, tick: number, key: string) => unknown;
  // Layout Engine - returns JsValue (JavaScript object) via serde-wasm-bindgen
  compute_layout_wasm: (scoreJson: string, configJson: string) => unknown;
  // Schema version
  get_schema_version: () => number;
}

let wasmModule: WasmModule | null = null;
let wasmInitialized = false;
let initializationPromise: Promise<WasmModule> | null = null;

/**
 * Initialize the WASM module
 * @returns Promise that resolves with the initialized WASM module
 * @throws Error if WASM initialization fails
 */
export async function initWasm(): Promise<WasmModule> {
  // Return existing initialization if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return cached module if already initialized
  if (wasmInitialized && wasmModule) {
    return wasmModule;
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      // Load WASM module - in production, this is in /wasm/ directory
      // The JS bindings will automatically load the .wasm file from the same directory
      // Use BASE_URL to support deployment to subdirectories (e.g., GitHub Pages project sites)
      const basePath = import.meta.env.BASE_URL.endsWith('/') 
        ? import.meta.env.BASE_URL 
        : `${import.meta.env.BASE_URL}/`;
      
      // WASM versioning: Service worker precache uses revision hashes for cache invalidation.
      // Do NOT add Date.now() or random cache busters — they create unique URLs that
      // the service worker cannot match to precached entries, breaking offline mode.
      // When WASM binary changes, rebuild frontend → new SW revision hash handles invalidation.
      const jsUrl = new URL(`${basePath}wasm/musicore_backend.js`, window.location.origin);
      const wasmUrl = new URL(`${basePath}wasm/musicore_backend_bg.wasm`, window.location.origin);
      
      console.log('[WASM] Loading module:', { jsUrl: jsUrl.href, wasmUrl: wasmUrl.href });
      
      // Dynamically import the JS bindings
      const wasm = await import(/* @vite-ignore */ jsUrl.href) as WasmModule;
      
      // Initialize the WASM module
      // Note: The wasm.default() function auto-loads the .wasm file from the same directory
      // The ?v= cache-buster on the JS URL should propagate to the WASM fetch
      await wasm.default();
      
      wasmModule = wasm;
      wasmInitialized = true;
      
      console.log('[WASM] Music engine initialized successfully');
      return wasmModule;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[WASM] Failed to initialize music engine:', errorMessage);
      throw new Error(`WASM initialization failed: ${errorMessage}`);
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Get the initialized WASM module
 * @returns The WASM module or null if not initialized
 */
export function getWasmModule(): WasmModule | null {
  if (!wasmInitialized) {
    console.warn('[WASM] getWasmModule called before initialization');
    return null;
  }
  return wasmModule;
}

/**
 * Check if WASM is initialized
 * @returns true if WASM module is ready to use
 */
export function isWasmInitialized(): boolean {
  return wasmInitialized;
}

/**
 * Reset WASM initialization state (useful for testing)
 */
export function resetWasmState(): void {
  wasmModule = null;
  wasmInitialized = false;
  initializationPromise = null;
}
