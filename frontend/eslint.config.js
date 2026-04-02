import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'build', 'coverage', 'node_modules', '**/*.min.js']),
  // Feature 030: lint-test/ is an intentional ESLint boundary violation fixture.
  // Exclude it from the global lint run (verify it manually with:
  //   npx eslint plugins/lint-test/ — expected: 1 no-restricted-imports error).
  globalIgnores(['plugins/lint-test/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow unused variables/parameters prefixed with '_' (common convention for intentionally unused)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  // Relaxed rules for test files
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/globals': 'off',
    },
  },
  // Feature 030: Plugin API boundary enforcement (T003 / FR-001 / SC-004 / SC-008)
  // Plugin code may ONLY import from ../../src/plugin-api — all other host internals are forbidden.
  // Enforcement is static (lint-time); see specs/030-plugin-architecture/research.md R-003.
  //
  // NOTE: ESLint 9 flat config requires the simple string-array "patterns" form for
  // no-restricted-imports. The object form {group, message} is handled by
  // @typescript-eslint/no-restricted-imports if needed in future.
  {
    files: ['plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: ['../../src/components/*', '../../src/services/*', '../../src/pages/*', '../../src/data/*', '../../src/utils/*', '../../src/hooks/*'],
      }],
    },
  },
])
