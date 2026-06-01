import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // TypeScript itself checks for undefined identifiers, and core no-undef
      // does not understand TS ambient globals (NodeJS, the GIS `google`, etc.).
      'no-undef': 'off',
      // These are pre-existing patterns in the prototype; surface them as
      // warnings rather than hard failures so the gate stays green while the
      // codebase is incrementally tightened.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Browser shim loaded before the bundler; plain JS with browser globals.
    files: ['**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  {
    // TypeScript + the browser shim both manage their own globals; core
    // no-undef produces false positives (NodeJS namespace, btoa, GIS google).
    rules: {
      'no-undef': 'off',
    },
  },
);
