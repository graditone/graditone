import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // HTTPS is only needed for local dev (getUserMedia requires a secure context
  // on LAN / Android). Disable for:
  //   - `vite preview` (used by CI / playwright.config.prod.ts)
  //   - CI builds
  //   - Playwright dev runs (PLAYWRIGHT_TEST=1) so the webServer health-check
  //     can reach the server over plain HTTP without TLS cert issues.
  const useHttps = command === 'serve' && !process.env.CI && !process.env.PLAYWRIGHT_TEST;

  return {
  // Base path for GitHub Pages deployment
  // For user/org pages: base: '/'
  // For project pages: base: '/repository-name/'
  base: process.env.VITE_BASE || '/',
  
  // Dev server configuration - listen on all interfaces for mobile testing
  server: {
    host: '0.0.0.0',  // Listen on all network interfaces
    port: 5173,       // Default Vite port
    ...(useHttps ? { https: {} } : {}),  // Self-signed cert via @vitejs/plugin-basic-ssl
  },
  
  plugins: [
    ...(useHttps ? [basicSsl()] : []),
    react(),
    // PWA plugin configuration
    VitePWA({
      registerType: 'autoUpdate',  // Auto-install updates on reload
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png', 'wasm/*'],
      manifest: {
        name: 'Graditone',
        short_name: 'Graditone',
        description: 'Tablet-native app for interactive scores, designed for practice and performance. Display scores, control tempo, navigate with ease - even offline.',
        theme_color: '#6366f1',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'any',
        // scope and start_url are automatically set by vite-plugin-pwa based on base path
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['music', 'education', 'productivity'],
      },
      workbox: {
        // Precache all static assets (T008)
        // Feature 025: Added woff2 for Bravura fonts, mp3 for audio samples
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,musicxml,mxl,woff2,mp3}'],
        
        // Runtime caching strategies (T007)
        runtimeCaching: [
          {
            // Network-first for score data
            urlPattern: /\/api\/scores\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'graditone-scores-v2',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                purgeOnQuotaError: true,  // Auto-evict if quota exceeded
              },
            },
          },
          {
            // Stale-while-revalidate for images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'graditone-images-v2',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            // Cache-first for fonts
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'graditone-fonts-v2',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
        ],
        
        // Clean up old caches (T009)
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,  // Disable in dev mode - use Vite HMR instead (T010)
      },
    }),
    // Note: WASM files are copied manually in Dockerfile for Docker builds
    // For local development, run `npm run build:wasm` first
  ],
  // Enable top-level await for WASM initialization
  build: {
    target: 'esnext'
  }
  };
})
