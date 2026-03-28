import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',              // Playwright tests — run via `playwright test`, not vitest
      '**/tests/visual/**',     // Playwright visual regression tests — run via `playwright test`
      // External plugins symlinked for local dev — they have their own test suite
      'plugins/virtual-keyboard-pro/**',
      'plugins/sessions-plugin/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
