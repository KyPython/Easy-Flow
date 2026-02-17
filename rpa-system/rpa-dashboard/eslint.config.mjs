import globals from "globals";
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    // Keep rules empty here; use the local .eslintrc.cjs in this package to enable plugin rules.
    rules: {},
  },
  // TypeScript-specific override: use the TypeScript parser for .ts/.tsx files
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': {},
    },
    rules: {
      // Minimal rule set to allow parsing; full rules are configured in .eslintrc.js
    },
  },
];
